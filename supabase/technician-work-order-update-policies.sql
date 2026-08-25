-- Step 9 Part 6: Technician work order update policies.
-- Run this in Supabase SQL Editor before testing /technician/work-orders/[id].
-- Technicians can update only their assigned, open repair jobs. Admin update
-- access is kept separate from technician update access.

alter table public.repair_jobs enable row level security;

drop policy if exists repair_jobs_update_mechanic_or_admin
on public.repair_jobs;

drop policy if exists repair_jobs_admin_update
on public.repair_jobs;
create policy repair_jobs_admin_update
on public.repair_jobs
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists repair_jobs_assigned_mechanic_update
on public.repair_jobs;
create policy repair_jobs_assigned_mechanic_update
on public.repair_jobs
for update
to authenticated
using (
  mechanic_id = auth.uid()
  and status in ('assigned', 'in_progress')
)
with check (
  mechanic_id = auth.uid()
  and status in ('assigned', 'in_progress', 'completed')
);

create or replace function public.prevent_invalid_technician_repair_job_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

drop trigger if exists prevent_invalid_technician_repair_job_update
on public.repair_jobs;
create trigger prevent_invalid_technician_repair_job_update
before update on public.repair_jobs
for each row
execute function public.prevent_invalid_technician_repair_job_update();
