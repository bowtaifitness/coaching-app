/*
  # Aggressive fix for profiles RLS infinite recursion

  1. Problem
    - Multiple overlapping RLS policies on profiles table causing infinite recursion
    - Policies are referencing the profiles table within their own conditions
    - This creates circular dependencies that PostgreSQL cannot resolve

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create minimal, non-recursive policies
    - Use only auth.uid() and JWT claims, never profile table lookups
    - Separate admin access from regular user access completely

  3. New Policy Structure
    - Admin access via email (no profile lookup)
    - User self-access via auth.uid()
    - Coach-client visibility via assignments table only
    - Service role full access
*/

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Clients can view assigned coach" ON profiles;
DROP POLICY IF EXISTS "Coach and admin visibility" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new, simple policies that avoid recursion

-- 1. Admin access (using JWT email claim only)
CREATE POLICY "admin_full_access_by_email" ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- 2. Users can manage their own profile
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Allow profile creation during signup
CREATE POLICY "allow_profile_creation" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. Coaches can view clients (via assignments table, not profiles)
CREATE POLICY "coaches_view_assigned_clients" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 
      FROM coach_client_assignments cca 
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 5. Clients can view their assigned coach (via assignments table)
CREATE POLICY "clients_view_assigned_coach" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (role = 'coach' OR role = 'admin') AND 
    EXISTS (
      SELECT 1 
      FROM coach_client_assignments cca 
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 6. Service role full access
CREATE POLICY "service_role_full_access" ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Test the policies work without recursion
DO $$
BEGIN
  -- This should not cause infinite recursion
  PERFORM id FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000' LIMIT 1;
  RAISE NOTICE 'Profiles policies test completed successfully - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profiles policies test failed: %', SQLERRM;
END $$;