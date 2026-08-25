-- Step 8 Part 2: Admin booking status management policies.
-- Run this in Supabase SQL Editor after Step 8 Part 0.
-- Allows admin users to update booking status for customer requests.

alter table public.bookings
drop constraint if exists bookings_status_check;

alter table public.bookings
add constraint bookings_status_check
check (status in ('pending', 'confirmed', 'cancelled', 'completed'));

drop policy if exists "Admins can update all bookings" on public.bookings;
create policy "Admins can update all bookings"
on public.bookings
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());
