-- Automatic (SlipOK) verification for booking payments, on top of the
-- manual admin review already added by booking-payment-pickup.sql - this
-- makes the booking payment flow match the product-order payment flow
-- exactly: a customer's uploaded slip is checked automatically right after
-- upload, and an admin can also trigger the same automatic check or
-- approve/reject manually from the booking detail page.
--
-- The bug this is deliberately built to avoid (already hit once on the
-- product side and fixed there): a payment being verified/approved twice,
-- or the same real bank slip being used to "pay" more than one booking.
-- Two guards handle this:
--   1) A unique index on provider_reference - the same real SlipOK
--      transaction reference (or a synthetic "admin-manual:<id>" one for a
--      manual approval) can only ever be recorded once across every
--      booking_payments row.
--   2) approve_booking_payment / reject_booking_payment now both require
--      the row to still be "pending / submitted" before acting, so a
--      payment that's already been verified or rejected - by SlipOK, or by
--      another admin click - can never be re-approved or re-rejected.
--
-- Additive only, run after booking-payment-pickup.sql. Existing
-- booking_payments rows default to verification_status = 'submitted'
-- (their current, only meaningful state today), so nothing already in
-- production changes behavior.

alter table public.booking_payments
add column if not exists verification_status text not null default 'submitted',
add column if not exists verification_provider text,
add column if not exists provider_reference text,
add column if not exists verification_response jsonb,
add column if not exists slip_amount numeric(10, 2);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_payments_verification_status_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_verification_status_check
      check (
        verification_status in ('submitted', 'verified', 'rejected', 'failed')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_payments_verification_provider_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_verification_provider_check
      check (
        verification_provider is null
        or verification_provider in ('slipok', 'admin_manual')
      );
  end if;
end $$;

-- The core anti-double-verification guarantee: the same slip (real SlipOK
-- transRef, or a manual-approval's synthetic reference) can never be
-- recorded as verified on more than one booking_payments row. Scoped to
-- non-null values only, so the many rows that haven't been verified yet
-- (provider_reference still null) never collide with each other.
create unique index if not exists booking_payments_provider_reference_key
on public.booking_payments(provider_reference)
where provider_reference is not null;

-- 2) Customer submits (or resubmits, after a rejection) a payment slip.
-- Now also resets every verification column, so a resubmission starts a
-- clean verification cycle instead of carrying over a stale SlipOK result,
-- reference, or reported slip amount from a previous rejected attempt.
create or replace function public.submit_booking_payment_slip(
  target_booking_id uuid,
  slip_url text,
  slip_payment_method text
)
returns public.booking_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.bookings;
  payment_record public.booking_payments;
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into booking_record
  from public.bookings
  where id = target_booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองนี้';
  end if;

  if booking_record.customer_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์เข้าถึงการจองนี้';
  end if;

  if booking_record.payment_status not in ('awaiting_payment', 'rejected') then
    raise exception 'การจองนี้ไม่ได้อยู่ในสถานะที่รอชำระเงิน';
  end if;

  if slip_url is null or length(trim(slip_url)) = 0 then
    raise exception 'ไม่พบไฟล์สลิป';
  end if;

  if slip_payment_method not in ('bank_transfer', 'promptpay') then
    slip_payment_method := 'bank_transfer';
  end if;

  select * into payment_record
  from public.booking_payments
  where booking_id = target_booking_id
    and payment_status in ('pending', 'rejected')
  order by created_at desc
  limit 1;

  if payment_record is null then
    insert into public.booking_payments (
      booking_id,
      customer_id,
      amount,
      payment_method,
      slip_image_url,
      payment_status,
      submitted_at,
      verification_status,
      verification_provider,
      provider_reference,
      verification_response,
      slip_amount
    ) values (
      target_booking_id,
      auth.uid(),
      coalesce(booking_record.payment_amount, 0),
      slip_payment_method,
      slip_url,
      'pending',
      now_ts,
      'submitted',
      null,
      null,
      null,
      null
    )
    returning * into payment_record;
  else
    update public.booking_payments
    set
      payment_method = slip_payment_method,
      slip_image_url = slip_url,
      payment_status = 'pending',
      rejected_reason = null,
      submitted_at = now_ts,
      verified_at = null,
      verified_by = null,
      verification_status = 'submitted',
      verification_provider = null,
      provider_reference = null,
      verification_response = null,
      slip_amount = null,
      updated_at = now_ts
    where id = payment_record.id
    returning * into payment_record;
  end if;

  update public.bookings
  set payment_status = 'pending_review', updated_at = now_ts
  where id = target_booking_id;

  return payment_record;
end;
$$;

-- 3) Admin approves a booking payment slip manually. Guarded so a payment
-- that isn't currently "pending / submitted" (already verified by SlipOK,
-- already approved, or already rejected) can never be approved again.
-- provider_reference = 'admin-manual:<payment id>' participates in the
-- same uniqueness guarantee as a real SlipOK reference above.
create or replace function public.approve_booking_payment(
  target_booking_payment_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.booking_payments;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'เฉพาะแอดมินเท่านั้น';
  end if;

  select * into payment_record
  from public.booking_payments
  where id = target_booking_payment_id
  for update;

  if payment_record is null then
    raise exception 'ไม่พบรายการชำระเงินนี้';
  end if;

  if payment_record.payment_status <> 'pending'
    or payment_record.verification_status <> 'submitted' then
    raise exception 'รายการนี้ถูกตรวจสอบไปแล้ว ไม่สามารถอนุมัติซ้ำได้';
  end if;

  begin
    update public.booking_payments
    set
      payment_status = 'paid',
      paid_at = now_ts,
      verified_at = now_ts,
      verified_by = auth.uid(),
      verification_status = 'verified',
      verification_provider = 'admin_manual',
      provider_reference = 'admin-manual:' || target_booking_payment_id::text,
      rejected_reason = null,
      updated_at = now_ts
    where id = target_booking_payment_id;
  exception
    when unique_violation then
      raise exception 'สลิปนี้เคยถูกใช้ยืนยันการชำระเงินสำเร็จไปแล้วในรายการอื่น';
  end;

  update public.bookings
  set payment_status = 'paid', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;

-- 4) Admin rejects a booking payment slip manually. Same guard as approve.
create or replace function public.reject_booking_payment(
  target_booking_payment_id uuid,
  reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  payment_record public.booking_payments;
  booking_record public.bookings;
  now_ts timestamptz := now();
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  ) then
    raise exception 'เฉพาะแอดมินเท่านั้น';
  end if;

  if reason is null or length(trim(reason)) = 0 then
    raise exception 'กรุณาระบุเหตุผลที่ปฏิเสธ';
  end if;

  select * into payment_record
  from public.booking_payments
  where id = target_booking_payment_id
  for update;

  if payment_record is null then
    raise exception 'ไม่พบรายการชำระเงินนี้';
  end if;

  if payment_record.payment_status <> 'pending'
    or payment_record.verification_status <> 'submitted' then
    raise exception 'รายการนี้ถูกตรวจสอบไปแล้ว ไม่สามารถปฏิเสธซ้ำได้';
  end if;

  update public.booking_payments
  set
    payment_status = 'rejected',
    rejected_reason = reason,
    verified_at = now_ts,
    verified_by = auth.uid(),
    verification_status = 'rejected',
    paid_at = null,
    updated_at = now_ts
  where id = target_booking_payment_id;

  update public.bookings
  set payment_status = 'rejected', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;
