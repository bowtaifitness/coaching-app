/*
  # Add Update Trial Period Function

  1. New Functions
    - `update_default_trial_period` - Allows admins to update the default trial period
      - Updates the create_profile_for_user function with new trial days
      - Updates the profiles table default for trial_ends_at column

  2. Security
    - Function is SECURITY DEFINER to allow schema modifications
    - No specific RLS policies needed as this modifies functions/schema

  3. Notes
    - Only affects NEW signups after the change
    - Existing users are not affected
    - Promotions can still override the default
*/

-- Create function to update the default trial period
CREATE OR REPLACE FUNCTION public.update_default_trial_period(new_trial_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate input
  IF new_trial_days < 1 OR new_trial_days > 365 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Trial period must be between 1 and 365 days'
    );
  END IF;

  -- Update the create_profile_for_user function
  EXECUTE format('
    CREATE OR REPLACE FUNCTION public.create_profile_for_user(
      user_id uuid,
      user_email text,
      user_role text DEFAULT ''client''::text,
      first_name text DEFAULT ''User''::text,
      last_name text DEFAULT ''Name''::text,
      auto_subscribe boolean DEFAULT false,
      price_id text DEFAULT ''price_1234567890abcdef''::text
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $func$
    DECLARE
      trial_end_date timestamptz;
      promo_days integer;
    BEGIN
      -- Calculate trial end date based on any active promotion or default
      BEGIN
        SELECT 
          CASE 
            WHEN p.discount_type = ''free_days'' THEN p.discount_value
            ELSE %s
          END INTO promo_days
        FROM promotions p
        WHERE p.is_active = true
          AND now() BETWEEN p.start_date AND p.end_date
          AND p.discount_type = ''free_days''
        ORDER BY p.discount_value DESC
        LIMIT 1;
      EXCEPTION WHEN OTHERS THEN
        promo_days := %s;
      END;

      -- If no promotion found, use default
      IF promo_days IS NULL THEN
        promo_days := %s;
      END IF;

      trial_end_date := now() + (promo_days || '' days'')::interval;

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
        CASE WHEN auto_subscribe AND user_role = ''client'' 
          THEN price_id
          ELSE NULL 
        END,
        CASE WHEN auto_subscribe AND user_role = ''client''
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
        ''success'', true,
        ''user_id'', user_id,
        ''message'', ''Profile created successfully''
      );

    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object(
        ''success'', false,
        ''error'', SQLERRM,
        ''user_id'', user_id
      );
    END;
    $func$;
  ', new_trial_days, new_trial_days, new_trial_days);

  -- Update the default value for trial_ends_at column
  EXECUTE format('
    ALTER TABLE profiles 
      ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval ''%s days'')
  ', new_trial_days);

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Trial period updated to ' || new_trial_days || ' days',
    'new_trial_days', new_trial_days
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_default_trial_period(integer) TO authenticated;
