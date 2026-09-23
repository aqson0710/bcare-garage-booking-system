-- Powers the "count-up" stat cards on the public homepage (customers
-- served / repair jobs completed / technician team size) with real numbers
-- from the database instead of placeholder copy.
--
-- profiles and repair_jobs both have RLS that only lets a user read their
-- own rows (or an admin read everything) - there is no public/anon read
-- policy on either table, and this migration deliberately does not add
-- one, since that would expose individual customers'/technicians' names,
-- phone numbers and emails to anyone. Instead this adds one
-- security-definer function that returns ONLY the three aggregate counts
-- below (never individual rows), and grants execute on just that function
-- to anon/authenticated - the same "expose an aggregate, not the table"
-- pattern already used by public.current_user_role() in
-- admin-role-access.sql.
--
-- Run this in the Supabase SQL Editor.

create or replace function public.get_homepage_stats()
returns table (
  trusted_customers_count bigint,
  completed_repair_jobs_count bigint,
  technician_team_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.profiles where role = 'customer') as trusted_customers_count,
    (select count(*) from public.repair_jobs where status = 'completed') as completed_repair_jobs_count,
    (select count(*) from public.profiles where role = 'technician') as technician_team_count;
$$;

grant execute on function public.get_homepage_stats() to anon, authenticated;
