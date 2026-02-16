ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS moderator_regions text[];
