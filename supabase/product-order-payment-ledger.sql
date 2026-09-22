-- Product order payment rework: append-only ledger of verified payment
-- transactions, so an order's payment_status is always recomputed from what
-- has actually been verified instead of being set directly by whichever
-- code path happened to run (the SlipOK route, or an admin's manual
-- approve/reject action). See docs/production-readiness.md for the
-- background on the bug this closes.
--
-- Nothing existing is dropped. product_payments keeps recording every
-- upload attempt exactly as before; this table only records the subset of
-- attempts that were actually confirmed as real money received.

create table if not exists public.product_payment_transactions (
  id uuid primary key default gen_random_uuid(),
  product_payment_id uuid not null references public.product_payments(id) on delete cascade,
  product_order_id uuid not null references public.product_orders(id) on delete cascade,
  provider_reference text not null,
  verified_amount numeric(10, 2) not null,
  verified_by_type text not null,
  verified_by_user_id uuid references public.profiles(id) on delete set null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payment_transactions_verified_amount_check'
      and conrelid = 'public.product_payment_transactions'::regclass
  ) then
    alter table public.product_payment_transactions
    add constraint product_payment_transactions_verified_amount_check
      check (verified_amount > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payment_transactions_verified_by_type_check'
      and conrelid = 'public.product_payment_transactions'::regclass
  ) then
    alter table public.product_payment_transactions
    add constraint product_payment_transactions_verified_by_type_check
      check (verified_by_type in ('system_slipok', 'admin_manual'));
  end if;

  -- Extend the existing order payment_status values with 'partially_paid',
  -- for an order that has some verified money against it but not enough to
  -- cover total_amount yet. Existing rows and the existing values
  -- ('unpaid', 'pending', 'paid', 'refunded', 'cancelled') are unaffected.
  if exists (
    select 1
    from pg_constraint
    where conname = 'product_orders_payment_status_check'
      and conrelid = 'public.product_orders'::regclass
  ) then
    alter table public.product_orders
    drop constraint product_orders_payment_status_check;
  end if;

  alter table public.product_orders
  add constraint product_orders_payment_status_check
    check (
      payment_status in (
        'unpaid',
        'pending',
        'partially_paid',
        'paid',
        'refunded',
        'cancelled'
      )
    );
end $$;

-- One provider_reference (SlipOK's transRef) can only ever back one
-- verified transaction, system-wide. This is the real fix for "the same
-- physical bank slip gets verified successfully for two different orders" —
-- stronger than the earlier index on product_payments.provider_reference
-- (supabase/product-payment-provider-reference-unique.sql), which stays in
-- place and harmless but is superseded by this one.
create unique index if not exists product_payment_transactions_provider_reference_key
on public.product_payment_transactions(provider_reference);

create index if not exists product_payment_transactions_order_idx
on public.product_payment_transactions(product_order_id);

-- Only server-side (service role) code writes this table: the verify-slipok
-- route and the admin manual-approve action both run with the service role
-- key, never as the signed-in customer or admin's own session. No RLS
-- policy grants insert/update/delete to authenticated users; admins and the
-- order's own customer may only read it.
alter table public.product_payment_transactions enable row level security;

drop policy if exists "Admins can read all payment transactions"
on public.product_payment_transactions;
create policy "Admins can read all payment transactions"
on public.product_payment_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

drop policy if exists "Customers can read own order payment transactions"
on public.product_payment_transactions;
create policy "Customers can read own order payment transactions"
on public.product_payment_transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.product_orders
    where product_orders.id = product_payment_transactions.product_order_id
      and product_orders.customer_id = auth.uid()
  )
);
