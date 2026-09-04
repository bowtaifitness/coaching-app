/*
  # Add Admin Client Deletion Functionality

  1. New Functions
    - `delete_client_completely` - Admin function to permanently delete a client and all related data
      - Deletes from: trainer_assignments, client_intake_forms, workout_progress, workout_exercises, 
        workouts, messages, performance_data, video_analyses, and profiles
      - Only callable by admin users
  
  2. Security
    - Function has SECURITY DEFINER to bypass RLS
    - Includes explicit check for admin role
    - Returns boolean indicating success
  
  3. Important Notes
    - This is a destructive operation that cannot be undone
    - All client data will be permanently erased
    - Foreign key relationships ensure data integrity during deletion
*/

-- Drop function if it exists
DROP FUNCTION IF EXISTS delete_client_completely(uuid);

-- Create function to delete client and all related data
CREATE OR REPLACE FUNCTION delete_client_completely(client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get the role of the user calling this function
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Only allow admins to delete clients
  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete clients';
  END IF;

  -- Verify the target user is actually a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout progress
  DELETE FROM workout_progress WHERE user_id = client_id;
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises 
  WHERE workout_id IN (
    SELECT id FROM workouts WHERE user_id = client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts WHERE user_id = client_id;
  
  -- Delete trainer assignments
  DELETE FROM trainer_assignments WHERE client_id = client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms WHERE client_id = client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages WHERE sender_id = client_id OR receiver_id = client_id;
  
  -- Delete performance data
  DELETE FROM performance_data WHERE user_id = client_id;
  
  -- Delete video analyses
  DELETE FROM video_analyses WHERE user_id = client_id;
  
  -- Finally, delete the profile and auth user
  DELETE FROM profiles WHERE id = client_id;
  
  -- Note: The auth.users deletion is handled by the profile deletion trigger
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return false
    RAISE WARNING 'Error deleting client: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;