-- Step 10 Part 5.1: Garage operating days and closed dates.
-- Run this in Supabase SQL Editor after Step 10 Part 4.
-- This adds weekly open/closed rules, special closed dates, and updates
-- availability/overbooking checks so closed days cannot be booked.

create table if not exists public.garage_operating_days (
  weekday integer primary key,
  is_open boolean not null default true,
  open_time time not null default time '09:00',
  close_time time not null default time '18:00',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garage_operating_days_weekday_check
    check (weekday >= 0 and weekday <= 6),
  constraint garage_operating_days_time_check
    check (open_time < close_time)
);

create table if not exists public.garage_closed_dates (
  closed_date date primary key,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_garage_operating_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_garage_operating_days_updated_at
on public.garage_operating_days;
create trigger set_garage_operating_days_updated_at
before update on public.garage_operating_days
for each row
execute function public.set_garage_operating_updated_at();

drop trigger if exists set_garage_closed_dates_updated_at
on public.garage_closed_dates;
create trigger set_garage_closed_dates_updated_at
before update on public.garage_closed_dates
for each row
execute function public.set_garage_operating_updated_at();

insert into public.garage_operating_days (weekday, is_open, open_time, close_time, note)
values
  (0, false, time '09:00', time '18:00', 'Sunday'),
  (1, true, time '09:00', time '18:00', 'Monday'),
  (2, true, time '09:00', time '18:00', 'Tuesday'),
  (3, true, time '09:00', time '18:00', 'Wednesday'),
  (4, true, time '09:00', time '18:00', 'Thursday'),
  (5, true, time '09:00', time '18:00', 'Friday'),
  (6, false, time '09:00', time '18:00', 'Saturday')
on conflict (weekday) do nothing;

alter table public.garage_operating_days enable row level security;
alter table public.garage_closed_dates enable row level security;

drop policy if exists "Authenticated users can read garage operating days"
on public.garage_operating_days;
create policy "Authenticated users can read garage operating days"
on public.garage_operating_days
for select
to authenticated
using (true);

drop policy if exists "Admins can manage garage operating days"
on public.garage_operating_days;
create policy "Admins can manage garage operating days"
on public.garage_operating_days
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Authenticated users can read garage closed dates"
on public.garage_closed_dates;
create policy "Authenticated users can read garage closed dates"
on public.garage_closed_dates
for select
to authenticated
using (true);

drop policy if exists "Admins can manage garage closed dates"
on public.garage_closed_dates;
create policy "Admins can manage garage closed dates"
on public.garage_closed_dates
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create or replace function public.get_garage_operating_status(target_date date)
returns table (
  booking_date date,
  weekday integer,
  is_open boolean,
  open_time time,
  close_time time,
  is_special_closed boolean,
  note text,
  closed_reason text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    target_date as booking_date,
    extract(dow from target_date)::integer as weekday,
    (
      coalesce(garage_operating_days.is_open, extract(dow from target_date)::integer not in (0, 6))
      and garage_closed_dates.closed_date is null
    ) as is_open,
    coalesce(garage_operating_days.open_time, time '09:00') as open_time,
    coalesce(garage_operating_days.close_time, time '18:00') as close_time,
    garage_closed_dates.closed_date is not null as is_special_closed,
    garage_operating_days.note,
    garage_closed_dates.reason as closed_reason
  from (select 1) seed
  left join public.garage_operating_days
    on garage_operating_days.weekday = extract(dow from target_date)::integer
  left join public.garage_closed_dates
    on garage_closed_dates.closed_date = target_date
$$;

create or replace function public.get_garage_slot_availability(
  target_date date,
  target_time time
)
returns table (
  booking_date date,
  booking_time time,
  max_bookings integer,
  active_booking_count integer,
  available_booking_count integer,
  is_open boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with capacity as (
    select
      garage_capacity.max_bookings,
      garage_capacity.status
    from public.garage_capacity
    where garage_capacity.booking_date = target_date
      and garage_capacity.booking_time = target_time
    limit 1
  ),
  operating as (
    select *
    from public.get_garage_operating_status(target_date)
    limit 1
  ),
  booking_counts as (
    select count(*)::integer as active_count
    from public.bookings
    where bookings.booking_date::date = target_date
      and left(bookings.booking_time::text, 5) = to_char(target_time, 'HH24:MI')
      and bookings.status in ('pending', 'confirmed')
  ),
  resolved as (
    select
      coalesce(capacity.max_bookings, 1) as resolved_max_bookings,
      coalesce(capacity.status, 'open') as resolved_status,
      coalesce(operating.is_open, true) as operating_is_open,
      coalesce(operating.open_time, time '09:00') as operating_open_time,
      coalesce(operating.close_time, time '18:00') as operating_close_time,
      booking_counts.active_count
    from booking_counts
    left join capacity on true
    left join operating on true
  )
  select
    target_date as booking_date,
    target_time as booking_time,
    resolved.resolved_max_bookings as max_bookings,
    resolved.active_count as active_booking_count,
    greatest(resolved.resolved_max_bookings - resolved.active_count, 0)
      as available_booking_count,
    (
      resolved.operating_is_open
      and target_time >= resolved.operating_open_time
      and target_time <= resolved.operating_close_time
      and resolved.resolved_status = 'open'
      and resolved.resolved_max_bookings > resolved.active_count
    ) as is_open
  from resolved
$$;

create or replace function public.is_garage_slot_available(
  target_date date,
  target_time time
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select is_open
    from public.get_garage_slot_availability(target_date, target_time)
    limit 1
  ), false)
$$;

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
  shop_is_open boolean;
  shop_open_time time;
  shop_close_time time;
begin
  if new.status not in ('pending', 'confirmed') then
    return new;
  end if;

  target_date := new.booking_date::date;
  target_time := new.booking_time::time;

  select operating_status.is_open,
         operating_status.open_time,
         operating_status.close_time
  into shop_is_open, shop_open_time, shop_close_time
  from public.get_garage_operating_status(target_date) operating_status
  limit 1;

  if coalesce(shop_is_open, true) = false then
    raise exception 'BCare shop is closed on selected date.'
      using errcode = 'check_violation';
  end if;

  if target_time < coalesce(shop_open_time, time '09:00')
    or target_time > coalesce(shop_close_time, time '18:00') then
    raise exception 'BCare booking time is outside operating hours.'
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

grant execute on function public.get_garage_operating_status(date)
to authenticated;

grant execute on function public.get_garage_slot_availability(date, time)
to authenticated;

grant execute on function public.is_garage_slot_available(date, time)
to authenticated;
