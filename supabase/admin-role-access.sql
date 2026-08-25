-- Step 8 Part 0: Admin role and access setup.
-- Run this in Supabase SQL Editor.
-- This keeps the MVP roles simple: customer and admin.

alter table public.profiles
add column if not exists role text not null default 'customer';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
    add constraint profiles_role_check
    check (role in ('customer', 'admin', 'technician'));
  end if;
end $$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

grant execute on function public.current_user_role() to authenticated;
grant execute on function public.current_user_is_admin() to authenticated;

drop policy if exists "Admins can read all profiles" on public.profiles;
create policy "Admins can read all profiles"
on public.profiles
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can read all vehicles" on public.vehicles;
create policy "Admins can read all vehicles"
on public.vehicles
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can read all bookings" on public.bookings;
create policy "Admins can read all bookings"
on public.bookings
for select
to authenticated
using (public.current_user_is_admin());

-- Set the first admin account for this MVP.
-- Change this email if you want a different account to become admin.
update public.profiles
set role = 'admin'
where email = 'apisorn.ps@gmail.com';
