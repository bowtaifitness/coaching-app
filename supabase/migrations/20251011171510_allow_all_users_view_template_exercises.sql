/*
  # Allow all authenticated users to view template exercises

  1. Changes
    - Add SELECT policy on template_exercises table to allow all authenticated users to view exercises
  
  2. Security
    - All authenticated users can view template exercises (needed for clients to see standard program exercises)
    - This matches the existing "All users can view workout templates" policy
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'template_exercises' 
    AND policyname = 'All users can view template exercises'
  ) THEN
    CREATE POLICY "All users can view template exercises"
      ON template_exercises
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
