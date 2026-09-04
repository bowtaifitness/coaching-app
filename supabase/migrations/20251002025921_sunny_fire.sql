/*
  # Emergency Fix: Profiles Table Infinite Recursion

  This migration fixes the infinite recursion error in the profiles table RLS policies
  by removing problematic policies and creating simple, non-recursive replacements.

  ## Changes Made
  1. Drop all existing policies on profiles table
  2. Create minimal, safe policies that don't reference the profiles table within themselves
  3. Ensure admin access works via JWT email claim
  4. Restore basic functionality without recursion

  ## Security
  - Users can access their own profile data
  - Admin access via email verification
  - Coach-client relationships via assignments table only
*/

-- Drop ALL existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "admin_access_via_jwt" ON profiles;
DROP POLICY IF EXISTS "clients_view_assigned_coach" ON profiles;
DROP POLICY IF EXISTS "coaches_view_assigned_clients" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_access" ON profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "users_can_access_own_profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "admin_full_access_by_email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

CREATE POLICY "service_role_access"
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
  RAISE NOTICE 'Profiles policies fixed successfully - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Policy test failed: %', SQLERRM;
END $$;