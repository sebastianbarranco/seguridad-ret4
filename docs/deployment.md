# NVR Portal — Guía de Despliegue

## Requisitos

- Docker Engine 24+ y Docker Compose v2
- Mínimo 4 GB RAM, 2 cores (recomendado: 8 GB+ para Frigate)
- Disco dedicado para grabaciones (HDD surveillance recomendado)
- Para desarrollo en Windows: WSL2 con Docker Desktop

## Despliegue Paso a Paso

### 1. Clonar el repositorio
```bash
git clone https://github.com/sebastianbarranco/seguridad-ret4.git
cd seguridad-ret4
```

### 2. Copiar y configurar el .env
```bash
cp .env.example .env
```
Edita `.env` con tus valores reales:
- `POSTGRES_PASSWORD`: contraseña segura para la base de datos
- `JWT_SECRET`: cadena aleatoria de 32+ caracteres
- `MFA_ENCRYPTION_KEY`: cadena de 32 caracteres para cifrar secretos MFA
- URLs RTSP de tus cámaras reales (o deja los defaults para dev)

### 3. Preparar disco de grabación (producción)
```bash
# Montar disco dedicado
sudo mount /dev/sdX1 /mnt/nvr_data
# Crear symlink
ln -s /mnt/nvr_data ./data/frigate
```

### 4. Modo desarrollo (con simulador RTSP)

#### A) Generar videos de prueba
```bash
# Linux/Mac
./download_samples.sh

# Windows (PowerShell)
.\generate_samples.ps1
```

#### B) Levantar el stack de desarrollo
```bash
docker compose --profile dev -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 5. Modo producción (con cámaras reales)
```bash
# Editar config de Frigate con tus URLs RTSP reales
# infra/frigate/config.yml

# Levantar
docker compose up -d
```

### 6. Verificar servicios
```bash
# Estado de contenedores
docker compose ps

# Logs
docker compose logs -f backend
docker compose logs -f frigate

# Health check
curl http://localhost:8000/api/health
```

### 7. Acceder al portal
- URL: https://localhost (Caddy con TLS interno)
- Email: `admin@nvr.local`
- Password: `Admin123!`
- **¡Cambia la contraseña inmediatamente!**

### 8. Configurar rclone para backups
```bash
# 1) Configurar rclone con Google Drive
rclone config

# 2) Copiar configuración
cp ~/.config/rclone/rclone.conf infra/rclone/config/rclone.conf

# 3) Reiniciar backup
docker compose restart backup
```

### 9. Activar VPN (opcional)
```bash
docker compose --profile vpn up -d wg-easy
# UI de WireGuard: http://localhost:51821
```

## Troubleshooting

### "Bus error" en Frigate
Incrementar `shm_size` en docker-compose.yml:
```yaml
frigate:
  shm_size: "512mb"  # era 256mb
```

### RTSP se desconecta o se congela
1. Verificar conectividad de red a la cámara: `ping 192.168.100.10`
2. Probar RTSP directamente: `ffprobe rtsp://admin:pass@192.168.100.10:554/stream1`
3. Revisar logs de Frigate: `docker compose logs frigate | grep -i error`
4. Ajustar `input_args` en config.yml (timeout, TCP forzado)

### Permisos de volúmenes en Linux
```bash
# Si Frigate no puede escribir
sudo chown -R 1000:1000 ./data/frigate
sudo chmod -R 755 ./data/frigate
```

### Base de datos no inicia
```bash
# Reset completo (pierde datos)
docker compose down -v
rm -rf ./data/postgres
docker compose up -d postgres
```

### Frontend no compila
```bash
cd frontend
rm -rf node_modules .next
npm install
npm run build
cd ..
docker compose build frontend
```

### Backend no puede conectar a Frigate
- Verificar que Frigate está corriendo: `docker compose ps frigate`
- El backend usa puerto 5000 *interno* (no expuesto), es correcto
- Verificar red Docker: `docker network inspect admin_ret4_core`

## Comandos Útiles

```bash
# Ver todos los logs
docker compose logs -f

# Reiniciar un servicio específico
docker compose restart backend

# Ejecutar backup manualmente
docker compose exec backup /work/backup.sh

# Ejecutar migración de DB
docker compose exec backend alembic upgrade head

# Shell interactivo en el backend
docker compose exec backend bash

# Ver uso de disco de Frigate
du -sh ./data/frigate/recordings/*
```

## Ejemplos de curl para API

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -d "username=admin@nvr.local&password=Admin123!" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### Listar eventos
```bash
TOKEN="your_jwt_token"
curl http://localhost:8000/api/events \
  -H "Authorization: Bearer $TOKEN"
```

### Sincronizar eventos
```bash
curl -X POST http://localhost:8000/api/events/sync \
  -H "Authorization: Bearer $TOKEN"
```

### Exportar evidencia
```bash
curl -X POST http://localhost:8000/api/evidence/export \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event_id": "EVENT_UUID", "reason": "Revisión de incidente"}'
```

### Listar cámaras
```bash
curl http://localhost:8000/api/cameras \
  -H "Authorization: Bearer $TOKEN"
```

### Crear usuario
```bash
curl -X POST http://localhost:8000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "nuevo@nvr.local", "password": "SecurePass123!", "role": "admin"}'
```

### Health check
```bash
curl http://localhost:8000/api/health
```
