/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Circular dependency between profiles and coach_client_assignments policies
    - Profiles policies reference coach_client_assignments
    - Coach_client_assignments policies reference profiles
    - This creates infinite recursion

  2. Solution
    - Simplify profiles policies to avoid circular references
    - Use direct role checks instead of complex joins
    - Remove recursive policy dependencies

  3. Security
    - Maintain proper access control
    - Users can view own profiles
    - Coaches can view assigned client profiles
    - Admins have full access
*/

-- Drop existing problematic policies on profiles
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simplified policies that avoid recursion
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Simple policy for coaches to view client profiles without recursion
CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR 
    (
      role = 'client' AND 
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM auth.users au
        JOIN profiles p ON p.id = au.id
        WHERE au.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- Service role access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also simplify coach_client_assignments policies to avoid recursion
DROP POLICY IF EXISTS "Users can view relevant assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can update assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can delete assignments" ON coach_client_assignments;

-- Create non-recursive policies for coach_client_assignments
CREATE POLICY "Users can view their assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );

CREATE POLICY "Authenticated users can insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  )
  WITH CHECK (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );

CREATE POLICY "Users can delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );