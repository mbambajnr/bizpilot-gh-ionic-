insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'procurement-documents',
  'procurement-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can read procurement documents" on storage.objects;
create policy "Owners can read procurement documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'procurement-documents'
  and public.user_owns_business(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Owners can upload procurement documents" on storage.objects;
create policy "Owners can upload procurement documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'procurement-documents'
  and public.user_owns_business(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Owners can delete procurement documents" on storage.objects;
create policy "Owners can delete procurement documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'procurement-documents'
  and public.user_owns_business(((storage.foldername(name))[1])::uuid)
);
