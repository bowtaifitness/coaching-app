/*
  # Fix auto-confirm trigger to use AFTER instead of BEFORE
  
  This migration fixes the auto-confirmation trigger by using AFTER INSERT
  instead of BEFORE INSERT to avoid conflicts with Supabase's internal
  user creation process.
  
  1. Changes
    - Drops the BEFORE INSERT trigger
    - Creates an AFTER INSERT trigger
    - Updates the function to work with AFTER trigger
*/

-- Drop the problematic BEFORE trigger
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_new_users();

-- Create new function for AFTER trigger
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email_after_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-confirm the email after user is created
  IF NEW.email_confirmed_at IS NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create AFTER INSERT trigger
CREATE TRIGGER on_auth_user_created_auto_confirm_after
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email_after_insert();
