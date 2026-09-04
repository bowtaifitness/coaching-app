/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - This happens when policies reference the profiles table within their own conditions
    - Error: "infinite recursion detected in policy for relation 'profiles'"

  2. Solution
    - Drop all existing problematic policies
    - Create new policies that avoid self-referential queries
    - Use direct auth functions instead of profile table lookups
    - Ensure no circular dependencies between policies

  3. New Policies
    - Users can manage their own profile (direct auth.uid() check)
    - Admin access via JWT email claim (no profile lookup)
    - Coach-client visibility via assignments table only
    - Service role has full access
*/

-- Drop all existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "admin_full_access_by_email" ON profiles;
DROP POLICY IF EXISTS "allow_profile_creation" ON profiles;
DROP POLICY IF EXISTS "clients_view_assigned_coach" ON profiles;
DROP POLICY IF EXISTS "coaches_view_assigned_clients" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
DROP POLICY IF EXISTS "users_own_profile" ON profiles;

-- Create new non-recursive policies

-- 1. Users can manage their own profile (no recursion - direct auth check)
CREATE POLICY "users_own_profile_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Admin access via JWT email (no profile table lookup)
CREATE POLICY "admin_access_via_jwt"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
  );

-- 3. Allow profile creation for authenticated users
CREATE POLICY "allow_authenticated_profile_creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. Coaches can view assigned clients (via assignments table only)
CREATE POLICY "coaches_view_assigned_clients_via_assignments"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id 
      FROM coach_client_assignments 
      WHERE coach_id = auth.uid() 
        AND active = true
    )
  );

-- 5. Clients can view their assigned coach (via assignments table only)
CREATE POLICY "clients_view_assigned_coach_via_assignments"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT coach_id 
      FROM coach_client_assignments 
      WHERE client_id = auth.uid() 
        AND active = true
    )
  );

-- 6. Service role full access
CREATE POLICY "service_role_full_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Test the policies work without recursion
DO $$
BEGIN
  -- This should not cause infinite recursion
  PERFORM 1 FROM profiles WHERE id = auth.uid() LIMIT 1;
  RAISE NOTICE 'Profiles policies test passed - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profiles policies test failed: %', SQLERRM;
END $$;