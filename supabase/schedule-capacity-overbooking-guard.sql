-- Step 10 Part 4: Prevent overbooking.
-- Run this in Supabase SQL Editor after Step 10 Part 1 capacity schema.
-- This blocks booking inserts/updates that would exceed the slot capacity.

create or replace function public.prevent_booking_over_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_date date;
  target_time time;
  capacity_max integer;
  capacity_status text;
  active_booking_count integer;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  target_date := new.booking_date::date;
  target_time := new.booking_time::time;

  if target_time < time '09:00' or target_time > time '18:00' then
    raise exception 'BCare booking time is outside business hours.'
      using errcode = 'check_violation';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('bcare_booking_capacity'),
    hashtext(target_date::text || '|' || to_char(target_time, 'HH24:MI'))
  );

  select garage_capacity.max_bookings, garage_capacity.status
  into capacity_max, capacity_status
  from public.garage_capacity
  where garage_capacity.booking_date = target_date
    and garage_capacity.booking_time = target_time
  limit 1;

  capacity_max := coalesce(capacity_max, 1);
  capacity_status := coalesce(capacity_status, 'open');

  if capacity_status <> 'open' or capacity_max <= 0 then
    raise exception 'BCare booking slot is closed.'
      using errcode = 'check_violation';
  end if;

  select count(*)::integer
  into active_booking_count
  from public.bookings
  where bookings.booking_date::date = target_date
    and left(bookings.booking_time::text, 5) = to_char(target_time, 'HH24:MI')
    and bookings.status in ('pending', 'confirmed')
    and (
      tg_op = 'INSERT'
      or bookings.id is distinct from new.id
    );

  if active_booking_count >= capacity_max then
    raise exception 'BCare booking slot is full.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_booking_over_capacity
on public.bookings;
create trigger prevent_booking_over_capacity
before insert or update of booking_date, booking_time, status
on public.bookings
for each row
execute function public.prevent_booking_over_capacity();
