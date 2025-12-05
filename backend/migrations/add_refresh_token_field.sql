-- Add refresh_token field to users table
-- This allows storing hashed refresh tokens for extended sessions

ALTER TABLE users ADD COLUMN refresh_token VARCHAR;
