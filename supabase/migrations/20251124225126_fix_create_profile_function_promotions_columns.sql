/*
  # Fix create_profile_for_user Function - Correct Promotions Columns

  1. Problem
    - Function references non-existent promotions columns:
      * trial_days (doesn't exist)
      * starts_at (should be start_date)
      * ends_at (should be end_date)
      * deleted_at (doesn't exist)
    - Function references non-existent profiles column:
      * trial_starts_at (should be trial_started_at)
    
  2. Changes
    - Use correct promotions columns: discount_type, discount_value, start_date, end_date
    - Use correct profiles column: trial_started_at
    - Only look for 'free_days' discount type promotions
    - Simplify logic to work with actual schema

  3. Result
    - Profile creation will succeed during signup
    - Users can complete intake form
*/

CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client'::text,
  first_name text DEFAULT 'User'::text,
  last_name text DEFAULT 'Name'::text,
  auto_subscribe boolean DEFAULT false,
  price_id text DEFAULT 'price_1234567890abcdef'::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_end_date timestamptz;
  promo_days integer;
BEGIN
  -- Calculate trial end date based on any active promotion or default
  SELECT 
    CASE 
      WHEN p.discount_type = 'free_days' THEN p.discount_value
      ELSE 7
    END INTO promo_days
  FROM promotions p
  WHERE p.is_active = true
    AND now() BETWEEN p.start_date AND p.end_date
    AND p.discount_type = 'free_days'
  ORDER BY p.discount_value DESC
  LIMIT 1;

  -- If no promotion found, use default 7 days
  IF promo_days IS NULL THEN
    promo_days := 7;
  END IF;

  trial_end_date := now() + (promo_days || ' days')::interval;

  INSERT INTO public.profiles (
    id, 
    email, 
    role, 
    first_name, 
    last_name, 
    trial_started_at,
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
$$;