/*
  # Make Auto-Subscribe Default for All Clients

  1. Purpose
    - Remove opt-in checkbox requirement for auto-subscription
    - All clients will automatically be subscribed after their trial ends
    - Trial length is flexible based on promotions (7 days default, 30 days for Cyber Monday, etc.)

  2. Changes
    - Change auto_subscribe_after_trial default to true for all clients
    - Update existing client profiles to have auto_subscribe_after_trial = true
    - Ensure subscription_scheduled_at is set based on trial_ends_at for all clients

  3. How It Works
    - When client signs up, trial_ends_at is set based on active promotion or default 7 days
    - subscription_scheduled_at is automatically set to match trial_ends_at
    - After trial expires (checked daily), subscription is automatically created and charged
    - No checkbox needed - clients are notified that subscription auto-starts after trial

  4. Security
    - No RLS changes needed
    - Existing policies cover these fields
*/

-- Update default value for new profiles
ALTER TABLE profiles 
ALTER COLUMN auto_subscribe_after_trial SET DEFAULT true;

-- Update all existing client profiles to auto-subscribe
UPDATE profiles
SET auto_subscribe_after_trial = true,
    subscription_price_id = COALESCE(subscription_price_id, 'price_1SH5FbDIXnZQYlAbPgmJO008'),
    subscription_scheduled_at = COALESCE(subscription_scheduled_at, trial_ends_at)
WHERE role = 'client'
  AND subscription_tier IS NULL
  AND trial_ends_at IS NOT NULL;

-- Ensure all future clients get auto-subscribe by default
COMMENT ON COLUMN profiles.auto_subscribe_after_trial IS 
  'Always true for clients - subscription automatically starts after trial unless cancelled';
