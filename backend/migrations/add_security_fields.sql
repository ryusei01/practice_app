-- Add security-related fields to users table
-- Migration: Add failed_login_attempts and locked_until fields

-- Add failed_login_attempts column (default: 0)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;

-- Add locked_until column (nullable, for account lockout)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;

-- Update existing users to have default values
UPDATE users
SET failed_login_attempts = 0
WHERE failed_login_attempts IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.locked_until IS 'Timestamp when account will be unlocked (NULL if not locked)';
