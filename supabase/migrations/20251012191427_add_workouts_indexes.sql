/*
  # Add Performance Indexes to workouts Table

  1. Overview
    - Add indexes to workouts table to improve RLS policy performance
    - Speed up queries that filter by client_id and coach_id
    
  2. Changes
    - Add index on client_id (used heavily in RLS policies)
    - Add index on coach_id (used in coach access policies)
    - Add index on scheduled_date (used for date-based queries)
    
  3. Performance Impact
    - Dramatically speeds up RLS policy checks
    - Improves workout fetching performance
    - Enables efficient date-based workout queries
*/

-- Add index on client_id for fast client workout lookups
CREATE INDEX IF NOT EXISTS idx_workouts_client_id 
  ON workouts(client_id);

-- Add index on coach_id for fast coach workout lookups
CREATE INDEX IF NOT EXISTS idx_workouts_coach_id 
  ON workouts(coach_id);

-- Add index on scheduled_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled_date 
  ON workouts(scheduled_date);

-- Add composite index for client + date queries
CREATE INDEX IF NOT EXISTS idx_workouts_client_date 
  ON workouts(client_id, scheduled_date);
