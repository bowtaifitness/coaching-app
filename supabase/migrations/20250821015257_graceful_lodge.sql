/*
  # Fix Authentication Trigger Issues

  This migration removes problematic triggers and creates a simpler, more reliable approach
  to profile creation that won't interfere with the authentication process.
*/

-- Drop all existing triggers that might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create a simple function that can be called manually when needed
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, created_at, updated_at)
  VALUES (user_id, user_role, first_name, last_name, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO anon;

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;

-- Recreate clean RLS policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow coaches to view client profiles
CREATE POLICY "Coaches can view client profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid()
      AND coach_profile.role = 'coach'
    )
    AND role = 'client'
  );

-- Allow service role to manage profiles (for manual fixes)
CREATE POLICY "Service role can manage profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);