/*
  # Fix Profile Creation Trigger to Include Email
  
  1. Purpose
    - Updates the profile creation trigger to include the user's email
    - Ensures profiles have all necessary fields when created after email confirmation
  
  2. Changes
    - Modifies handle_user_confirmation() to insert email field
    - Email is taken from NEW.email (the auth.users email field)
  
  3. Impact
    - New users will have their email properly stored in profiles table
    - Existing users are not affected (this is for new signups)
*/

CREATE OR REPLACE FUNCTION public.handle_user_confirmation()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the user has confirmed their email
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Insert profile if it doesn't exist
    INSERT INTO public.profiles (
      id,
      email,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
