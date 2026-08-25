-- Step 8 Part 8: Admin service category management policies.
-- Run this in Supabase SQL Editor after Step 8 Part 0.
-- This allows admin users to see and update service categories.

drop policy if exists "Admins can read all service categories" on public.service_categories;
create policy "Admins can read all service categories"
on public.service_categories
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can update service categories" on public.service_categories;
create policy "Admins can update service categories"
on public.service_categories
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can create service categories" on public.service_categories;
create policy "Admins can create service categories"
on public.service_categories
for insert
to authenticated
with check (public.current_user_is_admin());
