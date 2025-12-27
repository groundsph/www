-- Create the ownership-proofs bucket
-- Private bucket for storing sensitive business documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ownership-proofs', 
    'ownership-proofs', 
    false, 
    10485760, -- 10MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Enable RLS (Usually already enabled, skipping to avoid permission errors)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload their own proof files
-- File path format: {userId}/{filename}
CREATE POLICY "Users can upload own ownership proofs" ON storage.objects
    FOR INSERT 
    WITH CHECK (
        bucket_id = 'ownership-proofs' 
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Users can view/download their own proof files
CREATE POLICY "Users can view own ownership proofs" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'ownership-proofs'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Users can delete their own proof files (optional, but good for cleanup)
CREATE POLICY "Users can delete own ownership proofs" ON storage.objects
    FOR DELETE
    USING (
        bucket_id = 'ownership-proofs'
        AND auth.role() = 'authenticated'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Policy: Admins can view all proof files
-- Performance warning: This queries the profiles table.
CREATE POLICY "Admins can view all ownership proofs" ON storage.objects
    FOR SELECT
    USING (
        bucket_id = 'ownership-proofs'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );
