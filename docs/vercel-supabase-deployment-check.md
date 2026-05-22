# SoulLoop Vercel + Supabase Deployment Check

Date: 2026-05-22

## Plugin Availability

Requested plugins:

- `@vercel`
- `@supabase`

Current Codex session result:

- No callable Vercel MCP/plugin tools are available.
- No callable Supabase MCP/plugin tools are available.
- No installable Vercel/Supabase plugin candidates were listed.

Fallback used:

- local project inspection;
- local `.env.local` key-name validation without printing secrets;
- Supabase service-role runtime validation through app scripts;
- Next.js build and route preflight;
- Stripe/Alipay sandbox payment smoke tests.

## Supabase Status

Status: passed.

Executed migration:

```text
/Users/zebramachine/Documents/soulloop/supabase/migrations/20260522000000_payment_completion.sql
```

Verified by:

```bash
npm run test:payments
```

Verified behavior:

- `payments` payment-completion fields exist.
- `credit_transactions` payment/provider fields exist.
- `public.complete_credit_payment(...)` exists.
- `public.apply_credit_transaction(...)` exists.
- Stripe app checkout session can be created.
- Signed Stripe webhook completes payment through `completePayment`.
- Stripe webhook replay is idempotent.
- A purchase credit transaction is written exactly once.
- Alipay signed order form can be generated.
- Alipay confirm-order route is reachable.
- Unsigned Alipay notify is rejected and does not add credits.

## Local Build Status

Status: passed.

Verified by:

```bash
npm run launch:preflight
```

Passed:

- env key presence check;
- `npm run lint`;
- `npm run build`;
- local route probes for:
  - `/`
  - `/credits`
  - `/payment-success`
  - `/referrals`
  - `/withdraw`
  - `/pricing`
  - `/privacy`
  - `/terms`
  - `/refund-policy`
  - `/contact`

## Vercel Link Status

Status: not locally linked.

Findings:

- No local `.vercel/project.json` was found.
- No `vercel.json` was found.
- `npx vercel --version` did not complete in this environment, so live Vercel project/env inspection could not be performed from Codex.

Action:

Use Vercel Dashboard to confirm the Production environment variables below.

## Required Vercel Production Environment Variables

Set these in:

```text
Vercel Project > Settings > Environment Variables > Production
```

Required values:

```env
NEXT_PUBLIC_APP_URL=https://soulloop-demo.vercel.app
NEXT_PUBLIC_ENABLE_ALIPAY=false
NEXT_PUBLIC_SUPABASE_URL=<set>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<set>
SUPABASE_SERVICE_ROLE_KEY=<set>
DEEPSEEK_API_KEY=<set>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
ALIPAY_APP_ID=<set>
ALIPAY_PRIVATE_KEY=<set>
ALIPAY_PUBLIC_KEY=<set>
ALIPAY_GATEWAY=<set>
STRIPE_SECRET_KEY=<set>
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<set>
STRIPE_WEBHOOK_SECRET=<set>
```

Do not set this to `true` in production:

```env
ALIPAY_ALLOW_INSECURE_NOTIFY=true
```

Recommended production launch value:

```env
NEXT_PUBLIC_ENABLE_ALIPAY=false
```

Keep Alipay hidden until its production callback verification has been tested end to end.

## Stripe Webhook Requirement

In Stripe Dashboard, endpoint URL must be:

```text
https://soulloop-demo.vercel.app/api/stripe/webhook
```

Events:

```text
checkout.session.completed
```

Use the endpoint signing secret as:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

Do not use the root domain as the webhook URL.

## Remaining Launch Risk

Stripe API connectivity passed, but the Stripe account previously reported:

```text
charges_enabled=false
payouts_enabled=false
```

Before real paid launch, complete Stripe account activation in Dashboard.

## Next Production Test

After Vercel env variables are confirmed and a production deployment is created:

1. Open `https://soulloop-demo.vercel.app/credits`.
2. Log in.
3. Start Stripe checkout.
4. Complete a test-mode card payment.
5. Confirm `/payment-success` completes.
6. Confirm credits increase once.
7. Confirm one `credit_transactions` purchase row exists.
8. Replay the Stripe webhook once.
9. Confirm credits do not increase again.
