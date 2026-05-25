# SoulLoop Manual Payment Test Checklist

Use this checklist for the manual testing phase on 2026-05-22.

## 1. Execute Supabase SQL

Open Supabase:

```text
Supabase Project > SQL Editor > New query
```

Paste and run the full content of:

```text
/Users/zebramachine/Documents/soulloop/supabase/migrations/20260522000000_payment_completion.sql
```

Then paste and run the full content of:

```text
/Users/zebramachine/Documents/soulloop/supabase/migrations/20260524000000_reading_mode_entitlements.sql
```

This SQL does the following:

- adds Stripe/payment completion columns to `payments`;
- adds payment/provider/idempotency columns to `credit_transactions`;
- creates idempotency indexes for purchases, bonuses, usage, referrals, and rewards;
- creates `withdrawal_requests`;
- creates `public.apply_credit_transaction(...)`;
- creates `public.complete_credit_payment(...)`;
- grants RPC execution to `service_role`.
- creates `reading_mode_entitlements`;
- enables own-row RLS for authenticated users;
- creates `public.unlock_reading_mode(...)` for credits-based paid mode unlocks.

Expected Supabase result:

```text
Success. No rows returned
```

Current status:

```text
2026-05-22: SQL executed successfully in Supabase.
```

If Supabase reports that `referral_rewards`, `referrals`, `payments`, `credit_transactions`, or `profiles` does not exist, stop and report the exact error.

## 2. Run Local Automated Preflight

After the SQL succeeds, run:

```bash
cd /Users/zebramachine/Documents/soulloop
export PATH="$HOME/.codex-local-tools/node-v24.14.0-darwin-arm64/bin:$PATH"
npm run launch:preflight
npm run test:providers
npm run test:payments
npm run test:entitlements
```

Expected:

- `launch:preflight` passes;
- `test:providers` shows Stripe and Alipay reachable;
- `test:payments` passes Stripe signed webhook, idempotency, and Alipay unsigned-notify rejection.
- `test:entitlements` creates temporary users, verifies `reading_mode_entitlements` schema access, confirms RLS only exposes own rows, and validates `unlock_reading_mode` debit + idempotency.

Current status:

```text
2026-05-22: npm run launch:preflight passed.
2026-05-22: npm run test:payments passed after SQL migration.
2026-05-22: local NEXT_PUBLIC_APP_URL fixed to http://127.0.0.1:3000.
```

## 3. Manual Stripe Sandbox Checkout

Run:

```bash
npm run test:stripe:direct
```

Open the returned Stripe Checkout URL.

Use Stripe test card:

```text
Card: 4242 4242 4242 4242
Expiry: any future date, for example 12/34
CVC: any 3 digits, for example 123
Email: any test email
```

Expected:

- Stripe Checkout loads;
- test payment succeeds;
- browser returns to `/payment-success`;
- Stripe Dashboard shows the checkout session as `paid`.

Current product-flow status:

```text
2026-05-22: Product UI Stripe Checkout opened from /credits.
2026-05-22: Stripe test card payment completed.
2026-05-22: Local confirm-session completed payment and increased credits from 120 to 220.
2026-05-22: Repeating confirm-session did not duplicate credits.
2026-05-22: Replaying signed Stripe webhook did not duplicate credits.
2026-05-22: purchase credit_transactions row count remained 1.
2026-05-22: User manual Stripe payment completed for 700 credits.
2026-05-22: Manual payment row status is completed, user balance is 2196, and one purchase credit_transaction exists.
2026-05-22: Signed webhook replay for the manual payment did not duplicate credits.
```

## 4. Manual Alipay Sandbox Checkout

Run:

```bash
npm run test:alipay:direct
```

Open the generated HTML form. If browser blocks `file://`, serve it locally:

```bash
npx --yes serve .local-logs -l 3101
```

Then open the generated file through:

```text
http://127.0.0.1:3101/<generated-alipay-file-name>
```

Expected:

- Alipay sandbox accepts the signed request;
- browser reaches `excashier-sandbox.dl.alipaydev.com`;
- page shows the SoulLoop order, amount, login box, or QR payment box.

## 5. Product Flow Manual Test

After SQL and `npm run test:payments` pass:

- log in to SoulLoop locally;
- open `http://127.0.0.1:3000/credits`;
- click `Buy with Stripe`;
- complete Stripe Checkout with test card;
- return to `/payment-success`;
- verify credits increased once;
- verify one `credit_transactions` purchase row exists;
- replay the Stripe webhook in Stripe Dashboard;
- verify credits did not increase again;
- refresh `/payment-success`;
- verify credits did not increase again.

## 6. Launch Decision

Do not launch paid traffic until:

- Supabase SQL has been applied;
- `npm run test:payments` passes;
- Stripe product flow credits arrive exactly once;
- webhook replay is idempotent;
- `/credits`, `/payment-success`, `/privacy`, `/terms`, `/refund-policy`, and `/contact` all work;
- Alipay is either fully tested or hidden with `NEXT_PUBLIC_ENABLE_ALIPAY=false`.
