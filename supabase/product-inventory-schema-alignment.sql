-- Step 11 Part 1: Product / inventory schema alignment.
-- Run this in Supabase SQL Editor after Step 11 Part 0 is approved.
-- This keeps existing product data and adds the minimum inventory foundation.

alter table public.products
add column if not exists sku text;

alter table public.products
add column if not exists unit_price numeric(10, 2) not null default 0;

alter table public.products
add column if not exists cost_price numeric(10, 2) not null default 0;

alter table public.products
add column if not exists stock_quantity integer not null default 0;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_unit_price_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_unit_price_check
    check (unit_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_cost_price_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_cost_price_check
    check (cost_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'products_stock_quantity_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint products_stock_quantity_check
    check (stock_quantity >= 0);
  end if;
end $$;

create index if not exists products_product_category_id_idx
on public.products(product_category_id);

create index if not exists products_status_idx
on public.products(status);

create index if not exists products_sku_idx
on public.products(lower(sku))
where sku is not null and btrim(sku) <> '';

create or replace function public.set_product_inventory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_products_updated_at
on public.products;
create trigger set_products_updated_at
before update on public.products
for each row
execute function public.set_product_inventory_updated_at();

drop trigger if exists set_product_categories_updated_at
on public.product_categories;
create trigger set_product_categories_updated_at
before update on public.product_categories
for each row
execute function public.set_product_inventory_updated_at();

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  movement_type text not null,
  quantity integer not null,
  reference_type text,
  reference_id uuid,
  note text,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint inventory_movements_movement_type_check
    check (
      movement_type in (
        'stock_in',
        'stock_out',
        'adjustment_in',
        'adjustment_out',
        'sale',
        'repair_usage',
        'return'
      )
    ),
  constraint inventory_movements_quantity_check
    check (quantity > 0 and quantity <= 100000)
);

create index if not exists inventory_movements_product_id_idx
on public.inventory_movements(product_id);

create index if not exists inventory_movements_created_at_idx
on public.inventory_movements(created_at desc);

create index if not exists inventory_movements_created_by_idx
on public.inventory_movements(created_by);

create or replace function public.apply_inventory_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stock integer;
  stock_delta integer;
begin
  if new.movement_type in ('stock_in', 'adjustment_in', 'return') then
    stock_delta := new.quantity;
  elsif new.movement_type in ('stock_out', 'adjustment_out', 'sale', 'repair_usage') then
    stock_delta := -new.quantity;
  else
    raise exception 'Unsupported inventory movement type: %', new.movement_type;
  end if;

  select products.stock_quantity
  into current_stock
  from public.products
  where products.id = new.product_id
  for update;

  if current_stock is null then
    raise exception 'Product was not found for inventory movement.';
  end if;

  if current_stock + stock_delta < 0 then
    raise exception 'Inventory movement would make product stock negative.';
  end if;

  update public.products
  set
    stock_quantity = current_stock + stock_delta,
    updated_at = now()
  where products.id = new.product_id;

  return new;
end;
$$;

drop trigger if exists apply_inventory_movement_on_insert
on public.inventory_movements;
create trigger apply_inventory_movement_on_insert
before insert on public.inventory_movements
for each row
execute function public.apply_inventory_movement();

alter table public.product_categories enable row level security;
alter table public.products enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "Authenticated users can read active product categories"
on public.product_categories;
create policy "Authenticated users can read active product categories"
on public.product_categories
for select
to authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists "Admins can manage product categories"
on public.product_categories;
create policy "Admins can manage product categories"
on public.product_categories
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Authenticated users can read active products"
on public.products;
create policy "Authenticated users can read active products"
on public.products
for select
to authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists "Admins can manage products"
on public.products;
create policy "Admins can manage products"
on public.products
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can read inventory movements"
on public.inventory_movements;
create policy "Admins can read inventory movements"
on public.inventory_movements
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Admins can create inventory movements"
on public.inventory_movements;
create policy "Admins can create inventory movements"
on public.inventory_movements
for insert
to authenticated
with check (public.current_user_is_admin());
