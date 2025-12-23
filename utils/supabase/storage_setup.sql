-- Create a bucket for review images
INSERT INTO storage.buckets (id, name, public) VALUES ('reviews', 'reviews', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Anyone can view avatars
CREATE POLICY "Reviews are public" ON storage.objects
  FOR SELECT USING (bucket_id = 'reviews');

-- Policy: Authenticated users can upload avatars
CREATE POLICY "Users can upload reviews" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'reviews' AND
    auth.role() = 'authenticated'
  );

-- Policy: Users can update their own avatars
CREATE POLICY "Users can update own reviews" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'reviews' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
