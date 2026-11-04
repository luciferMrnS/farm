create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'Lucea''s Poultry Farm',
  data jsonb not null default '{"flocks":[],"collections":[],"sales":[],"otherIncome":[],"inventory":[],"health":[],"expenses":[],"feedings":[],"currency":"NGN"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.farm_members (
  farm_id uuid not null references public.farms (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'assistant_manager')),
  is_primary_manager boolean not null default false,
  requires_password_setup boolean not null default false,
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (farm_id, user_id),
  check (not is_primary_manager or role = 'manager')
);

alter table public.farm_members
  add column if not exists requires_password_setup boolean not null default false;

create unique index if not exists farm_members_farm_email_unique
  on public.farm_members (farm_id, lower(email));

insert into public.farm_members (farm_id, user_id, email, role, is_primary_manager)
select f.id, u.id, lower(coalesce(u.email, '')), 'manager', true
from public.farms f
join auth.users u on u.id = f.owner_id
on conflict (farm_id, user_id) do nothing;

alter table public.farms enable row level security;
alter table public.farm_members enable row level security;

create or replace function public.is_farm_member(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_members m
    where m.farm_id = target_farm_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_primary_farm_manager(target_farm_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.farm_members m
    where m.farm_id = target_farm_id
      and m.user_id = (select auth.uid())
      and m.is_primary_manager
  );
$$;

revoke all on function public.is_farm_member(uuid) from public, anon;
revoke all on function public.is_primary_farm_manager(uuid) from public, anon;
grant execute on function public.is_farm_member(uuid) to authenticated;
grant execute on function public.is_primary_farm_manager(uuid) to authenticated;

create or replace function public.complete_farm_member_setup()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.farm_members
  set requires_password_setup = false
  where user_id = (select auth.uid());

  if not found then
    raise exception 'Farm membership was not found.';
  end if;
end;
$$;

revoke all on function public.complete_farm_member_setup() from public, anon;
grant execute on function public.complete_farm_member_setup() to authenticated;

revoke all on public.farms from anon, authenticated;
grant select on public.farms to authenticated;
grant update (data, updated_at) on public.farms to authenticated;

revoke all on public.farm_members from anon, authenticated;
grant select on public.farm_members to authenticated;
grant all on public.farm_members to service_role;

drop policy if exists "Farm owners can read their farm" on public.farms;
drop policy if exists "Users can create their own farm" on public.farms;
drop policy if exists "Farm owners can update their farm" on public.farms;
drop policy if exists "Farm members can read their farm" on public.farms;
create policy "Farm members can read their farm"
  on public.farms for select
  to authenticated
  using (public.is_farm_member(id));

drop policy if exists "Farm members can update their farm" on public.farms;
create policy "Farm members can update their farm"
  on public.farms for update
  to authenticated
  using (public.is_farm_member(id))
  with check (public.is_farm_member(id));

drop policy if exists "Users can read their own membership" on public.farm_members;
drop policy if exists "Primary managers can read farm memberships" on public.farm_members;
create policy "Users can read their own membership"
  on public.farm_members for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Primary managers can read farm memberships"
  on public.farm_members for select
  to authenticated
  using (public.is_primary_farm_manager(farm_id));
