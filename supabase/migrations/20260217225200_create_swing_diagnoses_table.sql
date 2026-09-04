/*
  # Create swing diagnoses table

  Stores the results of swing analysis sessions, including detected faults,
  severity ratings, and recommended training focus areas. This connects the
  Swing Analyzer to the Workout Generator.

  1. New Tables
    - `swing_diagnoses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users, the user who performed the analysis)
      - `diagnosed_at` (timestamptz, when the analysis was completed)
      - `faults` (text[], list of detected fault names e.g. "Early Extension")
      - `severity` (integer, 1-10 overall severity scale)
      - `recommended_focus` (text[], suggested training focus areas)

  2. Security
    - Enable RLS on `swing_diagnoses` table
    - Users can read and insert their own diagnoses
    - Coaches can read diagnoses of their assigned clients

  3. Indexes
    - Index on user_id for fast user lookups
    - Index on diagnosed_at for chronological queries
*/

CREATE TABLE IF NOT EXISTS swing_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnosed_at timestamptz NOT NULL DEFAULT now(),
  faults text[] NOT NULL DEFAULT '{}',
  severity integer NOT NULL DEFAULT 1 CHECK (severity >= 1 AND severity <= 10),
  recommended_focus text[] NOT NULL DEFAULT '{}'
);

ALTER TABLE swing_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_swing_diagnoses_user_id ON swing_diagnoses(user_id);
CREATE INDEX IF NOT EXISTS idx_swing_diagnoses_diagnosed_at ON swing_diagnoses(diagnosed_at DESC);

CREATE POLICY "Users can read own swing diagnoses"
  ON swing_diagnoses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own swing diagnoses"
  ON swing_diagnoses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches can read assigned client diagnoses"
  ON swing_diagnoses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.client_id = swing_diagnoses.user_id
      AND coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.active = true
    )
  );
