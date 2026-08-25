-- Step 6 Part 4: Guest booking insert policies, including authenticated fallback.
-- Run this only if the anon-only policy did not allow inserts from the app.
-- This does not delete table data.

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Allow guest profile insert" on public.profiles;
create policy "Allow guest profile insert"
on public.profiles
for insert
to anon, authenticated
with check (
  full_name is not null
  and phone_number is not null
);

drop policy if exists "Allow guest vehicle insert" on public.vehicles;
create policy "Allow guest vehicle insert"
on public.vehicles
for insert
to anon, authenticated
with check (
  customer_id is not null
  and license_plate is not null
);

drop policy if exists "Allow guest booking insert" on public.bookings;
create policy "Allow guest booking insert"
on public.bookings
for insert
to anon, authenticated
with check (
  customer_id is not null
  and vehicle_id is not null
  and service_id is not null
  and booking_date is not null
  and booking_time is not null
);

