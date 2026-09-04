/*
  # Fix Client Intake Form Constraints

  1. Purpose
    - Remove NOT NULL constraints from legacy columns
    - Drop legacy columns that are no longer used
    - Clean up the client_intake_forms table structure

  2. Changes
    - Drop old columns: primary_goal, practice_frequency, biggest_challenge, preferred_communication, additional_notes, years_playing, handicap
    - These columns have been replaced with new fields in a previous migration

  3. Notes
    - Data has already been migrated to new columns in previous migration
    - This completes the table restructuring
*/

-- Drop old columns that are no longer needed
DO $$
BEGIN
  -- Drop primary_goal (replaced by primary_golf_goal)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'primary_goal'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN primary_goal;
  END IF;

  -- Drop practice_frequency (replaced by play_frequency)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'practice_frequency'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN practice_frequency;
  END IF;

  -- Drop biggest_challenge (replaced by biggest_weakness)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_challenge'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN biggest_challenge;
  END IF;

  -- Drop preferred_communication (no longer collected)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'preferred_communication'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN preferred_communication;
  END IF;

  -- Drop additional_notes (replaced by golf_notes)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'additional_notes'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN additional_notes;
  END IF;

  -- Drop years_playing (replaced by years_playing_golf)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_playing'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN years_playing;
  END IF;

  -- Drop handicap (replaced by current_handicap)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'handicap'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN handicap;
  END IF;
END $$;
