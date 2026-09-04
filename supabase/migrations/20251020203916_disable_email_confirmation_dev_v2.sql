/*
  # Disable Email Confirmation for Development Environment
  
  1. Changes
    - Auto-confirms all unconfirmed users
    - Creates a trigger to auto-confirm new signups
  
  2. Security
    - This is appropriate for development environments
    - Should not be used in production
*/

-- Auto-confirm all existing unconfirmed users
UPDATE auth.users 
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;

-- Create function to auto-confirm new users
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-confirm on insert
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;
CREATE TRIGGER auto_confirm_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email();
