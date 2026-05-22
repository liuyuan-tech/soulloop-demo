# SoulLoop Day1 + Day2 Launch Tasks

This file merges the original Day1 infrastructure work and Day2 payment-closure testing into one execution plan for the 2026-05-24 launch window.

## Launch Rule

Ship only the paid MVP until these tasks pass:

- Stripe checkout can create a payment.
- Stripe webhook verifies the signature.
- `completePayment` completes the payment idempotently.
- Credits increase exactly once.
- Every credit increase writes `credit_transactions`.
- Required legal and support pages are reachable.

Alipay must not block launch. If Alipay callback verification or sandbox/production credentials are not fully verified, keep the code but hide or disable the Alipay purchase button for launch.

## Task A: Local Code Preflight

Owner: Codex / local machine

Run:

```bash
/Users/zebramachine/Documents/soulloop/tools/launch_preflight.sh
```

Payment sandbox smoke test:

```bash
npm run test:providers
npm run test:stripe:direct
npm run test:alipay:direct
npm run test:payments
```

Status checklist:

- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] Local dev server responds on `http://127.0.0.1:3000`.
- [x] These routes return HTTP 200:
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
- [x] Payment code routes Stripe and Alipay completion through `completePayment`.
- [x] Stripe webhook route requires `STRIPE_WEBHOOK_SECRET`.
- [x] Alipay notify route verifies the Alipay signature.

Last local execution:

```text
2026-05-21: /Users/zebramachine/Documents/soulloop/tools/launch_preflight.sh passed.
2026-05-22: npm run launch:preflight passed.
```

## Task B: Supabase Database Setup

Owner: user in Supabase SQL editor

Current status:

- [x] Supabase payment SQL executed on 2026-05-22.
- [x] `npm run test:payments` passed after SQL migration.
- [x] Stripe API connectivity passed with test key.
- [x] Alipay sandbox gateway connectivity passed.
- [x] Direct Stripe Checkout sandbox card payment passed.
- [x] Direct Alipay sandbox cashier page reached after signed page.pay request.
- [x] Product UI Stripe Checkout completed with test card.
- [x] Product `confirm-session` increased credits once and wrote one purchase transaction.
- [x] Repeated confirmation and signed webhook replay did not duplicate credits.
- [x] User manual Stripe test payment completed for 700 credits; payment completed, balance updated, and webhook replay stayed idempotent.
- [ ] Stripe account currently reports `charges_enabled=false`; verify Stripe account setup before real paid launch.

Run the SQL in:

```text
/Users/zebramachine/Documents/soulloop/docs/payment-db-env-notes.md
```

Standalone migration file:

```text
/Users/zebramachine/Documents/soulloop/supabase/migrations/20260522000000_payment_completion.sql
```

Required result:

- `payments` has provider/order/session completion fields.
- `credit_transactions` has payment/provider/idempotency fields.
- `public.complete_credit_payment(...)` exists.
- `public.apply_credit_transaction(...)` exists.
- Unique indexes prevent duplicate purchase credits, duplicate new-user bonus grants, duplicate usage charges, duplicate referral rewards, and duplicate referred-user binding.
- `withdrawal_requests` exists for MVP manual payout requests.

## Task C: Vercel Production Environment

Owner: user in Vercel dashboard

Set these variables in the Vercel project Production environment:

```env
NEXT_PUBLIC_APP_URL=https://soulloop-demo.vercel.app
NEXT_PUBLIC_ENABLE_ALIPAY=false
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Do not upload `.env.local`.

## Task D: Stripe Webhook Configuration

Owner: user in Stripe dashboard

Create exactly one webhook endpoint:

```text
https://soulloop-demo.vercel.app/api/stripe/webhook
```

Required configuration:

- Payload style: Snapshot
- Events from: Your account
- Event: `checkout.session.completed`
- Signing secret: copy the endpoint `whsec_...` value into Vercel `STRIPE_WEBHOOK_SECRET`.

Do not use the root domain as the webhook URL.

Keep `NEXT_PUBLIC_ENABLE_ALIPAY=false` until Alipay production callback verification has been tested end to end.

## Task E: Production Payment Closure Test

Owner: user + Codex after Vercel deploy

Test sequence:

- [ ] Deploy production after Supabase and Vercel env are complete.
- [ ] Open `https://soulloop-demo.vercel.app/credits`.
- [ ] Start Stripe checkout.
- [ ] Complete payment with a Stripe test card.
- [ ] Return to `/payment-success?provider=stripe...`.
- [ ] Confirm user credits increased.
- [ ] Confirm `payments.status = completed`.
- [ ] Confirm `credit_transactions` has one `purchase` row for the payment.
- [ ] Replay the Stripe webhook once from Stripe dashboard.
- [ ] Confirm credits did not increase a second time.
- [ ] Refresh `/payment-success`.
- [ ] Confirm credits did not increase a second time.

## Task F: Launch Decision

Ship on 2026-05-24 only if all are true:

- Stripe payment completion is verified in production.
- Webhook replay is idempotent.
- Refreshing success page is idempotent.
- Legal/support pages are reachable.
- Alipay is either fully verified or disabled from the launch purchase UI.

No-go if any of these are true:

- Stripe webhook signing secret is missing or wrong.
- Supabase SQL was not applied.
- Payment completion requires manual SQL repair.
- Credits can be duplicated by webhook replay or page refresh.
- `credit_transactions` is missing for a credit increase.
