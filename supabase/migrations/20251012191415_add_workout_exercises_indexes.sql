/*
  # Add Performance Indexes to workout_exercises Table

  1. Overview
    - Add indexes to workout_exercises table to improve query performance
    - Resolve statement timeout issues when updating workout exercise progress
    
  2. Changes
    - Add index on workout_id (foreign key lookup)
    - Add index on exercise_id (foreign key lookup)
    - These indexes will dramatically speed up RLS policy checks
    
  3. Performance Impact
    - Fixes "canceling statement due to statement timeout" errors
    - Improves UPDATE query performance for workout progress saving
    - Speeds up SELECT queries that join through workout_exercises
*/

-- Add index on workout_id for fast foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id 
  ON workout_exercises(workout_id);

-- Add index on exercise_id for fast foreign key lookups  
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id 
  ON workout_exercises(exercise_id);

-- Add composite index for common query patterns (workout_id + order_index)
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order 
  ON workout_exercises(workout_id, order_index);
