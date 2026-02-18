# MVP on‑prem NVR + portal web tipo SaaS para 2 cámaras con respaldo nocturno a Google Drive

## Resumen ejecutivo

Este reporte define un MVP (producto mínimo viable) para un sistema **on‑prem** de videovigilancia con **2 cámaras RTSP** bajo el **Modelo A** (el servidor graba directamente), más un **portal web** (tipo SaaS interno) para acceso multi‑admin, y un **respaldo nocturno automatizado a Google Drive** (Opción 1) con verificación de integridad. Se prioriza que la grabación funcione aun sin Internet, y que el acceso remoto sea seguro (preferentemente por VPN). 

La arquitectura recomendada separa claramente:  
- **Ingesta + NVR (Frigate)**: consume RTSP/ONVIF/RTSP de cámaras y guarda grabación (sin re‑codificar) y evidencias (eventos, snapshots, clips). Las grabaciones se guardan en `/media/frigate/recordings` con estructura por fecha/hora en **UTC**, y snapshots en `/media/frigate/clips`. citeturn0search3turn0search28  
- **Portal web (frontend + backend)**: la web no “sirve video” desde la base de datos; guarda **metadata** en PostgreSQL y referencias a archivos (paths/URLs) y a IDs de eventos.  
- **Respaldo nocturno (rclone)**: copia (o sincroniza) directorios “del día” hacia Google Drive, opcionalmente **cifrando** con `crypt` y verificando con `rclone check` (hashes/tamaños). citeturn1search3turn1search7turn4search3turn1search29  
- **Seguridad**: RBAC (SuperAdmin/Admin/ReadOnly), MFA (TOTP), TLS al portal, auditoría, y exposición mínima (cámaras aisladas en VLAN; el NVR no expone puertos sin necesidad; acceso remoto por WireGuard). citeturn8search0turn8search1turn3search18turn11search0  

**Conclusión práctica**: con tu PC (Ryzen 5 7600X, 32 GB RAM, GPU RTX), el MVP de 2 cámaras es totalmente viable. Para rendimiento estable: usar **stream de detección** a 5 fps (máx. 10) y resolución ajustada, y dejar el stream de grabación a mayor calidad; Frigate recomienda ese patrón. citeturn4search31  

A nivel costos, el “mínimo serio” incluye: 2 cámaras PoE, switch PoE, cableado, disco dedicado para grabación, y UPS (muy recomendable). Los precios varían por tienda, pero se anexan rangos con referencias actuales en México. citeturn9search1turn9search6turn9search7turn9search15  

## Arquitectura propuesta y flujo de datos

### Diagrama de alto nivel

```mermaid
flowchart TD
  subgraph CamNet["Red Cámaras (VLAN aislada, sin Internet)"]
    C1["Cam 1 (RTSP)"] -->|RTSP| NVR
    C2["Cam 2 (RTSP)"] -->|RTSP| NVR
  end

  subgraph Host["Servidor on-prem (tu PC)"]
    NVR["Frigate (ingesta + detección + grabación)"]
    DB["PostgreSQL (metadata)"]
    OBJ["Objeto local o MinIO (evidencias exportadas)"]
    API["Backend FastAPI (RBAC/MFA/auditoría/API)"]
    UI["Frontend (Web portal)"]
    RP["Reverse proxy (Caddy/Nginx) TLS"]
    BAK["Job nocturno rclone (Drive + crypt + check)"]
  end

  subgraph Remote["Nube"]
    GDrive["Google Drive (backup cifrado opcional)"]
  end

  NVR -->|HTTP API / polling| API
  API --> DB
  API --> OBJ
  UI --> RP --> API
  BAK -->|rclone copy/sync| GDrive
  BAK -->|lee| NVR
  BAK -->|lee| OBJ
```

### Flujo de video y eventos

**Protocolos y compatibilidad de cámaras**  
- RTSP es un protocolo de control para entrega de datos con propiedades de tiempo real; en la práctica, es el estándar de facto para “jalar” video desde cámaras IP. citeturn2search1turn2search13  
- ONVIF existe para interoperabilidad en seguridad física; el Perfil S se diseñó para sistemas de video IP y cubre descubrimiento/streaming/control sobre IP (comúnmente RTSP para video). citeturn2search4turn2search0  

**Eventos**  
Tienes dos rutas válidas para poblar tu SaaS con eventos:  
- **Polling HTTP** a endpoints de eventos (más simple para MVP). Frigate expone `/api/events` y endpoints por `event_id` para `clip.mp4` y `snapshot.jpg`. citeturn1search0turn1search17turn1search5  
- **Feed MQTT** (más “real‑time”). El tópico `frigate/events` publica JSON por objeto rastreado; incluye `type: new/update/end` y puede incluir `recognized_license_plate` (si integras lectura de placas). citeturn7view0  

En este MVP (2 cámaras), se recomienda **Polling HTTP** primero (menos servicios). MQTT puede agregarse después.

## Diseño Docker Compose y servicios

### Servicios base del MVP

- NVR: Frigate (ingesta/recording/detect). Recordings en `/media/frigate/recordings` y snapshots/clips en `/media/frigate/clips`. citeturn0search3turn0search28  
- Backend: FastAPI con auth JWT + hashing (baseline de seguridad) y endpoints REST. citeturn1search2turn1search36  
- DB: PostgreSQL para metadata (usuarios, roles, eventos, auditoría, exportaciones).  
- Object store:  
  - MVP: **filesystem local** (más simple).  
  - Opcional: MinIO (S3-compatible) para “evidence vault”, pre‑signed URLs y aislamiento. MinIO se describe como object storage S3‑compatible y está bajo licencia AGPLv3. citeturn2search10turn2search14  
- Reverse proxy: Caddy o Nginx. Con Caddy, el enfoque destacado es HTTPS automático (certificados y renovación) cuando hay dominio accesible. citeturn0search12turn0search15  
- Backup: rclone nocturno a Google Drive. rclone `sync` puede borrar en destino si el origen ya no tiene archivos; se debe usar con cuidado y probar con `--dry-run`. citeturn1search29  
- VPN opcional: WireGuard (ideal para acceso remoto sin abrir puertos a Internet). WireGuard se basa en intercambio de llaves públicas y busca ser simple de desplegar. citeturn3search18turn3search3  

### Consideraciones clave de Frigate para Docker

- Puertos:  
  - `8971`: UI/API autenticada (sin TLS) y **se recomienda para reverse proxy**. citeturn11search0turn5search22  
  - `5000`: UI/API interna **no autenticada**, ideal solo dentro de la red Docker (no exponer). citeturn11search0turn5search22  
- Memoria compartida: Frigate usa `shm` para frames. La doc indica que 64 MB es suficiente para 2 cámaras a 720p (detección); además, logs pueden consumir ~30 MB, así que conviene sobredimensionar. citeturn11search22turn0search33  

### Docker Compose propuesto (listo para repo)

> Nota operativa: este compose asume host Linux. En Windows, lo estable es correrlo en WSL2 o migrar el “NVR host” a Linux para 24/7.

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: nvr_portal
      POSTGRES_USER: nvr
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nvr -d nvr_portal"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [core]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - ./data/minio:/data
    ports:
      - "9001:9001" # consola (solo LAN/VPN)
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 10
    networks: [core]

  frigate:
    image: ghcr.io/blakeblackshear/frigate:stable
    shm_size: "256mb"
    volumes:
      - ./infra/frigate/config.yml:/config/config.yml:ro
      - ./data/frigate:/media/frigate
      - /etc/localtime:/etc/localtime:ro
    ports:
      - "8971:8971" # solo LAN/VPN; reverse proxy apunta aquí
    restart: unless-stopped
    networks: [core, cameras]

  backend:
    build:
      context: ./backend
    environment:
      DATABASE_URL: postgresql+psycopg://nvr:${POSTGRES_PASSWORD}@postgres:5432/nvr_portal
      FRIGATE_BASE_URL: http://frigate:5000
      MINIO_ENDPOINT: http://minio:9000
      MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY}
      MINIO_SECRET_KEY: ${MINIO_SECRET_KEY}
      JWT_SECRET: ${JWT_SECRET}
      MFA_ENCRYPTION_KEY: ${MFA_ENCRYPTION_KEY}
      TZ: America/Mexico_City
    depends_on:
      postgres:
        condition: service_healthy
    networks: [core]
    restart: unless-stopped

  frontend:
    build:
      context: ./frontend
    environment:
      NEXT_PUBLIC_API_BASE: /api
    networks: [core]
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - ./data/caddy/data:/data
      - ./data/caddy/config:/config
    networks: [core]
    restart: unless-stopped

  backup:
    build:
      context: ./infra/rclone
    environment:
      TZ: America/Mexico_City
      XDG_CONFIG_HOME: /config
      RCLONE_CONFIG_PASS: ${RCLONE_CONFIG_PASS}
      SOURCE_DIR: /source
      DEST_REMOTE: ${RCLONE_DEST_REMOTE}
      DEST_PATH: ${RCLONE_DEST_PATH}
      RETENTION_DAYS: "14"
    volumes:
      - ./data/frigate:/source/frigate:ro
      - ./data/evidence:/source/evidence:ro
      - ./infra/rclone/config:/config
      - ./data/backup-logs:/logs
    networks: [core]
    restart: unless-stopped

  wg-easy:
    image: ghcr.io/wg-easy/wg-easy:latest
    environment:
      WG_HOST: ${WG_HOST}
      PASSWORD: ${WG_EASY_PASSWORD}
    volumes:
      - ./data/wireguard:/etc/wireguard
    ports:
      - "51820:51820/udp"
      - "51821:51821"
    cap_add:
      - NET_ADMIN
      - SYS_MODULE
    sysctls:
      - net.ipv4.ip_forward=1
      - net.ipv4.conf.all.src_valid_mark=1
    networks: [core]
    restart: unless-stopped
    profiles: ["vpn"]

networks:
  core: {}
  cameras:
    internal: true
```

**Justificación de decisiones**  
- Se intenta que la red `cameras` sea **interna** para evitar “salidas” innecesarias (aunque el contenedor necesita salir a la red física para jalar RTSP de cámaras; en algunos hosts, esto se resuelve con rutas/VLAN en el host, no desde Docker). La lógica de “aislamiento real” se logra más confiablemente con VLAN y firewall en el router/switch, no solo con la red Docker.  
- Se expone solamente `8971` (Frigate “authenticated UI/API”) y se evita `5000` (interno no autenticado). citeturn11search0turn5search22  
- Se usa `shm_size` 256 MB para evitar errores y absorber overhead de logs; la doc da referencia mínima para 2 cámaras a 720p. citeturn11search22turn0search33  
- El reverse proxy usa TLS; Caddy facilita HTTPS automático por defecto (si hay dominio). citeturn0search12  

## Almacenamiento, layout de carpetas y respaldo nocturno

### Layout de almacenamiento (on‑prem)

**Frigate (volumen `./data/frigate`)**  
- `/media/frigate/recordings`  
  - Guardado por fecha/hora en UTC: `YYYY-MM-DD/HH/<camera_name>/MM.SS.mp4` (sin re‑codificar). citeturn0search3  
- `/media/frigate/clips`  
  - Snapshots: `<camera>-<id>.jpg` accesibles también por API. citeturn0search28  

**Evidence vault (MVP)**  
- `./data/evidence/exports/YYYY-MM-DD/`  
  - `export_<evidence_id>.mp4`  
  - `export_<evidence_id>.sha256` (hash)  
  - `manifest_<evidence_id>.json` (cadena de custodia)

**Importante sobre “día”**  
Frigate organiza recordings por **UTC**, no por tu zona horaria. citeturn0search3  
Eso implica que un “día local” (America/Mexico_City) no coincide 1:1 con el folder `YYYY-MM-DD` de recordings. Para MVP, hay dos enfoques:

- Enfoque simple (recomendado para arrancar): respaldar por “día UTC” tal cual lo guarda Frigate.  
- Enfoque exacto (mejor UX): crear un “daily bundle” por día local (requiere lógica adicional).

### Respaldo nocturno a Google Drive con rclone (Opción 1)

**Configuración de Google Drive en rclone**  
rclone para Drive se configura con `rclone config` y obtiene un token en navegador. citeturn1search3  

**Cifrado antes de subir (muy recomendado)**  
Para no depender de permisos/compartición de Drive como capa “de seguridad”, se recomienda usar `crypt`, que cifra contenido y nombres al transferir. citeturn1search7  

**Verificación de integridad**  
- `rclone check` compara tamaños y hashes (MD5/SHA1) y no altera origen/destino. citeturn4search3  
- Google Drive expone `md5Checksum` para archivos binarios vía su API, lo que se alinea con verificaciones de integridad en herramientas como rclone. citeturn4search2  

**Retención en Google Drive**  
Si respaldas 24/7 de 2 cámaras, el volumen sube rápido. Por eso el job debe aplicar una política (p. ej., 14 días) y/o limitar qué se sube (solo eventos vs 24/7).

### Diseño del contenedor de backup + cron

**infra/rclone/Dockerfile**

```dockerfile
FROM rclone/rclone:latest
RUN apk add --no-cache bash tzdata coreutils findutils
WORKDIR /work
COPY backup.sh /work/backup.sh
COPY crontab /etc/crontabs/root
RUN chmod +x /work/backup.sh
CMD ["crond", "-f", "-l", "8"]
```

Este patrón es viable porque la imagen oficial de rclone está basada en Alpine e instala paquetes con `apk`. citeturn13view0turn12search1  

**infra/rclone/crontab** (ejecuta a las 02:10 diario)

```cron
10 2 * * * /work/backup.sh >> /logs/backup.log 2>&1
```

**infra/rclone/backup.sh** (copia por día UTC + check + retención)

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DIR:?SOURCE_DIR requerido}"
: "${DEST_REMOTE:?DEST_REMOTE requerido}"
: "${DEST_PATH:?DEST_PATH requerido}"
: "${RETENTION_DAYS:?RETENTION_DAYS requerido}"

UTC_DAY="$(date -u +%F)"          # hoy UTC
UTC_YDAY="$(date -u -d 'yesterday' +%F)"  # ayer UTC

SRC_RECORDINGS="${SOURCE_DIR}/frigate/recordings/${UTC_YDAY}"
SRC_CLIPS="${SOURCE_DIR}/frigate/clips"
SRC_EVID="${SOURCE_DIR}/evidence"

DEST="${DEST_REMOTE}:${DEST_PATH}"

echo "[INFO] Backup día UTC: ${UTC_YDAY}"
echo "[INFO] Source: ${SRC_RECORDINGS}"
echo "[INFO] Dest:   ${DEST}/${UTC_YDAY}"

# 1) Copiar recordings del día (ayer UTC) a Drive
# Usar 'copy' (no sync) para evitar borrados accidentales.
rclone copy "${SRC_RECORDINGS}" "${DEST}/recordings/${UTC_YDAY}" \
  --create-empty-src-dirs \
  --transfers=4 --checkers=8 --fast-list

# 2) Copiar clips/snapshots (pueden contener evidencia)
rclone copy "${SRC_CLIPS}" "${DEST}/clips" \
  --transfers=4 --checkers=8 --fast-list

# 3) Copiar evidence vault (exportaciones firmadas)
rclone copy "${SRC_EVID}" "${DEST}/evidence" \
  --transfers=4 --checkers=8 --fast-list

# 4) Verificar integridad (solo del folder recién copiado)
rclone check "${SRC_RECORDINGS}" "${DEST}/recordings/${UTC_YDAY}" \
  --one-way \
  --log-level INFO

# 5) Retención (borra en destino folders antiguos)
# rclone delete + filtro por antigüedad; alternativa: usar nombres y una rutina de "ls + purge".
rclone delete "${DEST}/recordings" --min-age "${RETENTION_DAYS}d" --rmdirs
rclone delete "${DEST}/clips" --min-age "${RETENTION_DAYS}d" --rmdirs
rclone delete "${DEST}/evidence" --min-age "${RETENTION_DAYS}d" --rmdirs

echo "[OK] Backup completado: ${UTC_YDAY}"
```

**Notas de rigor**  
- Se usa `copy` en vez de `sync` para reducir riesgo; `sync` está diseñado para “hacer espejo” y puede borrar en destino. citeturn1search29  
- En un sistema de seguridad, es preferible conservar evidencia y gestionar retención de forma explícita (borrado por antigüedad) en lugar de sincronizar borrados automáticamente.  
- La verificación con `rclone check` está documentada como comparación de tamaños/hashes sin modificar datos. citeturn4search3  

## Modelo de datos, ciclo de vida de eventos y API del portal

### Ciclo de vida de un evento en el MVP

1) **Cámara emite RTSP** y Frigate lo consume. RTSP controla el streaming en tiempo real. citeturn2search1  
2) Frigate ejecuta detección sobre el stream de “detect” (no necesita decodificar todo a máxima fps). Se recomienda 5 fps de detección; 10 fps suele ser el máximo recomendado. citeturn4search31turn3search12  
3) Frigate genera un **event_id** y expone:  
   - metadata con `/api/events` citeturn1search0  
   - snapshot por `/api/events/:event_id/snapshot.jpg` citeturn1search5  
   - clip por `/api/events/:event_id/clip.mp4` citeturn1search17  
4) El backend del portal **ingiere** eventos (polling) y los guarda en Postgres.  
5) Cuando un admin exporta evidencia, el backend descarga el clip (o frame) y genera **SHA‑256** (cadena de custodia) y lo almacena en el evidence vault (local o MinIO).

### Esquema Postgres propuesto (tablas mínimas)

**Principio**: Postgres guarda *metadata*, no video. Los archivos viven en filesystem/objeto.

Tablas recomendadas:

- `tenants` (por si el SaaS crece)  
  - `id (uuid pk)`, `name`, `created_at`
- `sites`  
  - `id`, `tenant_id`, `name`, `timezone` (America/Mexico_City)
- `users`  
  - `id`, `tenant_id`, `email`, `password_hash`, `role`, `is_active`, `created_at`, `last_login_at`
- `mfa_totp`  
  - `user_id pk`, `secret_enc`, `enabled`, `created_at`, `last_used_at`
- `cameras`  
  - `id`, `site_id`, `name`, `rtsp_url_redacted`, `enabled`, `created_at`
- `events`  
  - `id (uuid pk)`, `site_id`, `camera_id`, `frigate_event_id`, `label`, `sub_label`, `start_time`, `end_time`, `has_clip`, `has_snapshot`, `score`, `zones (jsonb)`, `raw (jsonb)`, `created_at`
- `evidence_exports`  
  - `id`, `event_id`, `requested_by`, `requested_at`, `object_store_uri`, `sha256`, `size_bytes`, `content_type`, `download_count`, `last_download_at`
- `audit_log`  
  - `id`, `site_id`, `actor_user_id`, `action`, `resource_type`, `resource_id`, `ip`, `user_agent`, `created_at`, `meta (jsonb)`
- `backup_runs`  
  - `id`, `started_at`, `finished_at`, `status`, `utc_day`, `bytes_sent`, `files_sent`, `errors (jsonb)`

### RBAC y MFA (TOTP) en el portal

- Roles:  
  - **SuperAdmin**: configura sistema, usuarios, retención, cámaras.  
  - **Admin**: ve, busca, exporta evidencia.  
  - **ReadOnly**: solo lectura (sin exportaciones).  

- MFA TOTP: TOTP está estandarizado por la IETF en RFC 6238. citeturn8search0  
- Buenas prácticas OWASP: cambios de factor MFA deben requerir re‑autenticación y auditarse. citeturn8search1turn8search13  

### API endpoints del portal (propuesta)

**Auth**
- `POST /api/auth/login` → JWT (y refresh opcional)  
- `POST /api/auth/logout`  
- `POST /api/auth/mfa/totp/enroll` → genera secreto + QR (otpauth://)  
- `POST /api/auth/mfa/totp/verify` → verifica código TOTP  
- `POST /api/auth/refresh` (opcional)

**Users (SuperAdmin)**
- `GET /api/users`  
- `POST /api/users`  
- `PATCH /api/users/{id}` (rol/estado)  
- `POST /api/users/{id}/reset-password`

**Cameras**
- `GET /api/cameras`  
- `POST /api/cameras`  
- `PATCH /api/cameras/{id}`  
- `DELETE /api/cameras/{id}`

**Events**
- `GET /api/events?camera_id=&from=&to=&label=&has_clip=`  
- `GET /api/events/{id}`  
- `POST /api/events/sync` (manual: fuerza polling contra Frigate)  

**Media proxy (sin exponer Frigate al usuario)**
- `GET /api/events/{id}/snapshot` → backend hace proxy desde `/api/events/:event_id/snapshot.jpg` citeturn1search5  
- `GET /api/events/{id}/clip` → proxy desde `/api/events/:event_id/clip.mp4` citeturn1search17  

**Evidence (cadena de custodia)**
- `POST /api/evidence/export` (body: event_id, format, reason)  
  - descarga clip, guarda en vault, calcula SHA‑256, registra auditoría  
- `GET /api/evidence/{id}/download` (solo Admin/SuperAdmin)  
- `GET /api/evidence/{id}/manifest` (incluye hash, timestamps, actor)

**Audit**
- `GET /api/audit?from=&to=&actor=&action=` (solo SuperAdmin)  

**Backups**
- `GET /api/backups/runs`  
- `GET /api/backups/runs/{id}`  

## Seguridad y hardening

### Canal seguro de acceso: VPN + TLS + mínima exposición

**VPN (recomendado)**  
Idealmente, el portal web y el NVR **no se exponen a Internet**; se acceden vía WireGuard (clientes: celulares/PCs de administradores). WireGuard enfatiza simplicidad de despliegue y llaves públicas tipo SSH. citeturn3search18turn3search3  

**TLS**  
- Caddy puede aprovisionar HTTPS automáticamente y renovar certificados (cuando hay un dominio válido y resoluble). citeturn0search12  
- Si solo habrá LAN/VPN sin dominio público, usar **TLS interno** (CA interna) o terminar TLS en Caddy con certificado interno (esto es diseño, no una “magia” automática del Internet).

### Checklist de hardening de cámaras (operativo)

1) **Contraseñas únicas** por cámara; deshabilitar defaults.  
2) **Desactivar P2P / nube del fabricante** (si existe).  
3) Actualizar firmware con cadencia (p. ej. trimestral).  
4) **RTSP/ONVIF solo en VLAN cámaras**; bloquear Internet saliente para esa VLAN.  
5) Permitir solo:  
   - De cámaras → NVR: RTSP  
   - De Admin VLAN/VPN → Portal (443)  

Este aislamiento reduce superficie de ataque: aunque una cámara tenga vulnerabilidad, no debería “salir” a Internet ni moverse lateralmente a tu red.

### Reglas de firewall/VLAN (modelo)

- VLAN_CAM (cámaras):  
  - Deny: VLAN_CAM → Internet (0.0.0.0/0)  
  - Allow: VLAN_CAM → NVR_IP: 554/tcp (RTSP) (o el puerto real)  
  - Deny: VLAN_CAM → LAN_ADMIN (todo)  
- VLAN_ADMIN:  
  - Allow: VLAN_ADMIN/VPN → Portal: 443/tcp  
  - Allow: VLAN_ADMIN/VPN → NVR: 8971/tcp (solo SuperAdmin, opcional)  
- Bloquear exposición de Frigate `5000` (interno no autenticado). citeturn11search0turn5search22  

### Gestión de secretos

- `.env` (solo local) para variables no comprometibles.  
- Para producción:  
  - rclone config cifrada con `rclone config` password (y `RCLONE_CONFIG_PASS` en secreto).  
  - MFA secrets en DB **encriptados** (KMS local o key de app).  
- Opcional: Vault, SOPS, o Docker Secrets (si migras a Swarm/K8s).

## Dimensionamiento, rendimiento esperado y BOM con estimación de costos

### Rendimiento y sizing para tu PC

**Decodificación de video**  
Frigate recomienda usar GPU para acelerar la decodificación de video (hardware acceleration). citeturn11search12turn3search2  
Con una GPU RTX, lo típico es:  
- GPU se usa para **decode** (reduce CPU).  
- Detección puede ir en CPU (MVP) o en GPU si usas detector compatible (p. ej. TensorRT). Frigate soporta detectores `cpu`, `edgetpu`, `openvino`, `tensorrt`, etc., y por defecto usa CPU. citeturn3search0turn3search1  

**Ajustes recomendados para 2 cámaras**
- Stream “detect”: 720p–1080p a ~5 fps (máx. 10 fps). citeturn4search31turn3search12  
- Stream “record”: resolución alta (2K/4MP) a ~15 fps (ajústalo en firmware). citeturn4search31  
- `shm_size`: 256 MB (con margen); doc referencia 64 MB para 2 cámaras a 720p, y que logs consumen shm también. citeturn11search22turn0search33  

**Estimación de carga (orientativa, no garantía)**  
- 2 cámaras con detect 720p@5fps + record 4MP@15fps:  
  - CPU: normalmente estable si GPU decodifica (depende de bitrate, codec y overlays).  
  - GPU: baja‑media si solo decode; sube si haces detect por TensorRT.  
Como la doc fija recomendaciones (fps/streams) pero no promete % de CPU, la forma rigurosa de validar es con pruebas: 48–72h con métricas (FPS detect, inference time, dropped frames). citeturn4search31turn3search0  

### Capacidad de almacenamiento (modelo rápido)

Para estimar almacenamiento de 24/7:  
- **GB/día ≈ (Mbps ÷ 8) × 86,400 ÷ 1,024**  
Ejemplo: 4 Mbps ≈ ~42 GB/día por cámara; 8 Mbps ≈ ~84 GB/día.  
Dos cámaras: ~84–168 GB/día. Con 2 TB en Drive, la retención completa de 24/7 sería del orden de 12–24 días (sin contar overhead). Esto justifica retención corta en nube o subir solo eventos.

### BOM sugerido (2 cámaras) con rangos en MXN

> Nota: los precios cambian; se incluyen referencias actuales en México para dimensionar.

| Componente | Cantidad | Rango estimado (MXN) | Comentario técnico |
|---|---:|---:|---|
| Cámara IP PoE 4MP exterior (WDR 120dB, H.265, IR) | 2 | 1,700–2,200 c/u | Ejemplos de 4MP PoE en tiendas mexicanas en ~1.7k–2.1k; la calidad depende del modelo. citeturn10search6turn10search10 |
| Switch PoE (8 puertos recomendado) | 1 | 1,500–3,500 | Un switch PoE+ es base para estabilidad. Referencias de modelos PoE/PoE+. citeturn9search20turn9search12 |
| Cable UTP Cat6 exterior 305m (según calidad: CCA vs 100% cobre) | 1 | 1,900–12,000 | CCA es más barato; 100% cobre + gel/doble chaqueta cuesta más pero dura más (intemperie). citeturn10search8turn10search24 |
| Disco duro “surveillance” 4TB | 1 | ~2,300–2,600 | WD Purple 4TB se ve alrededor de $2,369 MXN en retail. citeturn9search1 |
| Disco duro “surveillance” 8TB (opcional si quieres más retención local) | 1 | ~4,700–5,000 | WD Purple 8TB alrededor de $4,759 MXN en retail. citeturn9search6 |
| UPS / No‑break 1000VA (recomendado) | 1 | 1,600–12,000 | Hay gamas; BV1000 ronda ~1,659; Smart‑UPS sube mucho. citeturn9search15turn9search11 |
| Misceláneos (conectores RJ45, canaleta, cajas, sellado) | — | 500–2,000 | Depende de instalación |

## Checklist priorizado, plan de pruebas, despliegue y prompt para VS Code agent

### Checklist priorizado de implementación

**Fase 0: Red y seguridad base (antes del software)**  
- VLAN cámaras sin Internet, reglas mínimas (solo RTSP hacia NVR).  
- Contraseñas y desactivar P2P.  
- Decidir si acceso remoto será solo por VPN (recomendado) o dominio público con TLS.

**Fase 1: NVR operativo (Frigate)**  
- Configurar 2 cámaras con streams separados (detect/record). citeturn4search31turn0search3  
- Verificar grabación en `/media/frigate/recordings` y snapshots en `/media/frigate/clips`. citeturn0search3turn0search28  
- Ajustar `shm_size` si hay “Bus error”. citeturn11search22turn0search33  

**Fase 2: Portal web (auth + eventos + evidencias)**  
- Implementar auth JWT + hashing en FastAPI (baseline). citeturn1search2  
- Implementar RBAC + MFA TOTP (RFC 6238) + auditoría (OWASP). citeturn8search0turn8search1  
- Sync (polling) a `/api/events` de Frigate y almacenar metadata. citeturn1search0  
- Export evidence: descargar `clip.mp4`, calcular SHA‑256, almacenar vault.

**Fase 3: Respaldo nocturno con rclone**  
- Configurar Drive remote y crypt remote. citeturn1search3turn1search7  
- Job nocturno: `copy` + `check` + retención. citeturn4search3turn1search29  

### Plan de pruebas (práctico y verificable)

- **Pruebas de NVR (48–72h)**  
  - estabilidad RTSP (sin cortes), tasa de detección, clips disponibles por API (snapshot/clip). citeturn1search5turn1search17  
  - medir uso de CPU/GPU con y sin hwaccel (Frigate recomienda GPU decode). citeturn11search12  

- **Pruebas de seguridad**  
  - MFA: enroll/verify/disable; asegurar re‑autenticación para cambios (OWASP). citeturn8search1turn8search13  
  - RBAC: ReadOnly no exporta evidencia; Admin sí; SuperAdmin administra.  
  - Auditoría: que cada export, login, cambio de rol quede en `audit_log`.

- **Pruebas de backup**  
  - Ejecutar `backup.sh` manual con `--dry-run` (cuando aplique) y validar logs.  
  - Validar `rclone check` OK para el folder del día. citeturn4search3  

### Despliegue paso a paso (alto nivel)

1) Preparar disco dedicado para `./data/frigate` (idealmente HDD surveillance).  
2) Instalar Docker + Docker Compose (host Linux recomendado). citeturn8search34turn8search10  
3) Crear `.env` (sección abajo).  
4) Configurar rclone (`drive` + `crypt`) y copiar config a `infra/rclone/config/`. citeturn1search3turn1search7  
5) Escribir `infra/frigate/config.yml` para 2 cámaras.  
6) `docker compose up -d`  
7) Validar:  
   - Frigate graba en disco (`/recordings`) citeturn0search3  
   - Backend puede leer eventos de Frigate API citeturn1search0  
   - Portal responde por TLS  
   - Backup corre manualmente una vez y luego por cron.

### Prompt listo para pegar en VS Code agent

> Pégalo tal cual. Ajusta nombres de repo si quieres.

**PROMPT**

Actúa como Arquitecto de Software + DevSecOps. Implementa un MVP de un sistema on‑prem de videovigilancia con 2 cámaras (Modelo A: el servidor graba directamente) y portal web tipo SaaS interno con respaldo nocturno a Google Drive.

Requerimientos obligatorios:

A) Repo y estructura
- Crear repo con:
  - /infra
    - /frigate (config.yml)
    - /caddy (Caddyfile)
    - /rclone (Dockerfile, backup.sh, crontab, README)
  - /backend (FastAPI)
  - /frontend (Next.js o React)
  - /docs (operación, seguridad, cómo agregar cámaras)
- Entregables: docker-compose.yml en raíz, .env.example, scripts init, migraciones.

B) Docker Compose (stack completo)
- Servicios: frigate, backend, frontend, postgres, minio (opcional pero incluido), caddy, backup(rclone+cron).
- Extra opcional: wg-easy (WireGuard UI) en profile "vpn".
- Redes: core + cameras (internal true).
- Volúmenes persistentes en ./data.
- Healthchecks para postgres/minio.

C) Frigate
- Implementar config.yml con 2 cámaras RTSP y streams separados: detect (5fps recomendado) y record (15fps recomendado).
- Guardar recordings en /media/frigate/recordings y snapshots/clips en /media/frigate/clips.
- Exponer solo puerto 8971 al host; mantener 5000 solo interno.

D) Backend (FastAPI)
- Auth: OAuth2 password flow + JWT, hashing seguro (passlib/bcrypt).
- RBAC: SuperAdmin/Admin/ReadOnly.
- MFA: TOTP (RFC 6238). Endpoints:
  - POST /api/auth/mfa/totp/enroll
  - POST /api/auth/mfa/totp/verify
- Auditoría: tabla audit_log con registro de logins, exports, cambios.
- Ingesta eventos:
  - Polling a FRIGATE_BASE_URL (/api/events) cada 30s (configurable) y upsert en Postgres.
  - Guardar frigate_event_id, label, start_time/end_time, has_clip/has_snapshot, raw json.
- Media proxy:
  - GET /api/events/{id}/snapshot (proxy de /api/events/:event_id/snapshot.jpg)
  - GET /api/events/{id}/clip (proxy de /api/events/:event_id/clip.mp4)
- Export evidence:
  - POST /api/evidence/export: descarga clip mp4, guarda en evidence vault (filesystem o MinIO bucket "evidence"), calcula SHA-256, genera manifest JSON, registra audit + evidence_exports.
  - GET /api/evidence/{id}/download: descarga controlada (RBAC), incrementa contador y audita.

E) DB (Postgres)
- Migraciones con Alembic:
  - users, mfa_totp, cameras, events, evidence_exports, audit_log, backup_runs.
- Campos mínimos y constraints (FK, índices por fechas/cámara).

F) Backup nocturno (rclone)
- Contenedor backup basado en rclone/rclone:latest con apk bash tzdata coreutils.
- backup.sh:
  - Copia “ayer UTC” de /source/frigate/recordings/YYYY-MM-DD hacia Google Drive (DEST_REMOTE:DEST_PATH/recordings/YYYY-MM-DD) usando rclone copy.
  - Copia /source/frigate/clips y /source/evidence.
  - Ejecuta rclone check para el folder recién copiado.
  - Aplica retención: borrar en destino archivos con antigüedad > RETENTION_DAYS.
- Soportar cifrado con rclone crypt: el remote final debe ser (por ejemplo) “gdrive_crypt:retorno”.
- Documentar cómo generar rclone.conf de forma segura y cómo setear RCLONE_CONFIG_PASS.

G) Reverse proxy
- Caddy con TLS:
  - / → frontend
  - /api/* → backend
- Añadir headers de seguridad básicos.
- Documentar modo “LAN/VPN sin dominio” y modo “dominio público”.

H) Documentación (/docs)
- Operación diaria:
  - cómo ver eventos
  - cómo exportar evidencia
  - cómo interpretar hash SHA‑256 y manifest
  - cómo agregar nuevas cámaras
- Seguridad:
  - checklist hardening cámaras
  - VLAN/firewall rules recomendadas
  - política de retención on‑prem y en Drive
- Deployment:
  - pasos docker compose up
  - troubleshooting (shm_size, RTSP caídas, permisos volúmenes)

Calidad
- Código tipado, validaciones, manejo de errores.
- Logs estructurados.
- No hardcodear secretos; usar .env y .env.example.

Entrega final
- Commit con todo funcionando en local con streams RTSP simulados (agrega un servicio opcional “rtsp-sim” para dev o documenta cómo probar sin cámaras reales).
- Incluye comandos de prueba y curl examples para endpoints principales.

### Enlaces oficiales clave (para que tu equipo los tenga a mano)

```text
Frigate Recording: https://docs.frigate.video/configuration/record/
Frigate Camera setup (fpS/streams): https://docs.frigate.video/frigate/camera_setup/
Frigate HTTP API (Events): https://docs.frigate.video/integrations/api/frigate-http-api/
Frigate API events list: https://docs.frigate.video/integrations/api/events-events-get/
Frigate API clip: https://docs.frigate.video/integrations/api/event-clip-events-event-id-clip-mp-4-get/
Frigate API snapshot: https://docs.frigate.video/integrations/api/event-snapshot-events-event-id-snapshot-jpg-get/
Frigate ports / install: https://docs.frigate.video/frigate/installation/
rclone Google Drive backend: https://rclone.org/drive/
rclone crypt: https://rclone.org/crypt/
rclone sync (cuidado con deletes): https://rclone.org/commands/rclone_sync/
rclone check: https://rclone.org/commands/rclone_check/
Google Drive API files.md5Checksum: https://developers.google.com/workspace/drive/api/reference/rest/v3/files
Caddy Automatic HTTPS: https://caddyserver.com/docs/automatic-https
WireGuard quickstart: https://www.wireguard.com/quickstart/
ONVIF Profile S: https://www.onvif.org/profiles/profile-s/
RTSP RFC 2326: https://datatracker.ietf.org/doc/html/rfc2326
TOTP RFC 6238: https://datatracker.ietf.org/doc/html/rfc6238
```
RECORDAR CREAR TODO EL ENTORNO PARA PROD PRUEBAS Y TEST UY TODO EN GITHUB 
mi usuario de github es sebastianbarranco
y el repo https://github.com/sebastianbarranco/seguridad-ret4.git 
(debeirmoa poder hacer pruebas con videos samples de grbaciones al azar de como funcionaria viendo nuestros cideos para noesperar nuestras camaras para ber el saas)