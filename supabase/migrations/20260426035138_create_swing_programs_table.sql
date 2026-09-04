/*
  # Create Swing Programs Table

  ## Overview
  Persists each client's 12-week TPI Power-Play progressive program. The 12 weeks
  are organised into four 3-week training blocks. The full block structure is stored
  as JSON so the front-end can replay the exact phase data the generator produced
  at program start, while the columns expose the fields the app updates as a client
  moves through the program.

  ## Tables
  1. `swing_programs`
     - `id` (uuid, primary key)
     - `user_id` (uuid, FK to auth.users) — owner / client
     - `program_start_date` (date) — Day the client began block 1, week 1
     - `current_week` (integer 1-12) — Week the client is currently on
     - `program_status` (text) — One of `active`, `completed`, `needs_assessment`
     - `blocks` (jsonb) — Array of 4 `{ blockNumber, weeks, workoutPhaseData }` objects
     - `created_at`, `updated_at` (timestamptz)

  ## Constraints
  - `current_week` must be between 1 and 12
  - `program_status` must be one of the three documented states
  - One active program per user is enforced by a partial unique index so a client
    cannot accidentally have two simultaneously running programs

  ## Security
  - RLS is enabled on `swing_programs`
  - Per-action policies (SELECT / INSERT / UPDATE / DELETE) restrict every row to
    its owner via `auth.uid() = user_id`. There are no public or service-wide
    policies, no `USING (true)` shortcuts.

  ## Indexes
  - `swing_programs_user_id_idx` on `user_id` for fast per-user lookups
  - Partial unique index `swing_programs_one_active_per_user` so only one row per
    user can have `program_status = 'active'`
*/

CREATE TABLE IF NOT EXISTS swing_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  program_start_date date NOT NULL DEFAULT CURRENT_DATE,
  current_week integer NOT NULL DEFAULT 1 CHECK (current_week BETWEEN 1 AND 12),
  program_status text NOT NULL DEFAULT 'active'
    CHECK (program_status IN ('active', 'completed', 'needs_assessment')),
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS swing_programs_user_id_idx
  ON swing_programs (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS swing_programs_one_active_per_user
  ON swing_programs (user_id)
  WHERE program_status = 'active';

ALTER TABLE swing_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own swing programs"
  ON swing_programs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own swing programs"
  ON swing_programs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own swing programs"
  ON swing_programs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own swing programs"
  ON swing_programs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION _swing_programs_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS swing_programs_set_updated_at ON swing_programs;
CREATE TRIGGER swing_programs_set_updated_at
  BEFORE UPDATE ON swing_programs
  FOR EACH ROW
  EXECUTE FUNCTION _swing_programs_touch_updated_at();
