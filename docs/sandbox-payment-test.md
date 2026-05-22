# SoulLoop Sandbox Payment Test

Run this after the Supabase payment SQL has been applied.

```bash
export PATH="$HOME/.codex-local-tools/node-v24.14.0-darwin-arm64/bin:$PATH"
npm run test:providers
npm run test:stripe:direct
npm run test:alipay:direct
npm run test:payments
```

The script uses `.env.local` without printing secret values.

It verifies:

- local app responds on `http://127.0.0.1:3000`;
- Supabase payment columns exist;
- `complete_credit_payment` RPC exists;
- a temporary smoke user can be created and signed in;
- an active credit package exists;
- Stripe Checkout session can be created with the app route;
- Stripe webhook signature verification works with `STRIPE_WEBHOOK_SECRET`;
- Stripe completion runs through `completePayment`;
- Stripe webhook replay does not duplicate credits;
- one purchase row is written to `credit_transactions`;
- Alipay order form generation works;
- Alipay confirm-order route is reachable;
- unsigned Alipay notify is rejected and does not add credits.

Current result on 2026-05-22:

```text
Provider connectivity:
Stripe API reachable.
Stripe account country: HK.
Stripe charges_enabled: false.
Stripe payouts_enabled: false.
Alipay sandbox gateway reachable.
Direct Stripe Checkout session creation works.
Direct Stripe sandbox card payment was completed in Checkout and returned to local /payment-success.
Direct Alipay page-pay form was accepted by Alipay sandbox and reached the sandbox cashier page.

Blocked before payment testing:
- payments.provider_order_id does not exist
- credit_transactions.payment_id does not exist
- public.complete_credit_payment(...) is missing from the schema cache
```

Next action:

Apply the SQL in:

```text
/Users/zebramachine/Documents/soulloop/docs/payment-db-env-notes.md
```

Then rerun:

```bash
npm run test:payments
```
