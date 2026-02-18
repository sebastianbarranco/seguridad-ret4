# rclone Backup Container

## Configuración

### 1. Configurar rclone con Google Drive

Ejecuta en tu máquina local (con navegador):

```bash
rclone config
```

- Crea un remote tipo `drive` (nombre sugerido: `gdrive`)
- Luego crea un remote tipo `crypt` (nombre: `gdrive_crypt`) que apunte al remote `gdrive`
- Esto cifra todos los archivos antes de subirlos

### 2. Copiar la configuración

```bash
cp ~/.config/rclone/rclone.conf infra/rclone/config/rclone.conf
```

### 3. Cifrar la configuración (recomendado)

```bash
rclone config password
```

Luego asigna el password en `.env`:
```
RCLONE_CONFIG_PASS=your_config_encryption_password
```

### 4. Variables de entorno

| Variable | Descripción | Ejemplo |
|---|---|---|
| `SOURCE_DIR` | Directorio fuente (montado en container) | `/source` |
| `DEST_REMOTE` | Remote de rclone para destino | `gdrive_crypt` |
| `DEST_PATH` | Path base en el remote | `nvr_backups` |
| `RETENTION_DAYS` | Días de retención en Drive | `14` |
| `RCLONE_CONFIG_PASS` | Password del config cifrado | (secreto) |

### 5. Ejecución manual (para pruebas)

```bash
docker compose exec backup /work/backup.sh
```

### 6. Verificar logs

```bash
tail -f data/backup-logs/backup.log
```

## Estructura en Google Drive

```
nvr_backups/
├── recordings/
│   ├── 2025-01-15/
│   │   ├── 00/cam_entrada/...
│   │   └── 23/cam_patio/...
│   └── 2025-01-14/...
├── clips/
│   ├── cam_entrada-abc123.jpg
│   └── cam_patio-def456.jpg
└── evidence/
    └── exports/
        └── 2025-01-15/
            ├── export_uuid.mp4
            ├── export_uuid.sha256
            └── manifest_uuid.json
```
