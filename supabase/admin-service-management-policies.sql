-- Step 8 Part 7: Admin service management policies.
-- Run this in Supabase SQL Editor after Step 8 Part 0.
-- This allows admin users to see inactive services and update service settings.

drop policy if exists "Admins can read all services" on public.services;
create policy "Admins can read all services"
on public.services
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can update services" on public.services;
create policy "Admins can update services"
on public.services
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can read all service categories" on public.service_categories;
create policy "Admins can read all service categories"
on public.service_categories
for select
to authenticated
using (public.current_user_is_admin());
