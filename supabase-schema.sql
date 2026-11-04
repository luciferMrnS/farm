create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'Lucea''s Poultry Farm',
  data jsonb not null default '{"flocks":[],"collections":[],"sales":[],"otherIncome":[],"inventory":[],"health":[],"expenses":[],"feedings":[],"currency":"NGN"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.farms enable row level security;

revoke all on public.farms from anon;
grant select, insert, update on public.farms to authenticated;

drop policy if exists "Farm owners can read their farm" on public.farms;
create policy "Farm owners can read their farm"
  on public.farms for select
  to authenticated
  using ((select auth.uid()) = owner_id);

drop policy if exists "Users can create their own farm" on public.farms;
create policy "Users can create their own farm"
  on public.farms for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Farm owners can update their farm" on public.farms;
create policy "Farm owners can update their farm"
  on public.farms for update
  to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
