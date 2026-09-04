/*
  # Allow Clients to Archive Workouts

  Adds an `archived` boolean column to the `workouts` table so clients
  can hide old workouts from the My Workouts view without deleting them.
  An index on (client_id, archived) speeds up the common "list my active
  workouts" query.

  1. Schema Changes
     - `workouts.archived` (boolean, default false, not null)
     - index `idx_workouts_client_archived` on (client_id, archived)

  2. Security
     - No new policies needed: existing "Clients can update own workouts"
       policy already covers updating this column, and "Clients can
       delete own workouts" handles permanent deletion.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'workouts'
      AND column_name = 'archived'
  ) THEN
    ALTER TABLE workouts ADD COLUMN archived boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workouts_client_archived
  ON workouts (client_id, archived);
