/*
  # Add Force Delete User by Email Function

  1. Purpose
    - Create admin function to completely delete a user by email
    - Removes both auth.users record and profiles record
    - Used for cleaning up problematic accounts

  2. Changes
    - Creates admin_force_delete_user_by_email function
    - Deletes from profiles table first
    - Then deletes from auth.users table
    - Returns success/error message

  3. Security
    - Function runs with SECURITY DEFINER (elevated privileges)
    - Only accessible via direct function call or edge function
*/

CREATE OR REPLACE FUNCTION admin_force_delete_user_by_email(user_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  target_user_id UUID;
  profile_deleted BOOLEAN := FALSE;
  auth_deleted BOOLEAN := FALSE;
BEGIN
  -- Find user ID from profiles
  SELECT id INTO target_user_id
  FROM profiles
  WHERE email = user_email;

  -- If profile exists, delete it
  IF target_user_id IS NOT NULL THEN
    DELETE FROM profiles WHERE id = target_user_id;
    profile_deleted := TRUE;
  END IF;

  -- Find user in auth.users if not found in profiles
  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = user_email;
  END IF;

  -- Delete from auth.users if user exists
  IF target_user_id IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = target_user_id;
    auth_deleted := TRUE;
  END IF;

  -- Return result
  IF profile_deleted OR auth_deleted THEN
    RETURN json_build_object(
      'success', TRUE,
      'message', 'User deleted successfully',
      'profile_deleted', profile_deleted,
      'auth_deleted', auth_deleted,
      'user_id', target_user_id
    );
  ELSE
    RETURN json_build_object(
      'success', FALSE,
      'message', 'No user found with this email',
      'profile_deleted', FALSE,
      'auth_deleted', FALSE
    );
  END IF;
END;
$$;