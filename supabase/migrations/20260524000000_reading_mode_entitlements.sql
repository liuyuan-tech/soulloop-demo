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
language sql
security definer
set search_path = public
begin atomic
  with
    input as (
      select
        p_user_id as user_id,
        p_mode as mode,
        p_credits_cost as credits_cost,
        p_mode in ('tarot', 'color_personality', 'daily_loop') as mode_valid,
        coalesce(p_credits_cost, 0) > 0 as cost_valid
    ),
    locked_profile as (
      select p.id, coalesce(p.credits_balance, 0) as credits_balance
      from public.profiles p
      join input i on i.user_id = p.id
      for update
    ),
    existing as (
      select e.id, e.mode
      from public.reading_mode_entitlements e
      join input i on i.user_id = e.user_id and i.mode = e.mode
      where e.status = 'active'
      limit 1
    ),
    inserted_entitlement as (
      insert into public.reading_mode_entitlements (
        user_id,
        mode,
        source,
        credits_spent
      )
      select
        i.user_id,
        i.mode,
        'credit_unlock',
        i.credits_cost
      from input i
      join locked_profile p on true
      where i.mode_valid
        and i.cost_valid
        and p.credits_balance >= i.credits_cost
        and not exists (select 1 from existing)
      on conflict do nothing
      returning id, mode
    ),
    debited_profile as (
      update public.profiles p
      set
        credits_balance = coalesce(p.credits_balance, 0) - i.credits_cost,
        updated_at = now()
      from input i
      where p.id = i.user_id
        and exists (select 1 from inserted_entitlement)
      returning p.credits_balance
    ),
    credit_entry as (
      insert into public.credit_transactions (
        user_id,
        amount,
        type,
        reason
      )
      select
        i.user_id,
        -i.credits_cost,
        'usage',
        'unlock_' || i.mode
      from input i
      where exists (select 1 from debited_profile)
      returning id
    )
  select case
    when not (select mode_valid from input) then
      jsonb_build_object(
        'error', 'Unsupported reading mode: ' || p_mode,
        'code', 'UNSUPPORTED_READING_MODE',
        'mode', p_mode
      )
    when not (select cost_valid from input) then
      jsonb_build_object(
        'error', 'Reading mode unlock cost must be positive',
        'code', 'INVALID_READING_MODE_COST',
        'mode', p_mode
      )
    when not exists (select 1 from locked_profile) then
      jsonb_build_object(
        'error', 'Profile not found for reading mode unlock user ' || p_user_id::text,
        'code', 'PROFILE_NOT_FOUND',
        'mode', p_mode
      )
    when exists (select 1 from existing) then
      jsonb_build_object(
        'alreadyOwned', true,
        'entitlementId', (select id from existing limit 1),
        'mode', p_mode,
        'creditsBalance', (select credits_balance from locked_profile limit 1)
      )
    when (select credits_balance from locked_profile limit 1) < p_credits_cost then
      jsonb_build_object(
        'error', 'Insufficient credits for reading mode unlock user ' || p_user_id::text,
        'code', 'INSUFFICIENT_CREDITS',
        'insufficientCredits', true,
        'mode', p_mode,
        'creditsBalance', (select credits_balance from locked_profile limit 1)
      )
    when exists (select 1 from inserted_entitlement) then
      jsonb_build_object(
        'alreadyOwned', false,
        'entitlementId', (select id from inserted_entitlement limit 1),
        'mode', p_mode,
        'creditsBalance', (select credits_balance from debited_profile limit 1),
        'creditTransactionWritten', exists (select 1 from credit_entry)
      )
    else
      jsonb_build_object(
        'error', 'Reading mode unlock conflict, please retry',
        'code', 'UNLOCK_CONFLICT_RETRY',
        'mode', p_mode,
        'creditsBalance', (select credits_balance from locked_profile limit 1)
      )
  end;
end;

grant execute on function public.unlock_reading_mode(
  uuid,
  text,
  integer
) to service_role;

commit;
