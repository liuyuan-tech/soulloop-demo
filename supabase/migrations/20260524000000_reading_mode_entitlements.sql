begin;

create table if not exists public.reading_mode_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('tarot', 'color_personality', 'daily_loop')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  source text not null default 'credit_unlock',
  credits_spent integer not null default 0 check (credits_spent >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists reading_mode_entitlements_active_uidx
on public.reading_mode_entitlements(user_id, mode)
where status = 'active';

create index if not exists reading_mode_entitlements_user_status_idx
on public.reading_mode_entitlements(user_id, status);

alter table public.reading_mode_entitlements enable row level security;

drop policy if exists reading_mode_entitlements_select_own
on public.reading_mode_entitlements;

create policy reading_mode_entitlements_select_own
on public.reading_mode_entitlements
for select
to authenticated
using (user_id = auth.uid());

grant select on public.reading_mode_entitlements to authenticated;
grant select, insert, update, delete on public.reading_mode_entitlements to service_role;

create or replace function public.unlock_reading_mode(
  p_user_id uuid,
  p_mode text,
  p_credits_cost integer
)
returns jsonb
as '
declare
  v_credits_balance integer;
  v_entitlement_id uuid;
begin
  if p_mode not in (''tarot'', ''color_personality'', ''daily_loop'') then
    raise exception ''Unsupported reading mode: %'', p_mode;
  end if;

  if coalesce(p_credits_cost, 0) <= 0 then
    raise exception ''Reading mode unlock cost must be positive'';
  end if;

  select credits_balance
  into v_credits_balance
  from public.profiles
  where id = p_user_id
  for update;

  if not found then
    raise exception ''Profile not found for reading mode unlock user %'', p_user_id;
  end if;

  select id
  into v_entitlement_id
  from public.reading_mode_entitlements
  where user_id = p_user_id
    and mode = p_mode
    and status = ''active''
  limit 1;

  if v_entitlement_id is not null then
    return jsonb_build_object(
      ''alreadyOwned'', true,
      ''entitlementId'', v_entitlement_id,
      ''mode'', p_mode,
      ''creditsBalance'', v_credits_balance
    );
  end if;

  if coalesce(v_credits_balance, 0) < p_credits_cost then
    raise exception ''Insufficient credits for reading mode unlock user %'', p_user_id;
  end if;

  update public.profiles
  set
    credits_balance = coalesce(credits_balance, 0) - p_credits_cost,
    updated_at = now()
  where id = p_user_id
  returning credits_balance into v_credits_balance;

  insert into public.credit_transactions (
    user_id,
    amount,
    type,
    reason
  )
  values (
    p_user_id,
    -p_credits_cost,
    ''usage'',
    ''unlock_'' || p_mode
  );

  insert into public.reading_mode_entitlements (
    user_id,
    mode,
    source,
    credits_spent
  )
  values (
    p_user_id,
    p_mode,
    ''credit_unlock'',
    p_credits_cost
  )
  returning id into v_entitlement_id;

  return jsonb_build_object(
    ''alreadyOwned'', false,
    ''entitlementId'', v_entitlement_id,
    ''mode'', p_mode,
    ''creditsBalance'', v_credits_balance
  );
end;
'
language plpgsql
security definer
set search_path = public;

grant execute on function public.unlock_reading_mode(
  uuid,
  text,
  integer
) to service_role;

commit;
