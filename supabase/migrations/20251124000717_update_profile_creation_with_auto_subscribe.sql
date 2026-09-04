/*
  # Update Profile Creation with Auto-Subscribe Support

  1. Changes
    - Updates create_profile_for_user function to accept auto_subscribe parameter
    - Updates handle_new_user trigger to read auto_subscribe from user metadata
    - Sets subscription_price_id to default Golf Strength Training price
    - Sets subscription_scheduled_at to trial_ends_at when auto_subscribe is true

  2. Purpose
    - Enables automatic subscription enrollment after trial expiration
    - Stores user's consent to auto-subscribe in the database
*/

-- Update function to handle auto_subscribe
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
      THEN 'price_1234567890abcdef'
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

-- Update trigger function to pass auto_subscribe from user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_role text;
  user_first_name text;
  user_last_name text;
  user_auto_subscribe boolean;
BEGIN
  -- Extract data from user metadata
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'User');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name');
  user_auto_subscribe := COALESCE((NEW.raw_user_meta_data->>'auto_subscribe')::boolean, false);

  -- Call the create_profile_for_user function with auto_subscribe
  PERFORM create_profile_for_user(
    NEW.id,
    NEW.email,
    user_role,
    user_first_name,
    user_last_name,
    user_auto_subscribe
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;