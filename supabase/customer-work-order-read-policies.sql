-- Step 9 Part 7: Customer work order read policies.
-- Run this in Supabase SQL Editor before testing customer work order progress.
-- Customers can read only repair jobs linked to their own profile and can read
-- the assigned mechanic profile only for those repair jobs.

alter table public.repair_jobs enable row level security;

drop policy if exists repair_jobs_customer_select_own
on public.repair_jobs;
create policy repair_jobs_customer_select_own
on public.repair_jobs
for select
to authenticated
using (customer_id = auth.uid());

drop policy if exists "Customers can read assigned mechanic profiles"
on public.profiles;
create policy "Customers can read assigned mechanic profiles"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.repair_jobs
    where repair_jobs.mechanic_id = profiles.id
      and repair_jobs.customer_id = auth.uid()
  )
);
