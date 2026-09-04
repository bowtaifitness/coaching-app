/*
  # Fix Admin Client Deletion Function

  1. Changes
    - Update table references to match actual schema
    - Use correct column names for each table
    - Add Stripe-related data deletion
  
  2. Tables Updated
    - workouts: uses client_id
    - workout_exercises: delete via workout_id relationship
    - coach_client_assignments: uses client_id
    - client_intake_forms: uses user_id
    - messages: uses sender_id and receiver_id
    - performance_metrics: uses client_id
    - swing_analyses: uses client_id
    - stripe_customers: uses user_id
    - stripe_subscriptions: delete via customer relationship
    - stripe_orders: delete via customer relationship
*/

-- Drop and recreate the function with correct table names
DROP FUNCTION IF EXISTS delete_client_completely(uuid);

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
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises 
  WHERE workout_id IN (
    SELECT id FROM workouts WHERE client_id = client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts WHERE client_id = client_id;
  
  -- Delete coach-client assignments
  DELETE FROM coach_client_assignments WHERE client_id = client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms WHERE user_id = client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages WHERE sender_id = client_id OR receiver_id = client_id;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics WHERE client_id = client_id;
  
  -- Delete swing analyses (video analyses)
  DELETE FROM swing_analyses WHERE client_id = client_id;
  
  -- Delete Stripe-related data
  -- First delete subscriptions and orders related to this customer
  DELETE FROM stripe_subscriptions 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = client_id
  );
  
  DELETE FROM stripe_orders 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = client_id
  );
  
  -- Then delete the customer record
  DELETE FROM stripe_customers WHERE user_id = client_id;
  
  -- Finally, delete the profile (this should cascade to auth.users via trigger)
  DELETE FROM profiles WHERE id = client_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception so the error message is visible
    RAISE EXCEPTION 'Error deleting client: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;