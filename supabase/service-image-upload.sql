-- Service image support.
-- Run this in Supabase SQL Editor before testing service image upload/save.

alter table public.services
add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read service images"
on storage.objects;
create policy "Anyone can read service images"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
  and name like 'services/%'
);

drop policy if exists "Admins can upload service images"
on storage.objects;
create policy "Admins can upload service images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can update service images"
on storage.objects;
create policy "Admins can update service images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
)
with check (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can delete service images"
on storage.objects;
create policy "Admins can delete service images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and name like 'services/%'
  and public.current_user_is_admin()
);
