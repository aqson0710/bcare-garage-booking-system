-- Step 12 Part 10: SlipOK payment schema check.
-- Run this in Supabase SQL Editor after product-payment-slipok-schema.sql.
-- Read-only check: this file does not create, alter, update, or delete data.

with expected_columns as (
  select unnest(array[
    'id',
    'product_order_id',
    'payment_method',
    'payment_status',
    'amount',
    'paid_at',
    'verification_provider',
    'verification_status',
    'slip_image_url',
    'slip_qr_payload',
    'slip_reference',
    'slip_amount',
    'slip_transfer_at',
    'slip_sender_bank',
    'slip_sender_account',
    'slip_receiver_bank',
    'slip_receiver_account',
    'slip_receiver_name',
    'provider_reference',
    'verification_response',
    'submitted_at',
    'verified_at',
    'verified_by',
    'rejected_reason',
    'created_at',
    'updated_at'
  ]) as column_name
)
select
  expected_columns.column_name,
  (columns.column_name is not null) as column_exists,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from expected_columns
left join information_schema.columns as columns
  on columns.table_schema = 'public'
  and columns.table_name = 'product_payments'
  and columns.column_name = expected_columns.column_name
order by expected_columns.column_name;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'product_payments'
order by policyname;

select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'product_payments'
  and indexname in (
    'product_payments_slip_reference_key',
    'product_payments_verification_status_idx',
    'product_payments_provider_reference_idx'
  )
order by indexname;
