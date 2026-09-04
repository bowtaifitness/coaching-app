/*
  # Disable email confirmation requirement
  
  This migration creates a trigger that automatically confirms user emails
  immediately upon signup, allowing users to sign in without clicking
  confirmation links.
  
  1. Changes
    - Creates a trigger function to auto-confirm emails on insert
    - Adds trigger to auth.users table
  
  2. Security
    - Users can sign up and log in immediately
    - Email addresses are still collected
    - Can be reverted by dropping the trigger
*/

-- Function to auto-confirm emails on user creation
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically confirm the email (confirmed_at is a generated column)
  NEW.email_confirmed_at := NOW();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

-- Create trigger that runs BEFORE insert
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_users();

-- Confirm any existing unconfirmed users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
