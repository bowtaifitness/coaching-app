/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - Policies on coach_client_assignments that check profiles.role cause infinite recursion
    - When querying profiles, it checks coach_client_assignments, which checks profiles again
    
  2. Solution
    - Remove role-based admin policies on coach_client_assignments
    - Use email-based admin check instead (auth.jwt()->>'email')
    - This breaks the circular dependency
    
  3. Changes
    - Drop problematic admin policies on coach_client_assignments
    - Create new email-based admin policy
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin full access to coach_client_assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON coach_client_assignments;

-- Create email-based admin policy (no circular dependency)
CREATE POLICY "Admin email access to assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');