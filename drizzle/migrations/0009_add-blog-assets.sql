ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS images text[];
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS tagged_cafe_ids uuid[];
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS crawl_id uuid REFERENCES cafe_crawls(id) ON DELETE SET NULL;
