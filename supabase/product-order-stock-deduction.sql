-- Step 12 Part 5: Product order stock deduction and inventory movement.
-- Run this in Supabase SQL Editor after Step 12 Part 4 is approved.
-- This lets checkout deduct stock through inventory_movements without giving
-- customers direct insert permission on inventory_movements.

create unique index if not exists inventory_movements_product_order_sale_key
on public.inventory_movements(reference_id, product_id)
where reference_type = 'product_order'
  and movement_type = 'sale'
  and reference_id is not null;

create or replace function public.apply_product_order_inventory(
  target_order_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  order_record public.product_orders%rowtype;
  order_item record;
  existing_movement_count integer;
  inserted_movement_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'BCare product order stock deduction requires an authenticated user.';
  end if;

  select *
  into order_record
  from public.product_orders
  where id = target_order_id
  for update;

  if order_record.id is null then
    raise exception 'BCare product order was not found.';
  end if;

  if order_record.customer_id <> auth.uid()
    and not public.current_user_is_admin()
  then
    raise exception 'BCare product order does not belong to the current user.';
  end if;

  if order_record.status = 'cancelled' then
    raise exception 'BCare cancelled product orders cannot deduct stock.';
  end if;

  select count(*)::integer
  into existing_movement_count
  from public.inventory_movements
  where movement_type = 'sale'
    and reference_type = 'product_order'
    and reference_id = target_order_id;

  if existing_movement_count > 0 then
    return existing_movement_count;
  end if;

  if not exists (
    select 1
    from public.product_order_items
    where product_order_id = target_order_id
  ) then
    raise exception 'BCare product order has no items.';
  end if;

  for order_item in
    select
      product_order_items.product_id,
      product_order_items.quantity,
      products.name,
      products.status,
      products.stock_quantity
    from public.product_order_items
    join public.products
      on products.id = product_order_items.product_id
    where product_order_items.product_order_id = target_order_id
    order by product_order_items.created_at
  loop
    if order_item.status <> 'active' then
      raise exception 'BCare product "%" is not active.', order_item.name;
    end if;

    if order_item.quantity > order_item.stock_quantity then
      raise exception 'BCare product "%" does not have enough stock.', order_item.name;
    end if;
  end loop;

  for order_item in
    select
      product_order_items.product_id,
      product_order_items.quantity,
      products.name
    from public.product_order_items
    join public.products
      on products.id = product_order_items.product_id
    where product_order_items.product_order_id = target_order_id
    order by product_order_items.created_at
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
      'sale',
      order_item.quantity,
      'product_order',
      target_order_id,
      'Product order sale: ' || order_record.order_number,
      auth.uid()
    );

    inserted_movement_count := inserted_movement_count + 1;
  end loop;

  return inserted_movement_count;
end;
$$;

grant execute on function public.apply_product_order_inventory(uuid)
to authenticated;
