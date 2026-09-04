/*
  # Add Trial Extension Support for Admins

  1. New Columns
    - Add `trial_extended_until` (timestamptz) to profiles table
      - Allows admins to manually extend trial periods for clients
      - NULL means no extension has been granted
  
  2. Changes
    - Add column with proper default (NULL)
    - Add index for performance
  
  3. Security
    - Only admins can update this column (handled by existing RLS policies)
*/

-- Add trial extension column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_extended_until'
  ) THEN
    ALTER TABLE profiles ADD COLUMN trial_extended_until timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_trial_extended_until 
ON profiles(trial_extended_until) 
WHERE trial_extended_until IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN profiles.trial_extended_until IS 'Admin-set extended trial period. If set, this overrides the standard trial_ends_at date.';