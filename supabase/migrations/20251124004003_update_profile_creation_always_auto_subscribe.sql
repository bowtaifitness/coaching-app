/*
  # Update Profile Creation to Always Auto-Subscribe Clients

  1. Purpose
    - Remove checkbox requirement - all clients auto-subscribe by default
    - Always set subscription_scheduled_at to trial_ends_at for clients
    - Support flexible trial periods (7 days, 30 days for Cyber Monday, etc.)

  2. Changes
    - Update create_profile_for_user function to always enable auto-subscribe for clients
    - Always set subscription_price_id for clients
    - Always set subscription_scheduled_at to match trial_ends_at
    - Support promotional trial periods from promotions table

  3. How It Works
    - When client signs up, checks for active promotion with trial extension
    - Sets trial_ends_at based on promotion (e.g., 30 days for Cyber Monday) or default 7 days
    - Automatically sets subscription to start when trial ends
    - No checkbox needed - clients are notified during signup

  4. Security
    - SECURITY DEFINER function ensures proper execution
    - Only affects client role profiles
*/

-- Update function to always auto-subscribe clients
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name',
  auto_subscribe boolean DEFAULT true
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
    CASE WHEN user_role = 'client' THEN true ELSE false END,
    CASE WHEN user_role = 'client' THEN default_price_id ELSE NULL END,
    CASE WHEN user_role = 'client' THEN trial_end_date ELSE NULL END,
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
    auto_subscribe_after_trial = EXCLUDED.auto_subscribe_after_trial,
    subscription_price_id = EXCLUDED.subscription_price_id,
    subscription_scheduled_at = EXCLUDED.subscription_scheduled_at,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger function to always pass true for clients
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

  -- Always auto-subscribe clients (ignore metadata checkbox)
  PERFORM create_profile_for_user(
    NEW.id,
    NEW.email,
    user_role,
    user_first_name,
    user_last_name,
    user_role = 'client'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;