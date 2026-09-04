/*
  # Add corrective workout persistence per swing diagnosis

  1. Modified Tables
    - `swing_diagnoses`
      - Added `thumbnail_url` (text, nullable) - stores a base64 data URL of the video frame at time of analysis

  2. New Tables
    - `corrective_workout_exercises`
      - `id` (uuid, primary key)
      - `diagnosis_id` (uuid, foreign key to swing_diagnoses)
      - `exercise_id` (uuid, foreign key to exercises)
      - `phase_key` (text) - which TPI phase: mobility, power, strength, stability
      - `sort_order` (integer) - order within the phase
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled on corrective_workout_exercises
    - Users can only read/insert their own workout exercises (via join to swing_diagnoses)

  4. Indexes
    - Index on diagnosis_id for fast lookups
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_diagnoses' AND column_name = 'thumbnail_url'
  ) THEN
    ALTER TABLE swing_diagnoses ADD COLUMN thumbnail_url text;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS corrective_workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis_id uuid NOT NULL REFERENCES swing_diagnoses(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  phase_key text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE corrective_workout_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own corrective workout exercises"
  ON corrective_workout_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM swing_diagnoses
      WHERE swing_diagnoses.id = corrective_workout_exercises.diagnosis_id
      AND swing_diagnoses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own corrective workout exercises"
  ON corrective_workout_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM swing_diagnoses
      WHERE swing_diagnoses.id = corrective_workout_exercises.diagnosis_id
      AND swing_diagnoses.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_corrective_workout_exercises_diagnosis_id
  ON corrective_workout_exercises(diagnosis_id);
