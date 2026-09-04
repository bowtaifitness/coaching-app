/*
  # Add Schema Reload Function

  1. New Functions
    - `reload_schema()` - Allows authenticated users to reload the PostgREST schema cache
  
  2. Security
    - Function is marked as SECURITY DEFINER to allow necessary permissions
    - Only accessible to authenticated users

  This function helps resolve PGRST205 errors where PostgREST loses track of the schema cache.
*/

CREATE OR REPLACE FUNCTION reload_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION reload_schema() TO authenticated;
