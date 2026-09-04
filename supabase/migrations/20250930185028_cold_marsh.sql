/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - Policies are trying to query profiles table from within profiles policies
    - This creates circular dependencies and endless loops

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create simple, non-recursive policies
    - Avoid any subqueries to profiles table within profiles policies
    - Use direct auth functions and external table references only

  3. Security
    - Users can manage their own profiles
    - Admin access via direct email check
    - Coach-client relationships handled via coach_client_assignments table
    - Service role has full access
*/

-- Drop ALL existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile (no recursion)
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Admin access via direct email check (no profile table query)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

-- 4. Coaches can view clients assigned to them (using assignments table, not profiles)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR 
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.client_id = profiles.id 
          AND cca.coach_id = auth.uid() 
          AND cca.active = true
      )
    )
    OR
    (
      role IN ('coach', 'admin') 
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = profiles.id 
          AND cca.client_id = auth.uid() 
          AND cca.active = true
      )
    )
  );

-- 5. Service role has full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);