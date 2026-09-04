/*
  # Fix existing video coach assignment

  1. Updates
    - Find videos with null coach_id
    - Assign them to coaches based on client-coach relationships from workouts table
    - This allows coaches to see client videos that were uploaded before coach assignment was working

  2. Security
    - No changes to RLS policies needed
    - Existing policies will work once coach_id is properly set
*/

-- Update swing_analyses records that have null coach_id
-- Assign them to coaches based on existing client-coach relationships from workouts
UPDATE swing_analyses 
SET coach_id = (
  SELECT DISTINCT w.coach_id 
  FROM workouts w 
  WHERE w.client_id = swing_analyses.client_id 
    AND w.coach_id IS NOT NULL 
  LIMIT 1
)
WHERE coach_id IS NULL 
  AND client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM workouts w 
    WHERE w.client_id = swing_analyses.client_id 
      AND w.coach_id IS NOT NULL
  );

-- If no workout relationship exists, we could also assign to the first coach
-- but let's be more conservative and only update where there's a clear relationship