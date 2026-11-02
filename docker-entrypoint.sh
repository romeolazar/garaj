#!/bin/sh
set -e

mkdir -p "$DATA_DIR"

# Generate a persistent NEXTAUTH_SECRET on first start if none was provided.
if [ -z "$NEXTAUTH_SECRET" ]; then
  SECRET_FILE="$DATA_DIR/.nextauth_secret"
  if [ ! -s "$SECRET_FILE" ]; then
    node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64'))" > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
  fi
  NEXTAUTH_SECRET="$(cat "$SECRET_FILE")"
  export NEXTAUTH_SECRET
fi

npx prisma migrate deploy
npm run prisma:init

exec node_modules/.bin/next start -p "$PORT"
