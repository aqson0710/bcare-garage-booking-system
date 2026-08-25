-- Step 9 Part 4.2: Technician multi-skill schema.
-- Run this in Supabase SQL Editor after Step 8 admin role setup.
-- This keeps technician identity in public.profiles and stores reusable skill
-- labels in separate tables so one technician can have many skills.

create table if not exists public.technician_skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_skills_status_check
    check (status in ('active', 'inactive'))
);

create table if not exists public.technician_profile_skills (
  technician_id uuid not null references public.profiles(id) on delete cascade,
  skill_id uuid not null references public.technician_skills(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (technician_id, skill_id)
);

create index if not exists technician_skills_status_idx
on public.technician_skills(status);

create index if not exists technician_profile_skills_skill_id_idx
on public.technician_profile_skills(skill_id);

alter table public.technician_skills enable row level security;
alter table public.technician_profile_skills enable row level security;

drop policy if exists "Anyone authenticated can read active technician skills"
on public.technician_skills;
create policy "Anyone authenticated can read active technician skills"
on public.technician_skills
for select
to authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists "Admins can manage technician skills"
on public.technician_skills;
create policy "Admins can manage technician skills"
on public.technician_skills
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins and own technician can read profile skills"
on public.technician_profile_skills;
create policy "Admins and own technician can read profile skills"
on public.technician_profile_skills
for select
to authenticated
using (
  public.current_user_is_admin()
  or technician_id = auth.uid()
);

drop policy if exists "Admins and own technician can insert profile skills"
on public.technician_profile_skills;
create policy "Admins and own technician can insert profile skills"
on public.technician_profile_skills
for insert
to authenticated
with check (
  public.current_user_is_admin()
  or (
    technician_id = auth.uid()
    and public.current_user_role() = 'technician'
  )
);

drop policy if exists "Admins and own technician can update profile skills"
on public.technician_profile_skills;
create policy "Admins and own technician can update profile skills"
on public.technician_profile_skills
for update
to authenticated
using (
  public.current_user_is_admin()
  or (
    technician_id = auth.uid()
    and public.current_user_role() = 'technician'
  )
)
with check (
  public.current_user_is_admin()
  or (
    technician_id = auth.uid()
    and public.current_user_role() = 'technician'
  )
);

drop policy if exists "Admins and own technician can delete profile skills"
on public.technician_profile_skills;
create policy "Admins and own technician can delete profile skills"
on public.technician_profile_skills
for delete
to authenticated
using (
  public.current_user_is_admin()
  or (
    technician_id = auth.uid()
    and public.current_user_role() = 'technician'
  )
);

insert into public.technician_skills (name, description)
values
  ('Engine', 'Engine inspection, diagnosis, and repair'),
  ('Electrical', 'Battery, wiring, lighting, and electrical systems'),
  ('Suspension', 'Suspension and undercarriage inspection or repair'),
  ('Brakes', 'Brake inspection, pads, discs, and related systems'),
  ('Air conditioning', 'Vehicle air conditioning inspection and repair'),
  ('Tires and wheels', 'Tires, wheels, balancing, and related service')
on conflict (name) do nothing;
