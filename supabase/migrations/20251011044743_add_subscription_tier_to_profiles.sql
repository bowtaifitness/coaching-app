/*
  # Add Subscription Tier to Profiles

  1. Purpose
    - Add a subscription_tier field to distinguish between basic and premium coaching tiers
    - Basic tier clients can access standard programs
    - Premium tier clients get custom programs from coaches

  2. Changes
    - Add subscription_tier column to profiles table
    - Set default to 'basic' for existing users
    - Add check constraint for valid tier values

  3. Notes
    - Valid values are 'basic' and 'premium'
    - Existing clients will default to 'basic' tier
    - Coaches and admins don't need a tier (only applies to clients)
*/

-- Add subscription_tier column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN subscription_tier text DEFAULT 'basic';
    
    -- Add check constraint for valid subscription tiers
    ALTER TABLE profiles 
    ADD CONSTRAINT subscription_tier_check 
    CHECK (subscription_tier IN ('basic', 'premium'));
  END IF;
END $$;
