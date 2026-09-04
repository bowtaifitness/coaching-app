/*
  # Add assigned_coach_id to profiles table

  1. New Columns
    - `assigned_coach_id` (uuid, foreign key to profiles.id)
      - Allows direct coach assignment without separate junction table
      - Improves query performance for coach-client relationships

  2. Indexes
    - Add index on `assigned_coach_id` for better query performance

  3. Data Migration
    - Migrate existing active coach_client_assignments to new structure
    - Preserve existing coach-client relationships

  4. Security
    - Update RLS policies to work with new assigned_coach_id structure
    - Maintain proper access control for coaches and clients
*/

-- Add assigned_coach_id column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_coach_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_coach_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_assigned_coach_id_fkey'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_assigned_coach_id_fkey 
    FOREIGN KEY (assigned_coach_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_coach_id 
ON profiles(assigned_coach_id);

-- Migrate existing active coach_client_assignments to the new structure
UPDATE profiles 
SET assigned_coach_id = (
  SELECT coach_id 
  FROM coach_client_assignments 
  WHERE coach_client_assignments.client_id = profiles.id 
    AND coach_client_assignments.active = true
  LIMIT 1
)
WHERE role = 'client';

-- Update RLS policies to work with the new structure
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    id = auth.uid() 
    OR 
    -- Coaches can view clients assigned to them
    (assigned_coach_id = auth.uid() AND role = 'client')
    OR
    -- Clients can view their assigned coach
    (role IN ('coach', 'admin') AND id = (
      SELECT assigned_coach_id FROM profiles WHERE id = auth.uid()
    ))
    OR
    -- Admins can view all profiles
    (EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    ))
  );

-- Allow coaches to update client assignments
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
CREATE POLICY "Coaches can update client assignments"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Coaches and admins can update client assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  )
  WITH CHECK (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Coaches and admins can update client assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  );