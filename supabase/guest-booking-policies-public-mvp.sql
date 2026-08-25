-- Step 6 Part 4: MVP guest booking insert policies using public role.
-- Use this if anon/authenticated-specific policies still do not match the app request.
-- This does not delete table data. It only replaces policies with the same names.

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Allow guest profile insert" on public.profiles;
create policy "Allow guest profile insert"
on public.profiles
as permissive
for insert
to public
with check (
  full_name is not null
  and length(trim(full_name)) > 0
  and phone_number is not null
  and length(trim(phone_number)) > 0
);

drop policy if exists "Allow guest vehicle insert" on public.vehicles;
create policy "Allow guest vehicle insert"
on public.vehicles
as permissive
for insert
to public
with check (
  customer_id is not null
  and license_plate is not null
  and length(trim(license_plate)) > 0
);

drop policy if exists "Allow guest booking insert" on public.bookings;
create policy "Allow guest booking insert"
on public.bookings
as permissive
for insert
to public
with check (
  customer_id is not null
  and vehicle_id is not null
  and service_id is not null
  and booking_date is not null
  and booking_time is not null
);

