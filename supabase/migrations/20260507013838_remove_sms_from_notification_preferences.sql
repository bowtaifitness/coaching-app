/*
  # Remove SMS fields from notification_preferences

  1. Modified Tables
    - `profiles`
      - Updated `notification_preferences` column default to only include email toggles
      - Removed sms_upcoming_workout, sms_completed, sms_block_end from the default

  2. Notes
    - Existing rows will retain any SMS keys in their JSONB but they are unused
    - The application code no longer reads SMS preference keys
    - Phone column remains on profiles for general contact info but is no longer
      tied to notifications
*/

ALTER TABLE profiles
  ALTER COLUMN notification_preferences
  SET DEFAULT '{
    "email_upcoming_workout": false,
    "email_completed": false,
    "email_block_end": false
  }'::jsonb;
