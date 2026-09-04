/*
  # Add Program Week Exercises Table

  1. Purpose
    - Allow customization of exercises for specific program weeks
    - Store week-specific exercise variations independent of templates
    - Enable coaches to modify workouts per week after template assignment

  2. New Table: program_week_exercises
    - `id` (uuid, primary key)
    - `program_week_id` (uuid, foreign key to program_weeks)
    - `exercise_id` (uuid, foreign key to exercises)
    - `sets` (integer, optional)
    - `reps` (integer, optional)
    - `weight` (numeric, optional)
    - `duration` (integer, optional - in seconds)
    - `rest_seconds` (integer, optional)
    - `notes` (text, optional)
    - `order_index` (integer, required)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Security
    - Enable RLS
    - Coaches can manage exercises for their programs

  4. Indexes
    - Index on program_week_id for efficient queries
    - Index on order_index for sorting
*/

-- Create program_week_exercises table
CREATE TABLE IF NOT EXISTS program_week_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_week_id uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets integer,
  reps integer,
  weight numeric(10, 2),
  duration integer,
  rest_seconds integer,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_program_week_exercises_program_week_id 
  ON program_week_exercises(program_week_id);

CREATE INDEX IF NOT EXISTS idx_program_week_exercises_order 
  ON program_week_exercises(program_week_id, order_index);

-- Enable RLS
ALTER TABLE program_week_exercises ENABLE ROW LEVEL SECURITY;

-- Coaches can manage exercises for their programs
CREATE POLICY "Coaches can insert exercises for their programs"
  ON program_week_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update exercises for their programs"
  ON program_week_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete exercises for their programs"
  ON program_week_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can view exercises for their programs"
  ON program_week_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_program_week_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_program_week_exercises_updated_at
  BEFORE UPDATE ON program_week_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_program_week_exercises_updated_at();
