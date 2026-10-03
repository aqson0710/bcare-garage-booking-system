-- Limit what a customer can write on their own bookings.
--
-- The "Users can insert own bookings" / "Users can update own pending
-- bookings" RLS policies (authenticated-rls-policies.sql) only check that the
-- row belongs to the customer - not WHICH columns change. Without this
-- trigger a customer could, from the browser console, mark their own pending
-- booking as 'confirmed' or 'completed' (skipping the admin), or set
-- payment_status = 'paid' / change payment_amount.
--
-- After this trigger, a normal signed-in customer can only:
--   * INSERT a new booking - it is always stored as status 'pending' with no
--     payment fields set, whatever the request sent.
--   * UPDATE their booking from 'pending' to 'cancelled' (the app's cancel
--     button) - nothing else.
-- Admins, the service-role key (server API routes), the existing
-- SECURITY DEFINER functions (payment/pickup/work-order sync) and the
-- Supabase SQL Editor are not affected.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create or replace function public.guard_customer_booking_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') = 'service_role'
     or current_user not in ('authenticated', 'anon')
     or public.current_user_is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.payment_status := 'not_required';
    new.payment_amount := null;
    new.picked_up_at := null;
    return new;
  end if;

  if old.status = 'pending'
     and new.status = 'cancelled'
     and (to_jsonb(new) - 'status' - 'updated_at')
       = (to_jsonb(old) - 'status' - 'updated_at') then
    return new;
  end if;

  raise exception 'Customers can only cancel their own pending bookings'
    using errcode = '42501';
end;
$$;

drop trigger if exists guard_customer_booking_write on public.bookings;
create trigger guard_customer_booking_write
before insert or update on public.bookings
for each row
execute function public.guard_customer_booking_write();
