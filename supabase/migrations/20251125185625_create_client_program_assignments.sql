/*
  # Create Client Program Assignments Table

  1. New Table
    - `client_program_assignments` - Tracks which programs are assigned to clients
      - `id` (uuid, primary key)
      - `client_id` (uuid, references profiles)
      - `program_id` (uuid, references workout_programs)
      - `assigned_by` (uuid, references profiles) - coach who assigned it
      - `assigned_at` (timestamptz)
      - `start_date` (date) - when program starts
      - `status` (text) - active, completed, cancelled
      - `completed_at` (timestamptz)
      - `created_at` (timestamptz)
      
  2. Security
    - Enable RLS
    - Clients can view their own assignments
    - Coaches can view/manage their clients' assignments
    - Admins can manage all assignments
    
  3. Purpose
    - Explicitly track which program each client is on
    - UI can show "Current Program: XYZ"
    - Keep history of past programs
*/

-- Create table
CREATE TABLE IF NOT EXISTS client_program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_client 
  ON client_program_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_program 
  ON client_program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_status 
  ON client_program_assignments(status);

-- Enable RLS
ALTER TABLE client_program_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for clients
CREATE POLICY "Clients can view own program assignments"
  ON client_program_assignments
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id);

-- Policies for coaches
CREATE POLICY "Coaches can view their clients' program assignments"
  ON client_program_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role = 'coach'
    )
  );

CREATE POLICY "Coaches can insert program assignments for their clients"
  ON client_program_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role = 'coach'
    )
  );

CREATE POLICY "Coaches can update their clients' program assignments"
  ON client_program_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role = 'coach'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role = 'coach'
    )
  );

-- Policies for admins
CREATE POLICY "Admins can manage all program assignments"
  ON client_program_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Add comment
COMMENT ON TABLE client_program_assignments IS 'Tracks which workout programs are assigned to clients, allowing UI to show current program and history';