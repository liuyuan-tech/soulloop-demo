#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_NODE="$HOME/.codex-local-tools/node-v24.14.0-darwin-arm64/bin"

if [ -d "$LOCAL_NODE" ]; then
  export PATH="$LOCAL_NODE:$PATH"
fi

cd "$ROOT_DIR"

required_env=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "DEEPSEEK_API_KEY"
  "ALIPAY_APP_ID"
  "ALIPAY_PRIVATE_KEY"
  "ALIPAY_PUBLIC_KEY"
  "STRIPE_SECRET_KEY"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "STRIPE_WEBHOOK_SECRET"
)

echo "== SoulLoop launch preflight =="
echo "Project: $ROOT_DIR"
echo "Node: $(node --version)"
echo "npm: $(npm --version)"

if [ ! -f ".env.local" ]; then
  echo "Missing .env.local"
  exit 1
fi

missing_env=()
for key in "${required_env[@]}"; do
  line="$(grep -E "^${key}=" .env.local | tail -n 1 || true)"
  value="${line#*=}"

  if [ -z "$line" ] || [ -z "$value" ]; then
    missing_env+=("$key")
  else
    echo "env $key: set"
  fi
done

if [ "${#missing_env[@]}" -gt 0 ]; then
  echo "Missing required env keys:"
  printf '  %s\n' "${missing_env[@]}"
  exit 1
fi

echo "== lint =="
npm run lint

echo "== build =="
npm run build

base_url="${1:-http://127.0.0.1:3000}"

echo "== route probe: $base_url =="
routes=(
  "/"
  "/credits"
  "/payment-success"
  "/referrals"
  "/withdraw"
  "/pricing"
  "/privacy"
  "/terms"
  "/refund-policy"
  "/contact"
)

failed_routes=()
for route in "${routes[@]}"; do
  code="$(curl -sS -o /dev/null -w "%{http_code}" "$base_url$route" || true)"
  echo "$code $route"

  if [ "$code" != "200" ]; then
    failed_routes+=("$route:$code")
  fi
done

if [ "${#failed_routes[@]}" -gt 0 ]; then
  echo "Routes failed:"
  printf '  %s\n' "${failed_routes[@]}"
  exit 1
fi

echo "Preflight passed."
