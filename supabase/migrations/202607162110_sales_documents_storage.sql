insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sales-documents',
  'sales-documents',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Owners can read sales documents" on storage.objects;
create policy "Owners can read sales documents"
on storage.objects for select to authenticated
using (
  bucket_id = 'sales-documents'
  and public.user_owns_business(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Owners can upload sales documents" on storage.objects;
create policy "Owners can upload sales documents"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'sales-documents'
  and public.user_owns_business(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "Owners can delete sales documents" on storage.objects;
create policy "Owners can delete sales documents"
on storage.objects for delete to authenticated
using (
  bucket_id = 'sales-documents'
  and public.user_owns_business(((storage.foldername(name))[1])::uuid)
);
