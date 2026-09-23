-- Lets a customer delete a saved vehicle of their own from /my-vehicles.
--
-- Safety guard: deletion is only allowed once every booking that
-- references the vehicle is resolved - the booking itself is
-- cancelled or completed, or its repair job is completed (the
-- technician finished the work even if the booking record hasn't
-- been flipped to "completed" yet). A booking still pending or
-- confirmed with no completed repair job blocks the delete. This
-- matters because repair-jobs-work-order-schema-alignment.sql
-- already made repair_jobs.vehicle_id "on delete cascade" - so an
-- unrestricted vehicle delete could silently wipe out repair job
-- history that's still in progress. Encoding the check directly in
-- the RLS policy (rather than only in the app's query code) means it
-- holds no matter what calls delete() on this table, and is
-- evaluated atomically as part of the same DELETE statement, so
-- there's no race between checking and deleting.
--
-- authenticated-rls-policies.sql already enables RLS and adds
-- select/insert/update policies for vehicles; this replaces the
-- delete policy from vehicle-delete-policy.sql (previous version
-- blocked deletion while ANY booking referenced the vehicle,
-- regardless of status - this version relaxes that to only block on
-- unresolved bookings).

alter table public.vehicles enable row level security;

drop policy if exists "Users can delete own unused vehicles" on public.vehicles;
create policy "Users can delete own unused vehicles"
on public.vehicles
for delete
to authenticated
using (
  customer_id = auth.uid()
  and not exists (
    select 1
    from public.bookings
    where bookings.vehicle_id = vehicles.id
      and bookings.status not in ('cancelled', 'completed')
      and not exists (
        select 1
        from public.repair_jobs
        where repair_jobs.booking_id = bookings.id
          and repair_jobs.status = 'completed'
      )
  )
);
