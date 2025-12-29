-- Migration: Add menu-photos storage bucket with RLS
-- Created: 2025-12-29

-- Create public bucket for menu item photos
-- Public bucket is optimal for scalability:
-- - No signed URL generation overhead
-- - CDN caching for global edge delivery  
-- - Menu photos are public content anyway
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-photos', 'menu-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view menu photos (public bucket)
CREATE POLICY "Public can view menu photos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'menu-photos');

-- Allow cafe owners to upload menu photos
-- Path convention: {cafe_id}/{filename}
-- Using service role for admin uploads, this policy for owner uploads
CREATE POLICY "Cafe owners can upload menu photos" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (
    bucket_id = 'menu-photos' 
    AND EXISTS (
        SELECT 1 FROM public.cafes 
        WHERE id = (string_to_array(name, '/'))[1]::uuid 
        AND owner_ids @> ARRAY[auth.uid()]
    )
);

-- Allow cafe owners to update their menu photos
CREATE POLICY "Cafe owners can update menu photos" 
ON storage.objects FOR UPDATE 
TO authenticated 
USING (
    bucket_id = 'menu-photos' 
    AND EXISTS (
        SELECT 1 FROM public.cafes 
        WHERE id = (string_to_array(name, '/'))[1]::uuid 
        AND owner_ids @> ARRAY[auth.uid()]
    )
);

-- Allow cafe owners to delete their menu photos
CREATE POLICY "Cafe owners can delete menu photos" 
ON storage.objects FOR DELETE 
TO authenticated 
USING (
    bucket_id = 'menu-photos' 
    AND EXISTS (
        SELECT 1 FROM public.cafes 
        WHERE id = (string_to_array(name, '/'))[1]::uuid 
        AND owner_ids @> ARRAY[auth.uid()]
    )
);
