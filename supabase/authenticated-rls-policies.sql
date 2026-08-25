-- Step 7 Part 3: Authenticated RLS policies.
-- Run this in Supabase SQL Editor after removing guest/public MVP policies.
-- These policies scope customer data to the logged-in user's auth.uid().

alter table public.profiles enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Allow guest profile insert" on public.profiles;
drop policy if exists "Allow guest vehicle insert" on public.vehicles;
drop policy if exists "Allow guest booking insert" on public.bookings;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "Users can read own vehicles" on public.vehicles;
create policy "Users can read own vehicles"
on public.vehicles
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Users can insert own vehicles" on public.vehicles;
create policy "Users can insert own vehicles"
on public.vehicles
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Users can update own vehicles" on public.vehicles;
create policy "Users can update own vehicles"
on public.vehicles
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists "Users can read own bookings" on public.bookings;
create policy "Users can read own bookings"
on public.bookings
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Users can insert own bookings" on public.bookings;
create policy "Users can insert own bookings"
on public.bookings
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Users can update own pending bookings" on public.bookings;
create policy "Users can update own pending bookings"
on public.bookings
for update
to authenticated
using (customer_id = auth.uid() and status = 'pending')
with check (customer_id = auth.uid());

