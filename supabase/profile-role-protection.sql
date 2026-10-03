-- Protect profiles.role from being changed by the user themselves.
--
-- The "Users can update own profile" / "Users can insert own profile" RLS
-- policies (authenticated-rls-policies.sql) let a signed-in user write any
-- column of their own profile row - including `role`. Without this trigger a
-- customer could open the browser console and run
--   supabase.from("profiles").update({ role: "admin" }).eq("id", myId)
-- and become an admin.
--
-- This trigger:
--   * on INSERT by a normal signed-in user: always stores role = 'customer'
--   * on UPDATE: rejects any change to `role` unless the caller is an admin
-- Changes made with the service-role key (the app's
-- /api/admin/customers/[customerId]/role route) and from the Supabase SQL
-- Editor are still allowed, so admins can keep managing roles as before.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Service-role key (server API routes) or a direct database session
  -- (SQL Editor / migrations): trusted, allow anything.
  if coalesce(auth.role(), '') = 'service_role'
     or current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'customer';
    return new;
  end if;

  if new.role is distinct from old.role
     and not public.current_user_is_admin() then
    raise exception 'Only an admin can change a profile role'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
before insert or update on public.profiles
for each row
execute function public.protect_profile_role();
