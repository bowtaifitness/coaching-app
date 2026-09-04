/*
  # Fix Admin Policies on Exercises Table

  1. Problem
    - Policies checking profiles.role cause infinite recursion
    - Admin users cannot delete exercises
    
  2. Solution
    - Replace role-based admin policies with email-based policies
    - Use auth.jwt()->>'email' to avoid circular dependency
    
  3. Changes
    - Drop problematic admin policies on exercises table
    - Create new email-based admin policy
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin full access to exercises" ON exercises;
DROP POLICY IF EXISTS "Admins can manage all exercises" ON exercises;

-- Create email-based admin policy (no circular dependency)
CREATE POLICY "Admin email full access to exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');