/*
  # Swing Training Plan Progress

  1. New Tables
    - `swing_training_progress`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK -> auth.users)
      - `plan_key` (text) - identifier for the generated plan (derived from fault ids)
      - `day_id` (int) - 1..4
      - `exercise_name` (text) - the exercise row identifier
      - `completed` (bool) - whether it is checked off
      - `swapped_to` (text, nullable) - if user swapped, the current replacement name
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Constraints
    - Unique per (user_id, plan_key, day_id, exercise_name)

  3. Security
    - Enable RLS
    - Policies: authenticated users can select/insert/update/delete only their own rows
*/

CREATE TABLE IF NOT EXISTS swing_training_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key text NOT NULL DEFAULT '',
  day_id integer NOT NULL,
  exercise_name text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  swapped_to text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'swing_training_progress_unique_row'
  ) THEN
    ALTER TABLE swing_training_progress
      ADD CONSTRAINT swing_training_progress_unique_row
      UNIQUE (user_id, plan_key, day_id, exercise_name);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS swing_training_progress_user_plan_idx
  ON swing_training_progress (user_id, plan_key);

ALTER TABLE swing_training_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'swing_training_progress' AND policyname = 'Users can view own training progress'
  ) THEN
    CREATE POLICY "Users can view own training progress"
      ON swing_training_progress FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'swing_training_progress' AND policyname = 'Users can insert own training progress'
  ) THEN
    CREATE POLICY "Users can insert own training progress"
      ON swing_training_progress FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'swing_training_progress' AND policyname = 'Users can update own training progress'
  ) THEN
    CREATE POLICY "Users can update own training progress"
      ON swing_training_progress FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'swing_training_progress' AND policyname = 'Users can delete own training progress'
  ) THEN
    CREATE POLICY "Users can delete own training progress"
      ON swing_training_progress FOR DELETE
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;
