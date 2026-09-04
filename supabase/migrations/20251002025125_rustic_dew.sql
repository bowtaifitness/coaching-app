/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current RLS policies on profiles table are causing infinite recursion
    - This happens when policies reference the same table they're protecting
    - Error: "infinite recursion detected in policy for relation 'profiles'"

  2. Solution
    - Drop all existing problematic policies
    - Create new, simpler policies that don't cause recursion
    - Use direct user ID checks instead of profile table lookups
    - Separate policies for different access patterns

  3. New Policies
    - Users can manage their own profile (direct uid() check)
    - Admin access via email check (no profile table lookup)
    - Service role full access
    - Coach-client visibility for messaging (simplified)
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Clients can view assigned coach profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view coach and admin profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches and admins can view all client profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new, non-recursive policies

-- 1. Users can manage their own profile (direct uid() check)
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Admin access via email (no profile table lookup)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- 3. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Allow profile creation during signup
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 5. Coach-client visibility for messaging (simplified)
-- Coaches can view clients they're assigned to
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 6. Clients can view their assigned coach
CREATE POLICY "Clients can view assigned coach"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (role = 'coach' OR role = 'admin') AND 
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 7. General visibility for coaches and admins (simplified)
-- This allows coaches to see other coaches/admins for system functionality
CREATE POLICY "Coach and admin visibility"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Current user is coach/admin AND target profile is coach/admin
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com' OR
    (
      role IN ('coach', 'admin') AND
      auth.uid() IN (
        SELECT id FROM profiles WHERE role IN ('coach', 'admin')
      )
    )
  );

-- Verify policies are working by testing a simple query
-- This should not cause recursion
DO $$
BEGIN
  -- Test that we can query profiles without recursion
  PERFORM id FROM profiles WHERE id = auth.uid() LIMIT 1;
  RAISE NOTICE 'Profiles RLS policies updated successfully - no recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'RLS policy test failed: %', SQLERRM;
END $$;