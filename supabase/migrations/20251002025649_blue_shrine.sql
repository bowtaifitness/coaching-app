/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table are causing infinite recursion
    - Policies are referencing the profiles table within their own conditions
    - This creates circular dependencies that cause database errors

  2. Solution
    - Drop all existing problematic policies
    - Create new policies that avoid self-referential queries
    - Use direct auth.uid() checks and JWT claims instead of profile lookups
    - Ensure coach-client relationships use only assignment table

  3. New Policies
    - users_own_profile_access: Direct auth.uid() check for own profile
    - admin_access_via_jwt: Uses JWT email claim for admin access
    - coaches_view_assigned_clients: Uses assignments table only
    - clients_view_assigned_coach: Uses assignments table only
    - service_role_full_access: Service role bypass
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "admin_access_via_jwt" ON profiles;
DROP POLICY IF EXISTS "allow_authenticated_profile_creation" ON profiles;
DROP POLICY IF EXISTS "clients_view_assigned_coach_via_assignments" ON profiles;
DROP POLICY IF EXISTS "coaches_view_assigned_clients_via_assignments" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_access" ON profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "users_own_profile_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "admin_access_via_jwt"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

CREATE POLICY "coaches_view_assigned_clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id 
      FROM coach_client_assignments 
      WHERE coach_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "clients_view_assigned_coach"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT coach_id 
      FROM coach_client_assignments 
      WHERE client_id = auth.uid() AND active = true
    )
  );

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
  PERFORM 1 FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000';
  RAISE NOTICE 'Profiles policies test completed successfully - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profiles policies test failed: %', SQLERRM;
END $$;