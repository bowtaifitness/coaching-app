/*
  # Remove auto-confirm email trigger
  
  This migration removes the auto-confirmation trigger to restore
  normal email confirmation flow.
  
  1. Changes
    - Drops the auto-confirm trigger
    - Drops the auto-confirm function
*/

-- Drop trigger
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;

-- Drop function
DROP FUNCTION IF EXISTS public.auto_confirm_user_email();
