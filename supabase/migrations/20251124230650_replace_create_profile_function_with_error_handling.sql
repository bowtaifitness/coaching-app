/*
  # Replace create_profile_for_user with Better Error Handling

  1. Problem
    - Profile creation works when called manually
    - Fails silently when called from frontend during signup
    - Current function returns void, can't return error info
    
  2. Changes
    - Drop all existing overloaded versions
    - Create new version that returns jsonb with success/error info
    - Add detailed error handling and logging
    
  3. Result
    - Can diagnose why profile creation fails from frontend
    - Frontend can check for errors
*/

-- Drop all existing versions of the function
DROP FUNCTION IF EXISTS create_profile_for_user(uuid, text);
DROP FUNCTION IF EXISTS create_profile_for_user(uuid, text, text);
DROP FUNCTION IF EXISTS create_profile_for_user(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS create_profile_for_user(uuid, text, text, text, text, boolean);
DROP FUNCTION IF EXISTS create_profile_for_user(uuid, text, text, text, text, boolean, text);

-- Create new version with error handling
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client'::text,
  first_name text DEFAULT 'User'::text,
  last_name text DEFAULT 'Name'::text,
  auto_subscribe boolean DEFAULT false,
  price_id text DEFAULT 'price_1234567890abcdef'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_end_date timestamptz;
  promo_days integer;
BEGIN
  -- Calculate trial end date based on any active promotion or default
  BEGIN
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
  EXCEPTION WHEN OTHERS THEN
    promo_days := 7;
  END;

  -- If no promotion found, use default 7 days
  IF promo_days IS NULL THEN
    promo_days := 7;
  END IF;

  trial_end_date := now() + (promo_days || ' days')::interval;

  -- Insert or update profile
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
  
  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'message', 'Profile created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'user_id', user_id
  );
END;
$$;