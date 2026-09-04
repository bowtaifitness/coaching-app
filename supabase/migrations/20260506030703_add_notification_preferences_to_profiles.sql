/*
  # Add notification preferences to profiles

  1. Modified Tables
    - `profiles`
      - Added `notification_preferences` (jsonb, default with all toggles off)
        - Stores user notification preferences including:
          - email_upcoming_workout (boolean)
          - email_completed (boolean)
          - email_block_end (boolean)
          - sms_upcoming_workout (boolean)
          - sms_completed (boolean)
          - sms_block_end (boolean)

  2. Notes
    - All notification toggles default to false (opt-in model)
    - Phone number column already exists on profiles
    - Existing RLS policies already restrict users to updating their own row
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_preferences jsonb DEFAULT '{
      "email_upcoming_workout": false,
      "email_completed": false,
      "email_block_end": false,
      "sms_upcoming_workout": false,
      "sms_completed": false,
      "sms_block_end": false
    }'::jsonb NOT NULL;
  END IF;
END $$;
