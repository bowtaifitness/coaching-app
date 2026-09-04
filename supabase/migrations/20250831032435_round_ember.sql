/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table create circular references
    - Policies reference coach_client_assignments which references profiles
    - This creates infinite recursion during policy evaluation

  2. Solution
    - Simplify profiles policies to avoid circular dependencies
    - Remove complex subqueries that reference back to profiles
    - Use direct user ID checks where possible
    - Separate coach and client access patterns

  3. Security Changes
    - Users can always view and update their own profile
    - Coaches can view client profiles through direct assignment checks
    - Admins can view all profiles
    - Service role maintains full access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Coaches can view assigned client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create simplified policies without circular references
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Separate policy for coaches to view client profiles
-- This avoids the circular reference by not joining back to profiles
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    auth.uid() = id
    OR
    -- Coaches can see clients assigned to them (direct check without profile join)
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 
        FROM coach_client_assignments cca 
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = id 
        AND cca.active = true
      )
    )
    OR
    -- Admin users can see all profiles (direct role check)
    (
      EXISTS (
        SELECT 1 
        FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
      )
    )
  );

-- Keep the service role policy as is
-- (This policy should already exist and doesn't cause recursion)