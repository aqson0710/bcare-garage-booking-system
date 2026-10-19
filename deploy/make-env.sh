#!/usr/bin/env bash
# Creates ~/bcare/.env on the VPS. Run ON THE VPS inside the app folder:
#   cd ~/bcare && bash make-env.sh
#
# BCare has no local database password to generate - its secrets come from
# Supabase and SlipOK dashboards. This script asks for them with hidden input
# (nothing is echoed or saved to shell history) and writes .env with chmod 600.
set -euo pipefail

ENV_FILE="${1:-.env}"
if [ -f "$ENV_FILE" ]; then
  echo "$ENV_FILE already exists - not overwriting. Delete it first if you really want to recreate it." >&2
  exit 1
fi

ask() {            # ask VAR "Prompt" [default]
  local __v; read -r -p "$2${3:+ [$3]}: " __v; printf -v "$1" '%s' "${__v:-${3:-}}"
}
ask_secret() {     # hidden input
  local __v; read -r -s -p "$2: " __v; echo; printf -v "$1" '%s' "$__v"
}

echo "== BCare .env setup (values from Supabase > Project Settings > API, and SlipOK) =="
ask        SUPA_URL  "NEXT_PUBLIC_SUPABASE_URL (https://xxxx.supabase.co)"
ask        SUPA_PUB  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
ask_secret SUPA_SRV  "SUPABASE_SERVICE_ROLE_KEY (hidden)"
ask        SLIP_BR   "SLIPOK_BRANCH_ID"
ask_secret SLIP_KEY  "SLIPOK_API_KEY (hidden)"
ask        SLIP_MODE "SLIPOK_MODE (test/live)" "test"
ask        APP_PORT  "APP_PORT (127.0.0.1 only)" "3301"

umask 077
cat > "$ENV_FILE" <<ENV
NEXT_PUBLIC_SUPABASE_URL=$SUPA_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$SUPA_PUB
SUPABASE_SERVICE_ROLE_KEY=$SUPA_SRV
SLIPOK_BRANCH_ID=$SLIP_BR
SLIPOK_API_KEY=$SLIP_KEY
SLIPOK_MODE=$SLIP_MODE
APP_PORT=$APP_PORT
APP_IMAGE=ghcr.io/aqson0710/bcare-garage-booking-system:latest
ENV
chmod 600 "$ENV_FILE"
echo "Wrote $ENV_FILE (chmod 600). Keys: $(cut -d= -f1 "$ENV_FILE" | tr '\n' ' ')"
