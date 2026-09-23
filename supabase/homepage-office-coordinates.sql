-- Adds an office latitude/longitude to homepage_footer_settings so the
-- admin can pin the exact map location shown on the public homepage,
-- instead of relying on Google Maps to geocode the free-text office
-- address (which can land on the wrong building for a new/small business).
--
-- No RLS changes needed: homepage_footer_settings already has "Anyone can
-- read active homepage footer settings" (to anon, authenticated) from
-- homepage-slides-schema.sql, and these are just two more nullable
-- columns on that same row.
--
-- Run this in the Supabase SQL Editor.

alter table public.homepage_footer_settings
add column if not exists office_latitude numeric(10, 7);

alter table public.homepage_footer_settings
add column if not exists office_longitude numeric(10, 7);
