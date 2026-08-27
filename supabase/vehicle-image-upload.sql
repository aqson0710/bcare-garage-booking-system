-- Customer vehicle image support.
-- Run this in Supabase SQL Editor before testing vehicle image upload/save.

alter table public.vehicles
add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read vehicle images"
on storage.objects;
create policy "Anyone can read vehicle images"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'vehicle-images');

drop policy if exists "Users can upload own vehicle images"
on storage.objects;
create policy "Users can upload own vehicle images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own vehicle images"
on storage.objects;
create policy "Users can update own vehicle images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can delete own vehicle images"
on storage.objects;
create policy "Users can delete own vehicle images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'vehicle-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
