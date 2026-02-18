# NVR Portal — Guía de Operación Diaria

## Acceso al Portal

1. Abre el navegador y ve a `https://tu-servidor/` (o la IP/VPN correspondiente)
2. Ingresa con tu email y contraseña
3. Si tienes MFA habilitado, ingresa el código TOTP de tu app authenticator

## Ver Eventos

1. Ve a **Eventos** en el menú lateral
2. Filtra por tipo de objeto (persona, auto, etc.) o por fecha
3. Haz clic en un evento para ver el detalle:
   - **Snapshot**: captura del momento de detección
   - **Clip**: video del evento completo
   - **Score**: nivel de confianza de la detección

## Sincronizar Eventos

- Los eventos se sincronizan automáticamente cada 30 segundos desde Frigate
- Para forzar una sincronización manual: clic en **🔄 Sincronizar con Frigate**

## Exportar Evidencia

1. En la página de **Eventos**, encuentra el evento deseado
2. Clic en **📥 Exportar**
3. Ingresa la **razón** (cadena de custodia)
4. El sistema:
   - Descarga el clip de Frigate
   - Calcula el hash **SHA-256**
   - Guarda el archivo, el hash y un manifest JSON
   - Registra la acción en el log de auditoría

## Verificar Integridad (SHA-256)

El SHA-256 es un hash criptográfico que permite verificar que un archivo no ha sido modificado.

### En Linux/Mac:
```bash
sha256sum evidence_abc123.mp4
```

### En Windows (PowerShell):
```powershell
Get-FileHash evidence_abc123.mp4 -Algorithm SHA256
```

Compara el resultado con el hash del manifest JSON. Si coinciden, el archivo es íntegro.

## Manifest JSON de Evidencia

Cada exportación genera un manifest como este:
```json
{
  "evidence_id": "uuid...",
  "event_id": "uuid...",
  "frigate_event_id": "1234567.890",
  "sha256": "a1b2c3d4...",
  "size_bytes": 5242880,
  "content_type": "video/mp4",
  "requested_by_email": "admin@nvr.local",
  "requested_at": "2026-02-17T03:45:00Z",
  "reason": "Revisión de incidente",
  "camera_name": "Cámara Entrada",
  "event_label": "person",
  "event_start_time": "2026-02-17T03:40:15Z"
}
```

## Agregar Nuevas Cámaras

### 1. Configurar en Frigate
Edita `infra/frigate/config.yml` y agrega una nueva cámara:
```yaml
cameras:
  cam_nueva:
    enabled: true
    ffmpeg:
      inputs:
        - path: rtsp://user:pass@IP:554/stream1
          roles: [record]
        - path: rtsp://user:pass@IP:554/stream2
          roles: [detect]
    detect:
      width: 1280
      height: 720
      fps: 5
```

### 2. Reiniciar Frigate
```bash
docker compose restart frigate
```

### 3. Registrar en el Portal
Como SuperAdmin, ve a **Cámaras** o usa la API:
```bash
curl -X POST https://portal/api/cameras \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Cámara Nueva", "frigate_name": "cam_nueva", "site_id": "SITE_UUID"}'
```

### 4. Verificar
- La cámara debería aparecer en el portal
- Los eventos se sincronizarán automáticamente
