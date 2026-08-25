-- Debug current RLS and policies for guest booking tables.
-- Run this in Supabase SQL Editor and share the result.

select
  schemaname,
  tablename,
  rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('profiles', 'vehicles', 'bookings');

select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'vehicles', 'bookings')
order by tablename, policyname;

