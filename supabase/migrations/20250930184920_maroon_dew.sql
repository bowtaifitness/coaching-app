/*
  # Fix infinite recursion in profiles RLS policies

  1. Security Changes
    - Drop problematic policies that cause recursion
    - Create simplified policies that don't reference profiles table within profiles policies
    - Use direct auth.uid() comparisons instead of subqueries to profiles table
    - Maintain security while avoiding circular references

  2. Policy Changes
    - Simplified user access to own profile
    - Direct admin access via email check
    - Removed recursive profile lookups
    - Coach-client relationships handled via coach_client_assignments table
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Admin access via direct email check (no recursion)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

-- 3. Coaches can view assigned clients (using coach_client_assignments, not profiles)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    auth.uid() = id 
    OR 
    -- Admin access
    (auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text
    OR
    -- Coaches can view clients assigned to them via coach_client_assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    ))
    OR
    -- Clients can view their assigned coach via coach_client_assignments
    (role IN ('coach', 'admin') AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    ))
  );

-- 4. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);