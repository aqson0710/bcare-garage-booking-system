-- Remove the old, duplicate RLS policy set and close the gaps it left open.
--
-- The database has two overlapping policy sets:
--   * the current one, using public.current_user_is_admin() (profiles.role)
--   * an older one, using public.is_admin() (user_roles/roles tables),
--     with snake_case names like bookings_update_own_cancel_or_admin.
-- Postgres allows a row if ANY policy allows it, so the old set widens
-- access beyond what the app intends. This file drops the old policies on
-- the tables/buckets the app uses, and re-adds the few public "read active
-- rows" policies so visitors who are not signed in can still browse
-- services and products.
--
-- Also removes the policies that let customers overwrite a payment slip
-- image after upload (the app never overwrites - every upload uses a new
-- file name), and fixes two small schema mistakes.
--
-- Run in the Supabase SQL Editor. Safe to run more than once.

begin;

-- 1. bookings ---------------------------------------------------------------
drop policy if exists bookings_insert_own on public.bookings;
drop policy if exists bookings_select_own_or_admin on public.bookings;
drop policy if exists bookings_update_own_cancel_or_admin on public.bookings;

-- 2. profiles ---------------------------------------------------------------
drop policy if exists profiles_insert_own_or_admin on public.profiles;
drop policy if exists profiles_select_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_or_admin on public.profiles;

-- 3. vehicles ---------------------------------------------------------------
drop policy if exists vehicles_insert_own_or_admin on public.vehicles;
drop policy if exists vehicles_select_own_or_admin on public.vehicles;
drop policy if exists vehicles_update_own_or_admin on public.vehicles;

-- 4. Catalog tables: drop old policies, keep public read of active rows ------
drop policy if exists services_admin_all on public.services;
drop policy if exists services_public_active_or_admin on public.services;
drop policy if exists "Anyone can read active services" on public.services;
create policy "Anyone can read active services"
on public.services for select to anon, authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists service_categories_admin_all on public.service_categories;
drop policy if exists service_categories_public_active_or_admin on public.service_categories;
drop policy if exists "Anyone can read active service categories" on public.service_categories;
create policy "Anyone can read active service categories"
on public.service_categories for select to anon, authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists products_admin_all on public.products;
drop policy if exists products_public_active_or_admin on public.products;
drop policy if exists "Anyone can read active products" on public.products;
create policy "Anyone can read active products"
on public.products for select to anon, authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists product_categories_admin_all on public.product_categories;
drop policy if exists product_categories_public_active_or_admin on public.product_categories;
drop policy if exists "Anyone can read active product categories" on public.product_categories;
create policy "Anyone can read active product categories"
on public.product_categories for select to anon, authenticated
using (status = 'active' or public.current_user_is_admin());

-- 5. Storage ----------------------------------------------------------------
-- payment-slips: no overwriting a slip after upload; drop old duplicates.
drop policy if exists "Users can update own payment slips" on storage.objects;
drop policy if exists payment_slips_owner_update_before_verified_or_admin on storage.objects;
drop policy if exists payment_slips_owner_insert on storage.objects;
drop policy if exists payment_slips_owner_read_or_admin on storage.objects;
drop policy if exists payment_slips_admin_delete on storage.objects;

-- product-images / profile-images: old duplicates of current policies.
drop policy if exists product_images_admin_insert on storage.objects;
drop policy if exists product_images_admin_update on storage.objects;
drop policy if exists product_images_admin_delete on storage.objects;
drop policy if exists product_images_public_read on storage.objects;
drop policy if exists profile_images_owner_insert on storage.objects;
drop policy if exists profile_images_owner_read_or_admin on storage.objects;
drop policy if exists profile_images_owner_update_or_admin on storage.objects;
drop policy if exists profile_images_owner_delete_or_admin on storage.objects;

-- service-images bucket is not used (service images live in product-images).
drop policy if exists service_images_admin_insert on storage.objects;
drop policy if exists service_images_admin_update on storage.objects;
drop policy if exists service_images_admin_delete on storage.objects;
drop policy if exists service_images_public_read on storage.objects;

-- 6. Small schema fixes -----------------------------------------------------
-- 'waiting' is not an allowed repair_jobs.status value.
alter table public.repair_jobs alter column status set default 'pending';
-- Uses a booking status ('approved') that does not exist, so it never applies.
drop index if exists public.unique_approved_booking_slot;

commit;
