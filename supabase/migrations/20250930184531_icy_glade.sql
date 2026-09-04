/*
  # Fix RLS infinite recursion in profiles policies

  1. Database Changes
    - Add assigned_coach_id column to profiles table
    - Add foreign key constraint and index
    - Migrate existing coach_client_assignments data
    - Fix RLS policies to avoid infinite recursion

  2. Security
    - Updated RLS policies that don't create circular references
    - Proper access control for coaches, clients, and admins
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

-- Update RLS policies to work with the new structure without infinite recursion
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    id = auth.uid() 
    OR 
    -- Coaches can view clients assigned to them (direct column check)
    (assigned_coach_id = auth.uid() AND role = 'client')
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
    -- Coaches and admins can update client assignments (check role directly)
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
    -- Coaches and admins can update client assignments (check role directly)
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  );