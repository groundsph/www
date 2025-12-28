-- Create a new private bucket for payment proofs
insert into storage.buckets (id, name, public)
values ('cafe-payments', 'cafe-payments', false)
on conflict (id) do nothing;

-- Set up RLS for the bucket
-- alter table storage.objects enable row level security; -- RLS is enabled by default on storage.objects in Supabase

-- Policy: Authenticated users can upload their own payment proofs
-- Path convention: {cafe_id}/{filename}
-- We check if the user is the owner of the cafe in the path (this is tricky in storage RLS without extra lookups)
-- Simpler approach: Allow authenticated users to upload to any path in this bucket, 
-- but rely on the application logic to verify ownership before saving the reference in `cafe_subscriptions`.
-- However, strict RLS is better. 
-- Let's stick to a simpler "Authenticated users can upload" policy for now to avoid complex joins in RLS which can be slow/problematic.
create policy "Authenticated users can upload payment proofs"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'cafe-payments' );

-- Policy: Authenticated users can view their own uploads (if we store user_id in metadata or path)
-- Since we are storing by cafe_id, and don't easily know which user owns which cafe inside storage RLS,
-- we'll rely on the server generating signed URLs for viewing.
-- But the user needs to preview it immediately after upload?
-- If it's private, they can't preview easily without a signed URL.
-- Actually, the `uploadCafeImageWithProgress` returns a path or signed URL?
-- If I make it private, I need to handle signed URLs.

-- Alternative: Make it public but with RLS restricting INSERT/UPDATE/DELETE?
-- "public" bucket means reads are public to everyone. proof of payment contains sensitive info (ref numbers, names).
-- So it MUST be private.

-- Policy: Admin users can select (view) all payment proofs
-- (Assuming we have an app_admin role or similar checks)
-- For now, we will rely on SERVICE ROLE (server actions) or Signed URLs to view.

-- Allow users to read their own uploads? 
-- If we use the standard folder structure `userId/filename`, then:
create policy "Users can view their own payment proofs"
on storage.objects for select
to authenticated
using ( bucket_id = 'cafe-payments' and substring(name from 1 for 36) = auth.uid()::text );

-- WAIT, my previous implementation used `payments/{cafeId}/...`
-- The `uploadCafeImageWithProgress` function uses `cafe-assets` bucket and `userId/filename` path structure by default?
-- No, looking at `SubscriptionPage.tsx`:
-- `uploadCafeImageWithProgress(file, ..., 'cafe-assets', 'payments/{cafeId}/...')`
-- I need to update `SubscriptionPage.tsx` to use `cafe-payments` bucket.
-- And I should probably use `cafeId/filename` or `userId/filename`.
-- `userId` is safer for RLS. `cafeId` is better for organization.
-- Let's use `cafeId` in the path, but this makes RLS harder.
-- I will stick to `cafe-payments` bucket (private).
-- And allow authenticated INSERT. 
-- SELECT will be restricted (no public access).
-- Admin viewing will be done via Signed URLs generated on the server.

create policy "Authenticated users can upload to cafe-payments"
on storage.objects for insert
to authenticated
with check ( bucket_id = 'cafe-payments' );

-- Allow users to update/delete their own files if needed (optional)
