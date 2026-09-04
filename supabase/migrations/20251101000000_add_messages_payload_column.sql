/*
  # Add payload column to messages table

  1. Changes
    - Add `payload` jsonb column to messages table for storing attachment data
    - Column is nullable to maintain backward compatibility

  2. Purpose
    - Enable file attachments in messages
    - Store metadata about attached files (name, url, type, size)
*/

-- Add payload column to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS payload jsonb;

-- Add comment for documentation
COMMENT ON COLUMN messages.payload IS 'JSON payload for message attachments and metadata';
