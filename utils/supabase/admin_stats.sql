-- Create a function to get admin stats
-- This function skips RLS to get accurate counts
create or replace function get_admin_stats()
returns json
language plpgsql
security definer
as $$
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

  -- 3. Business Stats
  select count(*) into cafes_total from public.cafes;
  select count(*) into cafes_verified from public.cafes where is_verified = true;
  select count(*) into cafes_published from public.cafes where is_published = true;
  
  -- Check if tables exist before querying to avoid errors if features aren't fully deployed
  -- Reviews (assuming table is 'reviews' or 'cafe_reviews', let's check standard 'reviews' as per utility files)
  -- The utility file referenced 'reviews' table.
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
        'badges', badges_size
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
