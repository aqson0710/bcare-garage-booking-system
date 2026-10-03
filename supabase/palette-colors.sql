-- Switch the saved homepage colors to the royal-blue palette.
--
-- The homepage background and footer colors are admin settings stored in
-- the database, so changing the defaults in code does not change the rows
-- that already exist. This only replaces the system's OLD default colors
-- (the original red/black and the earlier navy draft); if an admin has
-- picked a different color on purpose, it is left alone.
-- (Admins can still change both colors later in /admin/homepage.)
--
-- Run in the Supabase SQL Editor. Safe to run more than once.

update public.homepage_footer_settings
set background_color = '#111FA2'
where lower(background_color) in ('#c81010', '#030164');

update public.homepage_appearance_settings
set background_color = '#060B4A'
where lower(background_color) in ('#0a0d0b', '#020146');
