-- Adds an optional pinned delivery location (latitude/longitude) to
-- product orders, captured from the map picker on the checkout page.
-- The free-text delivery address field is kept as-is; this is an
-- additional, optional refinement so staff can see exactly where to
-- deliver instead of relying on the text address alone.
-- Safe to run again.
-- Run this in Supabase SQL Editor.

alter table public.product_orders
  add column if not exists delivery_latitude numeric(10, 7);
alter table public.product_orders
  add column if not exists delivery_longitude numeric(10, 7);

alter table public.product_orders
  drop constraint if exists product_orders_delivery_location_check;
alter table public.product_orders
  add constraint product_orders_delivery_location_check
  check (
    (delivery_latitude is null and delivery_longitude is null)
    or (
      delivery_latitude is not null
      and delivery_longitude is not null
      and delivery_latitude between -90 and 90
      and delivery_longitude between -180 and 180
    )
  );
