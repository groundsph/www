-- Update reviews with NULL status to 'published'
UPDATE reviews 
SET status = 'published' 
WHERE status IS NULL;
