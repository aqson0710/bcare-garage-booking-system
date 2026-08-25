-- Step 10 Part 1: Schedule / capacity database schema.
-- Run this in Supabase SQL Editor after Step 10 Part 0 is approved.
-- This creates the first dedicated capacity table for booking slots.

create table if not exists public.garage_capacity (
  id uuid primary key default gen_random_uuid(),
  booking_date date not null,
  booking_time time not null,
  max_bookings integer not null default 1,
  status text not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garage_capacity_booking_slot_key
    unique (booking_date, booking_time),
  constraint garage_capacity_max_bookings_check
    check (max_bookings >= 0 and max_bookings <= 100),
  constraint garage_capacity_status_check
    check (status in ('open', 'closed')),
  constraint garage_capacity_business_hours_check
    check (booking_time >= time '09:00' and booking_time <= time '18:00')
);

create index if not exists garage_capacity_booking_date_idx
on public.garage_capacity(booking_date);

create index if not exists garage_capacity_status_idx
on public.garage_capacity(status);

create or replace function public.set_garage_capacity_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_garage_capacity_updated_at
on public.garage_capacity;
create trigger set_garage_capacity_updated_at
before update on public.garage_capacity
for each row
execute function public.set_garage_capacity_updated_at();

alter table public.garage_capacity enable row level security;

drop policy if exists "Admins can manage garage capacity"
on public.garage_capacity;
create policy "Admins can manage garage capacity"
on public.garage_capacity
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Authenticated users can read open garage capacity"
on public.garage_capacity;
create policy "Authenticated users can read open garage capacity"
on public.garage_capacity
for select
to authenticated
using (
  status = 'open'
  or public.current_user_is_admin()
);

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
      booking_counts.active_count
    from booking_counts
    left join capacity on true
  )
  select
    target_date as booking_date,
    target_time as booking_time,
    resolved.resolved_max_bookings as max_bookings,
    resolved.active_count as active_booking_count,
    greatest(resolved.resolved_max_bookings - resolved.active_count, 0)
      as available_booking_count,
    (
      target_time >= time '09:00'
      and target_time <= time '18:00'
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

grant execute on function public.get_garage_slot_availability(date, time)
to authenticated;

grant execute on function public.is_garage_slot_available(date, time)
to authenticated;
