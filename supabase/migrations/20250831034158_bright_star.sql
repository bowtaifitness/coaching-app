/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current RLS policies on profiles table are causing infinite recursion
    - Policies are referencing the profiles table within their own conditions
    - This creates a circular dependency during policy evaluation

  2. Solution
    - Drop all existing problematic policies
    - Create new, simplified policies that don't self-reference
    - Use auth.uid() and role checks without querying profiles table recursively

  3. New Policies
    - Users can view their own profile
    - Coaches can view client profiles (simplified check)
    - Service role has full access
*/

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view all client profiles" ON profiles;

-- Create new, simplified policies without recursion
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

CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    auth.uid() = id 
    OR 
    -- Or if they are a coach and the profile is a client
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_app_meta_data->>'role' = 'coach'
      )
    )
  );

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);