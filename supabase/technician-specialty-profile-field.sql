-- Step 9 Part 4.1: Technician specialty profile field.
-- Run this in Supabase SQL Editor before setting technician specialties.
-- This lets admins distinguish mechanics while assigning repair jobs.

alter table public.profiles
add column if not exists technician_specialty text;
