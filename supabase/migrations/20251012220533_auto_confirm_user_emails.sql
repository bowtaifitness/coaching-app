/*
  # Auto-confirm user emails on signup
  
  This migration creates a trigger to automatically confirm user emails upon signup,
  bypassing the need for email confirmation links.
  
  1. Changes
    - Creates a function to auto-confirm emails
    - Creates a trigger on auth.users to run after insert
  
  2. Security
    - Only affects new user signups
    - Maintains existing user data
*/

-- Create function to auto-confirm emails
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm the email
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
  WHERE id = NEW.id
  AND email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;

-- Create trigger to auto-confirm emails on user creation
CREATE TRIGGER auto_confirm_email_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email();
