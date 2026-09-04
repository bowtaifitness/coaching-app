/*
  # Fix Signup Issues by Removing Conflicting Triggers

  1. Problem
    - Multiple overlapping triggers on auth.users causing signup failures
    - auto_confirm_user_email_after_insert does an UPDATE during INSERT which can fail
    - Getting "Database error" on all signups regardless of email

  2. Changes
    - Drop auto_confirm_user_email_after_insert trigger (conflicts with BEFORE trigger)
    - Keep auto_confirm_email_trigger (BEFORE INSERT - sets email_confirmed_at)
    - Keep handle_user_confirmation for profile creation
    - Simplify to single confirmation flow

  3. Result
    - Users will be auto-confirmed on signup via BEFORE trigger
    - Profile will be created automatically
    - No conflicting UPDATE operations during INSERT
*/

-- Drop the problematic AFTER INSERT trigger that tries to UPDATE during INSERT
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm_after ON auth.users;

-- Drop the function too since it's no longer needed
DROP FUNCTION IF EXISTS auto_confirm_user_email_after_insert();