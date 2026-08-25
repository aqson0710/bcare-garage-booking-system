-- Step 9 Part 5: Technician work order read policies.
-- Run this in Supabase SQL Editor before testing /technician/work-orders.
-- Allows assigned technicians to read the booking, customer, and vehicle
-- records needed to understand their own repair jobs.

drop policy if exists "Assigned mechanics can read linked bookings"
on public.bookings;
create policy "Assigned mechanics can read linked bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.repair_jobs
    where repair_jobs.booking_id = bookings.id
      and repair_jobs.mechanic_id = auth.uid()
  )
);

drop policy if exists "Assigned mechanics can read linked customers"
on public.profiles;
create policy "Assigned mechanics can read linked customers"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.repair_jobs
    where repair_jobs.customer_id = profiles.id
      and repair_jobs.mechanic_id = auth.uid()
  )
);

drop policy if exists "Assigned mechanics can read linked vehicles"
on public.vehicles;
create policy "Assigned mechanics can read linked vehicles"
on public.vehicles
for select
to authenticated
using (
  exists (
    select 1
    from public.repair_jobs
    where repair_jobs.vehicle_id = vehicles.id
      and repair_jobs.mechanic_id = auth.uid()
  )
);
