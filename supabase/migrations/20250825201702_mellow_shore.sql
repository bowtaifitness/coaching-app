/*
  # Create workout programs system

  1. New Tables
    - `workout_programs`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, optional)
      - `duration_weeks` (integer) - total weeks in program
      - `days_per_week` (integer) - workout days per week
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `program_days`
      - `id` (uuid, primary key)
      - `program_id` (uuid, references workout_programs)
      - `day_name` (text) - e.g., "Push", "Pull", "Legs"
      - `day_order` (integer) - order within the week (1, 2, 3, etc.)
      - `created_at` (timestamp)
    
    - `program_weeks`
      - `id` (uuid, primary key)
      - `program_id` (uuid, references workout_programs)
      - `program_day_id` (uuid, references program_days)
      - `week_number` (integer) - which week (1, 2, 3, etc.)
      - `template_id` (uuid, references workout_templates, optional)
      - `notes` (text, optional) - week-specific notes
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for coaches to manage their own programs
    - Add policies for clients to view programs assigned to them

  3. Indexes
    - Add indexes for efficient querying by program, week, and day
*/

-- Create workout_programs table
CREATE TABLE IF NOT EXISTS workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration_weeks integer NOT NULL CHECK (duration_weeks >= 1 AND duration_weeks <= 52),
  days_per_week integer NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create program_days table
CREATE TABLE IF NOT EXISTS program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  day_name text NOT NULL,
  day_order integer NOT NULL CHECK (day_order >= 1 AND day_order <= 7),
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, day_order)
);

-- Create program_weeks table
CREATE TABLE IF NOT EXISTS program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  program_day_id uuid NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number >= 1),
  template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, program_day_id, week_number)
);

-- Enable RLS
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;

-- Policies for workout_programs
CREATE POLICY "Coaches can create programs"
  ON workout_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "Coaches can view own programs"
  ON workout_programs
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can update own programs"
  ON workout_programs
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own programs"
  ON workout_programs
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Policies for program_days
CREATE POLICY "Coaches can manage program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_days.program_id 
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_days.program_id 
      AND created_by = auth.uid()
    )
  );

-- Policies for program_weeks
CREATE POLICY "Coaches can manage program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_weeks.program_id 
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_weeks.program_id 
      AND created_by = auth.uid()
    )
  );

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workout_programs_created_by ON workout_programs(created_by);
CREATE INDEX IF NOT EXISTS idx_program_days_program_id ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_order ON program_days(program_id, day_order);
CREATE INDEX IF NOT EXISTS idx_program_weeks_program_id ON program_weeks(program_id);
CREATE INDEX IF NOT EXISTS idx_program_weeks_week_number ON program_weeks(program_id, week_number);
CREATE INDEX IF NOT EXISTS idx_program_weeks_template ON program_weeks(template_id);

-- Create updated_at trigger for workout_programs
CREATE OR REPLACE FUNCTION update_workout_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workout_programs_updated_at
  BEFORE UPDATE ON workout_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_programs_updated_at();