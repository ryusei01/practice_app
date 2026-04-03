-- Add media_urls column to questions table
-- Stores JSON array of media attachments: [{"type":"image"|"audio","url":"...","position":"question"|"answer","caption":"..."}]
ALTER TABLE questions ADD COLUMN IF NOT EXISTS media_urls JSON;
