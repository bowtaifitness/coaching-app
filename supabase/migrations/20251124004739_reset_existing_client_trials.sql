/*
  # Reset Existing Client Trials

  1. Purpose
    - Clear all trial and subscription data for existing clients
    - Prevent charging clients who signed up before auto-subscribe feature
    - Allow existing clients to activate fresh trials on next login

  2. Changes
    - Clear trial_started_at and trial_ends_at for all clients
    - Clear subscription_scheduled_at to prevent auto-charging
    - Clear subscription_price_id
    - Set auto_subscribe_after_trial to true for future signups
    - Remove subscription_tier for clients who were on basic tier

  3. What This Does
    - Existing clients will need to re-enter payment info to start a fresh trial
    - New auto-subscribe rules will apply to their new trial
    - Protects existing users from unexpected charges

  4. Security
    - Only affects client role users
    - Preserves all other profile data
    - Does not affect coaches or admins
*/

-- Clear trial and subscription data for all existing clients
UPDATE profiles
SET 
  trial_started_at = NULL,
  trial_ends_at = NULL,
  subscription_scheduled_at = NULL,
  subscription_price_id = NULL,
  auto_subscribe_after_trial = true,
  subscription_tier = NULL,
  updated_at = now()
WHERE role = 'client';

-- Log the reset action
DO $$
DECLARE
  affected_count integer;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE 'Reset trials for % client profiles', affected_count;
END $$;