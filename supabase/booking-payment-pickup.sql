-- Repair-job payment + vehicle-pickup flow for bookings.
--
-- Mirrors the product-order payment pattern (slip upload -> admin review),
-- but simpler: a booking only ever owes one flat amount (the service's
-- base_price, snapshotted when the repair job is closed), so there is no
-- partial-payment ledger like product_payment_transactions - just one
-- payment_status on the booking plus a history of upload attempts in
-- booking_payments.
--
-- Nothing existing is touched: bookings.status and repair_jobs.status keep
-- their current values and meaning. This only adds new columns/tables, and
-- a new payment_status column on bookings that starts at 'not_required' for
-- every existing row so nothing already in production changes behavior.
--
-- All writes to bookings/booking_payments for this flow happen through the
-- five security-definer functions below (never a bare client-side
-- .update()), because the various callers (technician, customer, admin)
-- each only have narrow rights to touch these rows and the existing RLS
-- setup on `bookings` is not something this migration wants to guess at or
-- widen. Run this whole file once in the Supabase SQL editor.

alter table public.bookings
add column if not exists payment_status text not null default 'not_required',
add column if not exists payment_amount numeric(10, 2),
add column if not exists picked_up_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'bookings_payment_status_check'
      and conrelid = 'public.bookings'::regclass
  ) then
    alter table public.bookings
    add constraint bookings_payment_status_check
      check (
        payment_status in (
          'not_required',
          'awaiting_payment',
          'pending_review',
          'paid',
          'rejected'
        )
      );
  end if;
end $$;

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null default 'bank_transfer',
  slip_image_url text not null,
  payment_status text not null default 'pending',
  rejected_reason text,
  submitted_at timestamptz not null default now(),
  paid_at timestamptz,
  verified_at timestamptz,
  verified_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_payments_payment_status_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_payment_status_check
      check (payment_status in ('pending', 'paid', 'rejected'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_payments_payment_method_check'
      and conrelid = 'public.booking_payments'::regclass
  ) then
    alter table public.booking_payments
    add constraint booking_payments_payment_method_check
      check (payment_method in ('bank_transfer', 'promptpay'));
  end if;
end $$;

create index if not exists booking_payments_booking_idx
on public.booking_payments(booking_id);

create index if not exists booking_payments_customer_idx
on public.booking_payments(customer_id);

alter table public.booking_payments enable row level security;

-- Read-only for regular users: every write below happens through the
-- security-definer functions, which bypass RLS by design and carry their
-- own explicit ownership/role/state checks. No insert/update/delete policy
-- is granted here on purpose.
drop policy if exists "Customers can read own booking payments"
on public.booking_payments;
create policy "Customers can read own booking payments"
on public.booking_payments
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Admins can read all booking payments"
on public.booking_payments;
create policy "Admins can read all booking payments"
on public.booking_payments
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

-- Storage: reuse the existing shared "payment-slips" bucket (already used
-- for product-order slips) with a bookings/ path prefix, following the same
-- "<uploaderUserId>/..." first-folder convention its existing policies use.
-- These policies are purely additive alongside whatever already exists on
-- that bucket for product-order slips.
drop policy if exists "Customers can upload own booking payment slips"
on storage.objects;
create policy "Customers can upload own booking payment slips"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'bookings'
);

drop policy if exists "Customers can read own booking payment slips"
on storage.objects;
create policy "Customers can read own booking payment slips"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (storage.foldername(name))[2] = 'bookings'
);

drop policy if exists "Admins can read all booking payment slips"
on storage.objects;
create policy "Admins can read all booking payment slips"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[2] = 'bookings'
  and exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'admin'
  )
);

-- 1) Technician closes a repair job: closes repair_jobs as before, and in
-- the same transaction snapshots the service price onto the booking and
-- flips it into "awaiting_payment" so the customer sees a payment step.
create or replace function public.complete_repair_job_and_request_payment(
  target_work_order_id uuid,
  diagnosis_text text,
  repair_notes_text text
)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.repair_jobs;
  booking_record public.bookings;
  service_price numeric(10, 2);
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'ต้องเข้าสู่ระบบ';
  end if;

  select * into job_record
  from public.repair_jobs
  where id = target_work_order_id
  for update;

  if job_record is null then
    raise exception 'ไม่พบใบงานซ่อมนี้';
  end if;

  if job_record.mechanic_id is distinct from auth.uid() then
    raise exception 'ไม่มีสิทธิ์แก้ไขใบงานซ่อมนี้';
  end if;

  if job_record.status in ('completed', 'cancelled') then
    raise exception 'ใบงานซ่อมนี้ปิดแล้ว ไม่สามารถแก้ไขได้';
  end if;

  select * into booking_record
  from public.bookings
  where id = job_record.booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองของใบงานซ่อมนี้';
  end if;

  select base_price into service_price
  from public.services
  where id = booking_record.service_id;

  update public.repair_jobs
  set
    status = 'completed',
    diagnosis = diagnosis_text,
    repair_notes = repair_notes_text,
    completed_at = now_ts,
    started_at = coalesce(job_record.started_at, now_ts),
    updated_at = now_ts
  where id = target_work_order_id
  returning * into job_record;

  update public.bookings
  set
    payment_status = 'awaiting_payment',
    payment_amount = coalesce(service_price, 0),
    updated_at = now_ts
  where id = booking_record.id;

  return job_record;
end;
$$;

grant execute on function public.complete_repair_job_and_request_payment(uuid, text, text)
to authenticated;

-- 2) Customer submits (or resubmits, after a rejection) a payment slip for
-- their own booking. The slip image itself is uploaded to storage
-- client-side first; this function only records it and re-reuses the same
-- booking_payments row on a resubmission rather than piling up duplicates.
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
      submitted_at
    ) values (
      target_booking_id,
      auth.uid(),
      coalesce(booking_record.payment_amount, 0),
      slip_payment_method,
      slip_url,
      'pending',
      now_ts
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

grant execute on function public.submit_booking_payment_slip(uuid, text, text)
to authenticated;

-- 3) Admin approves a booking payment slip.
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

  update public.booking_payments
  set
    payment_status = 'paid',
    paid_at = now_ts,
    verified_at = now_ts,
    verified_by = auth.uid(),
    rejected_reason = null,
    updated_at = now_ts
  where id = target_booking_payment_id;

  update public.bookings
  set payment_status = 'paid', updated_at = now_ts
  where id = payment_record.booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;

grant execute on function public.approve_booking_payment(uuid)
to authenticated;

-- 4) Admin rejects a booking payment slip - the booking falls back to
-- "rejected" so the customer can resubmit.
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

  update public.booking_payments
  set
    payment_status = 'rejected',
    rejected_reason = reason,
    verified_at = now_ts,
    verified_by = auth.uid(),
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

grant execute on function public.reject_booking_payment(uuid, text)
to authenticated;

-- 5) Customer confirms they picked the vehicle back up, only once the
-- booking is fully paid. Also closes the booking as "completed", the same
-- status value the admin's own manual "close booking" action already uses.
create or replace function public.confirm_booking_pickup(
  target_booking_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_record public.bookings;
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

  if booking_record.payment_status is distinct from 'paid' then
    raise exception 'ต้องชำระเงินให้เรียบร้อยก่อนยืนยันรับรถ';
  end if;

  if booking_record.picked_up_at is not null then
    raise exception 'ยืนยันรับรถไปแล้ว';
  end if;

  update public.bookings
  set picked_up_at = now_ts, status = 'completed', updated_at = now_ts
  where id = target_booking_id
  returning * into booking_record;

  return booking_record;
end;
$$;

grant execute on function public.confirm_booking_pickup(uuid)
to authenticated;
