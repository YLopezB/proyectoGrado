#!/usr/bin/env bash
# Respaldo de PRODUCCIÓN: base de datos (pg_dump) + repositorio de archivos (volumen repo-data).
# Uso:  ./scripts/backup.sh        -> crea backups/AAAAmmdd-HHMMSS/{db.sql.gz,files.tar.gz,company.tar.gz}
set -euo pipefail
cd "$(dirname "$0")/.."

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="backups/$STAMP"
mkdir -p "$OUT"

echo "==> Respaldando base de datos…"
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' | gzip > "$OUT/db.sql.gz"

echo "==> Respaldando archivos del repositorio…"
docker compose run --rm --no-deps --user root -v "$PWD/$OUT:/backup" repository-service \
  sh -c 'tar czf /backup/files.tar.gz -C /data .'

echo "==> Respaldando identidad de la empresa (logo y foto de inicio de sesión)…"
docker compose run --rm --no-deps --user root -v "$PWD/$OUT:/backup" org-service \
  sh -c 'tar czf /backup/company.tar.gz -C /data/company .'

echo "Listo: $OUT"
ls -lh "$OUT"
