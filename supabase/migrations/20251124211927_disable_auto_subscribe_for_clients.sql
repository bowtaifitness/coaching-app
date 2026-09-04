/*
  # Disable Auto-Subscribe for All Clients

  1. Purpose
    - Remove automatic subscription after trial ends
    - Clients must manually subscribe after trial expires
    - Trial notifications will prompt users to subscribe before expiration

  2. Changes
    - Set auto_subscribe_after_trial to false for all clients
    - Remove subscription_scheduled_at (no automatic charging)
    - Keep trial period tracking (trial_starts_at, trial_ends_at)
    - Update profile creation function to not auto-subscribe

  3. Security
    - Updates only affect subscription behavior
    - RLS policies remain unchanged
*/

-- Update all existing client profiles to disable auto-subscribe
UPDATE profiles
SET 
  auto_subscribe_after_trial = false,
  subscription_scheduled_at = NULL,
  updated_at = now()
WHERE role = 'client';

-- Update the profile creation function to not auto-subscribe by default
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name',
  auto_subscribe boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
  trial_end_date timestamptz;
  default_price_id text := 'price_1SH5FbDIXnZQYlAbPgmJO008';
BEGIN
  -- Calculate trial end date based on any active promotion or default
  SELECT 
    CASE 
      WHEN p.discount_type = 'free_days' 
      THEN now() + (p.discount_value || ' days')::interval
      ELSE now() + interval '7 days'
    END INTO trial_end_date
  FROM promotions p
  WHERE p.is_active = true
    AND now() BETWEEN p.start_date AND p.end_date
    AND p.discount_type = 'free_days'
  ORDER BY p.discount_value DESC
  LIMIT 1;

  -- If no promotion found, use default 7 days
  IF trial_end_date IS NULL THEN
    trial_end_date := now() + interval '7 days';
  END IF;

  INSERT INTO public.profiles (
    id, 
    email, 
    role, 
    first_name, 
    last_name, 
    trial_starts_at,
    trial_ends_at,
    auto_subscribe_after_trial,
    subscription_price_id,
    subscription_scheduled_at,
    created_at, 
    updated_at
  )
  VALUES (
    user_id, 
    user_email, 
    user_role, 
    first_name, 
    last_name,
    now(),
    trial_end_date,
    false,  -- Never auto-subscribe
    NULL,   -- No price ID until manual subscription
    NULL,   -- No scheduled subscription
    now(), 
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    trial_starts_at = EXCLUDED.trial_starts_at,
    trial_ends_at = EXCLUDED.trial_ends_at,
    auto_subscribe_after_trial = false,
    subscription_price_id = NULL,
    subscription_scheduled_at = NULL,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to never auto-subscribe
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_first_name text;
  user_last_name text;
BEGIN
  -- Extract data from user metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'User');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name');

  -- Never auto-subscribe
  PERFORM create_profile_for_user(
    NEW.id,
    NEW.email,
    user_role,
    user_first_name,
    user_last_name,
    false  -- Never auto-subscribe
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;