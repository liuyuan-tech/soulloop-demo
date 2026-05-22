# SoulLoop Local ENV Setup

Use this file to recreate the local runtime after the dependency recovery work.
Do not commit real secrets.

## Runtime Restored

```bash
export PATH="$HOME/.codex-local-tools/node-v24.14.0-darwin-arm64/bin:$PATH"

node --version
npm --version
npx --version
```

Expected:

```text
node v24.14.0
npm 11.9.0
npx 11.9.0
```

Installed dependencies:

```text
node_modules restored with npm ci
Next.js v16.2.6
```

## Local `.env.local` Template

Create `/Users/zebramachine/Documents/soulloop/.env.local` manually with real values:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_ENABLE_ALIPAY=false

# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# DeepSeek
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

# Alipay
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do

# Stripe
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

## Verification Commands

After filling `.env.local`, run:

```bash
export PATH="$HOME/.codex-local-tools/node-v24.14.0-darwin-arm64/bin:$PATH"
npm run lint
npm run build
npm run dev
```

The verified build command passed with placeholder env values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key \
SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key \
DEEPSEEK_API_KEY=dummy-deepseek-key \
ALIPAY_APP_ID=dummy-alipay-app-id \
ALIPAY_PRIVATE_KEY=dummy-private-key \
ALIPAY_PUBLIC_KEY=dummy-public-key \
STRIPE_SECRET_KEY=sk_test_dummy \
STRIPE_WEBHOOK_SECRET=whsec_dummy \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
npm run build
```

Verified results:

```text
npm run lint: passed
npm run build: passed
Generated routes: 31 app routes, including Stripe, Alipay, referrals, withdraw, and compliance pages
```

## Payment Database Setup

Before testing real payment completion, apply the SQL in:

```text
/Users/zebramachine/Documents/soulloop/docs/payment-db-env-notes.md
```

Required RPC functions from that SQL:

```text
public.complete_credit_payment
public.apply_credit_transaction
```

Without those functions, payment completion and credit changes will fail at runtime.

## Notes

- `.env.local` is intentionally not committed.
- Do not enable any insecure Alipay notify bypass.
- Stripe webhook must use `STRIPE_WEBHOOK_SECRET`.
- Alipay notify must verify with the Alipay public key.
- `npm ci` reported 2 moderate vulnerabilities. Do not run `npm audit fix --force` casually because it can change major dependency versions.
