/*
  # Force PostgREST Schema Reload
  
  This migration makes a harmless schema change to force PostgREST to reload its cache.
*/

-- Add a comment to force schema detection
COMMENT ON TABLE workout_templates IS 'Workout templates created by coaches - updated to force cache reload';
COMMENT ON TABLE workout_programs IS 'Workout programs for clients - updated to force cache reload';

-- Force reload signals
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');
