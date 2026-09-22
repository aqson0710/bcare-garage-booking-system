-- Lets a signed-in customer cancel their OWN product order from the order
-- history page, as long as it is still "pending" and not yet paid.
-- Mirrors cancel_product_order_with_inventory_return (admin-only, in
-- supabase/product-order-stock-safe-cancellation.sql) but checks
-- ownership + order status instead of admin access, and safely returns
-- any deducted stock through inventory_movements without ever inserting a
-- duplicate "return" movement for the same order (relies on the unique
-- index below - created again here with `if not exists` so this file is
-- safe to run whether or not the admin cancellation migration ran first).
-- Run this in Supabase SQL Editor.

create unique index if not exists inventory_movements_product_order_return_key
on public.inventory_movements(reference_id, product_id)
where reference_type = 'product_order'
  and movement_type = 'return'
  and reference_id is not null;

create or replace function public.cancel_own_product_order_with_inventory_return(
  target_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.product_orders%rowtype;
  sale_movement_count integer;
  existing_return_count integer;
  inserted_return_count integer := 0;
  order_item record;
begin
  if auth.uid() is null then
    raise exception 'BCare product order cancellation requires an authenticated user.';
  end if;

  select *
  into order_record
  from public.product_orders
  where id = target_order_id
  for update;

  if order_record.id is null then
    raise exception 'BCare product order was not found.';
  end if;

  if order_record.customer_id <> auth.uid() then
    raise exception 'BCare product order does not belong to this account.';
  end if;

  if order_record.status <> 'pending' then
    raise exception 'BCare product order can only be cancelled while it is still pending.';
  end if;

  if order_record.payment_status = 'paid' then
    raise exception 'BCare product order has already been paid and cannot be self-cancelled.';
  end if;

  select count(*)::integer
  into existing_return_count
  from public.inventory_movements
  where movement_type = 'return'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if existing_return_count > 0 then
    update public.product_orders
    set status = 'cancelled'
    where id = target_order_id;

    return existing_return_count;
  end if;

  if not exists (
    select 1
    from public.product_order_items
    where product_order_id = target_order_id
  ) then
    raise exception 'BCare product order has no items.';
  end if;

  select count(*)::integer
  into sale_movement_count
  from public.inventory_movements
  where movement_type = 'sale'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if sale_movement_count > 0 then
    for order_item in
      select
        product_order_items.product_id,
        sum(product_order_items.quantity)::integer as quantity
      from public.product_order_items
      where product_order_items.product_order_id = target_order_id
      group by product_order_items.product_id
      order by product_order_items.product_id
    loop
      insert into public.inventory_movements (
        product_id,
        movement_type,
        quantity,
        reference_type,
        reference_id,
        note,
        created_by
      )
      values (
        order_item.product_id,
        'return',
        order_item.quantity,
        'product_order',
        target_order_id,
        'Customer cancelled order: ' || order_record.order_number,
        auth.uid()
      );

      inserted_return_count := inserted_return_count + 1;
    end loop;
  end if;

  update public.product_orders
  set status = 'cancelled'
  where id = target_order_id;

  return inserted_return_count;
end;
$$;

grant execute on function public.cancel_own_product_order_with_inventory_return(uuid)
to authenticated;
