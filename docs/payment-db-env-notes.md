# SoulLoop Payment DB + Env Notes

Apply this SQL in Supabase before enabling Stripe or the shared payment completion service.

```sql
begin;

alter table public.payments
add column if not exists stripe_checkout_session_id text,
add column if not exists stripe_payment_intent_id text,
add column if not exists provider_order_id text,
add column if not exists completed_at timestamptz;

alter table public.credit_transactions
add column if not exists payment_id uuid references public.payments(id),
add column if not exists provider text,
add column if not exists stripe_session_id text,
add column if not exists stripe_checkout_session_id text,
add column if not exists idempotency_key text;

create unique index if not exists credit_transactions_purchase_payment_id_uidx
on public.credit_transactions(payment_id)
where payment_id is not null and type = 'purchase';

create unique index if not exists credit_transactions_new_user_bonus_uidx
on public.credit_transactions(user_id)
where type = 'grant' and reason = 'new_user_bonus';

create unique index if not exists credit_transactions_usage_message_id_uidx
on public.credit_transactions(message_id)
where message_id is not null and type = 'usage';

create unique index if not exists referral_rewards_payment_id_uidx
on public.referral_rewards(payment_id);

create unique index if not exists referrals_referred_user_id_uidx
on public.referrals(referred_user_id);

create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'cny',
  payout_method text not null check (payout_method in ('alipay', 'paypal', 'bank')),
  account_details jsonb not null,
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'paid', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_user_status_idx
on public.withdrawal_requests(user_id, status);

create or replace function public.apply_credit_transaction(
  p_user_id uuid,
  p_amount integer,
  p_type text,
  p_reason text default null,
  p_message_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_credits_balance integer;
begin
  if p_amount = 0 then
    raise exception 'Credit transaction amount cannot be zero';
  end if;

  select credits_balance
  into v_credits_balance
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception 'Profile not found for credit transaction user %', p_user_id;
  end if;

  if p_type = 'usage' and p_message_id is not null and exists (
    select 1
    from public.credit_transactions
    where message_id = p_message_id
      and type = 'usage'
  ) then
    return jsonb_build_object(
      'alreadyApplied', true,
      'creditsBalance', v_credits_balance
    );
  end if;

  if p_type = 'grant' and p_reason = 'new_user_bonus' and exists (
    select 1
    from public.credit_transactions
    where user_id = p_user_id
      and type = 'grant'
      and reason = 'new_user_bonus'
  ) then
    return jsonb_build_object(
      'alreadyApplied', true,
      'creditsBalance', v_credits_balance
    );
  end if;

  if p_amount < 0 and coalesce(v_credits_balance, 0) + p_amount < 0 then
    raise exception 'Insufficient credits for user %', p_user_id;
  end if;

  update public.profiles
  set
    credits_balance = coalesce(credits_balance, 0) + p_amount,
    updated_at = now()
  where id = p_user_id
  returning credits_balance into v_credits_balance;

  insert into public.credit_transactions (
    user_id,
    amount,
    type,
    reason,
    message_id
  )
  values (
    p_user_id,
    p_amount,
    p_type,
    p_reason,
    p_message_id
  );

  return jsonb_build_object(
    'alreadyApplied', false,
    'creditsBalance', v_credits_balance
  );
end;
$$;

create or replace function public.complete_credit_payment(
  p_payment_id uuid,
  p_provider_trade_no text default null,
  p_provider_order_id text default null,
  p_reason text default 'checkout',
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_credits_balance integer;
  v_referrer_user_id uuid;
  v_referrer_invite_code text;
  v_reward_amount_cents integer;
begin
  select *
  into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'Payment not found: %', p_payment_id;
  end if;

  if v_payment.status = 'completed' then
    select credits_balance
    into v_credits_balance
    from public.profiles
    where id = v_payment.user_id;

    return jsonb_build_object(
      'alreadyCompleted', true,
      'paymentId', v_payment.id,
      'status', 'completed',
      'creditsBalance', v_credits_balance
    );
  end if;

  if coalesce(v_payment.amount_total, 0) <= 0 then
    raise exception 'Payment amount_total must be positive for payment %', v_payment.id;
  end if;

  if coalesce(v_payment.credits_granted, 0) <= 0 then
    raise exception 'Payment credits_granted must be positive for payment %', v_payment.id;
  end if;

  update public.profiles
  set
    credits_balance = coalesce(credits_balance, 0) + v_payment.credits_granted,
    updated_at = now()
  where id = v_payment.user_id
  returning credits_balance into v_credits_balance;

  if not found then
    raise exception 'Profile not found for payment user %', v_payment.user_id;
  end if;

  update public.payments
  set
    status = 'completed',
    completed_at = coalesce(completed_at, now()),
    alipay_trade_no = case
      when provider = 'alipay' then coalesce(p_provider_trade_no, alipay_trade_no)
      else alipay_trade_no
    end,
    stripe_checkout_session_id = case
      when provider = 'stripe' then coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id)
      else stripe_checkout_session_id
    end,
    stripe_payment_intent_id = case
      when provider = 'stripe' then coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id)
      else stripe_payment_intent_id
    end,
    provider_order_id = coalesce(p_provider_order_id, provider_order_id)
  where id = v_payment.id
  returning * into v_payment;

  insert into public.credit_transactions (
    user_id,
    amount,
    type,
    reason,
    payment_id,
    provider,
    alipay_out_trade_no,
    stripe_session_id,
    stripe_checkout_session_id
  )
  select
    v_payment.user_id,
    v_payment.credits_granted,
    'purchase',
    p_reason,
    v_payment.id,
    v_payment.provider,
    v_payment.alipay_out_trade_no,
    v_payment.stripe_checkout_session_id,
    v_payment.stripe_checkout_session_id
  where not exists (
    select 1
    from public.credit_transactions
    where payment_id = v_payment.id
      and type = 'purchase'
  );

  select referred_by_user_id
  into v_referrer_user_id
  from public.profiles
  where id = v_payment.user_id;

  if v_referrer_user_id is not null and v_referrer_user_id <> v_payment.user_id then
    select invite_code
    into v_referrer_invite_code
    from public.profiles
    where id = v_referrer_user_id;

    insert into public.referrals (
      referrer_user_id,
      referred_user_id,
      invite_code,
      status
    )
    select
      v_referrer_user_id,
      v_payment.user_id,
      coalesce(v_referrer_invite_code, 'UNKNOWN'),
      'active'
    where not exists (
      select 1
      from public.referrals
      where referred_user_id = v_payment.user_id
    );

    v_reward_amount_cents := floor(v_payment.amount_total * 2000 / 10000);

    if v_reward_amount_cents > 0 then
      insert into public.referral_rewards (
        referrer_user_id,
        referred_user_id,
        payment_id,
        amount_cents,
        currency,
        source_amount_cents,
        reward_rate_bps,
        status,
        available_at
      )
      select
        v_referrer_user_id,
        v_payment.user_id,
        v_payment.id,
        v_reward_amount_cents,
        coalesce(v_payment.currency, 'cny'),
        v_payment.amount_total,
        2000,
        'pending',
        now() + interval '7 days'
      where not exists (
        select 1
        from public.referral_rewards
        where payment_id = v_payment.id
      );
    end if;
  end if;

  return jsonb_build_object(
    'alreadyCompleted', false,
    'paymentId', v_payment.id,
    'status', 'completed',
    'creditsBalance', v_credits_balance
  );
end;
$$;

grant execute on function public.complete_credit_payment(
  uuid,
  text,
  text,
  text,
  text,
  text
) to service_role;

grant execute on function public.apply_credit_transaction(
  uuid,
  integer,
  text,
  text,
  uuid
) to service_role;

commit;
```

Required local environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat

ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_GATEWAY=https://openapi-sandbox.dl.alipaydev.com/gateway.do
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_ENABLE_ALIPAY=false

STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

Production payment rules:

- Do not set `ALIPAY_ALLOW_INSECURE_NOTIFY=true`.
- Stripe webhook requests must pass `STRIPE_WEBHOOK_SECRET` signature verification.
- Alipay notify requests must pass Alipay public-key verification.
- Do not manually repair credits with SQL as product logic.
