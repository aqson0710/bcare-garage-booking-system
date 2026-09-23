-- Let anonymous (not-yet-logged-in) visitors read the shop's operating
-- hours and closed dates, not just authenticated users. Needed for the
-- new public-homepage "open/closed now" badge and weekly-hours table,
-- since a guest browsing the homepage before logging in should be able to
-- see business hours just like the rest of the homepage content already
-- does (slides/footer are already anon-readable - see
-- homepage-slides-schema.sql). Business hours aren't sensitive data, so
-- this is a straightforward widen of the existing authenticated-only
-- policies from garage-operating-days.sql.
--
-- Run this in the Supabase SQL Editor.

drop policy if exists "Authenticated users can read garage operating days"
on public.garage_operating_days;
create policy "Anyone can read garage operating days"
on public.garage_operating_days
for select
to anon, authenticated
using (true);

drop policy if exists "Authenticated users can read garage closed dates"
on public.garage_closed_dates;
create policy "Anyone can read garage closed dates"
on public.garage_closed_dates
for select
to anon, authenticated
using (true);
