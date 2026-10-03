-- Admin reports summary computed inside the database.
--
-- Before this, the admin reports page downloaded every row of bookings,
-- profiles, services and vehicles into the browser and counted them there.
-- That got slower as data grew, and because Supabase returns at most 1,000
-- rows per request by default, every number on the page silently stopped
-- being correct once a table passed 1,000 rows.
--
-- This function does the counting in Postgres and returns one small JSON
-- object. It runs as SECURITY INVOKER (the default), so the caller's existing
-- RLS policies still apply: an admin sees totals for everything, and nobody
-- gets data their policies wouldn't already let them read.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create or replace function public.get_admin_report_summary()
returns jsonb
language sql
stable
set search_path = public
as $$
  with booking_rows as (
    select status, service_id, customer_id, vehicle_id
    from public.bookings
  ),
  revenue as (
    select
      coalesce(sum(s.base_price), 0) as total,
      count(*) as booking_count
    from public.bookings b
    left join public.services s on s.id = b.service_id
    where b.status in ('confirmed', 'completed')
  )
  select jsonb_build_object(
    'total_booking_count', (select count(*) from booking_rows),
    'total_customer_count', (select count(*) from public.profiles),
    'total_vehicle_count', (select count(*) from public.vehicles),
    'active_customer_count',
      (select count(distinct customer_id) from booking_rows),
    'estimated_revenue', (select total from revenue),
    'revenue_booking_count', (select booking_count from revenue),
    'status_counts', (
      select coalesce(jsonb_object_agg(status, status_count), '{}'::jsonb)
      from (
        select status, count(*) as status_count
        from booking_rows
        group by status
      ) counts
    ),
    'top_services', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'count', id_count)
          order by id_count desc, id),
        '[]'::jsonb
      )
      from (
        select service_id as id, count(*) as id_count
        from booking_rows
        where service_id is not null
        group by service_id
        order by id_count desc, service_id
        limit 5
      ) top
    ),
    'top_customers', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'count', id_count)
          order by id_count desc, id),
        '[]'::jsonb
      )
      from (
        select customer_id as id, count(*) as id_count
        from booking_rows
        where customer_id is not null
        group by customer_id
        order by id_count desc, customer_id
        limit 5
      ) top
    ),
    'top_vehicles', (
      select coalesce(
        jsonb_agg(jsonb_build_object('id', id, 'count', id_count)
          order by id_count desc, id),
        '[]'::jsonb
      )
      from (
        select vehicle_id as id, count(*) as id_count
        from booking_rows
        where vehicle_id is not null
        group by vehicle_id
        order by id_count desc, vehicle_id
        limit 5
      ) top
    )
  );
$$;

revoke execute on function public.get_admin_report_summary() from public, anon;
grant execute on function public.get_admin_report_summary() to authenticated;
