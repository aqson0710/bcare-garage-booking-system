-- Step 12 Part 1: Product sales / customer storefront schema alignment.
-- Run this in Supabase SQL Editor after Step 12 Part 0 is approved.
-- This creates the first customer product sales foundation.

create or replace function public.set_product_sales_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_product_order_number()
returns trigger
language plpgsql
as $$
begin
  if new.order_number is null or btrim(new.order_number) = '' then
    new.order_number :=
      'PO-' ||
      to_char(now(), 'YYYYMMDD') ||
      '-' ||
      upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;

  return new;
end;
$$;

create table if not exists public.delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null,
  phone_number text not null,
  address_line text not null,
  province text not null,
  district text not null,
  postal_code text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_addresses_recipient_name_check
    check (char_length(btrim(recipient_name)) between 2 and 120),
  constraint delivery_addresses_phone_number_check
    check (char_length(btrim(phone_number)) between 8 and 30),
  constraint delivery_addresses_address_line_check
    check (char_length(btrim(address_line)) between 5 and 500),
  constraint delivery_addresses_postal_code_check
    check (char_length(btrim(postal_code)) between 4 and 20)
);

create index if not exists delivery_addresses_customer_id_idx
on public.delivery_addresses(customer_id);

drop trigger if exists set_delivery_addresses_updated_at
on public.delivery_addresses;
create trigger set_delivery_addresses_updated_at
before update on public.delivery_addresses
for each row
execute function public.set_product_sales_updated_at();

create table if not exists public.product_orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  order_number text not null,
  status text not null default 'pending',
  delivery_method text not null default 'pickup',
  delivery_address text,
  subtotal_amount numeric(10, 2) not null default 0,
  delivery_fee numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  payment_status text not null default 'unpaid',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_orders_order_number_key unique (order_number),
  constraint product_orders_status_check
    check (
      status in (
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'out_for_delivery',
        'completed',
        'cancelled'
      )
    ),
  constraint product_orders_delivery_method_check
    check (delivery_method in ('pickup', 'delivery')),
  constraint product_orders_payment_status_check
    check (payment_status in ('unpaid', 'pending', 'paid', 'refunded', 'cancelled')),
  constraint product_orders_amounts_check
    check (
      subtotal_amount >= 0
      and delivery_fee >= 0
      and total_amount >= 0
      and total_amount = subtotal_amount + delivery_fee
    ),
  constraint product_orders_delivery_address_check
    check (
      delivery_method = 'pickup'
      or (delivery_method = 'delivery' and delivery_address is not null and btrim(delivery_address) <> '')
    )
);

create index if not exists product_orders_customer_id_idx
on public.product_orders(customer_id);

create index if not exists product_orders_status_idx
on public.product_orders(status);

create index if not exists product_orders_payment_status_idx
on public.product_orders(payment_status);

create index if not exists product_orders_created_at_idx
on public.product_orders(created_at desc);

drop trigger if exists set_product_orders_updated_at
on public.product_orders;
create trigger set_product_orders_updated_at
before update on public.product_orders
for each row
execute function public.set_product_sales_updated_at();

drop trigger if exists generate_product_order_number_on_insert
on public.product_orders;
create trigger generate_product_order_number_on_insert
before insert on public.product_orders
for each row
execute function public.generate_product_order_number();

create table if not exists public.product_order_items (
  id uuid primary key default gen_random_uuid(),
  product_order_id uuid not null references public.product_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  total_price numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  constraint product_order_items_quantity_check
    check (quantity > 0 and quantity <= 1000),
  constraint product_order_items_price_check
    check (
      unit_price >= 0
      and total_price >= 0
      and total_price = quantity * unit_price
    )
);

create index if not exists product_order_items_product_order_id_idx
on public.product_order_items(product_order_id);

create index if not exists product_order_items_product_id_idx
on public.product_order_items(product_id);

create table if not exists public.product_payments (
  id uuid primary key default gen_random_uuid(),
  product_order_id uuid not null references public.product_orders(id) on delete cascade,
  payment_method text not null default 'cash',
  payment_status text not null default 'pending',
  amount numeric(10, 2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_payments_payment_method_check
    check (payment_method in ('cash', 'bank_transfer', 'promptpay', 'card', 'other')),
  constraint product_payments_payment_status_check
    check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'cancelled')),
  constraint product_payments_amount_check
    check (amount >= 0)
);

create index if not exists product_payments_product_order_id_idx
on public.product_payments(product_order_id);

create index if not exists product_payments_payment_status_idx
on public.product_payments(payment_status);

drop trigger if exists set_product_payments_updated_at
on public.product_payments;
create trigger set_product_payments_updated_at
before update on public.product_payments
for each row
execute function public.set_product_sales_updated_at();

create table if not exists public.shopping_carts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_carts_status_check
    check (status in ('active', 'ordered', 'abandoned'))
);

create index if not exists shopping_carts_customer_id_idx
on public.shopping_carts(customer_id);

create unique index if not exists shopping_carts_one_active_per_customer_idx
on public.shopping_carts(customer_id)
where status = 'active';

drop trigger if exists set_shopping_carts_updated_at
on public.shopping_carts;
create trigger set_shopping_carts_updated_at
before update on public.shopping_carts
for each row
execute function public.set_product_sales_updated_at();

create table if not exists public.shopping_cart_items (
  id uuid primary key default gen_random_uuid(),
  shopping_cart_id uuid not null references public.shopping_carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopping_cart_items_quantity_check
    check (quantity > 0 and quantity <= 1000),
  constraint shopping_cart_items_cart_product_key
    unique (shopping_cart_id, product_id)
);

create index if not exists shopping_cart_items_shopping_cart_id_idx
on public.shopping_cart_items(shopping_cart_id);

create index if not exists shopping_cart_items_product_id_idx
on public.shopping_cart_items(product_id);

drop trigger if exists set_shopping_cart_items_updated_at
on public.shopping_cart_items;
create trigger set_shopping_cart_items_updated_at
before update on public.shopping_cart_items
for each row
execute function public.set_product_sales_updated_at();

alter table public.delivery_addresses enable row level security;
alter table public.product_orders enable row level security;
alter table public.product_order_items enable row level security;
alter table public.product_payments enable row level security;
alter table public.shopping_carts enable row level security;
alter table public.shopping_cart_items enable row level security;

drop policy if exists "Users can read own delivery addresses"
on public.delivery_addresses;
create policy "Users can read own delivery addresses"
on public.delivery_addresses
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Users can insert own delivery addresses"
on public.delivery_addresses;
create policy "Users can insert own delivery addresses"
on public.delivery_addresses
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Users can update own delivery addresses"
on public.delivery_addresses;
create policy "Users can update own delivery addresses"
on public.delivery_addresses
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists "Admins can manage delivery addresses"
on public.delivery_addresses;
create policy "Admins can manage delivery addresses"
on public.delivery_addresses
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Users can read own product orders"
on public.product_orders;
create policy "Users can read own product orders"
on public.product_orders
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Users can insert own product orders"
on public.product_orders;
create policy "Users can insert own product orders"
on public.product_orders
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Users can update own pending product orders"
on public.product_orders;
create policy "Users can update own pending product orders"
on public.product_orders
for update
to authenticated
using (customer_id = auth.uid() and status = 'pending')
with check (customer_id = auth.uid() and status in ('pending', 'cancelled'));

drop policy if exists "Admins can manage product orders"
on public.product_orders;
create policy "Admins can manage product orders"
on public.product_orders
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Users can read own product order items"
on public.product_order_items;
create policy "Users can read own product order items"
on public.product_order_items
for select
to authenticated
using (
  exists (
    select 1
    from public.product_orders
    where product_orders.id = product_order_items.product_order_id
      and product_orders.customer_id = auth.uid()
  )
);

drop policy if exists "Users can insert own pending product order items"
on public.product_order_items;
create policy "Users can insert own pending product order items"
on public.product_order_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.product_orders
    where product_orders.id = product_order_items.product_order_id
      and product_orders.customer_id = auth.uid()
      and product_orders.status = 'pending'
  )
);

drop policy if exists "Admins can manage product order items"
on public.product_order_items;
create policy "Admins can manage product order items"
on public.product_order_items
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Users can read own product payments"
on public.product_payments;
create policy "Users can read own product payments"
on public.product_payments
for select
to authenticated
using (
  exists (
    select 1
    from public.product_orders
    where product_orders.id = product_payments.product_order_id
      and product_orders.customer_id = auth.uid()
  )
);

drop policy if exists "Admins can manage product payments"
on public.product_payments;
create policy "Admins can manage product payments"
on public.product_payments
for all
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Users can read own shopping carts"
on public.shopping_carts;
create policy "Users can read own shopping carts"
on public.shopping_carts
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Users can insert own shopping carts"
on public.shopping_carts;
create policy "Users can insert own shopping carts"
on public.shopping_carts
for insert
to authenticated
with check (customer_id = auth.uid());

drop policy if exists "Users can update own shopping carts"
on public.shopping_carts;
create policy "Users can update own shopping carts"
on public.shopping_carts
for update
to authenticated
using (customer_id = auth.uid())
with check (customer_id = auth.uid());

drop policy if exists "Admins can read shopping carts"
on public.shopping_carts;
create policy "Admins can read shopping carts"
on public.shopping_carts
for select
to authenticated
using (public.current_user_is_admin());

drop policy if exists "Users can read own shopping cart items"
on public.shopping_cart_items;
create policy "Users can read own shopping cart items"
on public.shopping_cart_items
for select
to authenticated
using (
  exists (
    select 1
    from public.shopping_carts
    where shopping_carts.id = shopping_cart_items.shopping_cart_id
      and shopping_carts.customer_id = auth.uid()
  )
);

drop policy if exists "Users can insert own shopping cart items"
on public.shopping_cart_items;
create policy "Users can insert own shopping cart items"
on public.shopping_cart_items
for insert
to authenticated
with check (
  exists (
    select 1
    from public.shopping_carts
    where shopping_carts.id = shopping_cart_items.shopping_cart_id
      and shopping_carts.customer_id = auth.uid()
      and shopping_carts.status = 'active'
  )
);

drop policy if exists "Users can update own shopping cart items"
on public.shopping_cart_items;
create policy "Users can update own shopping cart items"
on public.shopping_cart_items
for update
to authenticated
using (
  exists (
    select 1
    from public.shopping_carts
    where shopping_carts.id = shopping_cart_items.shopping_cart_id
      and shopping_carts.customer_id = auth.uid()
      and shopping_carts.status = 'active'
  )
)
with check (
  exists (
    select 1
    from public.shopping_carts
    where shopping_carts.id = shopping_cart_items.shopping_cart_id
      and shopping_carts.customer_id = auth.uid()
      and shopping_carts.status = 'active'
  )
);

drop policy if exists "Users can delete own shopping cart items"
on public.shopping_cart_items;
create policy "Users can delete own shopping cart items"
on public.shopping_cart_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.shopping_carts
    where shopping_carts.id = shopping_cart_items.shopping_cart_id
      and shopping_carts.customer_id = auth.uid()
      and shopping_carts.status = 'active'
  )
);

drop policy if exists "Admins can read shopping cart items"
on public.shopping_cart_items;
create policy "Admins can read shopping cart items"
on public.shopping_cart_items
for select
to authenticated
using (public.current_user_is_admin());
