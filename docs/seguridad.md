# NVR Portal — Guía de Seguridad

## Checklist de Hardening de Cámaras

- [ ] Cambiar contraseñas por defecto de cada cámara (usar contraseñas únicas)
- [ ] Desactivar P2P / cloud del fabricante
- [ ] Desactivar UPnP en las cámaras
- [ ] Actualizar firmware (cadencia trimestral recomendada)
- [ ] Usar solo RTSP/ONVIF (deshabilitar HTTP/telnet si es posible)
- [ ] Aislar en VLAN dedicada sin acceso a Internet

## Reglas de VLAN y Firewall

### Arquitectura de red recomendada

```
VLAN_CAM (cámaras)  ──RTSP──►  NVR (tu servidor)
                                    │
VLAN_ADMIN ◄───── TLS 443 ─────────┘
                                    │
Internet ◄────── WireGuard ─────────┘ (opcional)
```

### Reglas de firewall

#### VLAN_CAM (cámaras)
| Origen | Destino | Puerto | Acción |
|---|---|---|---|
| VLAN_CAM | NVR_IP | 554/tcp (RTSP) | **ALLOW** |
| VLAN_CAM | Internet (0.0.0.0/0) | * | **DENY** |
| VLAN_CAM | VLAN_ADMIN | * | **DENY** |
| VLAN_CAM | * | * | **DENY** |

#### VLAN_ADMIN / VPN
| Origen | Destino | Puerto | Acción |
|---|---|---|---|
| ADMIN/VPN | Portal | 443/tcp | **ALLOW** |
| ADMIN/VPN | NVR_IP | 8971/tcp | ALLOW (solo SuperAdmin, opcional) |

### Puertos de Frigate
- **8971**: UI/API autenticada — OK para reverse proxy
- **5000**: UI/API **NO autenticada** — NUNCA exponer fuera de Docker

## Autenticación y Autorización

### Roles (RBAC)
| Rol | Permisos |
|---|---|
| SuperAdmin | Todo: configuración, usuarios, cámaras, auditoría, evidencia |
| Admin | Ver eventos, buscar, exportar evidencia, ver backups |
| ReadOnly | Solo ver eventos y cámaras (sin exportaciones) |

### MFA (TOTP)
- Basado en RFC 6238 (Time-based One-Time Password)
- Compatible con Google Authenticator, Authy, etc.
- **Obligatorio** para SuperAdmin (recomendado para todos)
- Cambios de MFA requieren sesión activa y se auditan

### Buenas prácticas OWASP
- Cambios de factor MFA deben requerir re-autenticación
- Todas las acciones sensibles se registran en audit_log
- Tokens JWT con expiración (1 hora access, 24h refresh)
- Contraseñas hasheadas con bcrypt

## Política de Retención

### On-prem (disco local)
- Recordings: 14 días por defecto (configurable en Frigate)
- Eventos con clip: 30 días
- Snapshots: 30 días

### En Google Drive (backup nocturno)
- Retención: 14 días (configurable via RETENTION_DAYS)
- Cifrado con rclone crypt (recomendado)
- Verificación de integridad con `rclone check`

### Evidence vault
- Sin retención automática — las evidencias exportadas se conservan indefinidamente
- Respaldadas a Drive junto con recordings

## Gestión de Secretos

### Desarrollo
- `.env` local (nunca en git)
- `.env.example` con valores placeholder

### Producción
- rclone config cifrada (RCLONE_CONFIG_PASS)
- MFA secrets cifrados en DB
- JWT_SECRET mínimo 32 caracteres, aleatorio
- Considerar Docker Secrets o SOPS para producción real

## Acceso Remoto

### Opción 1: WireGuard VPN (recomendado)
- No se expone el portal a Internet
- Cada admin tiene su perfil WireGuard
- Activar con `docker compose --profile vpn up -d`

### Opción 2: Dominio público con TLS
- Requiere dominio, DNS y puerto 443 abierto
- Caddy auto-provisionará certificado Let's Encrypt
- Configurar `SITE_DOMAIN` en Caddyfile
