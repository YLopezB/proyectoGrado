#!/usr/bin/env bash
# Crea el archivo .env a partir de .env.example generando secretos aleatorios.
# Uso:  ./scripts/init-env.sh [contraseña_admin]
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo "Ya existe .env — no se sobrescribe. Bórralo primero si quieres regenerarlo." >&2
  exit 1
fi
rand() { openssl rand -hex "${1:-24}"; }

ADMIN_PASS="${1:-$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-14)A1!}"

# escapa caracteres especiales de sed en el texto de reemplazo
ESC_PASS=$(printf '%s' "$ADMIN_PASS" | sed -e 's/[\/&|]/\\&/g')

cp .env.example .env
sed -i.bak \
  -e "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD='${ESC_PASS}'|" \
  -e "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(rand 16)|" \
  -e "s|^JWT_SECRET=.*|JWT_SECRET=$(rand 32)|" \
  -e "s|^INTERNAL_API_KEY=.*|INTERNAL_API_KEY=$(rand 24)|" .env
rm -f .env.bak

echo ".env creado."
echo "  Usuario administrador: $(grep '^ADMIN_USER=' .env | cut -d= -f2)"
echo "  Contraseña administrador: ${ADMIN_PASS}"
echo "Guarda esta contraseña; podrás cambiarla después desde la plataforma (Administración > Contraseña)."
