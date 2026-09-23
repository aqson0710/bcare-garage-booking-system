-- Lets a technician undo their own "เสร็จงาน" (complete) click on a repair
-- job, for when it was pressed by mistake - additive on top of
-- booking-payment-pickup.sql, which is where complete_repair_job_and_
-- request_payment (the function this reverses) is defined.
--
-- Why this needs its own security-definer function rather than a plain
-- client .update(): completing a job doesn't just set repair_jobs.status,
-- it also snapshots the price onto the booking and flips
-- bookings.payment_status to 'awaiting_payment' - and a technician's own
-- session has no direct write access to `bookings` (same reason
-- complete_repair_job_and_request_payment itself is security definer).
-- Reopening has to undo both halves atomically, the same way completing
-- set both.
--
-- Safety guard (the important part): reopening is only allowed while
-- bookings.payment_status is still exactly 'awaiting_payment' - i.e. the
-- customer hasn't touched the payment step at all yet (no slip uploaded).
-- The moment a slip is submitted (payment_status moves to
-- 'pending_review', 'paid', or 'rejected'), the booking has a payment
-- trail a technician should not be able to erase by reopening the job out
-- of the workflow - it's handed off to the payment/admin flow at that
-- point and any correction goes through an admin instead.
--
-- Bypassing the "closed job" trigger: technician-work-order-update-
-- policies.sql / work-order-status-sync-rules.sql already installed a
-- BEFORE UPDATE trigger on repair_jobs
-- (prevent_invalid_technician_repair_job_update) that raises "Closed
-- repair jobs cannot be updated by technicians." for any update where
-- old.status is 'completed' or 'cancelled' - and triggers fire on every
-- UPDATE statement regardless of the calling function's own privilege
-- level, so being security definer does not exempt this function from
-- it. work-order-status-sync-rules.sql already gives that trigger an
-- escape hatch for exactly this situation: it returns immediately
-- without checking anything once the session-local flag
-- app.bcare_status_sync is 'on' (the same flag its own cross-table sync
-- triggers set on themselves before writing to the other table). This
-- function sets that flag before touching repair_jobs, the same way the
-- built-in sync triggers already do - every real authorization/safety
-- check for reopening has already run above by that point, so this is
-- purely lifting a guard that doesn't know "reopen" is a legitimate
-- operation, not skipping a check that matters here.
--
-- There is a second trigger, prevent_repair_job_booking_status_mismatch,
-- that blocks a repair job from being anything other than 'completed'
-- while its linked booking is still bookings.status = 'completed'. That
-- one does not check the sync flag, so bookings.status has to be moved
-- off 'completed' (back to 'confirmed') *before* repair_jobs is updated,
-- not after - hence updating bookings first below.
create or replace function public.reopen_repair_job(
  target_work_order_id uuid
)
returns public.repair_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  job_record public.repair_jobs;
  booking_record public.bookings;
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

  if job_record.status <> 'completed' then
    raise exception 'เปิดใบงานซ่อมนี้อีกครั้งไม่ได้ เพราะยังไม่ได้ถูกปิดงาน';
  end if;

  select * into booking_record
  from public.bookings
  where id = job_record.booking_id
  for update;

  if booking_record is null then
    raise exception 'ไม่พบการจองของใบงานซ่อมนี้';
  end if;

  if booking_record.payment_status <> 'awaiting_payment' then
    raise exception 'ลูกค้าเริ่มดำเนินการชำระเงินแล้ว ไม่สามารถเปิดงานซ่อมนี้อีกครั้งได้ กรุณาติดต่อแอดมิน';
  end if;

  -- Lift the "closed job can't be touched by a technician" trigger guard
  -- for the repair_jobs update below - every real check has already run.
  perform set_config('app.bcare_status_sync', 'on', true);

  -- Move the booking off 'completed' first, so the repair_jobs update
  -- right after this doesn't get rejected by
  -- prevent_repair_job_booking_status_mismatch for looking "open" while
  -- its booking still reads as completed.
  update public.bookings
  set
    status = 'confirmed',
    payment_status = 'not_required',
    payment_amount = null,
    updated_at = now_ts
  where id = booking_record.id;

  update public.repair_jobs
  set
    status = 'in_progress',
    completed_at = null,
    updated_at = now_ts
  where id = target_work_order_id
  returning * into job_record;

  return job_record;
end;
$$;

grant execute on function public.reopen_repair_job(uuid)
to authenticated;
