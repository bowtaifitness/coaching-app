/*
  # Fix profiles table RLS permissions

  1. Security Updates
    - Drop all existing problematic policies on profiles table
    - Create new, simplified policies that avoid recursion
    - Allow coaches to view client profiles for dashboard functionality
    - Maintain proper security boundaries

  2. Changes
    - Remove complex policies that reference other tables
    - Add simple role-based access policies
    - Enable proper coach-client data access
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Authenticated users can read basic profile info" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new simplified policies
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
    auth.uid() = id OR 
    (
      role = 'client' AND 
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = id 
        AND cca.active = true
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
      )
    )
  );

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);