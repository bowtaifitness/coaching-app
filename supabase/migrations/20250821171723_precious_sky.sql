/*
  # Create workout template system

  1. New Tables
    - `workout_templates`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, optional)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
    - `template_exercises`
      - `id` (uuid, primary key)
      - `template_id` (uuid, references workout_templates)
      - `exercise_id` (uuid, references exercises)
      - `sets` (integer, optional)
      - `reps` (integer, optional)
      - `weight` (numeric, optional)
      - `duration` (integer, optional)
      - `notes` (text, optional)
      - `order_index` (integer)

  2. Changes
    - Add `template_id` to `workouts` table to track which template was used

  3. Security
    - Enable RLS on both new tables
    - Add policies for coaches to manage their own templates
    - Add policies for viewing template exercises
*/

-- Create workout_templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create template_exercises table
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES exercises(id) NOT NULL,
  sets integer,
  reps integer,
  weight numeric,
  duration integer,
  notes text,
  order_index integer DEFAULT 0
);

-- Add template_id to workouts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE workouts ADD COLUMN template_id uuid REFERENCES workout_templates(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

-- Policies for workout_templates
CREATE POLICY "Coaches can create templates"
  ON workout_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'coach'
    )
  );

CREATE POLICY "Coaches can view own templates"
  ON workout_templates
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can update own templates"
  ON workout_templates
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own templates"
  ON workout_templates
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Policies for template_exercises
CREATE POLICY "Coaches can insert template exercises"
  ON template_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view template exercises"
  ON template_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update template exercises"
  ON template_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete template exercises"
  ON template_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );