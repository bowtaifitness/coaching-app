/*
  # Nuclear Delete: Remove All Exercises

  This migration completely clears the exercises table to remove all default/mock exercises
  that were preloaded in the app. This gives users a clean slate to import their own exercises.

  1. Actions
     - Delete ALL exercises from the exercises table
     - Reset the table to completely empty state

  2. Security
     - No changes to RLS policies
     - Existing policies remain intact for future exercises

  3. Notes
     - This is a one-time cleanup to remove mock/default data
     - Users can re-import exercises from YouTube after this cleanup
     - All workout_exercises references will be cleaned up by CASCADE
*/

-- Delete all exercises from the table
DELETE FROM exercises;

-- Optional: Reset any sequences if needed (PostgreSQL will handle this automatically)
-- This ensures a clean slate for new exercise imports