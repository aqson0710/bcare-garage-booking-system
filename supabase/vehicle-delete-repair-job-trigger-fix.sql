-- Fix: "Only the assigned technician can update this repair job." now
-- appears when a customer deletes a vehicle.
--
-- Cause: vehicle-delete-fk-fix.sql made repair_jobs.vehicle_id
-- ON DELETE SET NULL. That FK action runs as an internal UPDATE on
-- repair_jobs (only vehicle_id changes, to null), inside the same
-- transaction as the customer's DELETE on vehicles - and referential
-- integrity actions bypass row-level security, so this internal UPDATE
-- reaches the repair_jobs BEFORE UPDATE trigger
-- (prevent_invalid_technician_repair_job_update, from
-- technician-work-order-update-policies.sql / work-order-status-sync-rules.sql)
-- running as the deleting customer, not the assigned technician. The
-- trigger has no way to tell that apart from a technician trying to edit
-- someone else's job, so it raises the "assigned technician" exception and
-- the whole vehicle delete fails.
--
-- Fix: let that trigger recognize this one specific case - vehicle_id
-- being nulled because the referenced vehicle genuinely no longer exists -
-- and let it through before the ownership checks run. A technician trying
-- to manually null out vehicle_id on a row whose vehicle still exists is
-- still blocked exactly as before.
--
-- Run this in the Supabase SQL Editor, after vehicle-delete-fk-fix.sql.

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

  -- The vehicle FK's ON DELETE SET NULL action landing here: old.vehicle_id
  -- pointed at a vehicle that has just been deleted, so it no longer exists.
  if new.vehicle_id is null
    and old.vehicle_id is not null
    and not exists (
      select 1 from public.vehicles where vehicles.id = old.vehicle_id
    ) then
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
