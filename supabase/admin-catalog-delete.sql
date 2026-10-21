-- Admin catalog management: add / delete for products, product categories,
-- services and service categories.
-- Run this whole file once in Supabase SQL Editor (safe to run again).
--
-- What it does:
--   1. admin_delete_product(): deletes a product safely in one transaction.
--   2. Lets admins INSERT and DELETE services (before: read/update only).
--   3. Lets admins DELETE service categories (before: read/insert/update).
-- Products and product categories already have an admin "for all" policy,
-- so they need no new policy.
--
-- Data safety: every foreign key to these tables is ON DELETE RESTRICT
-- (bookings -> services, services -> service_categories,
-- products -> product_categories, product_order_items / inventory_movements
-- -> products), so a row that is still in use can never be deleted.

-- ---------------------------------------------------------------------------
-- 1. Delete a product
-- ---------------------------------------------------------------------------
-- A product that was ever sold, returned or used in a repair keeps its
-- history and cannot be deleted (set it to "inactive" instead). A product
-- with only stock-in / adjustment movements (e.g. created by mistake) is
-- deleted together with those stock movements. Shopping-cart rows are
-- removed automatically (ON DELETE CASCADE).
create or replace function public.admin_delete_product(target_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_item_count integer;
  v_history_count integer;
begin
  if not public.current_user_is_admin() then
    raise exception 'Only admins can delete products.'
      using errcode = '42501';
  end if;

  perform 1
  from public.products
  where id = target_product_id
  for update;

  if not found then
    raise exception 'ไม่พบสินค้านี้ อาจถูกลบไปแล้ว'
      using errcode = 'P0002';
  end if;

  select count(*)
  into v_order_item_count
  from public.product_order_items
  where product_id = target_product_id;

  if v_order_item_count > 0 then
    raise exception 'ลบสินค้านี้ไม่ได้ เพราะมีประวัติการสั่งซื้อ % รายการ ให้เปลี่ยนสถานะเป็น "ปิดใช้งาน" แทน', v_order_item_count
      using errcode = 'P0001';
  end if;

  select count(*)
  into v_history_count
  from public.inventory_movements
  where product_id = target_product_id
    and movement_type in ('sale', 'return', 'repair_usage');

  if v_history_count > 0 then
    raise exception 'ลบสินค้านี้ไม่ได้ เพราะมีประวัติการขายหรือใช้ในงานซ่อม % รายการ ให้เปลี่ยนสถานะเป็น "ปิดใช้งาน" แทน', v_history_count
      using errcode = 'P0001';
  end if;

  delete from public.inventory_movements
  where product_id = target_product_id;

  delete from public.products
  where id = target_product_id;
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public;
revoke all on function public.admin_delete_product(uuid) from anon;
grant execute on function public.admin_delete_product(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Services: admins can add and delete
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can create services" on public.services;
create policy "Admins can create services"
on public.services
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete services" on public.services;
create policy "Admins can delete services"
on public.services
for delete
to authenticated
using (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- 3. Service categories: admins can delete
-- ---------------------------------------------------------------------------
drop policy if exists "Admins can delete service categories" on public.service_categories;
create policy "Admins can delete service categories"
on public.service_categories
for delete
to authenticated
using (public.current_user_is_admin());

-- ---------------------------------------------------------------------------
-- Check (optional): should list the new function and policies.
-- ---------------------------------------------------------------------------
-- select proname from pg_proc where proname = 'admin_delete_product';
-- select tablename, policyname, cmd from pg_policies
-- where tablename in ('services', 'service_categories', 'products', 'product_categories')
-- order by tablename, cmd;
