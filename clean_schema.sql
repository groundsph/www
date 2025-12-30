--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: badge_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.badge_category AS ENUM (
    'achievement',
    'monetary',
    'social'
);


--
-- Name: badge_rarity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.badge_rarity AS ENUM (
    'common',
    'rare',
    'legendary'
);


--
-- Name: blog_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.blog_category AS ENUM (
    'news',
    'guides',
    'events',
    'promotions',
    'community',
    'cafe_update'
);


--
-- Name: blog_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.blog_status AS ENUM (
    'draft',
    'published',
    'archived'
);


--
-- Name: coffee_style; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.coffee_style AS ENUM (
    'classic',
    'artisan'
);


--
-- Name: contribution_action_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contribution_action_type AS ENUM (
    'CREATE',
    'UPDATE',
    'VERIFY',
    'MEDIA',
    'SUGGEST'
);


--
-- Name: event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.event_status AS ENUM (
    'draft',
    'published',
    'cancelled'
);


--
-- Name: interaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.interaction_type AS ENUM (
    'like',
    'report'
);


--
-- Name: membership_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.membership_tier AS ENUM (
    'free',
    'basic',
    'premium'
);


--
-- Name: price_level; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.price_level AS ENUM (
    'low',
    'medium',
    'high'
);


--
-- Name: review_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.review_status AS ENUM (
    'published',
    'hidden',
    'flagged'
);


--
-- Name: scout_rank; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scout_rank AS ENUM (
    'novice',
    'expert',
    'vanguard'
);


--
-- Name: slot_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.slot_type AS ENUM (
    'hero',
    'sidebar',
    'collection',
    'regional_spotlight'
);


--
-- Name: subscription_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.subscription_status AS ENUM (
    'active',
    'cancelled',
    'past_due',
    'trialing'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'writer',
    'moderator',
    'admin'
);


--
-- Name: verification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.verification_status AS ENUM (
    'pending',
    'approved',
    'rejected'
);


--
-- Name: admin_get_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_get_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  users_count integer;
  db_size_bytes bigint;
  storage_total_bytes bigint;
  
  -- Storage buckets
  cafes_size bigint;
  reviews_size bigint;
  avatars_size bigint;
  blogs_size bigint;
  badges_size bigint;
  menu_photos_size bigint;
  events_size bigint;
  ownership_proofs_size bigint;

  -- Business metrics
  cafes_total integer;
  cafes_verified integer;
  cafes_published integer;
  reviews_total integer;
  blog_posts_total integer;
  pending_claims integer;
begin
  -- 1. System Stats
  select count(*) into users_count from auth.users;
  select pg_database_size(current_database()) into db_size_bytes;

  -- 2. Storage Stats (approximate from objects metadata)
  select coalesce(sum((metadata->>'size')::bigint), 0) into storage_total_bytes 
  from storage.objects;

  -- Breakdown by bucket
  select coalesce(sum((metadata->>'size')::bigint), 0) into cafes_size 
  from storage.objects where bucket_id = 'cafes';
  
  select coalesce(sum((metadata->>'size')::bigint), 0) into reviews_size 
  from storage.objects where bucket_id = 'reviews';
  
  select coalesce(sum((metadata->>'size')::bigint), 0) into avatars_size 
  from storage.objects where bucket_id = 'avatars';

  select coalesce(sum((metadata->>'size')::bigint), 0) into blogs_size 
  from storage.objects where bucket_id = 'blogs';

  select coalesce(sum((metadata->>'size')::bigint), 0) into badges_size 
  from storage.objects where bucket_id = 'badges';

  select coalesce(sum((metadata->>'size')::bigint), 0) into menu_photos_size 
  from storage.objects where bucket_id = 'menu-photos';

  select coalesce(sum((metadata->>'size')::bigint), 0) into events_size 
  from storage.objects where bucket_id = 'events';

  select coalesce(sum((metadata->>'size')::bigint), 0) into ownership_proofs_size 
  from storage.objects where bucket_id = 'ownership-proofs';

  -- 3. Business Stats
  select count(*) into cafes_total from public.cafes;
  select count(*) into cafes_verified from public.cafes where is_verified = true;
  select count(*) into cafes_published from public.cafes where is_published = true;
  
  -- Check if tables exist before querying to avoid errors if features aren't fully deployed
  if to_regclass('public.reviews') is not null then
    select count(*) into reviews_total from public.reviews;
  else
    reviews_total := 0;
  end if;

  if to_regclass('public.blog_posts') is not null then
    select count(*) into blog_posts_total from public.blog_posts;
  else
    blog_posts_total := 0;
  end if;

  if to_regclass('public.cafe_claims') is not null then
    select count(*) into pending_claims from public.cafe_claims where status = 'pending';
  else
    pending_claims := 0;
  end if;

  return json_build_object(
    'system', json_build_object(
      'users_count', users_count,
      'db_size_bytes', db_size_bytes
    ),
    'storage', json_build_object(
      'total_bytes', storage_total_bytes,
      'buckets', json_build_object(
        'cafes', cafes_size,
        'reviews', reviews_size,
        'avatars', avatars_size,
        'blogs', blogs_size,
        'badges', badges_size,
        'menu_photos', menu_photos_size,
        'events', events_size,
        'ownership_proofs', ownership_proofs_size
      )
    ),
    'business', json_build_object(
      'cafes_total', cafes_total,
      'cafes_verified', cafes_verified,
      'cafes_published', cafes_published,
      'reviews_total', reviews_total,
      'blog_posts_total', blog_posts_total,
      'pending_claims', pending_claims
    )
  );
end;
$$;


--
-- Name: approve_cafe_claim(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.approve_cafe_claim(claim_id uuid, admin_id uuid, notes text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    claim_record RECORD;
BEGIN
    -- Get claim details
    SELECT * INTO claim_record FROM cafe_claims WHERE id = claim_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Update claim status
    UPDATE cafe_claims
    SET status = 'approved',
        reviewed_at = NOW(),
        reviewed_by = admin_id,
        admin_notes = notes
    WHERE id = claim_id;
    
    -- Update cafe with owner
    UPDATE cafes
    SET owner_ids = array_append(COALESCE(owner_ids, '{}'), claim_record.user_id),
        is_claimed = TRUE
    WHERE id = claim_record.cafe_id
    AND NOT (claim_record.user_id = ANY(COALESCE(owner_ids, '{}')));
    
    RETURN TRUE;
END;
$$;


--
-- Name: can_add_menu_item(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.can_add_menu_item(p_cafe_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_tier membership_tier;
    v_count INTEGER;
BEGIN
    v_tier := get_cafe_tier(p_cafe_id);
    v_count := count_cafe_menu_items(p_cafe_id);
    
    -- Free tier: No menu items allowed
    IF v_tier = 'free' THEN
        RETURN FALSE;
    END IF;
    
    -- Basic/Pro tier: 5 item limit
    IF v_tier = 'basic' THEN
        RETURN v_count < 5;
    END IF;
    
    -- Premium tier: Unlimited
    RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION can_add_menu_item(p_cafe_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.can_add_menu_item(p_cafe_id uuid) IS 'Checks tier limits: Pro=5 items, Premium=unlimited';


--
-- Name: count_cafe_menu_items(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.count_cafe_menu_items(p_cafe_id uuid) RETURNS integer
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN (SELECT COUNT(*) FROM cafe_menu_items WHERE cafe_id = p_cafe_id);
END;
$$;


--
-- Name: get_admin_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_admin_stats() RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare
  users_count integer;
  db_size_bytes bigint;
  storage_total_bytes bigint;
  
  -- Storage buckets
  cafes_size bigint;
  reviews_size bigint;
  avatars_size bigint;
  blogs_size bigint;
  badges_size bigint;
  menu_photos_size bigint;
  events_size bigint;
  ownership_proofs_size bigint;

  -- Business metrics
  cafes_total integer;
  cafes_verified integer;
  cafes_published integer;
  reviews_total integer;
  blog_posts_total integer;
  pending_claims integer;
begin
  -- 1. System Stats
  select count(*) into users_count from auth.users;
  select pg_database_size(current_database()) into db_size_bytes;

  -- 2. Storage Stats (approximate from objects metadata)
  select coalesce(sum((metadata->>'size')::bigint), 0) into storage_total_bytes 
  from storage.objects;

  -- Breakdown by bucket
  select coalesce(sum((metadata->>'size')::bigint), 0) into cafes_size 
  from storage.objects where bucket_id = 'cafes';
  
  select coalesce(sum((metadata->>'size')::bigint), 0) into reviews_size 
  from storage.objects where bucket_id = 'reviews';
  
  select coalesce(sum((metadata->>'size')::bigint), 0) into avatars_size 
  from storage.objects where bucket_id = 'avatars';

  select coalesce(sum((metadata->>'size')::bigint), 0) into blogs_size 
  from storage.objects where bucket_id = 'blogs';

  select coalesce(sum((metadata->>'size')::bigint), 0) into badges_size 
  from storage.objects where bucket_id = 'badges';

  select coalesce(sum((metadata->>'size')::bigint), 0) into menu_photos_size 
  from storage.objects where bucket_id = 'menu-photos';

  select coalesce(sum((metadata->>'size')::bigint), 0) into events_size 
  from storage.objects where bucket_id = 'events';

  select coalesce(sum((metadata->>'size')::bigint), 0) into ownership_proofs_size 
  from storage.objects where bucket_id = 'ownership-proofs';

  -- 3. Business Stats
  select count(*) into cafes_total from public.cafes;
  select count(*) into cafes_verified from public.cafes where is_verified = true;
  select count(*) into cafes_published from public.cafes where is_published = true;
  
  -- Check if tables exist before querying to avoid errors if features aren't fully deployed
  if to_regclass('public.reviews') is not null then
    select count(*) into reviews_total from public.reviews;
  else
    reviews_total := 0;
  end if;

  if to_regclass('public.blog_posts') is not null then
    select count(*) into blog_posts_total from public.blog_posts;
  else
    blog_posts_total := 0;
  end if;

  if to_regclass('public.cafe_claims') is not null then
    select count(*) into pending_claims from public.cafe_claims where status = 'pending';
  else
    pending_claims := 0;
  end if;

  return json_build_object(
    'system', json_build_object(
      'users_count', users_count,
      'db_size_bytes', db_size_bytes
    ),
    'storage', json_build_object(
      'total_bytes', storage_total_bytes,
      'buckets', json_build_object(
        'cafes', cafes_size,
        'reviews', reviews_size,
        'avatars', avatars_size,
        'blogs', blogs_size,
        'badges', badges_size,
        'menu_photos', menu_photos_size,
        'events', events_size,
        'ownership_proofs', ownership_proofs_size
      )
    ),
    'business', json_build_object(
      'cafes_total', cafes_total,
      'cafes_verified', cafes_verified,
      'cafes_published', cafes_published,
      'reviews_total', reviews_total,
      'blog_posts_total', blog_posts_total,
      'pending_claims', pending_claims
    )
  );
end;
$$;


--
-- Name: get_cafe_tier(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cafe_tier(p_cafe_id uuid) RETURNS public.membership_tier
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_tier membership_tier;
BEGIN
    SELECT tier INTO v_tier
    FROM cafe_subscriptions
    WHERE cafe_id = p_cafe_id AND status = 'active';
    
    RETURN COALESCE(v_tier, 'free');
END;
$$;


--
-- Name: FUNCTION get_cafe_tier(p_cafe_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_cafe_tier(p_cafe_id uuid) IS 'Returns the active subscription tier for a cafe (defaults to free)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: cafes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_published boolean DEFAULT false,
    is_claimed boolean DEFAULT false,
    membership_tier public.membership_tier DEFAULT 'free'::public.membership_tier,
    featured_until timestamp with time zone,
    owner_ids uuid[] DEFAULT '{}'::uuid[],
    contributor_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    thumbnail text NOT NULL,
    gallery text[] DEFAULT '{}'::text[],
    region text NOT NULL,
    province text NOT NULL,
    city_municipality text NOT NULL,
    address_display text NOT NULL,
    lat numeric NOT NULL,
    lng numeric NOT NULL,
    has_wifi boolean DEFAULT false,
    has_sockets boolean DEFAULT false,
    has_parking boolean DEFAULT false,
    has_aircon boolean DEFAULT false,
    is_pet_friendly boolean DEFAULT false,
    has_outdoor_seating boolean DEFAULT false,
    is_work_friendly boolean DEFAULT false,
    roaster text,
    brew_methods text[] DEFAULT '{}'::text[],
    price_level public.price_level NOT NULL,
    is_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    search_vector tsvector GENERATED ALWAYS AS ((((setweight(to_tsvector('english'::regconfig, COALESCE(name, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(description, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(city_municipality, ''::text)), 'C'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(region, ''::text)), 'C'::"char"))) STORED,
    website_url text,
    socials jsonb DEFAULT '[]'::jsonb,
    phone text,
    email text,
    area text,
    operating_hours jsonb DEFAULT '[]'::jsonb,
    serves_food boolean DEFAULT false,
    specialty text[] DEFAULT '{}'::text[],
    payment_methods text,
    tags text[] DEFAULT '{}'::text[],
    has_indoor_seating boolean DEFAULT false,
    has_restroom boolean DEFAULT false,
    has_bidet boolean DEFAULT false,
    has_non_dairy boolean DEFAULT false,
    milk_options text[] DEFAULT '{}'::text[],
    coffee_style public.coffee_style
);


--
-- Name: COLUMN cafes.coffee_style; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.cafes.coffee_style IS 'Coffee style classification: classic (2nd-wave/espresso bar) or artisan (3rd-wave/craft)';


--
-- Name: get_cafes_in_bounds(double precision, double precision, double precision, double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_cafes_in_bounds(sw_lat double precision, sw_lng double precision, ne_lat double precision, ne_lng double precision) RETURNS SETOF public.cafes
    LANGUAGE sql STABLE
    AS $$
  SELECT * FROM cafes
  WHERE lat BETWEEN sw_lat AND ne_lat
    AND lng BETWEEN sw_lng AND ne_lng
    AND is_published = true;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    avatar_url,
    stats,
    passport
  )
  VALUES (
    NEW.id,
    -- Fallback: Use email prefix if username isn't in metadata
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    -- Default values matching your UserProfile interface
    '{"total_scouted": 0, "total_reviews": 0, "total_photos": 0, "scout_rank": "novice"}'::jsonb,
    '{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}'::jsonb
  );
  RETURN NEW;
END;
$$;


--
-- Name: is_cafe_owner(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_cafe_owner(p_user_id uuid, p_cafe_id uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM cafes 
        WHERE id = p_cafe_id 
        AND owner_ids @> ARRAY[p_user_id]::uuid[]
    );
END;
$$;


--
-- Name: FUNCTION is_cafe_owner(p_user_id uuid, p_cafe_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.is_cafe_owner(p_user_id uuid, p_cafe_id uuid) IS 'Checks if a user is in the owner_ids array for a cafe';


--
-- Name: queue_avatar_deletion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_avatar_deletion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- Only queue if there's an avatar to delete
    IF OLD.avatar_url IS NOT NULL THEN
        INSERT INTO avatar_deletion_queue (avatar_url, user_id)
        VALUES (OLD.avatar_url, OLD.id);
    END IF;
    RETURN OLD;
END;
$$;


--
-- Name: search_cafes(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_cafes(query_text text) RETURNS SETOF public.cafes
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM cafes
  WHERE search_vector @@ plainto_tsquery('english', query_text)
  AND is_published = true
  ORDER BY ts_rank(search_vector, plainto_tsquery('english', query_text)) DESC;
END;
$$;


--
-- Name: update_cafe_rating_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cafe_rating_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
    -- This logic runs for INSERT, UPDATE, and DELETE
    INSERT INTO public.cafe_rating_stats (
        cafe_id, 
        average_rating, 
        total_reviews, 
        rating_distribution, 
        last_updated
    )
    SELECT 
        COALESCE(NEW.cafe_id, OLD.cafe_id),
        AVG(rating)::NUMERIC(3,2),
        COUNT(*),
        jsonb_build_object(
            '5', COUNT(*) FILTER (WHERE rating = 5),
            '4', COUNT(*) FILTER (WHERE rating = 4),
            '3', COUNT(*) FILTER (WHERE rating = 3),
            '2', COUNT(*) FILTER (WHERE rating = 2),
            '1', COUNT(*) FILTER (WHERE rating = 1)
        ),
        NOW()
    FROM public.reviews
    WHERE cafe_id = COALESCE(NEW.cafe_id, OLD.cafe_id)
      AND status = 'published' -- Only count published reviews
    ON CONFLICT (cafe_id) DO UPDATE SET
        average_rating = EXCLUDED.average_rating,
        total_reviews = EXCLUDED.total_reviews,
        rating_distribution = EXCLUDED.rating_distribution,
        last_updated = EXCLUDED.last_updated;

    RETURN NULL;
END;
$$;


--
-- Name: update_cafe_subscriptions_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_cafe_subscriptions_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_owner_review_responses(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_owner_review_responses() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.response IS DISTINCT FROM NEW.response THEN
        NEW.is_edited = TRUE;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_user_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_user_stats() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    target_user_id UUID;
    new_total_photos INTEGER;
    new_total_reviews INTEGER;
BEGIN
    -- Determine the user_id to update (handle INSERT, UPDATE, DELETE)
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);

    -- Calculate total photos (sum of images array length)
    SELECT COALESCE(SUM(jsonb_array_length(to_jsonb(images))), 0)
    INTO new_total_photos
    FROM public.reviews
    WHERE user_id = target_user_id
    AND status = 'published'
    AND images IS NOT NULL;

    -- Calculate total reviews (count of reviews)
    SELECT COUNT(*)
    INTO new_total_reviews
    FROM public.reviews
    WHERE user_id = target_user_id
    AND status = 'published';

    -- Update the profiles table
    -- We use || to merge the new stats with existing stats, preserving other fields like 'total_scouted' or 'scout_rank'
    UPDATE public.profiles
    SET stats = COALESCE(stats, '{}'::jsonb) || jsonb_build_object(
        'total_photos', new_total_photos,
        'total_reviews', new_total_reviews
    )
    WHERE id = target_user_id;

    RETURN NULL;
END;
$$;


--
-- Name: avatar_deletion_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avatar_deletion_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    avatar_url text NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: badge_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badge_definitions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    image_url text NOT NULL,
    category public.badge_category NOT NULL,
    rarity public.badge_rarity NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    excerpt text,
    content text NOT NULL,
    cover_image text,
    author_id uuid NOT NULL,
    cafe_id uuid,
    category public.blog_category DEFAULT 'news'::public.blog_category NOT NULL,
    status public.blog_status DEFAULT 'draft'::public.blog_status NOT NULL,
    tags text[] DEFAULT '{}'::text[],
    featured boolean DEFAULT false,
    views_count integer DEFAULT 0,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    search_vector tsvector GENERATED ALWAYS AS (((setweight(to_tsvector('english'::regconfig, COALESCE(title, ''::text)), 'A'::"char") || setweight(to_tsvector('english'::regconfig, COALESCE(excerpt, ''::text)), 'B'::"char")) || setweight(to_tsvector('english'::regconfig, COALESCE(content, ''::text)), 'C'::"char"))) STORED
);


--
-- Name: blog_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    blog_post_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    reason text NOT NULL,
    details text,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT blog_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])))
);


--
-- Name: cafe_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_claims (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text,
    proof_text text NOT NULL,
    proof_document_url text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT cafe_claims_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: TABLE cafe_claims; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cafe_claims IS 'Stores cafe ownership claim requests from users';


--
-- Name: cafe_edit_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_edit_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    suggested_changes jsonb NOT NULL,
    suggested_images jsonb,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT cafe_edit_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: cafe_menu_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_menu_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    category text NOT NULL,
    name text NOT NULL,
    description text,
    price numeric(10,2) NOT NULL,
    image_url text,
    is_signature boolean DEFAULT false,
    is_available boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cafe_menu_items_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: TABLE cafe_menu_items; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cafe_menu_items IS 'Custom menu items added by cafe owners (Pro/Premium feature)';


--
-- Name: cafe_page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    viewed_at timestamp with time zone DEFAULT now() NOT NULL,
    visitor_id text,
    referrer text,
    device_type text,
    country text,
    CONSTRAINT cafe_page_views_device_type_check CHECK ((device_type = ANY (ARRAY['mobile'::text, 'desktop'::text, 'tablet'::text])))
);


--
-- Name: cafe_rating_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_rating_stats (
    cafe_id uuid NOT NULL,
    average_rating numeric(3,2) DEFAULT 0,
    total_reviews integer DEFAULT 0,
    rating_distribution jsonb DEFAULT '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::jsonb,
    last_updated timestamp with time zone DEFAULT now()
);


--
-- Name: cafe_stories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_stories (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    cafe_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cafe_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cafe_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    tier public.membership_tier DEFAULT 'free'::public.membership_tier NOT NULL,
    helix_subscription_id text,
    status public.subscription_status DEFAULT 'active'::public.subscription_status NOT NULL,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    proof_of_payment_url text,
    is_manual_payment boolean DEFAULT false,
    payment_verified boolean DEFAULT false
);


--
-- Name: TABLE cafe_subscriptions; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.cafe_subscriptions IS 'Stores per-cafe subscription information for the owner dashboard';


--
-- Name: cafe_with_ratings; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.cafe_with_ratings AS
 SELECT c.id,
    c.created_at,
    c.updated_at,
    c.is_published,
    c.is_claimed,
    c.membership_tier,
    c.featured_until,
    c.owner_ids,
    c.contributor_id,
    c.name,
    c.slug,
    c.description,
    c.thumbnail,
    c.gallery,
    c.region,
    c.province,
    c.city_municipality,
    c.address_display,
    c.lat,
    c.lng,
    c.has_wifi,
    c.has_sockets,
    c.has_parking,
    c.has_aircon,
    c.is_pet_friendly,
    c.has_outdoor_seating,
    c.is_work_friendly,
    c.roaster,
    c.brew_methods,
    c.price_level,
    c.is_verified,
    c.is_active,
    c.search_vector,
    COALESCE(s.average_rating, (0)::numeric) AS average_rating,
    COALESCE(s.total_reviews, 0) AS total_reviews,
    COALESCE(s.rating_distribution, '{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}'::jsonb) AS rating_distribution
   FROM (public.cafes c
     LEFT JOIN public.cafe_rating_stats s ON ((c.id = s.cafe_id)));


--
-- Name: contribution_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contribution_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cafe_id uuid NOT NULL,
    action_type public.contribution_action_type NOT NULL,
    details jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone,
    location_name text,
    address text,
    city text,
    region text,
    cafe_id uuid,
    image_url text,
    ticket_link text,
    is_national boolean DEFAULT false,
    created_by uuid,
    status public.event_status DEFAULT 'draft'::public.event_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    province text
);


--
-- Name: featured_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_schedules (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    cafe_id uuid NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    slot_type public.slot_type NOT NULL,
    region_context text,
    custom_title text,
    custom_description text,
    custom_image text,
    priority integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: featured_slot_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.featured_slot_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid,
    owner_id uuid,
    requested_month date NOT NULL,
    status text DEFAULT 'pending'::text,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT featured_slot_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: owner_review_responses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_review_responses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    review_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    response text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_edited boolean DEFAULT false,
    CONSTRAINT owner_review_responses_response_check CHECK ((length(response) <= 1000))
);


--
-- Name: TABLE owner_review_responses; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.owner_review_responses IS 'Stores cafe owner responses to customer reviews';


--
-- Name: owner_verification_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.owner_verification_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    verification_type text NOT NULL,
    proof_urls text[] DEFAULT '{}'::text[],
    notes text,
    status public.verification_status DEFAULT 'pending'::public.verification_status NOT NULL,
    reviewed_by uuid,
    reviewed_at timestamp with time zone,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT owner_verification_requests_verification_type_check CHECK ((verification_type = ANY (ARRAY['document'::text, 'email'::text, 'social_proof'::text])))
);


--
-- Name: TABLE owner_verification_requests; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.owner_verification_requests IS 'Tracks owner verification requests and their review status';


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text NOT NULL,
    display_name text NOT NULL,
    avatar_url text,
    bio text,
    stats jsonb DEFAULT '{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}'::jsonb,
    passport jsonb DEFAULT '{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}'::jsonb,
    is_supporter boolean DEFAULT false,
    support_since timestamp with time zone,
    total_contribution numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    role public.user_role DEFAULT 'user'::public.user_role,
    profile_completed boolean DEFAULT false,
    supporter_expires_at timestamp with time zone
);


--
-- Name: review_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_interactions (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    review_id uuid NOT NULL,
    user_id uuid NOT NULL,
    interaction_type public.interaction_type NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    cafe_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating integer NOT NULL,
    comment text NOT NULL,
    images text[] DEFAULT '{}'::text[],
    is_verified_visit boolean DEFAULT false,
    likes_count integer DEFAULT 0,
    is_edited boolean DEFAULT false,
    status public.review_status DEFAULT 'published'::public.review_status,
    is_pinned_by_owner boolean DEFAULT false,
    pinned_at timestamp with time zone,
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);


--
-- Name: supporter_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.supporter_subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    kofi_transaction_id text NOT NULL,
    email text NOT NULL,
    from_name text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text,
    tier_name text,
    is_subscription boolean DEFAULT false,
    is_first_subscription boolean DEFAULT false,
    message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    awarded_at timestamp with time zone DEFAULT now(),
    evidence_url text
);


--
-- Data for Name: avatar_deletion_queue; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.avatar_deletion_queue (id, avatar_url, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: badge_definitions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.badge_definitions (id, name, description, image_url, category, rarity, metadata, created_at) FROM stdin;
67a12337-d664-40e3-ac85-ffce578781c3	Grounds Supporter	Fueling the journey to discover and celebrate every hidden gem in the local coffee scene.	/icon-badge-placeholder.svg	monetary	rare	{"icon_name": "Heart", "icon_color": "#FF6B35"}	2025-12-24 15:13:24.506001+00
b357a84f-1d1a-4768-afcf-d830030c1d3c	Beta Tester	For the pioneers who helped us brew the first version of Grounds	https://cdn.grounds.ph/badges/1766767613600-fxn5np.png	achievement	legendary	\N	2025-12-24 05:57:31.539435+00
501c47c8-b298-4526-8e10-8f509142556e	Pathfinder	Scouted 20 Cafes!	https://cdn.grounds.ph/badges/1766769686111-jjyxhd.png	achievement	legendary	\N	2025-12-26 17:21:28.340217+00
de5a0053-db24-438c-b57e-eee89c980f39	Explorer	Scouted 10 Cafes!	https://cdn.grounds.ph/badges/1766769662806-ebtd6.png	achievement	rare	\N	2025-12-26 17:21:05.132806+00
fcbd0a3d-c7bb-49e7-a20f-146f46c47436	Connoisseur	Reviewed 5 Cafes	https://cdn.grounds.ph/badges/1766769789226-9r8w5b.png	achievement	common	\N	2025-12-26 17:23:11.435565+00
475d6a97-91da-43a1-8f40-993b58315d06	You Found Me!	What could this be?	https://cdn.grounds.ph/badges/1766769897113-pnge8m.png	social	legendary	\N	2025-12-26 17:24:59.60587+00
5788a7d6-1f7e-46fc-92fe-6e3d0e351012	Scout	Scouted 5 Cafes!	https://cdn.grounds.ph/badges/1766774513334-xya9sp.png	achievement	common	\N	2025-12-26 18:41:55.259916+00
bbb36cd1-9b51-451d-ab68-0546e6f80570	Eye Spy	Used the map feature	https://cdn.grounds.ph/badges/1766774689289-6f8bqj.png	achievement	common	\N	2025-12-26 18:44:51.589453+00
0c43775c-ad87-4f9a-a672-1a08a9e3ca73	Island Hopper	Explored the unique cafe cultures of two different island regions.	https://cdn.grounds.ph/badges/1766774912442-0g8975.png	achievement	rare	\N	2025-12-26 18:48:34.278161+00
f594047b-1a80-483e-90ff-bf99dfee9d55	Kape-ng Pambansa	Experienced the complete map of Philippine coffee culture from North to South.	https://cdn.grounds.ph/badges/1766774996932-9keic.png	achievement	legendary	\N	2025-12-26 18:49:58.836147+00
\.


--
-- Data for Name: blog_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.blog_posts (id, title, slug, excerpt, content, cover_image, author_id, cafe_id, category, status, tags, featured, views_count, published_at, created_at, updated_at) FROM stdin;
d68742f8-b272-4659-991c-b2d0135e7b6a	Backend Upgrade: Moving to Neon DB and BetterAuth	backend-upgrade-moving-to-neon-db-and-betterauth	To keep Grounds.ph brewing brilliantly, we're making vital backend upgrades for a faster, more robust experience. Expect exciting new features ahead! There will be a brief pause and a session reset, but all your favorite cafes and data will be safely waiting.	Hey everyone!\n\nTo keep **Grounds.ph** running smoothly and to ensure our cafe directory stays fast as we grow, I’m making some upgrades to our backend infrastructure. Specifically, I’ll be migrating our core database and authentication system from **Supabase** to a combination of **Neon DB** and **BetterAuth**.\n\n---\n\n### Why the Change?\n\nAs we continue to build out more features for the Philippine coffee community, we need a stack that offers more flexibility and developer control.\n\n**Neon and BetterAuth** allow us to:\n* **Database Branching:** Neon lets me test new features on a "branch" of our database, ensuring that updates are stable before they ever touch the live site.\n* **Faster Authentication:** BetterAuth lives directly within our application code rather than as an external service. This means snappier logins and a more seamless experience when managing your profile.\n* **Improved Performance:** Neon’s serverless architecture handles traffic spikes effortlessly, keeping the directory responsive during peak hours.\n\n### What to Expect\n\nBecause this is a major shift in how we handle data and user accounts, there will be a brief period of maintenance:\n\n* **Temporary Downtime:** The site may be inaccessible while I sync the database to its new home.\n* **Session Resets:** You will likely be logged out of your account. Once the migration is finished, you’ll just need to log back in—all your saved cafes and data will be right where you left them.\n\n---\n\nThis move is all about building a more robust foundation so we can ship new features faster. I’m working to keep the "brewing" time as short as possible, and I'll see you on the other side with a snappier Grounds.ph!\n\nThanks for your patience and for being part of this journey.\n\n**— Adrian** *Founder, Grounds.ph*	\N	2b919190-537d-4576-8b6f-3464d54bde33	\N	news	published	{devlog}	f	4	2025-12-30 07:11:31.448+00	2025-12-30 07:11:31.60452+00	2025-12-30 07:11:31.60452+00
13e97549-6912-45b1-8db7-8de3234835cd	Migrating to Cloudflare R2 ☕️	migrating-to-cloudflare-r2	Grounds.ph Update:We’re moving to Cloudflare R2 for faster speeds! ☕️ Expect brief downtime or missing images over the next 48 hours as we upgrade our infrastructure. Thanks for your patience while we improve your experience!	Hey everyone!\n\nTo keep **Grounds.ph** running smoothly and to ensure our cafe directory stays fast as we grow, I’m making some upgrades to our backend infrastructure. Specifically, I’ll be migrating all our hosted media from **Supabase Storage** to **Cloudflare R2**.\n\n---\n\n### Why the Change?\n\nAs we catalog more of the best coffee spots across the Philippines, we need a storage solution that scales effortlessly. \n\n**Cloudflare R2** allows us to:\n* **Reduce Latency:** By serving images from the "edge" (closer to you).\n* **Improve Reliability:** Ensuring cafe photos load every time, even during high traffic.\n* **Optimize Costs:** Keeping the platform sustainable for the long run.\n\n### What to Expect\n\nDuring this transition, I’ll be moving files over to their new home. Because of this:\n\n* **Temporary Downtime:** The site may be inaccessible for short intervals.\n* **Broken Images:** You might see some "missing" photos or placeholders while the DNS and file paths update.\n* **Maintenance Window:** I expect the bulk of the migration to happen over the next **4 to 8 hours**.\n\n---\n\nI’m working to keep the "brewing" time as short as possible. Once we’re finished, the site should feel snappier and more responsive than ever.\n\nThanks for your patience and for continuing to support **Grounds.ph**. See you on the other side of the migration!\n\n**- Adrian** *Founder, Grounds.ph*	\N	2b919190-537d-4576-8b6f-3464d54bde33	\N	news	published	{devlog}	f	4	2025-12-29 18:37:48.618+00	2025-12-29 18:37:48.714352+00	2025-12-29 18:37:48.714352+00
8e8c45ae-7212-4f8a-954b-4ecff0c8e48a	Migration Complete: Grounds.ph is Now Faster! ⚡️	r2-storage-migration-complete	The migration to Cloudflare R2 is complete! Enjoy faster image loading and a smoother experience as you explore the best cafes in the Philippines. Everything is back online and optimized for speed. Thanks for your patience!	Hello again everyone!\n\nI’m happy to announce that the transition from **Supabase Storage** to **Cloudflare R2** is officially finished. The "brewing" process is over, and **Grounds.ph** is back to 100% capacity.\n\n### What’s New?\nBy moving our media to the edge with Cloudflare, you should notice a significant improvement in how quickly cafe photos and menus load. This upgrade ensures that as we continue to add more spots across the Philippines, the site remains snappy and reliable for everyone.\n\n### Everything is Back Online\nAll images have been successfully moved, and the temporary downtime is over. If you happen to spot any broken links or missing photos, please feel free to [reach out](https://grounds.ph/contact), but everything should be running better than ever.\n\nThank you for your patience during the brief maintenance window. Now, go find your next favorite coffee spot!\n\n**— Adrian** *Founder, Grounds.ph*	\N	2b919190-537d-4576-8b6f-3464d54bde33	\N	news	published	{devlog}	f	7	2025-12-29 20:15:43.632+00	2025-12-29 20:15:43.862152+00	2025-12-29 20:15:43.862152+00
\.


--
-- Data for Name: blog_reports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.blog_reports (id, blog_post_id, reporter_id, reason, details, status, reviewed_by, reviewed_at, admin_notes, created_at) FROM stdin;
36ab527a-211d-43a3-b7f2-8adbd46f7f9b	8e8c45ae-7212-4f8a-954b-4ecff0c8e48a	85153abc-97d4-4e38-b87d-b0c7154c0259	other	test	dismissed	2b919190-537d-4576-8b6f-3464d54bde33	2025-12-30 05:47:35.396+00	\N	2025-12-30 05:47:00.891504+00
\.


--
-- Data for Name: cafe_claims; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_claims (id, cafe_id, user_id, status, proof_text, proof_document_url, admin_notes, created_at, reviewed_at, reviewed_by) FROM stdin;
\.


--
-- Data for Name: cafe_edit_suggestions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_edit_suggestions (id, cafe_id, user_id, status, suggested_changes, suggested_images, admin_notes, created_at, updated_at, reviewed_at, reviewed_by) FROM stdin;
41777718-2d6b-49e0-b471-82f7bc0de480	430bf732-b736-41bb-b34a-8273e32d5512	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	approved	{"price_level": "high", "brew_methods": ["Espresso", "Pour Over", "French Press", "Cold Brew", "espresso"]}	\N	\N	2025-12-25 16:20:40.356064+00	2025-12-25 16:20:40.356064+00	2025-12-25 16:22:59.132+00	2b919190-537d-4576-8b6f-3464d54bde33
cefacdb0-d36f-426f-85c8-0ea534660d82	430bf732-b736-41bb-b34a-8273e32d5512	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	rejected	{}	{"add_to_gallery": ["https://uriwhfpoprbrcehboadj.supabase.co/storage/v1/object/public/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766879590871-9x5un.webp"]}	\N	2025-12-27 23:53:13.368105+00	2025-12-27 23:53:13.368105+00	2025-12-28 03:30:08.523+00	2b919190-537d-4576-8b6f-3464d54bde33
904c1fc2-0e53-42fe-b563-b45436b0af6c	430bf732-b736-41bb-b34a-8273e32d5512	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	approved	{}	{"add_to_gallery": ["https://uriwhfpoprbrcehboadj.supabase.co/storage/v1/object/public/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766879706076-92h57a.webp", "https://uriwhfpoprbrcehboadj.supabase.co/storage/v1/object/public/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766879708020-nkostr.webp"]}	\N	2025-12-27 23:55:09.773781+00	2025-12-27 23:55:09.773781+00	2025-12-28 03:30:14.517+00	2b919190-537d-4576-8b6f-3464d54bde33
\.


--
-- Data for Name: cafe_menu_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_menu_items (id, cafe_id, category, name, description, price, image_url, is_signature, is_available, sort_order, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cafe_page_views; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_page_views (id, cafe_id, viewed_at, visitor_id, referrer, device_type, country) FROM stdin;
8a03bcce-d226-4c2c-8728-7fddc5102025	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-28 19:03:31.499582+00	-rjmhet	https://localhost:3000/owner/cafes/your-daily-go-cafe	desktop	\N
48f890f5-0970-4b3f-a059-8392027fe410	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:37:47.168857+00	-6ng9e5	\N	desktop	\N
d6298882-79ee-419f-aac4-138efc035e90	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:37:48.500746+00	-y9t4wg	\N	mobile	\N
2c6d880f-d0ed-4897-b43c-47dd13b1ac9b	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:37:54.750517+00	-6nga1e	\N	desktop	\N
6c8cc9a9-62e5-4d82-afd4-5024ea62438d	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:38:19.752323+00	-y9t4wg	https://grounds.ph/cafes	mobile	\N
ca9b4254-52f5-40f1-ba04-b6e82c68b191	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:39:35.382897+00	-y9t4wg	https://grounds.ph/	mobile	\N
a8a12063-12a6-478f-b0b0-9a41540cd79a	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:43:27.630951+00	-y9t4wg	https://grounds.ph/cafes	mobile	\N
1c49cfdc-803c-4892-aac2-1cbabd90d4b7	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:43:39.576866+00	-y9t4wg	https://grounds.ph/cafes	mobile	\N
ff938ccf-ed60-4fab-aab9-202a1a093fbe	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-29 02:52:03.688655+00	-rjmhet	https://localhost:3000/owner/cafes/your-daily-go-cafe	desktop	\N
4429c622-6029-4d87-99f7-2b999bc2dae7	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-29 03:07:56.495374+00	-rjmhet	https://localhost:3000/owner/cafes/your-daily-go-cafe	desktop	\N
f65935bd-2d18-4b2c-a4cf-fca9ec1c2a2b	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-29 04:25:51.006499+00	-rjmhet	\N	desktop	\N
5a22a7d0-349a-49bf-825a-9c4e5eb2f362	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-29 04:25:51.043299+00	-rjmhet	\N	desktop	\N
9c1784af-3c0d-4dce-856d-63a81ce58acc	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-29 04:28:39.149512+00	-rjmhet	\N	desktop	\N
0d8d63a3-f91f-4f97-8e67-cd2b25f0ce95	b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-29 04:36:55.630623+00	h6wi0n	\N	mobile	\N
1c96d9b9-a2bd-4cfa-a5e9-9d77236dbbe5	430bf732-b736-41bb-b34a-8273e32d5512	2025-12-29 05:26:29.773324+00	2cqppb	https://grounds.ph/cafes	mobile	\N
0c98de6f-ddfc-4862-a9b5-c86720952d1d	b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-29 06:56:05.860665+00	g3q75	https://grounds.ph/	desktop	\N
25c93d97-e17e-4501-ad72-78e5a18bf2a1	b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-29 06:56:24.727917+00	g3q75	https://grounds.ph/	desktop	\N
270da27b-1353-4199-82b0-040f4df04d0a	b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-29 06:56:38.936251+00	g3q75	https://grounds.ph/	desktop	\N
d6e998b1-833d-4763-9153-542fedb21c8a	b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-29 07:25:27.900082+00	h6wi0n	\N	mobile	\N
e9822711-7c2e-4071-81f4-6f1b524c5e9e	430bf732-b736-41bb-b34a-8273e32d5512	2025-12-29 08:40:29.572428+00	2cqppb	\N	mobile	\N
dedd196b-3533-4a11-9648-941e2819dbb7	b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-29 09:18:38.796173+00	-rjmhet	https://grounds.ph/cafes	desktop	\N
04382a0a-f73a-4d98-a312-da52b4ba04e3	b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-29 11:35:54.7195+00	-imkk2e	https://grounds.ph/cafes	desktop	\N
e14b9cb7-8910-4e75-a8ea-c48387074dbd	d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-29 11:40:41.216059+00	-rjmhet	https://grounds.ph/cafes	desktop	\N
2f355a7b-514c-449f-905b-808fee1789ad	b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-29 11:41:07.617433+00	-rjmhet	https://grounds.ph/cafes	desktop	\N
82157e29-9f84-434a-983e-f65016d0b9e9	18c28ff3-0a86-457a-a700-42977824abc6	2025-12-29 11:47:34.83132+00	b3przf	\N	mobile	\N
3a4f6165-d2af-4fe9-a75c-9197f14d9f20	569a03ff-e6a6-441e-96ea-67b2c5281f21	2025-12-29 13:08:14.716987+00	4o244a	https://grounds.ph/	desktop	\N
465b90b6-e976-4f1d-a903-1bef221b15be	f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 13:43:58.655652+00	ao6qkv	https://grounds.ph/	mobile	\N
63740d0a-711f-47fd-995d-293dd18ac018	569a03ff-e6a6-441e-96ea-67b2c5281f21	2025-12-29 14:01:06.081808+00	l3ek3k	\N	mobile	\N
31879e97-c240-4c69-a8b0-252738b8f7d8	096ddf67-9e95-44bc-8611-6a7c890b08f1	2025-12-29 14:12:05.411336+00	-irxn9m	https://grounds.ph/cafes	mobile	\N
5c8c2a94-59db-44f7-bef1-cb2913f5b51e	a740f606-e6ad-4039-b0fa-f62b2163a32c	2025-12-29 14:16:56.282172+00	-gw20l	https://grounds.ph/	desktop	\N
4784cf3e-7c60-4529-b77a-93b4a79daa76	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 14:21:14.611584+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
817cbf1d-0f2c-4b55-9563-8070f8627281	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 14:21:57.448013+00	e8qice	http://m.facebook.com	mobile	\N
0e51fe54-d472-45f4-8117-72be3cf8f2e6	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 14:34:33.698113+00	ao6qkv	https://l.facebook.com/	mobile	\N
811c1007-0824-47be-ac4f-a065b033575a	80609d6c-7811-4d88-b957-28dd3a5bb27c	2025-12-29 14:59:57.72966+00	-rjmhet	https://grounds.ph/cafes	desktop	\N
2ad5c5ad-d94e-4533-9e2f-b3231168cc18	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 15:50:32.823017+00	-u4skqd	https://grounds.ph/	desktop	\N
26ae7393-ba4b-4ad5-bc10-b5068533c1a6	096ddf67-9e95-44bc-8611-6a7c890b08f1	2025-12-29 15:58:08.142324+00	-irxn9m	https://grounds.ph/cafes	mobile	\N
12213f32-f5a8-4c92-be1d-a400dcb4fa56	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 16:13:48.808182+00	-1blnvs	https://grounds.ph/	mobile	\N
ecc10b41-e515-40f2-bf51-6214d8bc385a	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 16:14:14.41515+00	-zbbm4d	https://grounds.ph/cafes/kamp-craft-coffee-and-roastery	mobile	\N
4f958c25-9b9f-4c4c-a4ee-01e66abed941	b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-29 19:15:14.106858+00	-rjmhet	https://grounds.ph/	desktop	\N
b75f7e7e-b3d0-4237-9bff-838a9a84a59a	d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-29 19:15:23.660048+00	-rjmhet	\N	desktop	\N
05667159-0a61-4b63-b380-4ea0d5f89089	d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-29 19:15:23.672599+00	-rjmhet	\N	desktop	\N
168b04c9-b56b-4171-8c52-f561750e1119	b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-29 19:15:43.06826+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
a1855e93-e633-42a2-8cf9-64e737169300	569a03ff-e6a6-441e-96ea-67b2c5281f21	2025-12-29 20:33:11.561924+00	2u4ke7	https://grounds.ph/	mobile	\N
98ef70d8-a8fd-4469-bfa5-8fbb5af0b4ea	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 04:14:34.654796+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
e061d6a8-bfdf-4d0d-9a04-d3a8033b4322	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 04:15:49.791503+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
1088adc0-5a16-4f75-843c-f14fcdb96431	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 04:20:12.648612+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
fdd6fe59-869e-4d41-9cb5-7c6b8181ed63	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 04:21:12.318557+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
5b4f7dfa-a01b-4f1d-8a90-da56450936b1	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 04:27:06.577017+00	-rjmhet	https://localhost:3000/cafes	desktop	\N
c3242a90-baea-48f2-97ce-33631099415f	d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-30 04:38:42.496128+00	-rjmhet	\N	desktop	\N
f6232349-1013-435a-b053-499e3f292a24	d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-30 04:38:42.539276+00	-rjmhet	\N	desktop	\N
f8ba2d2b-8c4a-4cd3-8159-60d4188bfd81	d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-30 04:40:46.502819+00	-rjmhet	\N	desktop	\N
037a41e0-d277-46cb-b309-f225dca45421	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 04:57:27.600564+00	-vdjihc	https://grounds.ph/cafes	desktop	\N
f3d939a1-5bed-4425-89cb-826b960424fd	b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-30 05:01:05.856891+00	-rjmhet	\N	desktop	\N
c92cfc1f-07f4-4b15-8a87-f29b80aa6e4e	b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-30 05:01:05.897282+00	-rjmhet	\N	desktop	\N
ab0caec1-64d8-4035-b9ec-2fc3224b6e67	18c28ff3-0a86-457a-a700-42977824abc6	2025-12-30 05:38:20.11896+00	fowxu7	\N	desktop	\N
1bd5ac70-6785-4f96-903f-f772878af5af	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 06:37:12.336398+00	-t68cr	https://grounds.ph/cafes	desktop	\N
79c5651b-2dbc-4110-951b-c55b8a19aecb	9a0ff4c0-3974-43d1-b6f0-d8749d232098	2025-12-30 07:12:18.769588+00	-41fzxu	https://grounds.ph/cafes	desktop	\N
e078e5fb-5aae-434c-b9e3-96b474545cc0	9a0ff4c0-3974-43d1-b6f0-d8749d232098	2025-12-30 07:12:28.089482+00	-41fzxu	https://grounds.ph/cafes	desktop	\N
d723ef70-8d18-4cf0-85be-e3b04b101c68	569a03ff-e6a6-441e-96ea-67b2c5281f21	2025-12-30 07:27:51.934907+00	m9t8tf	\N	mobile	\N
b88cdef2-e304-40c7-86de-217f3401c45f	7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-30 08:51:51.955001+00	495w3y	https://grounds.ph/	desktop	\N
\.


--
-- Data for Name: cafe_rating_stats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_rating_stats (cafe_id, average_rating, total_reviews, rating_distribution, last_updated) FROM stdin;
430bf732-b736-41bb-b34a-8273e32d5512	\N	0	{"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}	2025-12-28 04:20:22.835143+00
18c28ff3-0a86-457a-a700-42977824abc6	5.00	1	{"1": 0, "2": 0, "3": 0, "4": 0, "5": 1}	2025-12-29 19:14:33.081688+00
b90c1bb6-885f-4365-a7d7-dd561ee74db0	5.00	1	{"1": 0, "2": 0, "3": 0, "4": 0, "5": 1}	2025-12-29 19:14:33.332979+00
a740f606-e6ad-4039-b0fa-f62b2163a32c	5.00	1	{"1": 0, "2": 0, "3": 0, "4": 0, "5": 1}	2025-12-29 19:14:33.545995+00
\.


--
-- Data for Name: cafe_stories; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_stories (id, cafe_id, content, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cafe_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafe_subscriptions (id, cafe_id, tier, helix_subscription_id, status, current_period_start, current_period_end, created_at, updated_at, proof_of_payment_url, is_manual_payment, payment_verified) FROM stdin;
\.


--
-- Data for Name: cafes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cafes (id, created_at, updated_at, is_published, is_claimed, membership_tier, featured_until, owner_ids, contributor_id, name, slug, description, thumbnail, gallery, region, province, city_municipality, address_display, lat, lng, has_wifi, has_sockets, has_parking, has_aircon, is_pet_friendly, has_outdoor_seating, is_work_friendly, roaster, brew_methods, price_level, is_verified, is_active, website_url, socials, phone, email, area, operating_hours, serves_food, specialty, payment_methods, tags, has_indoor_seating, has_restroom, has_bidet, has_non_dairy, milk_options, coffee_style) FROM stdin;
cebcefaa-858b-46e5-a9fe-d6100d0e31de	2025-12-27 03:54:51.360195+00	2025-12-29 18:42:06.52949+00	t	f	free	\N	\N	7cdbd0f5-3a43-44ca-b374-072c48ad83ae	White Beard Coffee	white-beard-coffee	Stands out for its excellent coffee, tasty breakfast/brunch offerings, friendly and welcoming service, and relaxed island vibe - making it a must-visit cafe in Siargao island.	https://cdn.grounds.ph/cafes/2b919190-537d-4576-8b6f-3464d54bde33/1766822004744-s3t6da.webp	\N	Region XIII - Caraga	Surigao del Norte	General Luna	Purok 1, General Luna, Siargao Island	9.807407472688517	126.16466403007509	t	t	t	t	t	t	t	\N	{Espresso,"Cold Brew"}	medium	f	t	\N	[{"url": "", "title": "Facebook"}, {"url": "", "title": "Instagram"}]	\N	\N	\N	[{"day": "mon", "open": "06:00", "close": "18:00", "is_closed": false}, {"day": "tue", "open": "06:00", "close": "18:00", "is_closed": false}, {"day": "wed", "open": "08:00", "close": "18:00", "is_closed": false}, {"day": "thu", "open": "06:00", "close": "18:00", "is_closed": false}, {"day": "fri", "open": "06:00", "close": "18:00", "is_closed": false}, {"day": "sat", "open": "06:00", "close": "18:00", "is_closed": false}, {"day": "sun", "open": "06:00", "close": "18:00", "is_closed": false}]	t	{specialty_coffee,pastries,brunch}	cash, gcash	{cozy,instagram_worthy}	f	f	f	f	{}	\N
9a0ff4c0-3974-43d1-b6f0-d8749d232098	2025-12-30 06:39:26.523558+00	2025-12-30 06:41:26.244359+00	t	f	free	\N	\N	b78b3a99-c83e-4e00-98ab-359c8d667bcc	Bos Coffee - Butuan	bos-coffee-butuan	\N	placeholder	\N	Region XIII - Caraga	Agusan del Norte	Butuan City	J.C. Aquino Avenue, Butuan City	8.9454876	125.533729	t	t	t	t	f	f	t	\N	{}	low	f	t	\N	[]	\N	\N	Sm City Butuan	[{"day": "mon", "open": "00:00", "close": "23:59", "is_closed": false}, {"day": "tue", "open": "00:00", "close": "23:59", "is_closed": false}, {"day": "wed", "open": "00:00", "close": "23:59", "is_closed": false}, {"day": "thu", "open": "00:00", "close": "23:59", "is_closed": false}, {"day": "fri", "open": "00:00", "close": "23:59", "is_closed": false}, {"day": "sat", "open": "00:00", "close": "23:59", "is_closed": false}, {"day": "sun", "open": "00:00", "close": "23:59", "is_closed": false}]	f	{specialty_coffee,pastries,brunch,matcha}	cash, gcash, maya, credit_card, debit_card	{}	f	t	f	f	{}	\N
ca2ae8a2-d4ed-41b4-adda-74ad599fe5d1	2025-12-27 06:07:22.447088+00	2025-12-29 19:14:30.599836+00	t	t	free	\N	{2ba0c9b4-452f-4a52-83dd-a9de821b256b}	2ba0c9b4-452f-4a52-83dd-a9de821b256b	Sayu Café	sayu-cafe-cebu	A friendly neighborhood café in the province of San Fernando Cebu.	https://cdn.grounds.ph/cafes/2ba0c9b4-452f-4a52-83dd-a9de821b256b/1766815638155-qu86o.webp	{https://cdn.grounds.ph/cafes/2ba0c9b4-452f-4a52-83dd-a9de821b256b/1766815638956-cjd6m.webp,https://cdn.grounds.ph/cafes/2ba0c9b4-452f-4a52-83dd-a9de821b256b/1766815639591-gupen.webp,https://cdn.grounds.ph/cafes/2ba0c9b4-452f-4a52-83dd-a9de821b256b/1766815640223-kwc1l.webp,https://cdn.grounds.ph/cafes/2ba0c9b4-452f-4a52-83dd-a9de821b256b/1766815640813-4tu3uq.webp}	Region VII - Central Visayas	Cebu	San Fernando	South Poblacion, San Fernando Cebu	10.16280520431255	123.70831042528155	t	t	t	t	f	t	t	Local Roaster, Mt. Apo	{Espresso,"Cold Brew"}	low	f	t	https://www.facebook.com/sayucafe	[{"url": "https://www.facebook.com/sayucafe", "title": "Facebook"}, {"url": "https://www.instagram.com/sayucafe.cebu/", "title": "Instagram"}, {"url": "https://maps.app.goo.gl/ZCaUkjK3APiPRgvW8", "title": "Google Maps"}]	09432469897	sayucafe.cebu@gmail.com	South Poblacion	[{"day": "mon", "open": "09:00", "close": "22:00", "is_closed": false}, {"day": "tue", "open": "09:00", "close": "22:00", "is_closed": false}, {"day": "wed", "open": "09:00", "close": "22:00", "is_closed": false}, {"day": "thu", "open": "09:00", "close": "22:00", "is_closed": false}, {"day": "fri", "open": "09:00", "close": "22:00", "is_closed": false}, {"day": "sat", "open": "09:00", "close": "22:00", "is_closed": false}, {"day": "sun", "open": "09:00", "close": "22:00", "is_closed": false}]	t	{specialty_coffee,pastries,brunch,matcha}	cash, gcash, maya, bank_transfer	{cozy,minimalist,modern,lively,instagram_worthy,quiet}	f	f	f	f	{}	\N
18c28ff3-0a86-457a-a700-42977824abc6	2025-12-25 15:06:04.028353+00	2025-12-29 18:42:07.521504+00	t	f	free	\N	{}	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	The High Grounds Cafe	the-high-grounds-cafe-cebu	Cozy, yet sophisticated atmosphere, where the room filled with the glorious aroma of freshly brewed coffee and home-made roasted beans. Every cup of coffee is made with meticulous attention, resulting in rich, creamy coffee.	https://cdn.grounds.ph/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766675155071-gdftxr.webp	\N	Region VII - Central Visayas	Cebu	Lapu-Lapu	Cadulang, Lapu-Lapu, Cebu	10.27420959754447	123.97417098283769	f	f	f	t	t	t	f	Home-made roasted coffee beans	{Espresso}	medium	f	t	\N	[{"url": "https://www.facebook.com/thehighgroundscoffee", "title": "Facebook"}, {"url": "https://www.instagram.com/thehighgroundscoffee/", "title": "Instagram"}]	\N	\N	\N	[{"day": "mon", "open": "10:00", "close": "20:00", "is_closed": true}, {"day": "tue", "open": "10:00", "close": "20:00", "is_closed": false}, {"day": "wed", "open": "10:00", "close": "20:00", "is_closed": false}, {"day": "thu", "open": "10:00", "close": "20:00", "is_closed": false}, {"day": "fri", "open": "10:00", "close": "20:00", "is_closed": false}, {"day": "sat", "open": "10:00", "close": "20:00", "is_closed": false}, {"day": "sun", "open": "10:00", "close": "20:00", "is_closed": false}]	t	{pastries,vegan_options,specialty_coffee}	cash, gcash	{cozy,minimalist,quiet}	f	f	f	f	{}	\N
2482b597-68d1-422e-931a-fc234a078a8f	2025-12-25 08:08:45.464335+00	2025-12-29 18:42:07.238602+00	t	f	free	\N	\N	9f76b760-a301-4c4e-8b3b-58a84e81136e	Starbucks - SM CDO Uptown	starbucks-sm-cdo-uptown	Experience Northern Mindanao’s first Starbucks Drive-Thru at the SM CDO Uptown North Wing. This sleek, modern branch is designed for both convenience and comfort, offering a spacious interior perfect for work or relaxation alongside a quick drive-thru lane for coffee lovers on the move.	https://cdn.grounds.ph/cafes/2b919190-537d-4576-8b6f-3464d54bde33/1766650648483-ohc7u.jpg	\N	Region X - Northern Mindanao	Misamis Oriental	Cagayan de Oro	Ground Level, North Wing, SM City CDO Uptown	8.456897328118593	124.62449669837953	f	t	t	t	f	f	t	\N	{}	medium	f	t	\N	[]	\N	\N	SM Uptown CDO	[{"day": "mon", "open": "07:00", "close": "23:00", "is_closed": false}, {"day": "tue", "open": "07:00", "close": "23:00", "is_closed": false}, {"day": "wed", "open": "07:00", "close": "23:00", "is_closed": false}, {"day": "thu", "open": "07:00", "close": "23:00", "is_closed": false}, {"day": "fri", "open": "07:00", "close": "23:00", "is_closed": false}, {"day": "sat", "open": "07:00", "close": "23:00", "is_closed": false}, {"day": "sun", "open": "07:00", "close": "23:00", "is_closed": false}]	t	{pastries,brunch,matcha}	cash, gcash, bank_transfer, credit_card, debit_card, maya	{cozy,modern,lively,instagram_worthy}	f	f	f	f	{}	\N
d172b297-ad92-42b8-a354-c3b051a919c9	2025-12-26 05:34:53.134084+00	2025-12-29 18:42:08.516026+00	t	f	free	\N	{}	2b919190-537d-4576-8b6f-3464d54bde33	Cafe Ethereal	cafe-ethereal	A minimalist haven near the port. Enjoy aesthetic vibes, high-speed WiFi, and specialty brews like their Spanish Latte. With vegan options and a serene atmosphere, it’s the perfect stopover for travelers and digital nomads alike.	https://cdn.grounds.ph/cafes/2b919190-537d-4576-8b6f-3464d54bde33/1766727288265-obn2k.webp	\N	Region XIII - Caraga	Surigao del Norte	Surigao City	First Place Bldg, Borromeo St, Brgy Taft, Surigao City	9.784539354117792	125.49973905086519	t	t	t	t	f	f	f	In-House	{Espresso}	medium	f	t	\N	[{"url": "https://www.instagram.com/EtherealCafe.ph/", "title": "Instagram"}]	\N	\N	First Place Arcade	[{"day": "mon", "open": "07:00", "close": "21:00", "is_closed": false}, {"day": "tue", "open": "07:00", "close": "21:00", "is_closed": false}, {"day": "wed", "open": "07:00", "close": "21:00", "is_closed": false}, {"day": "thu", "open": "07:00", "close": "21:00", "is_closed": false}, {"day": "fri", "open": "07:00", "close": "21:00", "is_closed": false}, {"day": "sat", "open": "07:00", "close": "21:00", "is_closed": false}, {"day": "sun", "open": "11:30", "close": "21:00", "is_closed": false}]	t	{specialty_coffee,brunch,matcha,vegan_options}	cash, gcash, debit_card	{cozy,modern,minimalist}	f	f	f	f	{}	\N
ccdd0082-fd78-4857-9647-87ed41615579	2025-12-25 19:43:47.281792+00	2025-12-29 19:14:30.818657+00	t	f	free	\N	{}	e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd	Espresson	espresson-davao	A small spot in the heart of the city that feels cozy and welcoming, offering a calm escape from the busy streets outside. What makes it even more special is Bambi, the owner’s friendly dog, whose presence adds warmth and a homey charm to every visit.	https://cdn.grounds.ph/cafes/e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd/1766691813454-e9i5i.webp	{https://cdn.grounds.ph/cafes/e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd/1766691815392-u6z27.webp,https://cdn.grounds.ph/cafes/e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd/1766691824950-zpi4dg.webp}	Region XI - Davao Region	Davao del Sur	Davao City	Door 3, Residencia del Marina Business Center, Emilio Jacinto St, Poblacion District, Davao City, Davao del Sur	7.0711379	125.6149224	f	f	t	t	f	f	t	\N	{Espresso}	medium	f	t	\N	[{"url": "https://www.instagram.com/espressondvo?igsh=cmJ3ang4bDU4b24w", "title": "Instagram"}]	\N	espressoncoffee@gmail.com	Emilio Jacinto,Poblacion district	[{"day": "mon", "open": "11:00", "close": "21:00", "is_closed": false}, {"day": "tue", "open": "11:00", "close": "21:00", "is_closed": false}, {"day": "wed", "open": "11:00", "close": "21:00", "is_closed": false}, {"day": "thu", "open": "11:00", "close": "21:00", "is_closed": false}, {"day": "fri", "open": "11:00", "close": "21:00", "is_closed": false}, {"day": "sat", "open": "11:00", "close": "21:00", "is_closed": false}, {"day": "sun", "open": "11:00", "close": "20:00", "is_closed": true}]	f	{matcha,specialty_coffee,pastries}	bank_transfer, gcash	{cozy,quiet}	f	f	f	f	{}	\N
430bf732-b736-41bb-b34a-8273e32d5512	2025-12-25 04:41:11.226734+00	2025-12-29 19:14:31.11299+00	t	f	free	\N	{}	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	Tightrope Coffee	tightrope-coffee	A brutalist-inspired cafe with minimalist aesthetics that create a bold yet inviting atmosphere matched with premium coffee that is crafted to perfection, rich, and aromatic.	https://cdn.grounds.ph/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766637668691-4p8oe.jpg	{https://cdn.grounds.ph/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766879706076-92h57a.webp,https://cdn.grounds.ph/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766879708020-nkostr.webp}	Region VII - Central Visayas	Cebu	Cebu City	One Paseo, Paseo Saturnino, Cebu City, 6000 Cebu	10.343475736084491	123.9115843176842	f	f	t	t	f	f	t	\N	{"Pour Over","French Press","Cold Brew",espresso}	high	f	t	\N	[{"url": "https://www.facebook.com/tightropecoffeevelez", "title": "Facebook"}, {"url": "https://www.instagram.com/tightropecoffee/", "title": "Instagram"}]	\N	\N	Going Maria Luisa Village	[{"day": "mon", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "tue", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "wed", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "thu", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "fri", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "sat", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "sun", "open": "08:00", "close": "22:00", "is_closed": false}]	t	{specialty_coffee,pastries,brunch}	cash, gcash, maya, credit_card, debit_card	{minimalist,modern,quiet,instagram_worthy}	f	f	f	f	{}	\N
b90c1bb6-885f-4365-a7d7-dd561ee74db0	2025-12-26 07:42:52.431365+00	2025-12-29 19:14:31.386753+00	t	t	free	\N	{f5f72fb2-af1c-4402-840d-00084c9bfe23}	f5f72fb2-af1c-4402-840d-00084c9bfe23	Cafe Stoke	cafe-stoke-surigao	Cafe Stoke is a cozy street-style spot with warm, laid-back vibes.\n\nWe serve homemade burgers made fresh for real, hearty flavor, and freshly espresso brewed coffee on the spot for a bold and comforting experience.\n\nIt’s a place to chill, enjoy good food, good coffee, and good company.	https://cdn.grounds.ph/cafes/f5f72fb2-af1c-4402-840d-00084c9bfe23/1766734961404-70o3xo.webp	{https://cdn.grounds.ph/cafes/f5f72fb2-af1c-4402-840d-00084c9bfe23/1766734964886-xwand.webp,https://cdn.grounds.ph/cafes/f5f72fb2-af1c-4402-840d-00084c9bfe23/1766734966217-cv69s.webp,https://cdn.grounds.ph/cafes/f5f72fb2-af1c-4402-840d-00084c9bfe23/1766734968268-g0nsdr.webp,https://cdn.grounds.ph/cafes/f5f72fb2-af1c-4402-840d-00084c9bfe23/1766734969906-cp6299.webp}	Region XIII - Caraga	Surigao del Norte	Surigao City	Borromeo Street, cor., P. Reyes Street, Surigao City	9.783422175785692	125.5005866289139	t	t	f	t	t	f	t	Craft coffee	{Espresso}	medium	f	t	https://instagram.com/cafestoke	[{"url": "instagram.com/cafestoke", "title": "Instagram"}, {"url": "facebook.com/stoked.hz", "title": "Facebook"}]	+639104125614	miguelitostoked@gmail.com	Borromeo Street, fronting the corner of TT & Company	[{"day": "mon", "open": "11:00", "close": "20:00", "is_closed": false}, {"day": "tue", "open": "11:00", "close": "20:00", "is_closed": false}, {"day": "wed", "open": "11:00", "close": "20:00", "is_closed": false}, {"day": "thu", "open": "11:00", "close": "20:00", "is_closed": false}, {"day": "fri", "open": "11:00", "close": "20:00", "is_closed": false}, {"day": "sat", "open": "11:00", "close": "20:00", "is_closed": false}, {"day": "sun", "open": "08:00", "close": "20:00", "is_closed": true}]	t	{brunch,brewed_coffee,burger,sandwiches,ricebowls}	cash, gcash, maya	{cozy,minimalist,modern,street_concept}	f	f	f	f	{}	\N
f07eaa5b-d244-438e-aa19-6c682de3f57f	2025-12-29 02:06:24.806253+00	2025-12-29 02:37:15.279935+00	t	f	free	\N	\N	312b2d77-117c-4c38-946a-54c8e5a20c7e	Kabin Kafe	kabin-kafe	Kabni Kafe is one coffee destination in Cabatuan, Iloilo. It is a small black cabin house by the roadside entering the next town, Maasin. What is fascinating about this cafe is how a young couple started it from a plain scratch of an idea.	placeholder	\N	Region VI - Western Visayas	Iloilo	Cabatuan	Bacan, Cabatuan, Iloilo City, Philippines	10.880022466352782	122.48124361038208	t	t	f	t	f	f	f	\N	\N	medium	f	t	https://nileonweekends.com/kabin-kafe-business-and-family/?fbclid=IwAR0h2HyGjZ-hWWTbxdnW26JvZilE61PmDAwsilAsaDQauhXdYudzC71FYKQ	\N	\N	\N	\N	[{"day": "mon", "open": "08:00", "close": "19:00", "is_closed": false}, {"day": "tue", "open": "08:00", "close": "19:00", "is_closed": false}, {"day": "wed", "open": "08:00", "close": "19:00", "is_closed": false}, {"day": "thu", "open": "08:00", "close": "19:00", "is_closed": false}, {"day": "fri", "open": "08:00", "close": "19:00", "is_closed": false}, {"day": "sat", "open": "08:00", "close": "19:00", "is_closed": false}, {"day": "sun", "open": "08:00", "close": "19:00", "is_closed": false}]	t	\N	\N	\N	f	t	f	f	\N	\N
569a03ff-e6a6-441e-96ea-67b2c5281f21	2025-12-27 18:24:41.344218+00	2025-12-29 18:42:10.124493+00	t	f	free	\N	\N	671ea1b0-2b46-445f-bb2a-9778e4c26012	Antigo Coffee	antigo-coffee	A cozy antique-themed cafe in the antiques center of Makati	https://cdn.grounds.ph/cafes/671ea1b0-2b46-445f-bb2a-9778e4c26012/1766859878814-d4g0xr.webp	\N	NCR - National Capital Region	Metro Manila	Makati	529 Gen Hizon, Brgy. Bangkal, Makati City, 1233	14.543023071555425	121.01253479719163	f	f	f	t	f	t	f	\N	{Espresso}	medium	f	t	\N	[{"url": "https://www.instagram.com/antigo_coffee/", "title": "Instagram"}]	\N	\N	\N	[{"day": "mon", "open": "10:00", "close": "19:00", "is_closed": false}, {"day": "tue", "open": "10:00", "close": "19:00", "is_closed": false}, {"day": "wed", "open": "10:00", "close": "19:00", "is_closed": false}, {"day": "thu", "open": "10:00", "close": "19:00", "is_closed": false}, {"day": "fri", "open": "10:00", "close": "20:00", "is_closed": false}, {"day": "sat", "open": "10:00", "close": "19:00", "is_closed": true}, {"day": "sun", "open": "10:00", "close": "19:00", "is_closed": true}]	f	{cookies,matcha,tea}	cash, gcash	{cozy,antique,instagram_worthy,lively,vintage}	f	f	f	f	{}	\N
80609d6c-7811-4d88-b957-28dd3a5bb27c	2025-12-26 13:26:22.135798+00	2025-12-29 19:14:31.633967+00	t	f	free	\N	\N	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	Bistro Bartolome	bistro-bartolome	This laid-back cafe has a cozy, quirky vibe, making it a popular spot for casual hangouts and quick coffee runs. It’s known for its cool & youthful interior, coffee, and matcha drinks paired with delicious food, offering a relaxed space that feels more chill and social.	https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766755572186-bfg3ue.webp	{https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766755575393-x6jgkk.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766755577127-af9m8w.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766755578761-lcckyc.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766755579596-qr0vv.webp}	Region VIII - Eastern Visayas	Leyte	Tacloban	Tacloban Astrodome, Bliss, 61, Sagkahan, Tacloban, Eastern Visayas, 6500, Philippines	11.2218222	125.0049938	f	f	f	t	f	t	t	\N	\N	medium	f	t	\N	[{"url": "https://www.facebook.com/share/16mJBs2C6r/?mibextid=wwXIfr", "title": "Facebook"}, {"url": "https://www.instagram.com/bistrobartolome?igsh=MW54MWtucHphOTBrdg==", "title": "Instagram"}]	\N	\N	Tacloban City Convention Center (Astrodome)	[{"day": "mon", "open": "14:00", "close": "23:00", "is_closed": false}, {"day": "tue", "open": "14:00", "close": "23:00", "is_closed": false}, {"day": "wed", "open": "14:00", "close": "23:00", "is_closed": false}, {"day": "thu", "open": "14:00", "close": "23:00", "is_closed": false}, {"day": "fri", "open": "14:00", "close": "23:30", "is_closed": false}, {"day": "sat", "open": "14:00", "close": "23:30", "is_closed": false}, {"day": "sun", "open": "14:00", "close": "23:00", "is_closed": false}]	t	{pastries,brunch,matcha,specialty_coffee}	cash, gcash, bank_transfer, maya, BPI	{instagram_worthy,cozy,modern,aesthetic}	f	f	f	f	{}	\N
21d89ce4-84ec-458a-b898-ceffb6f1d2ee	2025-12-26 20:04:37.394463+00	2025-12-29 19:14:32.085448+00	t	f	free	\N	\N	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	Espazio Arts + History Cafe	espazio-arts-history-cafe	Espazio Arts + Food + History Café offers a creative, museum-like space filled with vintage pieces and local history. Its warm, eclectic interiors pair well with coffee and dining, making it a café where you can definitely enjoy admiring culture and history.	https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766779467523-aadbia.webp	{https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766779470471-fhpitj.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766779472519-w3uvld.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766779474978-lm571f.webp}	Region VIII - Eastern Visayas	Leyte	Tacloban	130 Juan Luna Street, Downtown, Tacloban, Eastern Visayas, 6500, Philippines	11.240746852561395	125.00454962253572	f	f	t	f	f	t	t	\N	\N	medium	f	t	\N	[{"url": "https://www.facebook.com/espazio.tacloban", "title": "Facebook"}, {"url": "https://www.instagram.com/espazio.tacloban?igsh=MXN0aG5sMXJhcDh0eA==", "title": "Instagram"}]	0997 259 6809	\N	Downtown	[{"day": "mon", "open": "11:30", "close": "22:30", "is_closed": true}, {"day": "tue", "open": "11:30", "close": "22:30", "is_closed": false}, {"day": "wed", "open": "11:30", "close": "22:30", "is_closed": false}, {"day": "thu", "open": "11:30", "close": "22:30", "is_closed": false}, {"day": "fri", "open": "11:30", "close": "22:30", "is_closed": false}, {"day": "sat", "open": "11:30", "close": "22:30", "is_closed": false}, {"day": "sun", "open": "11:30", "close": "22:30", "is_closed": false}]	t	{brunch,pastries}	cash, gcash, debit_card, bank_transfer, credit_card	{historical,artsy,instagram_worthy,quiet,cozy}	f	f	f	f	{}	\N
096ddf67-9e95-44bc-8611-6a7c890b08f1	2025-12-26 19:44:36.001502+00	2025-12-29 19:14:32.30344+00	t	f	free	\N	\N	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	Figaro - Robinsons Tacloban	figaro-robinsons-tacloban	Figaro Coffee - Robinsons Tacloban is the Tacloban branch of a well-known Filipino coffee chain with a casual, European-inspired café vibe inside the beloved mall. It’s a comfortable, busy spot with large glass walls and both indoor and outdoor seating, popular for coffee lovers young and old.	https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766778266034-vork4b.webp	{https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766778268697-0il85w.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766778270364-vg51kc.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766778271892-gczjk.webp}	Region VIII - Eastern Visayas	Leyte	Tacloban	Figaro, Robinsons Place Tacloban, Tacloban, Eastern Visayas, 6500, Philippines	11.2085053	125.0073014	t	t	t	t	f	t	t	\N	\N	medium	f	t	https://figarocoffee.com/	[{"url": "https://www.facebook.com/FigaroTacloban", "title": "Facebook"}, {"url": "https://www.instagram.com/figarotacloban?igsh=ZWdzeGNocm5zZmls", "title": "Instagram"}]	\N	\N	Robinsons Marasbaras	[{"day": "mon", "open": "08:30", "close": "21:00", "is_closed": false}, {"day": "tue", "open": "08:30", "close": "21:00", "is_closed": false}, {"day": "wed", "open": "08:30", "close": "21:00", "is_closed": false}, {"day": "thu", "open": "08:30", "close": "21:00", "is_closed": false}, {"day": "fri", "open": "08:30", "close": "21:00", "is_closed": false}, {"day": "sat", "open": "08:30", "close": "21:00", "is_closed": false}, {"day": "sun", "open": "08:30", "close": "21:00", "is_closed": false}]	t	{pastries,brunch}	cash, gcash, bank_transfer, debit_card, maya, credit_card	{modern,cozy}	f	f	f	f	{}	\N
a740f606-e6ad-4039-b0fa-f62b2163a32c	2025-12-26 20:31:08.531331+00	2025-12-29 19:14:31.921246+00	t	f	free	\N	\N	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	Sky Cafe Palo	sky-cafe-palo	Sky Cafe offers delicious baked pastries, great drinks, and light bites, conveniently located in the heart of Palo. Enjoy their cozy ambience in a chill cafe where you can catch up with friends over coffee, study, or grab some food to eat.	https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766781057510-tej6fq.webp	{https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766781060198-5nnvp5.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766781062226-6n1p8f.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766781063904-7j521.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766781065699-41opse.webp}	Region VIII - Eastern Visayas	Leyte	Palo	2nd Floor, PKS Building, Brgy. Luntad, Palo, Leyte, Philippines	11.160573692086873	124.9931985139847	f	f	f	t	f	f	t	\N	\N	medium	f	t	\N	[{"url": "https://www.facebook.com/skycafepalo", "title": "Facebook"}, {"url": "https://www.instagram.com/skycafepalo?igsh=MXF5d3p0bW12amg1NA==", "title": "Instagram"}]	0917 189 7597	\N	Brgy. Luntad	[{"day": "mon", "open": "10:00", "close": "21:00", "is_closed": true}, {"day": "tue", "open": "10:00", "close": "21:00", "is_closed": false}, {"day": "wed", "open": "10:00", "close": "21:00", "is_closed": false}, {"day": "thu", "open": "10:00", "close": "21:00", "is_closed": false}, {"day": "fri", "open": "10:00", "close": "21:00", "is_closed": false}, {"day": "sat", "open": "10:00", "close": "21:00", "is_closed": false}, {"day": "sun", "open": "10:00", "close": "21:00", "is_closed": false}]	t	{pastries,brunch}	cash, gcash	{cozy,quiet,casual}	f	f	f	f	{}	\N
244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	2025-12-25 16:19:54.546711+00	2025-12-30 03:45:17.612874+00	t	f	free	\N	\N	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	Your Daily Go Cafe	your-daily-go-cafe	A bright place to enjoy your perfectly crafted coffee and their signature ceremonial matcha drinks and ice cream matched with their pastries.	https://cdn.grounds.ph/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766679585331-3i3nvd.webp	\N	Region VII - Central Visayas	Cebu	Cebu City	Banilad Rd, Cebu City, 6000 Cebu	10.326968091502282	123.90873044729234	f	f	t	t	f	f	t	\N	{Espresso}	high	f	t	\N	[{"url": "https://www.instagram.com/yourdailygo/", "title": "Instagram"}, {"url": "https://www.facebook.com/profile.php?id=61563285802359", "title": "Facebook"}]	\N	\N	Behind Wu Yang Banilad	[{"day": "mon", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "tue", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "wed", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "thu", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "fri", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "sat", "open": "08:00", "close": "22:00", "is_closed": false}, {"day": "sun", "open": "08:00", "close": "22:00", "is_closed": false}]	t	{specialty_coffee,pastries,matcha}	cash, gcash	{cozy,modern,lively,instagram_worthy}	f	f	f	f	{}	\N
7354d3c8-013b-4ac5-80af-1526f358291b	2025-12-29 13:55:04.81288+00	2025-12-29 18:42:11.364776+00	t	f	free	\N	\N	28ee1b34-0932-436b-af17-8b4cedd6b67b	Kamp Craft Coffee and Roastery	kamp-craft-coffee-and-roastery	Local coffee shop that gives extra care behind their craft. A cozy spot with the best playlists and homey atmosphere. They also serve a great tiramisu.	https://cdn.grounds.ph/cafes/28ee1b34-0932-436b-af17-8b4cedd6b67b/1767016502773-c748zj.webp	\N	Region VII - Central Visayas	Cebu	Cebu City	16 Molave Street, Bray. Camputhaw, Cebu City	10.319794067092268	123.90148567025538	t	t	t	t	f	t	f	\N	{Espresso}	medium	f	t	https://www.kamp.ph	[{"url": "https://www.facebook.com/share/1AydMNy8Hf/", "title": "Facebook"}, {"url": "https://www.instagram.com/kamp.ph?igsh=MWRyNzczajBrejN4Yg==", "title": "Instagram"}]	(032)402-3310	hello@kamp.ph	Molave Street	[{"day": "mon", "open": "09:00", "close": "20:00", "is_closed": false}, {"day": "tue", "open": "09:00", "close": "20:00", "is_closed": false}, {"day": "wed", "open": "09:00", "close": "20:00", "is_closed": false}, {"day": "thu", "open": "09:00", "close": "20:00", "is_closed": false}, {"day": "fri", "open": "09:00", "close": "20:00", "is_closed": false}, {"day": "sat", "open": "09:00", "close": "20:00", "is_closed": false}, {"day": "sun", "open": "09:00", "close": "20:00", "is_closed": false}]	t	{specialty_coffee,matcha}	cash, gcash	{cozy,instagram_worthy,modern}	t	t	f	f	{}	\N
ee7b3e51-3559-4049-b973-0305ce477c0b	2025-12-25 16:48:58.232507+00	2025-12-29 18:42:07.984003+00	t	f	free	\N	{}	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	On What Grounds? OWG Coffee	on-what-grounds-owg-coffee	A colorful retro interior with music playing from a vinyl disc and a modern design on the exterior—you can choose what vibe you want depending on your mood.	https://cdn.grounds.ph/cafes/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766681327829-23bhf.webp	\N	Region VII - Central Visayas	Cebu	Lapu-Lapu	New Sangi Rd, Lapu-Lapu, Cebu	10.310850136859761	123.96307736635211	f	t	t	t	f	t	t	\N	{Espresso}	medium	f	t	\N	[{"url": "https://maps.app.goo.gl/xtGzN5ZCfjxsPDS77", "title": "Google Maps"}, {"url": "https://www.facebook.com/onwhatgroundscoffee", "title": "Facebook"}]	\N	\N	Near Mactan Island Golf Course Driving Range	[{"day": "mon", "open": "08:00", "close": "00:00", "is_closed": false}, {"day": "tue", "open": "08:00", "close": "00:00", "is_closed": false}, {"day": "wed", "open": "08:00", "close": "00:00", "is_closed": false}, {"day": "thu", "open": "08:00", "close": "00:00", "is_closed": false}, {"day": "fri", "open": "08:00", "close": "00:00", "is_closed": false}, {"day": "sat", "open": "08:00", "close": "00:00", "is_closed": false}, {"day": "sun", "open": "08:00", "close": "00:00", "is_closed": false}]	t	{specialty_coffee,pastries,brunch}	cash, gcash	{cozy,modern,lively,instagram_worthy}	f	f	f	f	{}	\N
b33da31a-f6ba-43bf-ba99-74dc00126cc7	2025-12-28 10:14:16.559163+00	2025-12-29 19:14:32.521692+00	t	f	free	\N	\N	eeecbe2f-4fda-4a8f-8c8f-7c2eef647452	AKA day/night drinks	aka-daynight-drinks	A coffee shop by day, and cocktail bar by night. AKA (also-known-as) is simply obliged to serve you great drinks day/night.	https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916848605-wuf0w.webp	{https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916850015-zk83pa.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916850483-wa291ia.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916850994-cn4kr.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916851517-epa0r9.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916851988-xmw1ok.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916852468-y8ubc.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916852923-johwlm.webp,https://cdn.grounds.ph/cafes/eeecbe2f-4fda-4a8f-8c8f-7c2eef647452/1766916853568-6lhfml.webp}	NCR - National Capital Region	Metro Manila	Quezon City	Unit 5, ITC Commercial Complex, Timog Avenue cor. Panay, Quezon City, Metro Manila	14.63654	121.02832	t	t	t	t	t	f	t	Sphere	{Espresso,"Pour Over",Aeropress}	medium	f	t	https://instagram.com/drinks.aka	[{"url": "https://instagram.com/drinks.aka", "title": "Instagram"}, {"url": "https://www.facebook.com/p/AKA-daynight-drinks-61579304861933/", "title": "Facebook"}, {"url": "https://www.tiktok.com/@aka_day.night", "title": "TikTok"}]	09985661515	\N	Timog Ave. cor Panay	[{"day": "mon", "open": "08:00", "close": "20:00", "is_closed": true}, {"day": "tue", "open": "10:00", "close": "01:00", "is_closed": false}, {"day": "wed", "open": "10:00", "close": "01:00", "is_closed": false}, {"day": "thu", "open": "10:00", "close": "01:00", "is_closed": false}, {"day": "fri", "open": "10:00", "close": "03:00", "is_closed": false}, {"day": "sat", "open": "10:00", "close": "03:00", "is_closed": false}, {"day": "sun", "open": "10:00", "close": "01:00", "is_closed": false}]	t	{specialty_coffee,pastries,matcha}	cash, gcash, credit_card, debit_card, bank_transfer	{modern,quiet,instagram_worthy,minimalist}	t	t	t	t	{Coconut,Oat}	\N
bcf106a1-dbf9-424d-aa46-c95193124398	2025-12-26 09:33:30.110759+00	2025-12-29 19:14:32.694486+00	t	f	free	\N	\N	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	Café de Acacia - Palo	caf-de-acacia-palo	Café de Acacia - Palo branch is a classic café known for its cozy atmosphere, convenient location, Wi-Fi, as well as its coffee, pastries, and light meals. It’s a common spot for studying, casual meetings, or waiting for a companion shopping nearby.	https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766741601908-3sp6mj.webp	{https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766741604920-bf1hsx.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766741606093-7p0mmd.webp,https://cdn.grounds.ph/cafes/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766741607831-xinhxj.webp}	Region VIII - Eastern Visayas	Leyte	Palo	Pawing, Palo, Leyte (Beside Mr. DIY)	11.1764984	125.0019954	t	f	t	t	f	f	t	\N	\N	medium	f	t	\N	[{"url": "https://www.facebook.com/CafeDeAcacia", "title": "Facebook"}, {"url": "https://www.instagram.com/cafedeacacia?igsh=MW5vZ3dzMm9ibTl0Nw==", "title": "Instagram"}]	09163782668	\N	Campetic	[{"day": "mon", "open": "08:00", "close": "23:00", "is_closed": false}, {"day": "tue", "open": "08:00", "close": "23:00", "is_closed": false}, {"day": "wed", "open": "08:00", "close": "23:00", "is_closed": false}, {"day": "thu", "open": "08:00", "close": "23:00", "is_closed": false}, {"day": "fri", "open": "08:00", "close": "23:00", "is_closed": false}, {"day": "sat", "open": "08:00", "close": "23:00", "is_closed": false}, {"day": "sun", "open": "08:00", "close": "23:00", "is_closed": false}]	t	{pastries,brunch}	cash, gcash, maya, credit_card, debit_card, bank_transfer	{instagram_worthy,modern,cozy,quiet}	f	f	f	f	{}	\N
\.


--
-- Data for Name: contribution_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contribution_logs (id, user_id, cafe_id, action_type, details, created_at) FROM stdin;
372c94bb-44f5-4dbe-b163-8350276fd3fb	7cdbd0f5-3a43-44ca-b374-072c48ad83ae	cebcefaa-858b-46e5-a9fe-d6100d0e31de	CREATE	{"source": "backfill", "cafe_name": "White Beard Coffee"}	2025-12-27 03:54:51.360195+00
028bb0c8-67db-4aa1-9133-27eeb7b0878f	2ba0c9b4-452f-4a52-83dd-a9de821b256b	ca2ae8a2-d4ed-41b4-adda-74ad599fe5d1	CREATE	{"source": "backfill", "cafe_name": "Sayu Café"}	2025-12-27 06:07:22.447088+00
54deaf37-d754-4247-9bb0-e4a969869a19	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	430bf732-b736-41bb-b34a-8273e32d5512	CREATE	{"source": "backfill", "cafe_name": "Tightrope Coffee"}	2025-12-25 04:41:11.226734+00
08537190-8cb7-4942-821b-7e46f93fb6ae	9f76b760-a301-4c4e-8b3b-58a84e81136e	2482b597-68d1-422e-931a-fc234a078a8f	CREATE	{"source": "backfill", "cafe_name": "Starbucks - SM CDO Uptown"}	2025-12-25 08:08:45.464335+00
562660a7-76ce-46b4-8262-6b3281bd816d	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	CREATE	{"source": "backfill", "cafe_name": "Your Daily Go Cafe"}	2025-12-25 16:19:54.546711+00
b868b95d-7648-46d8-9f68-2b709e714821	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	18c28ff3-0a86-457a-a700-42977824abc6	CREATE	{"source": "backfill", "cafe_name": "The High Grounds Cafe"}	2025-12-25 15:06:04.028353+00
b6393efe-cf42-4aec-83a7-68d157705b78	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	ee7b3e51-3559-4049-b973-0305ce477c0b	CREATE	{"source": "backfill", "cafe_name": "On What Grounds? OWG Coffee"}	2025-12-25 16:48:58.232507+00
c0ee6543-fc8c-4dc6-a512-f22983e5e6f8	e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd	ccdd0082-fd78-4857-9647-87ed41615579	CREATE	{"source": "backfill", "cafe_name": "Espresson"}	2025-12-25 19:43:47.281792+00
75ffeefc-5994-40d1-94b7-5aecbd381db6	2b919190-537d-4576-8b6f-3464d54bde33	d172b297-ad92-42b8-a354-c3b051a919c9	CREATE	{"source": "backfill", "cafe_name": "Cafe Ethereal"}	2025-12-26 05:34:53.134084+00
9cce0b47-2ef0-4ec6-b8d6-49bb1ec2dd9c	f5f72fb2-af1c-4402-840d-00084c9bfe23	b90c1bb6-885f-4365-a7d7-dd561ee74db0	CREATE	{"source": "backfill", "cafe_name": "Cafe Stoke"}	2025-12-26 07:42:52.431365+00
19fb480a-ff64-44b8-a615-1ad929ce8a15	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	bcf106a1-dbf9-424d-aa46-c95193124398	CREATE	{"source": "backfill", "cafe_name": "Café de Acacia - Palo"}	2025-12-26 09:33:30.110759+00
b8a89201-b5e3-4915-a1f0-b5203ba83593	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	80609d6c-7811-4d88-b957-28dd3a5bb27c	CREATE	{"source": "backfill", "cafe_name": "Bistro Bartolome"}	2025-12-26 13:26:22.135798+00
2e31bef1-3b06-4951-a76e-922bab011081	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	a740f606-e6ad-4039-b0fa-f62b2163a32c	CREATE	{"source": "backfill", "cafe_name": "Sky Cafe Palo"}	2025-12-26 20:31:08.531331+00
9652cb79-f2e2-49c3-873b-8704dfdcbb4b	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	21d89ce4-84ec-458a-b898-ceffb6f1d2ee	CREATE	{"source": "backfill", "cafe_name": "Espazio Arts + History Cafe"}	2025-12-26 20:04:37.394463+00
06e5f2a5-dc2f-4672-8001-0b1f45e31b4d	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	096ddf67-9e95-44bc-8611-6a7c890b08f1	CREATE	{"source": "backfill", "cafe_name": "Figaro - Robinsons Tacloban"}	2025-12-26 19:44:36.001502+00
a01b3fda-e483-47b6-99eb-0b1d73af73c5	671ea1b0-2b46-445f-bb2a-9778e4c26012	569a03ff-e6a6-441e-96ea-67b2c5281f21	CREATE	{"source": "cafe_submission", "summary": "Scouted Antigo Coffee", "cafe_name": "Antigo Coffee"}	2025-12-27 18:24:42.586664+00
cfcc0ad5-2d7a-4527-b623-98a0f6c22616	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	430bf732-b736-41bb-b34a-8273e32d5512	SUGGEST	{"source": "edit_suggestion", "summary": "Suggested edits: ", "cafe_name": "Tightrope Coffee", "changed_fields": []}	2025-12-27 23:53:15.703995+00
90c35a97-01a8-441d-ab6f-02a75d6bf741	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	430bf732-b736-41bb-b34a-8273e32d5512	SUGGEST	{"source": "edit_suggestion", "summary": "Suggested edits: ", "cafe_name": "Tightrope Coffee", "changed_fields": []}	2025-12-27 23:55:10.77546+00
6a008942-8fc8-4b3c-8062-0b50d97e588a	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	430bf732-b736-41bb-b34a-8273e32d5512	UPDATE	{"source": "approved_suggestion", "summary": "Suggestion approved: ", "cafe_name": "Tightrope Coffee", "changed_fields": []}	2025-12-28 03:30:16.082336+00
10a281ad-6fee-4266-9fbf-69903bf8e5a5	eeecbe2f-4fda-4a8f-8c8f-7c2eef647452	b33da31a-f6ba-43bf-ba99-74dc00126cc7	CREATE	{"source": "cafe_submission", "summary": "Scouted AKA day/night drinks", "cafe_name": "AKA day/night drinks"}	2025-12-28 10:14:17.852899+00
72d027d7-daf3-4174-b036-2fad3effdbdd	2b919190-537d-4576-8b6f-3464d54bde33	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Your Daily Go Cafe", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "owner_ids"]}	2025-12-28 14:47:53.636913+00
1cf21416-be1e-49f7-a01d-817763c8e5ce	2b919190-537d-4576-8b6f-3464d54bde33	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Your Daily Go Cafe", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "owner_ids"]}	2025-12-28 16:31:44.264554+00
9de08bc3-73ed-42c1-bfe0-2ccf2fae8099	2b919190-537d-4576-8b6f-3464d54bde33	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Your Daily Go Cafe", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "owner_ids"]}	2025-12-28 18:59:46.678359+00
c2b0a5df-bbb2-46a6-a816-691f88e0356b	312b2d77-117c-4c38-946a-54c8e5a20c7e	f07eaa5b-d244-438e-aa19-6c682de3f57f	CREATE	{"source": "cafe_submission", "summary": "Scouted Kabin Kafe", "cafe_name": "Kabin Kafe"}	2025-12-29 02:06:26.020147+00
f33f595c-79ed-4475-b3c3-e34c493b850e	2b919190-537d-4576-8b6f-3464d54bde33	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Your Daily Go Cafe", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "owner_ids"]}	2025-12-29 04:38:33.748583+00
c2fed477-a2ef-4915-b2ef-bf0bde437b4b	2b919190-537d-4576-8b6f-3464d54bde33	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Your Daily Go Cafe", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "owner_ids"]}	2025-12-29 04:44:59.669821+00
6dad4d5b-fefd-494b-bebd-72fbb5704749	28ee1b34-0932-436b-af17-8b4cedd6b67b	7354d3c8-013b-4ac5-80af-1526f358291b	CREATE	{"source": "cafe_submission", "summary": "Scouted Kamp Craft Coffee and Roastery", "cafe_name": "Kamp Craft Coffee and Roastery"}	2025-12-29 13:55:05.975048+00
cd0880a1-eda5-4f5b-b3e6-671fc2fc29ac	2b919190-537d-4576-8b6f-3464d54bde33	7354d3c8-013b-4ac5-80af-1526f358291b	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Kamp Craft Coffee and Roastery", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "website_url"]}	2025-12-29 14:16:38.303421+00
608157c7-8951-4f89-8a9f-3dc66b05d66e	2b919190-537d-4576-8b6f-3464d54bde33	244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7	UPDATE	{"source": "admin_edit", "summary": "Updated 6 fields", "cafe_name": "Your Daily Go Cafe", "changed_fields": ["has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "owner_ids"]}	2025-12-30 03:45:17.935483+00
76903601-796c-472f-bdd5-be5949b5ad10	b78b3a99-c83e-4e00-98ab-359c8d667bcc	9a0ff4c0-3974-43d1-b6f0-d8749d232098	CREATE	{"source": "cafe_submission", "summary": "Scouted Bos Coffee Butuan", "cafe_name": "Bos Coffee Butuan"}	2025-12-30 06:39:27.502499+00
4d38fda8-1b1f-4cb8-b783-035ba6e9c188	2b919190-537d-4576-8b6f-3464d54bde33	9a0ff4c0-3974-43d1-b6f0-d8749d232098	UPDATE	{"source": "admin_edit", "summary": "Updated 9 fields", "cafe_name": "Bos Coffee - Butuan", "changed_fields": ["name", "has_indoor_seating", "has_restroom", "has_bidet", "has_non_dairy", "milk_options", "tags", "brew_methods", "socials"]}	2025-12-30 06:40:35.807019+00
\.


--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.events (id, title, description, start_date, end_date, location_name, address, city, region, cafe_id, image_url, ticket_link, is_national, created_by, status, created_at, updated_at, province) FROM stdin;
\.


--
-- Data for Name: featured_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.featured_schedules (id, cafe_id, start_date, end_date, slot_type, region_context, custom_title, custom_description, custom_image, priority, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: featured_slot_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.featured_slot_requests (id, cafe_id, owner_id, requested_month, status, admin_notes, created_at, processed_at) FROM stdin;
\.


--
-- Data for Name: owner_review_responses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.owner_review_responses (id, review_id, owner_id, response, created_at, updated_at, is_edited) FROM stdin;
\.


--
-- Data for Name: owner_verification_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.owner_verification_requests (id, cafe_id, user_id, verification_type, proof_urls, notes, status, reviewed_by, reviewed_at, admin_notes, created_at) FROM stdin;
\.


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.profiles (id, username, display_name, avatar_url, bio, stats, passport, is_supporter, support_since, total_contribution, created_at, updated_at, role, profile_completed, supporter_expires_at) FROM stdin;
b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	pompo	Coffeedrip	https://cdn.grounds.ph/avatars/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766604858854.jpg	I love trying new coffee places I saw from my ride sessions	{"scout_rank": "novice", "total_photos": 2, "total_reviews": 1, "total_scouted": 4}	{"visited_ids": ["430bf732-b736-41bb-b34a-8273e32d5512", "18c28ff3-0a86-457a-a700-42977824abc6"], "favorite_ids": ["430bf732-b736-41bb-b34a-8273e32d5512"], "wishlist_ids": ["430bf732-b736-41bb-b34a-8273e32d5512"], "favorite_region": ""}	f	\N	0	2025-12-24 07:20:26.105388+00	2025-12-29 19:14:33.081688+00	user	t	\N
85153abc-97d4-4e38-b87d-b0c7154c0259	ransauce	RanSauce	https://cdn.grounds.ph/avatars/85153abc-97d4-4e38-b87d-b0c7154c0259/1766649648744.jpg		{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-25 07:32:40.482865+00	2025-12-30 05:44:25.562762+00	writer	t	\N
9f76b760-a301-4c4e-8b3b-58a84e81136e	julmar	Julmari	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-25 06:51:12.201498+00	2025-12-26 07:32:18.370448+00	user	t	\N
b0a02768-1793-4c11-88ca-a23eed595d64	anoushka	Anoushka	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-24 16:43:52.138529+00	2025-12-26 07:32:18.370448+00	user	t	\N
e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd	hikarilee	Lkl	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-25 08:26:10.279989+00	2025-12-26 07:32:18.370448+00	user	t	\N
f5f72fb2-af1c-4402-840d-00084c9bfe23	miguelitostoked	miguelito	\N		{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-26 07:03:53.273533+00	2025-12-26 07:45:21.903586+00	user	t	\N
ad7ee060-bd35-40d1-997b-160228e70da7	akarai	Akarai	https://cdn.grounds.ph/avatars/ad7ee060-bd35-40d1-997b-160228e70da7/1766830774205.jpg		{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 10:17:53.653852+00	2025-12-29 18:42:13.157446+00	user	t	\N
7cdbd0f5-3a43-44ca-b374-072c48ad83ae	sweetnestbyaudrey	sweetnestbyaudrey	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-26 12:51:56.536865+00	2025-12-27 03:59:12.164544+00	user	t	\N
a14a0e62-90c4-4f65-9abd-c5b4fdb16c33	general102	Gen	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-26 15:50:52.99967+00	2025-12-26 15:51:23.484281+00	user	t	\N
2ba0c9b4-452f-4a52-83dd-a9de821b256b	felixyuboi	daoneandonly	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 03:44:29.984483+00	2025-12-27 06:22:09.183331+00	user	t	\N
0f53e0ef-4bfa-4ebc-8290-7c23ae2477c5	chipperpj	ChipperPJ	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 13:13:37.668813+00	2025-12-27 13:13:58.393354+00	user	t	\N
0436851f-e311-4cfc-8c9b-b575c6aedc4a	audreynavia	audreynavia	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 14:54:13.271426+00	2025-12-27 14:54:24.212091+00	user	t	\N
c07b070a-fe8c-44bf-a977-be5599f2bb7f	espressionist.ph	espressionist.ph	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 16:37:20.113081+00	2025-12-27 16:37:25.598847+00	user	t	\N
6ff230f4-7efa-43fb-897c-7c2dc2ca4771	doseofmeds	doseofmeds	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 17:38:00.197836+00	2025-12-27 17:38:16.990451+00	user	t	\N
671ea1b0-2b46-445f-bb2a-9778e4c26012	dustnfluff	dustnfluff	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-27 17:30:07.930879+00	2025-12-27 18:25:51.322891+00	user	t	\N
b0a4ac1c-c9a4-495d-9364-319585db00a6	harry	harry	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-28 04:22:42.906272+00	2025-12-28 04:23:11.820479+00	user	t	\N
f42226ef-d168-4ddc-a025-99c2b453a189	ocean	ean	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-28 06:11:35.487593+00	2025-12-28 06:11:53.536022+00	user	t	\N
f0a8d946-3af4-4d81-9969-020c19ab0570	dvskape	dvskape	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-28 07:06:39.251384+00	2025-12-28 07:07:15.786719+00	user	t	\N
eeecbe2f-4fda-4a8f-8c8f-7c2eef647452	unlockablenpc	unlockablenpc	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-28 09:49:51.276418+00	2025-12-28 10:19:37.568032+00	user	t	\N
43469979-d25c-4f34-bcf0-6ec1678cc522	jachelleromero	jachelleromero	\N	\N	{"scout_rank": "novice", "total_photos": 2, "total_reviews": 1, "total_scouted": 0}	{"visited_ids": ["b90c1bb6-885f-4365-a7d7-dd561ee74db0"], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-26 07:59:39.394499+00	2025-12-29 19:14:33.332979+00	user	t	\N
b9b290fc-ba6d-42ca-bf85-122cf872eb8e	mailmanpat	mailmanpat	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-29 13:06:01.781238+00	2025-12-29 13:06:11.066542+00	user	t	\N
312b2d77-117c-4c38-946a-54c8e5a20c7e	joris11101	BraveTuxedoCat	\N		{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-29 01:57:18.573386+00	2025-12-29 02:42:49.746615+00	user	t	\N
90f8d4ce-e4b7-4d8e-ab62-1e7c1aa4b3cc	annegaoran	bambi 🪼	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 0}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-29 04:35:53.847183+00	2025-12-29 04:36:30.004209+00	user	t	\N
28ee1b34-0932-436b-af17-8b4cedd6b67b	bibingkai	kai	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-29 13:46:03.375845+00	2025-12-29 14:18:22.979885+00	user	t	\N
2b919190-537d-4576-8b6f-3464d54bde33	adrianbonpin	Adrian Bonpin	https://cdn.grounds.ph/avatars/2b919190-537d-4576-8b6f-3464d54bde33/1766771289085.jpg	Hello!	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": ["d172b297-ad92-42b8-a354-c3b051a919c9"], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-22 16:38:23.576424+00	2025-12-29 18:42:12.850991+00	admin	t	\N
67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	notwabbit	wabbit	https://cdn.grounds.ph/avatars/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766771003295.jpg	i h8 not sweet coffee...	{"scout_rank": "expert", "total_photos": 2, "total_reviews": 1, "total_scouted": 5}	{"visited_ids": ["80609d6c-7811-4d88-b957-28dd3a5bb27c", "bcf106a1-dbf9-424d-aa46-c95193124398", "d172b297-ad92-42b8-a354-c3b051a919c9", "244e32a0-eae7-4cc9-b2bd-fcbcfc0fa8a7", "a740f606-e6ad-4039-b0fa-f62b2163a32c"], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-26 06:53:51.942951+00	2025-12-29 19:14:33.545995+00	moderator	t	\N
b78b3a99-c83e-4e00-98ab-359c8d667bcc	brokeredg14	brokeredg14	\N	\N	{"scout_rank": "novice", "total_photos": 0, "total_reviews": 0, "total_scouted": 1}	{"visited_ids": [], "wishlist_ids": [], "favorite_region": ""}	f	\N	0	2025-12-30 06:35:12.025836+00	2025-12-30 06:41:27.147343+00	user	t	\N
\.


--
-- Data for Name: review_interactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.review_interactions (id, review_id, user_id, interaction_type, created_at) FROM stdin;
\.


--
-- Data for Name: reviews; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.reviews (id, created_at, updated_at, cafe_id, user_id, rating, comment, images, is_verified_visit, likes_count, is_edited, status, is_pinned_by_owner, pinned_at) FROM stdin;
71a8fa85-74a4-45c4-b6b2-5572aa394d92	2025-12-25 16:31:44.351162+00	2025-12-29 19:14:33.081688+00	18c28ff3-0a86-457a-a700-42977824abc6	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	5	Parking space may be an issue but their coffee is worth trying! :D	{https://cdn.grounds.ph/reviews/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766680292935-rykh09.jpg,https://cdn.grounds.ph/reviews/b7b68b55-f1ac-4677-bdb7-bb832cc28b3e/1766680294723-zrh3w.jpg}	f	0	f	published	f	\N
2de15bb3-cbb1-49ef-b177-735758f57a7d	2025-12-26 08:04:17.231962+00	2025-12-29 19:14:33.332979+00	b90c1bb6-885f-4365-a7d7-dd561ee74db0	43469979-d25c-4f34-bcf0-6ec1678cc522	5	Really good food that both you and your wallet can actually enjoy. Everything tastes fresh and satisfying, and the prices are super reasonable for the quality you’re getting.\n\nMust-try: the shawarma burger — flavorful, filling, and worth every bite.\nMy favorite: the chicken satay. Perfectly cooked, well-seasoned, and something I’d definitely come back for. My go-to order!!\n\nPlus, the Spanish latte is really good too — a great pairing with the meal.	{https://cdn.grounds.ph/reviews/43469979-d25c-4f34-bcf0-6ec1678cc522/1766736246043-hyqzk.jpeg,https://cdn.grounds.ph/reviews/43469979-d25c-4f34-bcf0-6ec1678cc522/1766736251358-fkf1rb.jpeg}	f	0	f	published	f	\N
e254cf47-7c33-4f03-9a33-1173a1d6ec8c	2025-12-27 06:49:43.912793+00	2025-12-29 19:14:33.545995+00	a740f606-e6ad-4039-b0fa-f62b2163a32c	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	5	the location is great because there aren't a lot of cafes near the cathedral area ✨ like u dont have to ride a motor to andoks just to get coffee thanks to sky cafe! my favorite drink is actually their iced chocolate!! i love stopping by here. 	{https://cdn.grounds.ph/reviews/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766818179280-nhfh3j.jpeg,https://cdn.grounds.ph/reviews/67f4d6c1-e207-4182-b618-9d5e4b9f5b1b/1766818180680-2pgve.jpeg}	f	0	f	published	f	\N
\.


--
-- Data for Name: supporter_subscriptions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.supporter_subscriptions (id, user_id, kofi_transaction_id, email, from_name, amount, currency, tier_name, is_subscription, is_first_subscription, message, created_at) FROM stdin;
\.


--
-- Data for Name: user_badges; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_badges (id, user_id, badge_id, awarded_at, evidence_url) FROM stdin;
9505c8ef-9814-48a7-93d2-dad1564f7461	2b919190-537d-4576-8b6f-3464d54bde33	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-24 06:44:32.396981+00	\N
56fb1bfe-165a-4d33-a268-d390a1db1b8b	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-24 19:20:55.133553+00	\N
ce909c0e-2dcf-4200-8d3e-fc33e196ed83	b0a02768-1793-4c11-88ca-a23eed595d64	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-24 19:20:55.133553+00	\N
b27599d8-2351-4773-bf80-02b8f0c25d79	85153abc-97d4-4e38-b87d-b0c7154c0259	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-25 07:40:00.680592+00	\N
53994c48-d734-45f2-8f24-a7eae4c9dba1	9f76b760-a301-4c4e-8b3b-58a84e81136e	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-25 07:40:00.680592+00	\N
0d34114c-8d98-4878-86c2-faf9038b1730	b7b68b55-f1ac-4677-bdb7-bb832cc28b3e	67a12337-d664-40e3-ac85-ffce578781c3	2025-12-25 15:23:13.071+00	\N
6c07f379-9065-405a-a912-59de0a9519fc	e8f9a9c0-ef5e-44b6-bfe4-694a8a4d05fd	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-26 14:02:34.012643+00	\N
ae971f87-b6ee-4d37-b9ff-7d8ff80b629f	f5f72fb2-af1c-4402-840d-00084c9bfe23	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-26 14:02:34.012643+00	\N
6a529057-ffa0-4b36-b5fd-f173c582b607	43469979-d25c-4f34-bcf0-6ec1678cc522	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-26 14:02:34.012643+00	\N
225d8d1f-5f53-4d7c-a3e3-639c75aaf9c5	7cdbd0f5-3a43-44ca-b374-072c48ad83ae	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-26 14:02:34.012643+00	\N
416f1d30-c2bb-421a-814f-8b962d85f2f6	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-26 14:02:34.012643+00	\N
bcd9569b-9fbc-4748-8b32-bc0fef3dc0e1	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	5788a7d6-1f7e-46fc-92fe-6e3d0e351012	2025-12-27 02:17:08.909+00	\N
774c5046-bce0-4e57-b789-29eb38cdd97b	7cdbd0f5-3a43-44ca-b374-072c48ad83ae	bbb36cd1-9b51-451d-ab68-0546e6f80570	2025-12-27 04:14:43.215+00	\N
b4bf1baa-b65e-483c-83f9-e178811a10ce	2b919190-537d-4576-8b6f-3464d54bde33	bbb36cd1-9b51-451d-ab68-0546e6f80570	2025-12-27 06:12:10.834+00	\N
3e138378-8ec3-421d-b422-f9d724be8b3b	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	0c43775c-ad87-4f9a-a672-1a08a9e3ca73	2025-12-27 06:49:46.889+00	\N
300ed9ec-7df7-4d77-81b0-b6af0e8f79c6	6ff230f4-7efa-43fb-897c-7c2dc2ca4771	bbb36cd1-9b51-451d-ab68-0546e6f80570	2025-12-27 17:38:30.599+00	\N
2ef43203-ffb7-4fbb-a049-26ea95fa1ec7	67f4d6c1-e207-4182-b618-9d5e4b9f5b1b	bbb36cd1-9b51-451d-ab68-0546e6f80570	2025-12-28 09:11:51.318+00	\N
92416153-9add-43e9-8387-e017a7288f5b	a14a0e62-90c4-4f65-9abd-c5b4fdb16c33	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
2e097c38-5d08-4ef6-861d-58629908acff	2ba0c9b4-452f-4a52-83dd-a9de821b256b	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
b86c655a-f6a8-4572-9200-a7aaaeb95495	ad7ee060-bd35-40d1-997b-160228e70da7	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
81702521-4626-40f7-b257-4fffbfcc9733	0f53e0ef-4bfa-4ebc-8290-7c23ae2477c5	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
39e542a4-0101-4456-b452-6097140df7e9	0436851f-e311-4cfc-8c9b-b575c6aedc4a	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
82a1ef6f-c477-4883-b068-19c4d096f6f9	c07b070a-fe8c-44bf-a977-be5599f2bb7f	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
b0af72f4-e946-4cc8-872f-344f95778da8	6ff230f4-7efa-43fb-897c-7c2dc2ca4771	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
b46ac997-cbda-4a99-a57f-9f31c4c054e8	671ea1b0-2b46-445f-bb2a-9778e4c26012	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
b8f55eb9-9c83-4a0c-b49c-851940f57d3b	b0a4ac1c-c9a4-495d-9364-319585db00a6	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
23d5a702-5c5c-4c2b-a99f-148b10ff1834	f42226ef-d168-4ddc-a025-99c2b453a189	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
fde9f782-f38f-4850-984c-a3317b020331	f0a8d946-3af4-4d81-9969-020c19ab0570	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
18c66fc8-11ff-4530-a0b8-b7c47c75e026	eeecbe2f-4fda-4a8f-8c8f-7c2eef647452	b357a84f-1d1a-4768-afcf-d830030c1d3c	2025-12-28 10:36:49.555963+00	\N
\.


--
-- Name: avatar_deletion_queue avatar_deletion_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_deletion_queue
    ADD CONSTRAINT avatar_deletion_queue_pkey PRIMARY KEY (id);


--
-- Name: badge_definitions badge_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badge_definitions
    ADD CONSTRAINT badge_definitions_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: blog_reports blog_reports_blog_post_id_reporter_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_reports
    ADD CONSTRAINT blog_reports_blog_post_id_reporter_id_key UNIQUE (blog_post_id, reporter_id);


--
-- Name: blog_reports blog_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_reports
    ADD CONSTRAINT blog_reports_pkey PRIMARY KEY (id);


--
-- Name: cafe_claims cafe_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_claims
    ADD CONSTRAINT cafe_claims_pkey PRIMARY KEY (id);


--
-- Name: cafe_edit_suggestions cafe_edit_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_edit_suggestions
    ADD CONSTRAINT cafe_edit_suggestions_pkey PRIMARY KEY (id);


--
-- Name: cafe_menu_items cafe_menu_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_menu_items
    ADD CONSTRAINT cafe_menu_items_pkey PRIMARY KEY (id);


--
-- Name: cafe_page_views cafe_page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_page_views
    ADD CONSTRAINT cafe_page_views_pkey PRIMARY KEY (id);


--
-- Name: cafe_rating_stats cafe_rating_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_rating_stats
    ADD CONSTRAINT cafe_rating_stats_pkey PRIMARY KEY (cafe_id);


--
-- Name: cafe_stories cafe_stories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_stories
    ADD CONSTRAINT cafe_stories_pkey PRIMARY KEY (id);


--
-- Name: cafe_subscriptions cafe_subscriptions_cafe_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_cafe_id_key UNIQUE (cafe_id);


--
-- Name: cafe_subscriptions cafe_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: cafes cafes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_pkey PRIMARY KEY (id);


--
-- Name: cafes cafes_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_slug_key UNIQUE (slug);


--
-- Name: contribution_logs contribution_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_logs
    ADD CONSTRAINT contribution_logs_pkey PRIMARY KEY (id);


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);


--
-- Name: featured_schedules featured_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_schedules
    ADD CONSTRAINT featured_schedules_pkey PRIMARY KEY (id);


--
-- Name: featured_slot_requests featured_slot_requests_cafe_id_requested_month_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_slot_requests
    ADD CONSTRAINT featured_slot_requests_cafe_id_requested_month_key UNIQUE (cafe_id, requested_month);


--
-- Name: featured_slot_requests featured_slot_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_slot_requests
    ADD CONSTRAINT featured_slot_requests_pkey PRIMARY KEY (id);


--
-- Name: owner_review_responses owner_review_responses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_review_responses
    ADD CONSTRAINT owner_review_responses_pkey PRIMARY KEY (id);


--
-- Name: owner_review_responses owner_review_responses_review_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_review_responses
    ADD CONSTRAINT owner_review_responses_review_id_key UNIQUE (review_id);


--
-- Name: owner_verification_requests owner_verification_requests_cafe_id_user_id_status_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_verification_requests
    ADD CONSTRAINT owner_verification_requests_cafe_id_user_id_status_key UNIQUE (cafe_id, user_id, status);


--
-- Name: owner_verification_requests owner_verification_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_verification_requests
    ADD CONSTRAINT owner_verification_requests_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: review_interactions review_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_interactions
    ADD CONSTRAINT review_interactions_pkey PRIMARY KEY (id);


--
-- Name: review_interactions review_interactions_review_id_user_id_interaction_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_interactions
    ADD CONSTRAINT review_interactions_review_id_user_id_interaction_type_key UNIQUE (review_id, user_id, interaction_type);


--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);


--
-- Name: supporter_subscriptions supporter_subscriptions_kofi_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporter_subscriptions
    ADD CONSTRAINT supporter_subscriptions_kofi_transaction_id_key UNIQUE (kofi_transaction_id);


--
-- Name: supporter_subscriptions supporter_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporter_subscriptions
    ADD CONSTRAINT supporter_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: cafe_claims unique_pending_claim; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_claims
    ADD CONSTRAINT unique_pending_claim UNIQUE (cafe_id, user_id, status);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_badges user_badges_user_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_badge_id_key UNIQUE (user_id, badge_id);


--
-- Name: events_city_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_city_idx ON public.events USING btree (city);


--
-- Name: events_is_national_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_is_national_idx ON public.events USING btree (is_national);


--
-- Name: events_region_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_region_idx ON public.events USING btree (region);


--
-- Name: events_start_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_start_date_idx ON public.events USING btree (start_date);


--
-- Name: events_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_status_idx ON public.events USING btree (status);


--
-- Name: idx_blog_posts_author_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_author_id ON public.blog_posts USING btree (author_id);


--
-- Name: idx_blog_posts_cafe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_cafe_id ON public.blog_posts USING btree (cafe_id);


--
-- Name: idx_blog_posts_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_category ON public.blog_posts USING btree (category);


--
-- Name: idx_blog_posts_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_featured ON public.blog_posts USING btree (featured) WHERE (featured = true);


--
-- Name: idx_blog_posts_published_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_published_at ON public.blog_posts USING btree (published_at DESC);


--
-- Name: idx_blog_posts_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_search ON public.blog_posts USING gin (search_vector);


--
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- Name: idx_blog_reports_blog_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_reports_blog_post_id ON public.blog_reports USING btree (blog_post_id);


--
-- Name: idx_blog_reports_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_reports_status ON public.blog_reports USING btree (status);


--
-- Name: idx_cafe_claims_cafe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_claims_cafe ON public.cafe_claims USING btree (cafe_id);


--
-- Name: idx_cafe_claims_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_claims_status ON public.cafe_claims USING btree (status);


--
-- Name: idx_cafe_claims_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_claims_user ON public.cafe_claims USING btree (user_id);


--
-- Name: idx_cafe_menu_items_cafe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_menu_items_cafe ON public.cafe_menu_items USING btree (cafe_id);


--
-- Name: idx_cafe_menu_items_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_menu_items_category ON public.cafe_menu_items USING btree (cafe_id, category);


--
-- Name: idx_cafe_page_views_cafe_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_page_views_cafe_date ON public.cafe_page_views USING btree (cafe_id, viewed_at);


--
-- Name: idx_cafe_subscriptions_helix_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_subscriptions_helix_id ON public.cafe_subscriptions USING btree (helix_subscription_id) WHERE (helix_subscription_id IS NOT NULL);


--
-- Name: idx_cafe_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafe_subscriptions_status ON public.cafe_subscriptions USING btree (status);


--
-- Name: idx_cafes_is_published; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafes_is_published ON public.cafes USING btree (is_published) WHERE (is_published = true);


--
-- Name: idx_cafes_region; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafes_region ON public.cafes USING btree (region);


--
-- Name: idx_cafes_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cafes_search ON public.cafes USING gin (search_vector);


--
-- Name: idx_contribution_logs_cafe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contribution_logs_cafe_id ON public.contribution_logs USING btree (cafe_id);


--
-- Name: idx_contribution_logs_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contribution_logs_created_at ON public.contribution_logs USING btree (created_at DESC);


--
-- Name: idx_contribution_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contribution_logs_user_id ON public.contribution_logs USING btree (user_id);


--
-- Name: idx_edit_suggestions_cafe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edit_suggestions_cafe ON public.cafe_edit_suggestions USING btree (cafe_id);


--
-- Name: idx_edit_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edit_suggestions_status ON public.cafe_edit_suggestions USING btree (status);


--
-- Name: idx_edit_suggestions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_edit_suggestions_user ON public.cafe_edit_suggestions USING btree (user_id);


--
-- Name: idx_featured_schedules_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_featured_schedules_dates ON public.featured_schedules USING btree (start_date, end_date);


--
-- Name: idx_owner_review_responses_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_review_responses_owner ON public.owner_review_responses USING btree (owner_id);


--
-- Name: idx_owner_review_responses_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_review_responses_review ON public.owner_review_responses USING btree (review_id);


--
-- Name: idx_owner_verification_cafe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_verification_cafe ON public.owner_verification_requests USING btree (cafe_id);


--
-- Name: idx_owner_verification_pending; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_verification_pending ON public.owner_verification_requests USING btree (status) WHERE (status = 'pending'::public.verification_status);


--
-- Name: idx_owner_verification_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_owner_verification_user ON public.owner_verification_requests USING btree (user_id);


--
-- Name: idx_reviews_cafe_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reviews_cafe_id ON public.reviews USING btree (cafe_id);


--
-- Name: idx_supporter_subscriptions_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporter_subscriptions_email ON public.supporter_subscriptions USING btree (email);


--
-- Name: idx_supporter_subscriptions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_supporter_subscriptions_user_id ON public.supporter_subscriptions USING btree (user_id);


--
-- Name: reviews on_review_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_review_change AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_cafe_rating_stats();


--
-- Name: reviews on_review_change_update_user_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_review_change_update_user_stats AFTER INSERT OR DELETE OR UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_user_stats();


--
-- Name: cafes set_updated_at_cafes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_cafes BEFORE UPDATE ON public.cafes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles set_updated_at_profiles; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: reviews set_updated_at_reviews; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER set_updated_at_reviews BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: cafe_menu_items trigger_cafe_menu_items_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cafe_menu_items_updated_at BEFORE UPDATE ON public.cafe_menu_items FOR EACH ROW EXECUTE FUNCTION public.update_cafe_subscriptions_updated_at();


--
-- Name: cafe_subscriptions trigger_cafe_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_cafe_subscriptions_updated_at BEFORE UPDATE ON public.cafe_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_cafe_subscriptions_updated_at();


--
-- Name: owner_review_responses trigger_owner_review_responses_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_owner_review_responses_update BEFORE UPDATE ON public.owner_review_responses FOR EACH ROW EXECUTE FUNCTION public.update_owner_review_responses();


--
-- Name: profiles trigger_queue_avatar_deletion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_queue_avatar_deletion BEFORE DELETE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.queue_avatar_deletion();


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id);


--
-- Name: blog_posts blog_posts_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id);


--
-- Name: blog_reports blog_reports_blog_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_reports
    ADD CONSTRAINT blog_reports_blog_post_id_fkey FOREIGN KEY (blog_post_id) REFERENCES public.blog_posts(id) ON DELETE CASCADE;


--
-- Name: blog_reports blog_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_reports
    ADD CONSTRAINT blog_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: blog_reports blog_reports_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_reports
    ADD CONSTRAINT blog_reports_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: cafe_claims cafe_claims_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_claims
    ADD CONSTRAINT cafe_claims_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafe_claims cafe_claims_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_claims
    ADD CONSTRAINT cafe_claims_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: cafe_claims cafe_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_claims
    ADD CONSTRAINT cafe_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: cafe_edit_suggestions cafe_edit_suggestions_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_edit_suggestions
    ADD CONSTRAINT cafe_edit_suggestions_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafe_edit_suggestions cafe_edit_suggestions_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_edit_suggestions
    ADD CONSTRAINT cafe_edit_suggestions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: cafe_edit_suggestions cafe_edit_suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_edit_suggestions
    ADD CONSTRAINT cafe_edit_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: cafe_menu_items cafe_menu_items_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_menu_items
    ADD CONSTRAINT cafe_menu_items_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafe_page_views cafe_page_views_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_page_views
    ADD CONSTRAINT cafe_page_views_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafe_rating_stats cafe_rating_stats_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_rating_stats
    ADD CONSTRAINT cafe_rating_stats_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafe_stories cafe_stories_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_stories
    ADD CONSTRAINT cafe_stories_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafe_subscriptions cafe_subscriptions_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafe_subscriptions
    ADD CONSTRAINT cafe_subscriptions_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: cafes cafes_contributor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cafes
    ADD CONSTRAINT cafes_contributor_id_fkey FOREIGN KEY (contributor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contribution_logs contribution_logs_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_logs
    ADD CONSTRAINT contribution_logs_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: contribution_logs contribution_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contribution_logs
    ADD CONSTRAINT contribution_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: events events_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE SET NULL;


--
-- Name: events events_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: featured_schedules featured_schedules_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_schedules
    ADD CONSTRAINT featured_schedules_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: featured_slot_requests featured_slot_requests_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_slot_requests
    ADD CONSTRAINT featured_slot_requests_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: featured_slot_requests featured_slot_requests_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.featured_slot_requests
    ADD CONSTRAINT featured_slot_requests_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id);


--
-- Name: owner_review_responses owner_review_responses_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_review_responses
    ADD CONSTRAINT owner_review_responses_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: owner_review_responses owner_review_responses_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_review_responses
    ADD CONSTRAINT owner_review_responses_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: owner_verification_requests owner_verification_requests_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_verification_requests
    ADD CONSTRAINT owner_verification_requests_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: owner_verification_requests owner_verification_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_verification_requests
    ADD CONSTRAINT owner_verification_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: owner_verification_requests owner_verification_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.owner_verification_requests
    ADD CONSTRAINT owner_verification_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: review_interactions review_interactions_review_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_interactions
    ADD CONSTRAINT review_interactions_review_id_fkey FOREIGN KEY (review_id) REFERENCES public.reviews(id) ON DELETE CASCADE;


--
-- Name: review_interactions review_interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_interactions
    ADD CONSTRAINT review_interactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_cafe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_cafe_id_fkey FOREIGN KEY (cafe_id) REFERENCES public.cafes(id) ON DELETE CASCADE;


--
-- Name: reviews reviews_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: supporter_subscriptions supporter_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.supporter_subscriptions
    ADD CONSTRAINT supporter_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badge_definitions(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: featured_schedules Active features are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: events Admins and creators can delete events; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: events Admins and creators can update events; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: events Admins and mods can read all events; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: cafes Admins can delete cafes; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: events Admins can insert events; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: cafe_edit_suggestions Admins can manage all suggestions; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: blog_reports Admins can see all reports; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: cafes Admins can update cafes; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: cafe_claims Admins can update claims; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: owner_verification_requests Admins can update verification requests; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: cafe_claims Admins can view all claims; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: blog_posts Admins full access; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles
  WHERE (profiles.role = ANY (ARRAY['admin'::public.user_role, 'moderator'::public.user_role])))));


--
-- Name: cafe_menu_items Admins have full access; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles
   FROM public.profiles


--
-- Name: cafe_rating_stats Allow all inserts to rating stats; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_page_views Anyone can track views; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_menu_items Anyone can view menu items for published cafes; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes
  WHERE ((cafes.id = cafe_menu_items.cafe_id) AND (cafes.is_published = true)))) OR (EXISTS ( SELECT 1
   FROM public.cafes


--
-- Name: owner_review_responses Anyone can view review responses; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_edit_suggestions Authenticated users can insert suggestions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: reviews Authenticated users can post reviews; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafes Authenticated users can submit cafes; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: blog_posts Authors manage own drafts; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: badge_definitions Badge definitions are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: events Cafe owners can insert events; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes


--
-- Name: contribution_logs Contribution logs are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafes Contributors can update own unpublished cafes; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: events Creators can read own events; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: review_interactions Interactions are public; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: owner_review_responses Owners can create responses for their cafe reviews; Type: POLICY; Schema: public; Owner: -
--

   FROM (public.reviews r
     JOIN public.cafes c ON ((r.cafe_id = c.id)))


--
-- Name: owner_review_responses Owners can delete their own responses; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_stories Owners can manage stories for their cafes; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes


--
-- Name: cafe_menu_items Owners can manage their cafe menu items; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes


--
-- Name: cafe_page_views Owners can read their cafe views; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes


--
-- Name: owner_review_responses Owners can update their own responses; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_subscriptions Owners can view their cafe subscription; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes
   FROM public.profiles


--
-- Name: blog_posts Owners manage cafe posts; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes
  WHERE (cafes.id = blog_posts.cafe_id)))));


--
-- Name: events Public can read published events; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: blog_posts Public can read published posts; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: profiles Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafes Published cafes are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: reviews Reviews are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_stories Scouters can manage stories for their cafes; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes


--
-- Name: avatar_deletion_queue Service role can manage avatar deletion queue; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_subscriptions Service role can manage subscriptions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_rating_stats Stats are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_stories Stories are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

   FROM public.cafes
  WHERE ((cafes.id = cafe_stories.cafe_id) AND (cafes.is_published = true)))));


--
-- Name: user_badges User badges are public; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: review_interactions Users can create interactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: blog_reports Users can create reports; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: owner_verification_requests Users can create verification requests; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: review_interactions Users can delete their own interactions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_claims Users can insert claims; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: reviews Users can modify their own reviews; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: blog_reports Users can see own reports; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_claims Users can view own claims; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafes Users can view own submissions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: cafe_edit_suggestions Users can view own suggestions; Type: POLICY; Schema: public; Owner: -
--



--
-- Name: owner_verification_requests Users can view their verification requests; Type: POLICY; Schema: public; Owner: -
--

   FROM public.profiles


--
-- Name: avatar_deletion_queue; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: badge_definitions; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: blog_reports; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_claims; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_edit_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_menu_items; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_page_views; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_rating_stats; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_stories; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafe_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: cafes; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: contribution_logs; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: featured_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: owner_review_responses; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: owner_verification_requests; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: review_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: reviews; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--


--
-- PostgreSQL database dump complete
--

\unrestrict cB5Vv5fNvibX8XCWsQTYX1OtzddHYUnQXD9TkdlHrx8ns1Bi9w4VA1JR6OQuKMT

