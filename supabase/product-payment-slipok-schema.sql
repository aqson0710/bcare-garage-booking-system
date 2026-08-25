-- Step 12 Part 10: SlipOK payment schema and planning
-- Run this in Supabase SQL Editor before building the customer slip upload UI.

alter table public.product_payments
add column if not exists verification_provider text not null default 'manual',
add column if not exists verification_status text not null default 'not_submitted',
add column if not exists slip_image_url text,
add column if not exists slip_qr_payload text,
add column if not exists slip_reference text,
add column if not exists slip_amount numeric(10, 2),
add column if not exists slip_transfer_at timestamptz,
add column if not exists slip_sender_bank text,
add column if not exists slip_sender_account text,
add column if not exists slip_receiver_bank text,
add column if not exists slip_receiver_account text,
add column if not exists slip_receiver_name text,
add column if not exists provider_reference text,
add column if not exists verification_response jsonb,
add column if not exists submitted_at timestamptz,
add column if not exists verified_at timestamptz,
add column if not exists verified_by uuid references public.profiles(id) on delete set null,
add column if not exists rejected_reason text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payments_verification_provider_check'
      and conrelid = 'public.product_payments'::regclass
  ) then
    alter table public.product_payments
    add constraint product_payments_verification_provider_check
      check (verification_provider in ('manual', 'slipok'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payments_verification_status_check'
      and conrelid = 'public.product_payments'::regclass
  ) then
    alter table public.product_payments
    add constraint product_payments_verification_status_check
      check (
        verification_status in (
          'not_submitted',
          'submitted',
          'verified',
          'rejected',
          'failed'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_payments_slip_amount_check'
      and conrelid = 'public.product_payments'::regclass
  ) then
    alter table public.product_payments
    add constraint product_payments_slip_amount_check
      check (slip_amount is null or slip_amount >= 0);
  end if;
end $$;

create unique index if not exists product_payments_slip_reference_key
on public.product_payments(slip_reference)
where slip_reference is not null;

create index if not exists product_payments_verification_status_idx
on public.product_payments(verification_status);

create index if not exists product_payments_provider_reference_idx
on public.product_payments(provider_reference)
where provider_reference is not null;

drop policy if exists "Users can insert own product payments"
on public.product_payments;
create policy "Users can insert own product payments"
on public.product_payments
for insert
to authenticated
with check (
  payment_status in ('pending', 'failed')
  and paid_at is null
  and verified_at is null
  and exists (
    select 1
    from public.product_orders
    where product_orders.id = product_payments.product_order_id
      and product_orders.customer_id = auth.uid()
  )
);

drop policy if exists "Users can update own pending product payments"
on public.product_payments;
create policy "Users can update own pending product payments"
on public.product_payments
for update
to authenticated
using (
  payment_status in ('pending', 'failed')
  and exists (
    select 1
    from public.product_orders
    where product_orders.id = product_payments.product_order_id
      and product_orders.customer_id = auth.uid()
  )
)
with check (
  payment_status in ('pending', 'failed')
  and paid_at is null
  and verified_at is null
  and exists (
    select 1
    from public.product_orders
    where product_orders.id = product_payments.product_order_id
      and product_orders.customer_id = auth.uid()
  )
);
