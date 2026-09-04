/*
  # Reset All Client Trial Dates for Beta Testing

  1. Purpose
    - Reset trial dates for all existing clients
    - Apply current active promotion or default 7-day trial
    - Allow beta testers to get a fresh trial period

  2. Changes
    - Update trial_started_at to now
    - Calculate new trial_ends_at based on active promotions or default 7 days
    - Set is_trial_active to true
    - Clear trial_extended_until
    - Keep subscription_tier as NULL (clients in trial period)

  3. How It Works
    - Checks for active promotions with free trial days
    - If promotion exists, extends trial by promotion amount
    - Otherwise, applies default 7-day trial

  4. Security
    - Only affects client role profiles
    - Does not modify coach or admin accounts
*/

UPDATE profiles
SET 
  trial_started_at = now(),
  trial_ends_at = COALESCE(
    (SELECT now() + (p.discount_value || ' days')::interval
     FROM promotions p
     WHERE p.is_active = true
       AND now() BETWEEN p.start_date AND p.end_date
       AND p.discount_type = 'free_days'
     ORDER BY p.discount_value DESC
     LIMIT 1),
    now() + interval '7 days'
  ),
  is_trial_active = true,
  has_active_subscription = false,
  trial_extended_until = NULL,
  auto_subscribe_after_trial = false,
  subscription_price_id = NULL,
  subscription_scheduled_at = NULL,
  updated_at = now()
WHERE role = 'client';