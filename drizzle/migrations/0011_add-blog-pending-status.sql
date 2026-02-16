-- Add pending status to blog_status enum
ALTER TYPE blog_status ADD VALUE IF NOT EXISTS 'pending';
