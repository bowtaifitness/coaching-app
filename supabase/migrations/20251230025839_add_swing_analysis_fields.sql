/*
  # Add fields to swing_analyses table

  1. Changes
    - Add `video_name` column to store original filename
    - Add `analysis_data` jsonb column to store pose detection results
    - Add `updated_at` column for tracking updates
    - Keep existing columns (id, client_id, coach_id, video_url, analysis, feedback, created_at)

  2. Security
    - Policies already exist on swing_analyses table
    - No changes needed to RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_analyses' AND column_name = 'video_name'
  ) THEN
    ALTER TABLE swing_analyses ADD COLUMN video_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_analyses' AND column_name = 'analysis_data'
  ) THEN
    ALTER TABLE swing_analyses ADD COLUMN analysis_data jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_analyses' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE swing_analyses ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;