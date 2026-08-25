-- Step 9 Part 8: Work order and booking status sync rules.
-- Run this in Supabase SQL Editor after Step 9 Part 7.
-- Keeps booking status and repair job status from drifting apart.

alter table public.bookings enable row level security;
alter table public.repair_jobs enable row level security;

create or replace function public.prevent_invalid_technician_repair_job_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bcare_status_sync', true) = 'on' then
    return new;
  end if;

  if public.current_user_is_admin() then
    return new;
  end if;

  if old.mechanic_id is distinct from auth.uid() then
    raise exception 'Only the assigned technician can update this repair job.';
  end if;

  if old.status in ('completed', 'cancelled') then
    raise exception 'Closed repair jobs cannot be updated by technicians.';
  end if;

  if new.status not in ('assigned', 'in_progress', 'completed') then
    raise exception 'Technicians can only set assigned, in_progress, or completed.';
  end if;

  if new.booking_id is distinct from old.booking_id
    or new.customer_id is distinct from old.customer_id
    or new.vehicle_id is distinct from old.vehicle_id
    or new.mechanic_id is distinct from old.mechanic_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Technicians cannot change repair job ownership fields.';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_repair_job_booking_status_mismatch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_booking_status text;
begin
  select bookings.status
  into linked_booking_status
  from public.bookings
  where bookings.id = new.booking_id;

  if linked_booking_status is null then
    raise exception 'Repair job must be linked to an existing booking.';
  end if;

  if linked_booking_status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Cannot keep an open repair job for a cancelled booking.';
  end if;

  if linked_booking_status = 'completed' and new.status <> 'completed' then
    raise exception 'Cannot keep an open repair job for a completed booking.';
  end if;

  if linked_booking_status = 'pending'
    and new.status in ('assigned', 'in_progress', 'completed') then
    raise exception 'Booking must be confirmed before repair work can progress.';
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_repair_job_booking_status_mismatch
on public.repair_jobs;
create trigger prevent_repair_job_booking_status_mismatch
before insert or update of booking_id, status on public.repair_jobs
for each row
execute function public.prevent_repair_job_booking_status_mismatch();

create or replace function public.sync_booking_status_from_repair_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bcare_status_sync', true) = 'on' then
    return new;
  end if;

  perform set_config('app.bcare_status_sync', 'on', true);

  if new.status = 'completed' then
    update public.bookings
    set status = 'completed',
        updated_at = now()
    where id = new.booking_id
      and status <> 'cancelled';
  elsif new.status in ('pending', 'assigned', 'in_progress') then
    update public.bookings
    set status = 'confirmed',
        updated_at = now()
    where id = new.booking_id
      and status = 'pending';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_booking_status_from_repair_job
on public.repair_jobs;
create trigger sync_booking_status_from_repair_job
after insert or update of status on public.repair_jobs
for each row
execute function public.sync_booking_status_from_repair_job();

create or replace function public.sync_repair_job_status_from_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_setting('app.bcare_status_sync', true) = 'on' then
    return new;
  end if;

  if old.status is not distinct from new.status then
    return new;
  end if;

  perform set_config('app.bcare_status_sync', 'on', true);

  if new.status = 'cancelled' then
    update public.repair_jobs
    set status = 'cancelled',
        completed_at = null,
        updated_at = now()
    where booking_id = new.id
      and status not in ('completed', 'cancelled');
  elsif new.status = 'completed' then
    update public.repair_jobs
    set status = 'completed',
        started_at = coalesce(started_at, now()),
        completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where booking_id = new.id
      and status <> 'cancelled';
  end if;

  return new;
end;
$$;

drop trigger if exists sync_repair_job_status_from_booking
on public.bookings;
create trigger sync_repair_job_status_from_booking
after update of status on public.bookings
for each row
execute function public.sync_repair_job_status_from_booking();
