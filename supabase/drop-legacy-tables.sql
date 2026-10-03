-- Remove 13 tables from the first draft of the database that the app never
-- uses (the shop moved to product_orders / shopping_carts / booking_payments,
-- and roles live in profiles.role). Checked before writing this file:
--   * no code in src/ reads or writes any of these tables
--   * no table the app uses has a foreign key pointing at them
--   * no RLS policy on a used table calls is_admin()/has_role() any more
--     (after legacy-policy-cleanup.sql)
-- Rows at the time of writing: promotions 2, roles 3, user_roles 1, all
-- others 0.
--
-- THIS PERMANENTLY DELETES THESE TABLES AND THEIR ROWS.
-- Everything runs in one transaction: if any step fails, nothing changes.
--
-- Run in the Supabase SQL Editor.

begin;

-- Children first, then the tables they reference.
drop table if exists public.order_promotions;
drop table if exists public.order_items;
drop table if exists public.payments;
drop table if exists public.orders;
drop table if exists public.cart_items;
drop table if exists public.carts;
drop table if exists public.repair_job_parts;
drop table if exists public.reviews;
drop table if exists public.promotions;
drop table if exists public.user_roles;
drop table if exists public.roles;
drop table if exists public.audit_logs;
drop table if exists public.notifications;

-- Old role helpers that only worked with the user_roles/roles tables.
-- (The app uses public.current_user_is_admin() / current_user_role().)
drop function if exists public.is_admin();
drop function if exists public.is_customer();
drop function if exists public.is_mechanic();
drop function if exists public.has_role(text);

commit;
