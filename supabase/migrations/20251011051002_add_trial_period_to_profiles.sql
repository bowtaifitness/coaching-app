/*
  # Add Trial Period Tracking to Profiles

  1. Purpose
    - Track 7-day free trial period for new users
    - Lock app access after trial expires unless user subscribes
    - Allow users to try the app and standard programs for free

  2. Changes
    - Add trial_started_at column to track when trial begins
    - Add trial_ends_at column to track when trial expires
    - Add is_trial_active boolean for easy checking
    - Add has_active_subscription boolean to bypass trial check

  3. Notes
    - Trial starts when user creates account (set by trigger)
    - Trial lasts 7 days from trial_started_at
    - Coaches and admins are exempt from trial restrictions
    - Users with active subscription bypass trial check
*/

-- Add trial tracking columns
DO $$
BEGIN
  -- Add trial_started_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN trial_started_at timestamptz DEFAULT now();
  END IF;

  -- Add trial_ends_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '7 days');
  END IF;

  -- Add is_trial_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_trial_active'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN is_trial_active boolean DEFAULT true;
  END IF;

  -- Add has_active_subscription
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'has_active_subscription'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN has_active_subscription boolean DEFAULT false;
  END IF;
END $$;

-- Update existing profiles to set trial dates
UPDATE profiles
SET 
  trial_started_at = COALESCE(trial_started_at, created_at),
  trial_ends_at = COALESCE(trial_ends_at, created_at + interval '7 days'),
  is_trial_active = COALESCE(is_trial_active, true)
WHERE trial_started_at IS NULL OR trial_ends_at IS NULL;

-- Create function to check and update trial status
CREATE OR REPLACE FUNCTION check_trial_status(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record RECORD;
  trial_active boolean;
BEGIN
  SELECT 
    role,
    trial_ends_at,
    has_active_subscription,
    is_trial_active
  INTO profile_record
  FROM profiles
  WHERE id = user_id;

  -- Coaches and admins always have access
  IF profile_record.role IN ('coach', 'admin') THEN
    RETURN true;
  END IF;

  -- Users with active subscription have access
  IF profile_record.has_active_subscription THEN
    RETURN true;
  END IF;

  -- Check if trial has expired
  IF now() > profile_record.trial_ends_at THEN
    -- Update is_trial_active to false
    UPDATE profiles
    SET is_trial_active = false
    WHERE id = user_id;
    
    RETURN false;
  END IF;

  -- Trial is still active
  RETURN true;
END;
$$;
