/*
  # Fix Admin Role and Policies

  1. Updates
    - Set brian@bowtaifitness.com to admin role
    - Update profiles table to allow admin role
    - Add comprehensive admin policies

  2. Security
    - Admin can view all data
    - Admin policies override existing restrictions
    - Maintain existing coach/client policies
*/

-- First, ensure the profiles table allows admin role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to admin role
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com' OR id IN (
  SELECT id FROM auth.users WHERE email = 'brian@bowtaifitness.com'
);

-- If the profile doesn't exist, let's try to find it by auth user
DO $$
DECLARE
  brian_user_id uuid;
BEGIN
  -- Get brian's user ID from auth.users
  SELECT id INTO brian_user_id 
  FROM auth.users 
  WHERE email = 'brian@bowtaifitness.com';
  
  IF brian_user_id IS NOT NULL THEN
    -- Update the profile if it exists
    UPDATE profiles 
    SET role = 'admin', updated_at = now()
    WHERE id = brian_user_id;
    
    -- If no rows were updated, the profile might not exist
    IF NOT FOUND THEN
      RAISE NOTICE 'Profile not found for brian@bowtaifitness.com (ID: %)', brian_user_id;
    ELSE
      RAISE NOTICE 'Successfully updated brian@bowtaifitness.com to admin role';
    END IF;
  ELSE
    RAISE NOTICE 'User brian@bowtaifitness.com not found in auth.users';
  END IF;
END $$;

-- Add comprehensive admin policies for all tables
-- Profiles table admin policies
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
CREATE POLICY "Admin full access to profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workouts table admin policies
DROP POLICY IF EXISTS "Admin full access to workouts" ON workouts;
CREATE POLICY "Admin full access to workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Exercises table admin policies
DROP POLICY IF EXISTS "Admin full access to exercises" ON exercises;
CREATE POLICY "Admin full access to exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Performance metrics admin policies
DROP POLICY IF EXISTS "Admin full access to performance_metrics" ON performance_metrics;
CREATE POLICY "Admin full access to performance_metrics"
  ON performance_metrics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Messages admin policies
DROP POLICY IF EXISTS "Admin full access to messages" ON messages;
CREATE POLICY "Admin full access to messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Swing analyses admin policies
DROP POLICY IF EXISTS "Admin full access to swing_analyses" ON swing_analyses;
CREATE POLICY "Admin full access to swing_analyses"
  ON swing_analyses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Coach client assignments admin policies
DROP POLICY IF EXISTS "Admin full access to coach_client_assignments" ON coach_client_assignments;
CREATE POLICY "Admin full access to coach_client_assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workout templates admin policies
DROP POLICY IF EXISTS "Admin full access to workout_templates" ON workout_templates;
CREATE POLICY "Admin full access to workout_templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Template exercises admin policies
DROP POLICY IF EXISTS "Admin full access to template_exercises" ON template_exercises;
CREATE POLICY "Admin full access to template_exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workout exercises admin policies
DROP POLICY IF EXISTS "Admin full access to workout_exercises" ON workout_exercises;
CREATE POLICY "Admin full access to workout_exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workout programs admin policies
DROP POLICY IF EXISTS "Admin full access to workout_programs" ON workout_programs;
CREATE POLICY "Admin full access to workout_programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Program days admin policies
DROP POLICY IF EXISTS "Admin full access to program_days" ON program_days;
CREATE POLICY "Admin full access to program_days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Program weeks admin policies
DROP POLICY IF EXISTS "Admin full access to program_weeks" ON program_weeks;
CREATE POLICY "Admin full access to program_weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );