/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies query the profiles table from within the profiles table policies
    - This creates infinite recursion when trying to check user roles

  2. Solution
    - Drop all existing recursive policies
    - Create new policies that don't reference the profiles table recursively
    - Use auth.uid() directly for user identification
    - Use auth metadata or simpler checks where possible

  3. Changes
    - Remove policies that query profiles table within profiles policies
    - Add non-recursive policies for basic access control
    - Ensure users can always read their own profile
    - Allow admins access through email check instead of role check
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- Users can always read and update their own profile
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Brian (admin) can access all profiles using email check
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow profile creation during signup
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);