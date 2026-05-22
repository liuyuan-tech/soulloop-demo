#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env.local"

touch "$ENV_FILE"

read -r -p "Stripe publishable key (pk_test_... or pk_live_...): " STRIPE_PUBLISHABLE_KEY

read -r -s -p "Stripe secret key (sk_test_... or sk_live_...): " STRIPE_SECRET_KEY
printf "\n"

read -r -s -p "Stripe webhook secret (whsec_...): " STRIPE_WEBHOOK_SECRET
printf "\n"

if [[ ! "$STRIPE_PUBLISHABLE_KEY" =~ ^pk_(test|live)_ ]]; then
  echo "Invalid NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY. It should start with pk_test_ or pk_live_." >&2
  exit 1
fi

if [[ ! "$STRIPE_SECRET_KEY" =~ ^sk_(test|live)_ ]]; then
  echo "Invalid STRIPE_SECRET_KEY. It should start with sk_test_ or sk_live_." >&2
  exit 1
fi

if [[ ! "$STRIPE_WEBHOOK_SECRET" =~ ^whsec_ ]]; then
  echo "Invalid STRIPE_WEBHOOK_SECRET. It should start with whsec_." >&2
  exit 1
fi

BACKUP_FILE="$ENV_FILE.backup.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE"

update_env_key() {
  local key="$1"
  local value="$2"
  local escaped_value

  escaped_value="$(printf '%s' "$value" | sed 's/[\/&]/\\&/g')"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i '' "s/^${key}=.*/${key}=${escaped_value}/" "$ENV_FILE"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

update_env_key "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
update_env_key "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$STRIPE_PUBLISHABLE_KEY"
update_env_key "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"

echo "Stripe ENV values written to $ENV_FILE"
echo "Previous ENV backup saved to $BACKUP_FILE"
