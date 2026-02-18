# 🎥 NVR Portal — Sistema de Videovigilancia On-Prem

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

MVP de un sistema **on-prem** de videovigilancia con **2 cámaras RTSP**, portal web tipo SaaS interno con RBAC/MFA, y respaldo nocturno automatizado a Google Drive.

## Arquitectura

```
┌──────────────────────────────────────────────────────────┐
│                    Servidor On-Prem                       │
│                                                          │
│  ┌─────────┐   ┌──────────┐   ┌──────────┐             │
│  │ Frigate  │◄──│ Cámara 1 │   │ Cámara 2 │             │
│  │  (NVR)   │◄──│  (RTSP)  │   │  (RTSP)  │             │
│  └────┬─────┘   └──────────┘   └──────────┘             │
│       │                                                  │
│  ┌────▼─────┐   ┌──────────┐   ┌──────────┐            │
│  │ Backend  │──►│ Postgres │   │  MinIO   │            │
│  │ (FastAPI)│   │  (Meta)  │   │(Evidence)│            │
│  └────┬─────┘   └──────────┘   └──────────┘            │
│       │                                                  │
│  ┌────▼─────┐   ┌──────────┐   ┌──────────┐            │
│  │ Frontend │◄──│  Caddy   │──►│ WireGuard│            │
│  │ (Next.js)│   │  (TLS)   │   │  (VPN)   │            │
│  └──────────┘   └──────────┘   └──────────┘            │
│                                                          │
│  ┌──────────┐               ┌──────────────┐            │
│  │  rclone  │──────────────►│ Google Drive │            │
│  │ (backup) │  nocturno     │  (cifrado)   │            │
│  └──────────┘               └──────────────┘            │
└──────────────────────────────────────────────────────────┘
```

## Características

- **Grabación 24/7** con Frigate NVR (2 cámaras, expandible)
- **Detección de objetos** (personas, autos, perros, gatos) a 5 fps
- **Portal web** con autenticación JWT, RBAC y MFA (TOTP)
- **Proxy de medios** — el frontend nunca habla directamente con Frigate
- **Exportación de evidencia** con cadena de custodia (SHA-256 + manifest JSON)
- **Respaldo nocturno** a Google Drive con cifrado y verificación de integridad
- **VPN integrada** (WireGuard) para acceso remoto seguro
- **Simulador RTSP** para desarrollo y pruebas sin cámaras reales
- **Auditoría completa** — cada acción queda registrada

## Quick Start

### Desarrollo (sin cámaras reales)

```bash
# 1. Clonar
git clone https://github.com/sebastianbarranco/seguridad-ret4.git
cd seguridad-ret4

# 2. Configurar
cp .env.example .env

# 3. Generar videos de prueba
# Linux/Mac:
./download_samples.sh
# Windows PowerShell:
.\generate_samples.ps1

# 4. Levantar con simulador RTSP
docker compose --profile dev -f docker-compose.yml -f docker-compose.dev.yml up -d

# 5. Abrir portal
# https://localhost
# Email: admin@nvr.local
# Password: Admin123!
```

### Producción (con cámaras reales)

```bash
# 1. Editar infra/frigate/config.yml con URLs RTSP reales
# 2. Configurar .env con contraseñas seguras
# 3. Levantar
docker compose up -d
```

## Estructura del Proyecto

```
├── docker-compose.yml          # Stack principal
├── docker-compose.dev.yml      # Overrides para desarrollo
├── .env.example                # Variables de entorno (template)
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/                # Endpoints REST
│   │   ├── core/               # Auth, seguridad, MFA
│   │   ├── models/             # SQLAlchemy models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Frigate sync, etc.
│   │   ├── config.py           # Settings
│   │   ├── database.py         # DB engine
│   │   └── main.py             # App entry point
│   ├── alembic/                # Migraciones DB
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                   # Next.js frontend
│   ├── src/
│   │   ├── app/                # Pages (App Router)
│   │   ├── components/         # React components
│   │   └── lib/                # API client
│   ├── Dockerfile
│   └── package.json
├── infra/
│   ├── frigate/                # Config Frigate NVR
│   ├── caddy/                  # Caddyfile (reverse proxy)
│   ├── rclone/                 # Backup nocturno
│   └── rtsp-sim/               # Simulador RTSP (dev)
├── docs/                       # Documentación
│   ├── operacion.md            # Operación diaria
│   ├── seguridad.md            # Seguridad y hardening
│   └── deployment.md           # Despliegue y troubleshooting
├── samples/                    # Videos de prueba (no en git)
└── data/                       # Datos persistentes (no en git)
```

## API Endpoints

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login (JWT) |
| POST | `/api/auth/mfa/totp/enroll` | Enrollar MFA |
| POST | `/api/auth/mfa/totp/verify` | Verificar código MFA |
| GET | `/api/events` | Listar eventos |
| POST | `/api/events/sync` | Sincronizar con Frigate |
| GET | `/api/events/{id}/snapshot` | Proxy snapshot |
| GET | `/api/events/{id}/clip` | Proxy clip mp4 |
| POST | `/api/evidence/export` | Exportar evidencia |
| GET | `/api/evidence/{id}/download` | Descargar evidencia |
| GET | `/api/evidence/{id}/manifest` | Ver manifest |
| GET | `/api/cameras` | Listar cámaras |
| GET | `/api/users` | Listar usuarios (SuperAdmin) |
| GET | `/api/audit` | Log de auditoría (SuperAdmin) |
| GET | `/api/backups/runs` | Historial de backups |
| GET | `/api/health` | Health check |

## Documentación

- [Operación diaria](docs/operacion.md)
- [Seguridad y hardening](docs/seguridad.md)
- [Despliegue y troubleshooting](docs/deployment.md)

## Tech Stack

| Componente | Tecnología |
|---|---|
| NVR | Frigate |
| Backend | Python 3.12 + FastAPI |
| Frontend | Next.js 14 + Tailwind CSS |
| Base de datos | PostgreSQL 16 |
| Object storage | MinIO (S3-compatible) |
| Reverse proxy | Caddy 2 (TLS auto) |
| Backup | rclone + cron |
| VPN | WireGuard (wg-easy) |
| Contenedores | Docker Compose |

## Licencia

MIT
