/*
  # Allow Coaches and Admins to View Assigned Clients' Swing Training Progress

  1. Purpose
    - Previously, only a user could read their own `swing_training_progress` rows.
    - This migration adds read-only access so a coach can see the streak /
      completion history of any client that is actively assigned to them via
      `coach_client_assignments`, and so admins can view all rows.
    - No write access is granted; coaches cannot modify client progress rows.

  2. Security Changes
    - New RLS SELECT policy on `swing_training_progress`:
      `Coaches and admins can view assigned client training progress`
    - Policy grants SELECT only when:
        a. The caller has an active `coach_client_assignments` row matching the
           row's `user_id`, OR
        b. The caller has the `admin` role in `profiles`.
    - Existing owner policies remain unchanged; users can still read/write their
      own rows exactly as before.

  3. Notes
    - INSERT / UPDATE / DELETE policies are untouched, so this is strictly
      read-only aggregated access for supervising roles.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'swing_training_progress'
      AND policyname = 'Coaches and admins can view assigned client training progress'
  ) THEN
    CREATE POLICY "Coaches and admins can view assigned client training progress"
      ON swing_training_progress
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1
          FROM coach_client_assignments cca
          WHERE cca.coach_id = auth.uid()
            AND cca.client_id = swing_training_progress.user_id
            AND cca.active = true
        )
        OR EXISTS (
          SELECT 1
          FROM profiles p
          WHERE p.id = auth.uid()
            AND p.role = 'admin'
        )
      );
  END IF;
END $$;
