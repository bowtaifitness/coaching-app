/*
  # Add Index on profiles.role Column

  1. Overview
    - Add index on profiles.role column
    - This column is checked in every RLS policy for admin access
    - Missing index causes full table scans during policy evaluation
    
  2. Performance Impact
    - Dramatically speeds up admin policy checks
    - Eliminates table scans on profiles table
    - Critical for fixing statement timeout errors
*/

CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON profiles(role);

-- Also add a composite index for the common pattern (id + role)
CREATE INDEX IF NOT EXISTS idx_profiles_id_role 
  ON profiles(id, role);
