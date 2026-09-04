/*
  # Force Schema Reload
  
  This migration forces PostgREST to reload its schema cache by sending a NOTIFY signal.
*/

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- Also force a refresh of the schema cache
SELECT pg_notify('pgrst', 'reload schema');
