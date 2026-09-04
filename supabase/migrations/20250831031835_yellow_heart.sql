/*
  # Add Coach-Client Assignment System

  1. New Tables
    - `coach_client_assignments`
      - `id` (uuid, primary key)
      - `coach_id` (uuid, references profiles)
      - `client_id` (uuid, references profiles)
      - `assigned_at` (timestamp)
      - `assigned_by` (uuid, references profiles)
      - `active` (boolean, default true)

  2. Security
    - Enable RLS on `coach_client_assignments` table
    - Add policies for coaches to manage their assignments
    - Add policies for admins to manage all assignments

  3. Changes
    - Update existing queries to respect coach-client relationships
    - Ensure coaches only see their assigned clients
*/

-- Create coach_client_assignments table
CREATE TABLE IF NOT EXISTS coach_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- Enable RLS
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for coach_client_assignments
CREATE POLICY "Coaches can view their assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Coaches can manage their assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_coach_id ON coach_client_assignments(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_client_id ON coach_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_active ON coach_client_assignments(active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_coach_client_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coach_client_assignments_updated_at
  BEFORE UPDATE ON coach_client_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_coach_client_assignments_updated_at();

-- Update existing RLS policies to respect coach-client assignments

-- Update profiles policy for coaches to only see assigned clients
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
CREATE POLICY "Coaches can view assigned client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own profile
    auth.uid() = id OR
    -- Coaches can see clients assigned to them
    (
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() AND p.role = 'coach'
      ) AND
      role = 'client' AND
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = id 
        AND cca.active = true
      )
    ) OR
    -- Admins can see all profiles
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update workouts policies to respect assignments
DROP POLICY IF EXISTS "Coaches can view their workouts" ON workouts;
CREATE POLICY "Coaches can view assigned client workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    -- Coaches can see workouts for their assigned clients
    coach_id = auth.uid() OR
    -- Clients can see their own workouts
    client_id = auth.uid() OR
    -- Admins can see all workouts
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Coaches can create workouts" ON workouts;
CREATE POLICY "Coaches can create workouts for assigned clients"
  ON workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    ) AND
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid() 
      AND cca.client_id = workouts.client_id 
      AND cca.active = true
    )
  );

-- Update performance_metrics policies
DROP POLICY IF EXISTS "Users can view own performance metrics" ON performance_metrics;
CREATE POLICY "Users can view assigned performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can see their own metrics
    client_id = auth.uid() OR
    -- Coaches can see metrics for their assigned clients
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid() 
      AND cca.client_id = performance_metrics.client_id 
      AND cca.active = true
    ) OR
    -- Admins can see all metrics
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update swing_analyses policies
DROP POLICY IF EXISTS "Users can view their swing analyses" ON swing_analyses;
CREATE POLICY "Users can view assigned swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can see their own analyses
    client_id = auth.uid() OR
    -- Coaches can see analyses for their assigned clients
    coach_id = auth.uid() OR
    (
      coach_id IS NULL AND
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = swing_analyses.client_id 
        AND cca.active = true
      )
    ) OR
    -- Admins can see all analyses
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update messages policies to respect assignments
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view assigned messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see messages they sent or received
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    -- Coaches can see messages with their assigned clients
    (
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() AND p.role = 'coach'
      ) AND
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND (cca.client_id = sender_id OR cca.client_id = receiver_id)
        AND cca.active = true
      )
    ) OR
    -- Admins can see all messages
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );