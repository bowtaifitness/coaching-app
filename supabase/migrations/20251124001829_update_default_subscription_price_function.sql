/*
  # Update Profile Creation to Use Environment Variable for Price ID

  1. Changes
    - Updates create_profile_for_user function to use a placeholder
    - The actual price ID should be set via environment variable
    - Function will use the value passed to it, defaulting to placeholder

  2. Purpose
    - Allows easy configuration without code changes
    - Price ID can be updated via environment variables
*/

-- Update function to accept price_id parameter with default
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name',
  auto_subscribe boolean DEFAULT false,
  price_id text DEFAULT 'price_1234567890abcdef'
)
RETURNS void AS $$
DECLARE
  trial_end_date timestamptz;
BEGIN
  -- Calculate trial end date based on any active promotion or default
  SELECT 
    CASE 
      WHEN p.trial_days IS NOT NULL 
      THEN now() + (p.trial_days || ' days')::interval
      ELSE now() + interval '7 days'
    END INTO trial_end_date
  FROM promotions p
  WHERE p.is_active = true
    AND now() BETWEEN p.starts_at AND p.ends_at
    AND p.deleted_at IS NULL
  ORDER BY p.trial_days DESC NULLS LAST
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
    auto_subscribe,
    CASE WHEN auto_subscribe AND user_role = 'client' 
      THEN price_id
      ELSE NULL 
    END,
    CASE WHEN auto_subscribe AND user_role = 'client'
      THEN trial_end_date
      ELSE NULL
    END,
    now(), 
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    auto_subscribe_after_trial = EXCLUDED.auto_subscribe_after_trial,
    subscription_price_id = EXCLUDED.subscription_price_id,
    subscription_scheduled_at = EXCLUDED.subscription_scheduled_at,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;