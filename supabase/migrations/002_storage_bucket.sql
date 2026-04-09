-- Create storage bucket for project attachments (PDF, images)
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false);

-- Allow authenticated users to upload to their own folder
create policy "Users can upload attachments"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to read their own attachments
create policy "Users can read own attachments"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Allow users to delete their own attachments
create policy "Users can delete own attachments"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- Service role can read all attachments (for worker)
create policy "Service role can read all attachments"
  on storage.objects for select
  to service_role
  using (bucket_id = 'attachments');
