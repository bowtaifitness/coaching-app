/*
  # Swing Training Progress: Notes, Loads, and Completion History

  1. Modified Tables
    - `swing_training_progress`
      - Added `note` (text, nullable) - free-form user note per exercise
        (how the set felt, observations, etc.)
      - Added `load` (text, nullable) - short text capturing loads used
        (e.g. "95lb", "32kg KB", "BW")
      - Added `completed_at` (timestamptz, nullable) - stores the most recent
        time the exercise was marked complete. Used for streak/history views.

  2. Notes
    - All additions are nullable and safe to add; no existing rows are modified.
    - RLS remains in place from the original migration.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_training_progress' AND column_name = 'note'
  ) THEN
    ALTER TABLE swing_training_progress ADD COLUMN note text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_training_progress' AND column_name = 'load'
  ) THEN
    ALTER TABLE swing_training_progress ADD COLUMN load text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_training_progress' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE swing_training_progress ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS swing_training_progress_user_completed_at_idx
  ON swing_training_progress (user_id, completed_at)
  WHERE completed_at IS NOT NULL;
