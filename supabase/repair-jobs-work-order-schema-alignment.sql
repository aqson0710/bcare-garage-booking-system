-- Step 9 Part 1: Repair jobs work order schema alignment.
-- Run this in Supabase SQL Editor after Step 8 admin role setup.
-- This keeps the existing database direction:
-- - public.repair_jobs is the work order table.
-- - public.repair_jobs.mechanic_id stores the assigned technician profile id.
-- - public.profiles.role = 'technician' stores the account role.

do $$
begin
  if to_regclass('public.repair_jobs') is null then
    raise exception 'public.repair_jobs table is required before Step 9 Part 1';
  end if;
end $$;

alter table public.repair_jobs
add column if not exists booking_id uuid references public.bookings(id) on delete cascade,
add column if not exists customer_id uuid references public.profiles(id) on delete cascade,
add column if not exists vehicle_id uuid references public.vehicles(id) on delete cascade,
add column if not exists mechanic_id uuid references public.profiles(id) on delete set null,
add column if not exists diagnosis text,
add column if not exists repair_notes text,
add column if not exists started_at timestamptz,
add column if not exists completed_at timestamptz,
add column if not exists created_at timestamptz not null default now(),
add column if not exists updated_at timestamptz not null default now();

do $$
declare
  repair_jobs_status_type text;
begin
  select data_type
  into repair_jobs_status_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'repair_jobs'
    and column_name = 'status';

  if repair_jobs_status_type in ('text', 'character varying') then
    alter table public.repair_jobs
    drop constraint if exists repair_jobs_status_check;

    alter table public.repair_jobs
    add constraint repair_jobs_status_check
    check (status in ('pending', 'assigned', 'in_progress', 'completed', 'cancelled')) not valid;
  else
    raise notice 'Skipping repair_jobs_status_check because repair_jobs.status is %', repair_jobs_status_type;
  end if;
end $$;

create index if not exists repair_jobs_booking_id_idx
on public.repair_jobs(booking_id);

create index if not exists repair_jobs_customer_id_idx
on public.repair_jobs(customer_id);

create index if not exists repair_jobs_vehicle_id_idx
on public.repair_jobs(vehicle_id);

create index if not exists repair_jobs_mechanic_id_idx
on public.repair_jobs(mechanic_id);

create index if not exists repair_jobs_status_idx
on public.repair_jobs(status);

alter table public.repair_jobs enable row level security;

drop policy if exists repair_jobs_admin_insert on public.repair_jobs;
create policy repair_jobs_admin_insert
on public.repair_jobs
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists repair_jobs_select_allowed on public.repair_jobs;
create policy repair_jobs_select_allowed
on public.repair_jobs
for select
to authenticated
using (
  public.current_user_is_admin()
  or customer_id = auth.uid()
  or mechanic_id = auth.uid()
);

drop policy if exists repair_jobs_update_mechanic_or_admin on public.repair_jobs;
create policy repair_jobs_update_mechanic_or_admin
on public.repair_jobs
for update
to authenticated
using (
  public.current_user_is_admin()
  or mechanic_id = auth.uid()
)
with check (
  public.current_user_is_admin()
  or mechanic_id = auth.uid()
);
