/*
  # Add Automatic Profile Creation Trigger

  1. Purpose
    - Automatically creates a profile when a user confirms their email
    - Handles email confirmation flow properly
    - Ensures all authenticated users have a profile

  2. Changes
    - Creates a trigger function that runs when auth.users are inserted or updated
    - Only creates profile if user is confirmed (email_confirmed_at is set)
    - Uses user metadata to populate profile fields
    - Safely handles existing profiles with ON CONFLICT

  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only creates profiles for confirmed users
    - Preserves existing profile data if profile already exists
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_user_confirmation()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the user has confirmed their email
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Insert profile if it doesn't exist
    INSERT INTO public.profiles (
      id,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_confirmation();
