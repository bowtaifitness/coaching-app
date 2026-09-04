/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - Policies are querying profiles table from within profiles policies
    - This creates circular dependency and infinite loop

  2. Solution
    - Drop all existing problematic policies on profiles table
    - Create simple, non-recursive policies
    - Use auth.jwt() and direct comparisons instead of profile subqueries
    - Avoid any SELECT queries on profiles table within profiles policies

  3. Security
    - Maintain same access control without recursion
    - Users can manage own profiles
    - Admin access via email check
    - Coach-client relationships via assignments table
*/

-- Drop all existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;

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
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- 4. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Coach-client relationship via assignments table (no profiles recursion)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Own profile
    id = auth.uid()
    OR
    -- Admin access via email
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
    OR
    -- Coaches can view clients assigned to them via assignments table
    (role = 'client' AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    ))
    OR
    -- Clients can view their assigned coaches via assignments table
    (role IN ('coach', 'admin') AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    ))
  );