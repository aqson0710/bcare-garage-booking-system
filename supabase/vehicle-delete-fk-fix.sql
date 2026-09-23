-- Fix: deleting a vehicle fails with
--   update or delete on table "vehicles" violates foreign key constraint
--   "bookings_vehicle_id_fkey" on table "bookings"
--
-- Root cause: bookings.vehicle_id has no ON DELETE action (defaults to
-- RESTRICT), so any booking row still pointing at a vehicle - even a
-- cancelled or completed one - blocks the delete outright. Separately,
-- repair_jobs.vehicle_id is ON DELETE CASCADE (see
-- repair-jobs-work-order-schema-alignment.sql), which would silently wipe
-- a completed repair job's record the moment its vehicle is deleted -
-- exactly the case the vehicle-delete-policy.sql business rule is meant to
-- allow.
--
-- Fix: make both foreign keys ON DELETE SET NULL instead. Booking and
-- repair-job history rows are kept; they just lose the vehicle link, which
-- every place that renders `booking.vehicle` / `repairJob.vehicle` already
-- falls back to "-" for (booking-detail panels, receipts, reports, work
-- order panels all already do `vehicle?.license_plate ?? "-"`).
--
-- Run this in the Supabase SQL Editor.

-- bookings.vehicle_id
do $$
declare
  fk_name text;
begin
  select tc.constraint_name
  into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'bookings'
    and kcu.column_name = 'vehicle_id'
    and tc.constraint_type = 'FOREIGN KEY';

  if fk_name is not null then
    execute format('alter table public.bookings drop constraint %I', fk_name);
  end if;
end $$;

alter table public.bookings
alter column vehicle_id drop not null;

alter table public.bookings
add constraint bookings_vehicle_id_fkey
foreign key (vehicle_id) references public.vehicles(id) on delete set null;

-- repair_jobs.vehicle_id
do $$
declare
  fk_name text;
begin
  select tc.constraint_name
  into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'repair_jobs'
    and kcu.column_name = 'vehicle_id'
    and tc.constraint_type = 'FOREIGN KEY';

  if fk_name is not null then
    execute format('alter table public.repair_jobs drop constraint %I', fk_name);
  end if;
end $$;

alter table public.repair_jobs
alter column vehicle_id drop not null;

alter table public.repair_jobs
add constraint repair_jobs_vehicle_id_fkey
foreign key (vehicle_id) references public.vehicles(id) on delete set null;
