-- Homepage background color setting.
-- Separate from homepage_footer_settings on purpose: the footer's own
-- background_color only paints the footer band, and that table's status
-- flag (active/inactive) controls whether the footer shows at all. This
-- new setting controls the background of the whole homepage page itself,
-- and stays in effect even when the admin turns the footer off.
-- Run this in Supabase SQL Editor.

create table if not exists public.homepage_appearance_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique default 'default',
  background_color text not null default '#0a0d0b',
  background_image_url text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

-- Safe to run again on a table created by an earlier version of this file
-- (before the background image / logo options existed).
alter table public.homepage_appearance_settings
  add column if not exists background_image_url text;
alter table public.homepage_appearance_settings
  add column if not exists logo_url text;

alter table public.homepage_appearance_settings enable row level security;

create or replace function public.set_homepage_appearance_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_appearance_settings_set_updated_at
on public.homepage_appearance_settings;
create trigger homepage_appearance_settings_set_updated_at
before update on public.homepage_appearance_settings
for each row
execute function public.set_homepage_appearance_settings_updated_at();

-- Everyone (including anonymous visitors) can read this so the homepage
-- background renders for every visitor, not only signed-in users.
drop policy if exists "Anyone can read homepage appearance settings"
on public.homepage_appearance_settings;
create policy "Anyone can read homepage appearance settings"
on public.homepage_appearance_settings
for select
to anon, authenticated
using (true);

drop policy if exists "Admins can insert homepage appearance settings"
on public.homepage_appearance_settings;
create policy "Admins can insert homepage appearance settings"
on public.homepage_appearance_settings
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update homepage appearance settings"
on public.homepage_appearance_settings;
create policy "Admins can update homepage appearance settings"
on public.homepage_appearance_settings
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

insert into public.homepage_appearance_settings (setting_key, background_color)
values ('default', '#0a0d0b')
on conflict (setting_key) do nothing;
