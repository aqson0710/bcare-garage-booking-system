-- Step 10 Part 0: Schedule / capacity schema check.
-- Run this in Supabase SQL Editor.
-- Read-only check: this file does not create, alter, update, or delete data.

with candidate_tables as (
  select unnest(array[
    'bookings',
    'garage_capacity',
    'booking_capacity',
    'schedule_capacity',
    'booking_slots',
    'service_slots',
    'mechanic_schedules'
  ]) as table_name
)
select
  candidate_tables.table_name,
  (tables.table_name is not null) as table_exists,
  coalesce(
    string_agg(columns.column_name, ', ' order by columns.ordinal_position),
    ''
  ) as columns
from candidate_tables
left join information_schema.tables as tables
  on tables.table_schema = 'public'
  and tables.table_name = candidate_tables.table_name
  and tables.table_type = 'BASE TABLE'
left join information_schema.columns as columns
  on columns.table_schema = 'public'
  and columns.table_name = candidate_tables.table_name
group by candidate_tables.table_name, tables.table_name
order by candidate_tables.table_name;

select
  booking_date,
  booking_time,
  status,
  count(*) as booking_count
from public.bookings
group by booking_date, booking_time, status
order by booking_date desc, booking_time asc, status asc
limit 100;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'bookings',
    'garage_capacity',
    'booking_capacity',
    'schedule_capacity',
    'booking_slots',
    'service_slots',
    'mechanic_schedules'
  )
order by tablename, policyname;
