/*
  # Fix Infinite Recursion in RLS Policies

  The issue is that the "Coaches can view client profiles" policy creates infinite recursion
  by querying the profiles table within its own policy condition.

  We need to simplify the policies to avoid self-referencing queries.
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;

-- Create a simpler, non-recursive policy for coaches to view client profiles
-- This uses a direct role check without subqueries that could cause recursion
CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the requesting user is a coach (checked via auth metadata)
    -- and the profile being viewed is a client
    (
      COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), 'client') = 'coach'
      AND role = 'client'
    )
    OR
    -- Or if it's the user's own profile
    auth.uid() = id
  );

-- Ensure the basic "Users can view own profile" policy exists and is simple
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);