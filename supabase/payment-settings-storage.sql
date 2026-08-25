-- Step 14 Part 2: Public payment asset storage for QR images.
-- Run this in Supabase SQL Editor before testing admin QR uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-assets',
  'payment-assets',
  true,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can read payment assets"
on storage.objects;
create policy "Anyone can read payment assets"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'payment-assets');

drop policy if exists "Admins can upload payment assets"
on storage.objects;
create policy "Admins can upload payment assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-assets'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can update payment assets"
on storage.objects;
create policy "Admins can update payment assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-assets'
  and public.current_user_is_admin()
)
with check (
  bucket_id = 'payment-assets'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can delete payment assets"
on storage.objects;
create policy "Admins can delete payment assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'payment-assets'
  and public.current_user_is_admin()
);
