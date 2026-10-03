-- Make product order prices and totals come from the database, not the browser.
--
-- Checkout (createProductOrderFromCart) builds the order in the browser and
-- inserts product_orders.total_amount and product_order_items.unit_price
-- itself. The RLS policies only check that the order belongs to the
-- customer, so a customer could send their own prices - e.g. an order whose
-- total_amount is 1 baht - pay that 1 baht, and SlipOK would verify it,
-- because verification checks the slip against total_amount.
--
-- After this migration, for a normal signed-in customer:
--   * product_order_items.unit_price / total_price are always taken from
--     products.unit_price, and items can only be added while the order is
--     still pending and unpaid.
--   * product_orders.subtotal_amount / total_amount are recalculated from the
--     items every time items are added, and delivery_fee is fixed by the
--     database (see v_delivery_fee below - change it here if the shop's
--     delivery fee changes; it must match deliveryFee in checkout-panel.tsx).
--   * a new order always starts as status 'pending' / payment 'unpaid'.
--   * on an existing order the customer can only cancel a pending order or
--     move payment_status to 'pending' (after uploading a slip).
-- Admins, the service-role key (server API routes), SECURITY DEFINER
-- functions and the Supabase SQL Editor are not affected.
--
-- Run this in the Supabase SQL Editor. Safe to run more than once.

create or replace function public.is_trusted_product_order_writer()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.role(), '') = 'service_role'
    or current_user not in ('authenticated', 'anon')
    or public.current_user_is_admin();
$$;

-- 1. Order rows ------------------------------------------------------------

create or replace function public.guard_customer_product_order_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_delivery_fee constant numeric := 60;
begin
  if public.is_trusted_product_order_writer() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.payment_status := 'unpaid';
    new.delivery_fee :=
      case when new.delivery_method = 'delivery' then v_delivery_fee else 0 end;
    -- Real totals are filled in from the items (see step 3 below).
    new.subtotal_amount := 0;
    new.total_amount := new.delivery_fee;
    return new;
  end if;

  -- UPDATE: nothing except status / payment_status may change ...
  if (to_jsonb(new) - 'status' - 'payment_status' - 'updated_at')
     is distinct from
     (to_jsonb(old) - 'status' - 'payment_status' - 'updated_at') then
    raise exception 'Customers cannot change order details or prices'
      using errcode = '42501';
  end if;

  -- ... status may only go pending -> cancelled ...
  if new.status is distinct from old.status
     and not (old.status = 'pending' and new.status = 'cancelled') then
    raise exception 'Customers can only cancel a pending order'
      using errcode = '42501';
  end if;

  -- ... and payment_status may only be set to 'pending' (slip uploaded).
  if new.payment_status is distinct from old.payment_status
     and not (
       new.payment_status = 'pending'
       and old.payment_status in ('unpaid', 'pending')
     ) then
    raise exception 'Customers cannot change the payment status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_customer_product_order_write
on public.product_orders;
create trigger guard_customer_product_order_write
before insert or update on public.product_orders
for each row
execute function public.guard_customer_product_order_write();

-- 2. Item prices -----------------------------------------------------------

create or replace function public.set_product_order_item_price()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_unit_price numeric;
  v_order_status text;
  v_payment_status text;
begin
  if public.is_trusted_product_order_writer() then
    return new;
  end if;

  select status, payment_status
  into v_order_status, v_payment_status
  from public.product_orders
  where id = new.product_order_id;

  if v_order_status is distinct from 'pending'
     or v_payment_status is distinct from 'unpaid' then
    raise exception 'Items can only be added to an unpaid pending order'
      using errcode = '42501';
  end if;

  if new.quantity is null or new.quantity <= 0 then
    raise exception 'Quantity must be greater than zero'
      using errcode = '22023';
  end if;

  select unit_price into v_unit_price
  from public.products
  where id = new.product_id;

  if v_unit_price is null then
    raise exception 'Product not found' using errcode = '23503';
  end if;

  new.unit_price := v_unit_price;
  new.total_price := v_unit_price * new.quantity;
  return new;
end;
$$;

drop trigger if exists set_product_order_item_price
on public.product_order_items;
create trigger set_product_order_item_price
before insert or update on public.product_order_items
for each row
execute function public.set_product_order_item_price();

-- 3. Order totals from items -----------------------------------------------
-- SECURITY DEFINER so it can write the totals even though the customer
-- themselves is not allowed to change them (guard in step 1).

create or replace function public.recalculate_product_order_totals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.product_orders o
  set
    subtotal_amount = coalesce(items.subtotal, 0),
    total_amount = coalesce(items.subtotal, 0) + o.delivery_fee
  from (
    select sum(total_price) as subtotal
    from public.product_order_items
    where product_order_id = new.product_order_id
  ) items
  where o.id = new.product_order_id;

  return null;
end;
$$;

drop trigger if exists recalculate_product_order_totals
on public.product_order_items;
create trigger recalculate_product_order_totals
after insert on public.product_order_items
for each row
execute function public.recalculate_product_order_totals();
