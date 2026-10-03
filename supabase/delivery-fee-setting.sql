-- Let the admin set the delivery fee for product orders.
--
-- Until now the fee (60 baht) was written into both checkout-panel.tsx and
-- product-order-price-guard.sql. This stores it in payment_settings (edited
-- on /admin/payment-settings) and adds get_delivery_fee(), which both the
-- checkout page and the order price guard now read, so they always agree.
--
-- Run in the Supabase SQL Editor AFTER product-order-price-guard.sql.
-- Safe to run more than once.

alter table public.payment_settings
add column if not exists delivery_fee numeric(10, 2) not null default 60;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_settings_delivery_fee_check'
      and conrelid = 'public.payment_settings'::regclass
  ) then
    alter table public.payment_settings
    add constraint payment_settings_delivery_fee_check
      check (delivery_fee >= 0 and delivery_fee <= 10000);
  end if;
end $$;

-- Current delivery fee for everyone (visitors included). SECURITY DEFINER so
-- it works even while the payment settings row is set to inactive, which
-- hides the row itself from customers. Returns only the number.
create or replace function public.get_delivery_fee()
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select delivery_fee from public.payment_settings
     where setting_key = 'default'
     limit 1),
    60
  );
$$;

grant execute on function public.get_delivery_fee() to anon, authenticated;

-- Same guard as product-order-price-guard.sql, but the fee now comes from
-- get_delivery_fee() instead of a fixed 60.
create or replace function public.guard_customer_product_order_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_delivery_fee numeric := public.get_delivery_fee();
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

