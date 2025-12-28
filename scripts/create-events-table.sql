-- Events Feature: Database Schema
-- Run this SQL in Supabase SQL Editor

-- Create event_status enum
DO $$ BEGIN
    CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    start_date timestamptz NOT NULL,
    end_date timestamptz,
    location_name text,
    address text,
    city text,
    region text,
    cafe_id uuid REFERENCES public.cafes(id) ON DELETE SET NULL,
    image_url text,
    ticket_link text,
    is_national boolean DEFAULT false,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    status public.event_status DEFAULT 'draft',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS events_start_date_idx ON public.events(start_date);
CREATE INDEX IF NOT EXISTS events_status_idx ON public.events(status);
CREATE INDEX IF NOT EXISTS events_city_idx ON public.events(city);
CREATE INDEX IF NOT EXISTS events_region_idx ON public.events(region);
CREATE INDEX IF NOT EXISTS events_is_national_idx ON public.events(is_national);

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Public read access for published events
CREATE POLICY "Public can read published events"
    ON public.events
    FOR SELECT
    USING (status = 'published');

-- Admins and moderators can read all events
CREATE POLICY "Admins and mods can read all events"
    ON public.events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );

-- Creators can read their own events
CREATE POLICY "Creators can read own events"
    ON public.events
    FOR SELECT
    USING (created_by = auth.uid());

-- Admins can insert events
CREATE POLICY "Admins can insert events"
    ON public.events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );

-- Cafe owners can insert events for their cafes
CREATE POLICY "Cafe owners can insert events"
    ON public.events
    FOR INSERT
    WITH CHECK (
        cafe_id IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.cafes
            WHERE id = cafe_id
            AND auth.uid() = ANY(owner_ids)
        )
    );

-- Admins and creators can update events
CREATE POLICY "Admins and creators can update events"
    ON public.events
    FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );

-- Admins and creators can delete events
CREATE POLICY "Admins and creators can delete events"
    ON public.events
    FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
            AND role IN ('admin', 'moderator')
        )
    );

-- ============================================
-- STORAGE BUCKET & POLICIES FOR EVENT IMAGES
-- ============================================

-- Create the events storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'events',
    'events',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for re-running)
DROP POLICY IF EXISTS "Public can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Creators can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Creators can delete event images" ON storage.objects;

-- Policy: Allow public read access to event images
CREATE POLICY "Public can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'events');

-- Policy: Admins/moderators can upload event images
CREATE POLICY "Admins can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'events'
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
);

-- Policy: Cafe owners can upload event images (folder structure: cafe_id/filename)
CREATE POLICY "Cafe owners can upload event images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'events'
    AND auth.role() = 'authenticated'
    AND EXISTS (
        SELECT 1 FROM public.cafes
        WHERE id::text = (storage.foldername(name))[1]
        AND auth.uid() = ANY(owner_ids)
    )
);

-- Policy: Admins/moderators can update any event images
CREATE POLICY "Admins can update event images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'events'
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
);

-- Policy: Cafe owners can update their event images
CREATE POLICY "Cafe owners can update event images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'events'
    AND EXISTS (
        SELECT 1 FROM public.cafes
        WHERE id::text = (storage.foldername(name))[1]
        AND auth.uid() = ANY(owner_ids)
    )
);

-- Policy: Admins/moderators can delete any event images
CREATE POLICY "Admins can delete event images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'events'
    AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
);

-- Policy: Cafe owners can delete their event images
CREATE POLICY "Cafe owners can delete event images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'events'
    AND EXISTS (
        SELECT 1 FROM public.cafes
        WHERE id::text = (storage.foldername(name))[1]
        AND auth.uid() = ANY(owner_ids)
    )
);

