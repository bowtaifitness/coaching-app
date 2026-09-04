/*
  # Swing Program Preferences

  Stores per-user preferences for generating their custom swing-based
  mobility/strength program from the swing analyzer. Captures how many
  training days per week the user wants and what equipment they have
  available so the generated program can be tailored.

  1. New Tables
     - `swing_program_preferences`
       - `user_id` (uuid, primary key, FK to auth.users)
       - `days_per_week` (int, 1-4)
       - `equipment` (text, one of: bodyweight, bands, dumbbells, full-gym)
       - `updated_at` (timestamptz, default now())

  2. Security
     - Enable RLS
     - Policies restrict select/insert/update to the row owner only
*/

CREATE TABLE IF NOT EXISTS swing_program_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  days_per_week integer NOT NULL DEFAULT 4,
  equipment text NOT NULL DEFAULT 'full-gym',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT swing_program_preferences_days_check CHECK (days_per_week BETWEEN 1 AND 4),
  CONSTRAINT swing_program_preferences_equipment_check CHECK (
    equipment IN ('bodyweight','bands','dumbbells','full-gym')
  )
);

ALTER TABLE swing_program_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'swing_program_preferences'
      AND policyname = 'Users can view own swing program preferences'
  ) THEN
    CREATE POLICY "Users can view own swing program preferences"
      ON swing_program_preferences FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'swing_program_preferences'
      AND policyname = 'Users can insert own swing program preferences'
  ) THEN
    CREATE POLICY "Users can insert own swing program preferences"
      ON swing_program_preferences FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'swing_program_preferences'
      AND policyname = 'Users can update own swing program preferences'
  ) THEN
    CREATE POLICY "Users can update own swing program preferences"
      ON swing_program_preferences FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
