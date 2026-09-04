/*
  # Let Clients Archive and Remove Their Own Program Assignments

  Adds UPDATE and DELETE RLS policies on `client_program_assignments` so a
  client can archive (status='archived') or permanently remove a program
  that has been assigned to them. The existing app-side filter on
  `status = 'active'` will hide archived rows from the My Workouts view.

  1. Security
     - INSERT/SELECT policies for clients are unchanged.
     - New: clients can UPDATE rows where they are the client_id.
     - New: clients can DELETE rows where they are the client_id.
     - Coach/admin policies are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_program_assignments'
      AND policyname = 'Clients can update own program assignments'
  ) THEN
    CREATE POLICY "Clients can update own program assignments"
      ON client_program_assignments
      FOR UPDATE
      TO authenticated
      USING ((SELECT auth.uid()) = client_id)
      WITH CHECK ((SELECT auth.uid()) = client_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'client_program_assignments'
      AND policyname = 'Clients can delete own program assignments'
  ) THEN
    CREATE POLICY "Clients can delete own program assignments"
      ON client_program_assignments
      FOR DELETE
      TO authenticated
      USING ((SELECT auth.uid()) = client_id);
  END IF;
END $$;
