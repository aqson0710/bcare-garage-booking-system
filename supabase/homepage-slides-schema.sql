-- Homepage carousel slide management.
-- Run this in Supabase SQL Editor before testing admin homepage slide uploads.

create table if not exists public.homepage_slides (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  image_url text not null,
  primary_label text not null default 'จองบริการ',
  primary_href text not null default '/services',
  secondary_label text,
  secondary_href text,
  sort_order integer not null default 0,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.homepage_slides enable row level security;

create or replace function public.set_homepage_slides_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_slides_set_updated_at on public.homepage_slides;
create trigger homepage_slides_set_updated_at
before update on public.homepage_slides
for each row
execute function public.set_homepage_slides_updated_at();

drop policy if exists "Anyone can read active homepage slides"
on public.homepage_slides;
create policy "Anyone can read active homepage slides"
on public.homepage_slides
for select
to anon, authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists "Admins can insert homepage slides"
on public.homepage_slides;
create policy "Admins can insert homepage slides"
on public.homepage_slides
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update homepage slides"
on public.homepage_slides;
create policy "Admins can update homepage slides"
on public.homepage_slides
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete homepage slides"
on public.homepage_slides;
create policy "Admins can delete homepage slides"
on public.homepage_slides
for delete
to authenticated
using (public.current_user_is_admin());

create table if not exists public.homepage_footer_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null unique default 'default',
  status text not null default 'active' check (status in ('active', 'inactive')),
  background_color text not null default '#C81010',
  office_title text not null default 'สำนักงานใหญ่',
  office_address text,
  office_phone text,
  office_fax text,
  contact_title text not null default 'สอบถามข้อมูล',
  contact_phone text,
  contact_email text,
  services_title text not null default 'สินค้าและบริการ',
  services_content text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.homepage_footer_settings enable row level security;

create or replace function public.set_homepage_footer_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists homepage_footer_settings_set_updated_at
on public.homepage_footer_settings;
create trigger homepage_footer_settings_set_updated_at
before update on public.homepage_footer_settings
for each row
execute function public.set_homepage_footer_settings_updated_at();

drop policy if exists "Anyone can read active homepage footer settings"
on public.homepage_footer_settings;
create policy "Anyone can read active homepage footer settings"
on public.homepage_footer_settings
for select
to anon, authenticated
using (status = 'active' or public.current_user_is_admin());

drop policy if exists "Admins can insert homepage footer settings"
on public.homepage_footer_settings;
create policy "Admins can insert homepage footer settings"
on public.homepage_footer_settings
for insert
to authenticated
with check (public.current_user_is_admin());

drop policy if exists "Admins can update homepage footer settings"
on public.homepage_footer_settings;
create policy "Admins can update homepage footer settings"
on public.homepage_footer_settings
for update
to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "Admins can delete homepage footer settings"
on public.homepage_footer_settings;
create policy "Admins can delete homepage footer settings"
on public.homepage_footer_settings
for delete
to authenticated
using (public.current_user_is_admin());

insert into public.homepage_footer_settings (
  setting_key,
  status,
  background_color,
  office_title,
  office_address,
  office_phone,
  office_fax,
  contact_title,
  contact_phone,
  contact_email,
  services_title,
  services_content
)
values (
  'default',
  'active',
  '#C81010',
  'สำนักงานใหญ่',
  '99/9 ถนนพระราม 9' || chr(10) ||
    'แขวงสวนหลวง เขตสวนหลวง' || chr(10) ||
    'กรุงเทพฯ 10250',
  'โทร. 02-538-8111',
  'โทรสาร. 02-933-1241',
  'สอบถามข้อมูล',
  '02-538-8111 หรือศูนย์บริการใกล้บ้าน',
  'Email : bcare.service@example.com',
  'สินค้าและบริการ',
  'งานบริการ' || chr(10) ||
    'จำหน่ายอะไหล่รถยนต์' || chr(10) ||
    'ผลิตภัณฑ์ดูแลรถยนต์' || chr(10) ||
    'บริการจัดส่งสินค้า' || chr(10) ||
    chr(10) ||
    'กรุงเทพมหานครและปริมณฑล'
)
on conflict (setting_key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'homepage-slides',
  'homepage-slides',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read homepage slide images"
on storage.objects;
create policy "Anyone can read homepage slide images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'homepage-slides');

drop policy if exists "Admins can upload homepage slide images"
on storage.objects;
create policy "Admins can upload homepage slide images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'homepage-slides'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can update homepage slide images"
on storage.objects;
create policy "Admins can update homepage slide images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'homepage-slides'
  and public.current_user_is_admin()
)
with check (
  bucket_id = 'homepage-slides'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can delete homepage slide images"
on storage.objects;
create policy "Admins can delete homepage slide images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'homepage-slides'
  and public.current_user_is_admin()
);
