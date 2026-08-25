-- Step 12 Part 11: Payment slip storage bucket and policies.
-- Run this in Supabase SQL Editor before testing customer slip uploads.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-slips',
  'payment-slips',
  false,
  5242880,
  array['image/png', 'image/jpeg']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own payment slips"
on storage.objects;
create policy "Users can read own payment slips"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can upload own payment slips"
on storage.objects;
create policy "Users can upload own payment slips"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users can update own payment slips"
on storage.objects;
create policy "Users can update own payment slips"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'payment-slips'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Admins can read payment slips"
on storage.objects;
create policy "Admins can read payment slips"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-slips'
  and public.current_user_is_admin()
);

drop policy if exists "Admins can manage payment slips"
on storage.objects;
create policy "Admins can manage payment slips"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'payment-slips'
  and public.current_user_is_admin()
)
with check (
  bucket_id = 'payment-slips'
  and public.current_user_is_admin()
);
