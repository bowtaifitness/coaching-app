/*
  # Allow Authenticated Users to Create Personal Exercises

  The Swing Analyzer generates a custom training program with exercises
  that may not yet exist in the public exercise library. To let clients
  save those programs to their own workout calendar, they need permission
  to insert exercise rows tagged with their own user id.

  1. Security
     - Adds an INSERT policy on `exercises` that lets any authenticated user
       create rows where `created_by = auth.uid()`.
     - Existing coach/admin policies remain intact -- this is purely additive.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exercises'
      AND policyname = 'Authenticated users can create personal exercises'
  ) THEN
    CREATE POLICY "Authenticated users can create personal exercises"
      ON exercises FOR INSERT
      TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;
