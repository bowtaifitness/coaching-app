/*
  # Fix Profile Creation by Removing Old Trigger System

  1. Problem
    - Two systems trying to create profiles simultaneously:
      * handle_user_confirmation trigger (old, incomplete)
      * create_profile_for_user RPC function (new, complete)
    - The trigger creates profile with minimal fields
    - The RPC call then fails or conflicts
    - Getting "Database error saving new user"

  2. Changes
    - Remove handle_user_confirmation trigger entirely
    - Keep auto_confirm_email_trigger (BEFORE INSERT)
    - Rely on create_profile_for_user RPC in AuthContext
    - RPC handles all fields including trial dates, subscription setup, etc.

  3. Result
    - Single, unified profile creation path
    - All profile fields properly initialized
    - No conflicts between trigger and RPC
*/

-- Drop the old profile creation trigger
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Drop the old function (no longer needed)
DROP FUNCTION IF EXISTS handle_user_confirmation();