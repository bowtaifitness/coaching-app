/*
  # Update Client Intake Form Structure

  1. Purpose
    - Restructure intake form to separate basic information, golf information, and training information
    - Add new fields for comprehensive client assessment
    - Remove old fields that are no longer needed

  2. Changes to client_intake_forms table
    - Drop old columns: years_playing, primary_goal, practice_frequency, biggest_challenge
    - Add Basic Information fields: gender, height, weight
    - Rename and add Golf Information fields: years_playing_golf, current_handicap, primary_golf_goal, play_frequency, biggest_strength, biggest_weakness, golf_notes
    - Add Training Information fields: years_strength_training, training_goal, workout_frequency, equipment_access (array), training_notes
    - Keep: age, injury_history, user_id, completed_at, created_at, updated_at
    - Remove: preferred_communication, additional_notes

  3. Notes
    - Equipment access will be stored as a text array to support multiple selections
    - All notes fields are optional
    - Existing data will be preserved where possible
*/

-- Add new columns for Basic Information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'gender'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN gender text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'height'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN height text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'weight'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN weight text;
  END IF;
END $$;

-- Add new columns for Golf Information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_playing_golf'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN years_playing_golf integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'current_handicap'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN current_handicap text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'primary_golf_goal'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN primary_golf_goal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'play_frequency'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN play_frequency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_strength'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN biggest_strength text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_weakness'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN biggest_weakness text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'golf_notes'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN golf_notes text;
  END IF;
END $$;

-- Add new columns for Training Information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_strength_training'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN years_strength_training integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'training_goal'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN training_goal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'workout_frequency'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN workout_frequency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'equipment_access'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN equipment_access text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'training_notes'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN training_notes text;
  END IF;
END $$;

-- Migrate existing data where possible
DO $$
BEGIN
  -- Copy years_playing to years_playing_golf if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_playing'
  ) THEN
    UPDATE client_intake_forms
    SET years_playing_golf = years_playing
    WHERE years_playing_golf IS NULL AND years_playing IS NOT NULL;
  END IF;

  -- Copy handicap to current_handicap if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'handicap'
  ) THEN
    UPDATE client_intake_forms
    SET current_handicap = handicap
    WHERE current_handicap IS NULL AND handicap IS NOT NULL;
  END IF;

  -- Copy primary_goal to primary_golf_goal if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'primary_goal'
  ) THEN
    UPDATE client_intake_forms
    SET primary_golf_goal = primary_goal
    WHERE primary_golf_goal IS NULL AND primary_goal IS NOT NULL;
  END IF;

  -- Copy practice_frequency to play_frequency if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'practice_frequency'
  ) THEN
    UPDATE client_intake_forms
    SET play_frequency = practice_frequency
    WHERE play_frequency IS NULL AND practice_frequency IS NOT NULL;
  END IF;

  -- Copy biggest_challenge to biggest_weakness if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_challenge'
  ) THEN
    UPDATE client_intake_forms
    SET biggest_weakness = biggest_challenge
    WHERE biggest_weakness IS NULL AND biggest_challenge IS NOT NULL;
  END IF;

  -- Copy additional_notes to golf_notes if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'additional_notes'
  ) THEN
    UPDATE client_intake_forms
    SET golf_notes = additional_notes
    WHERE golf_notes IS NULL AND additional_notes IS NOT NULL;
  END IF;
END $$;
