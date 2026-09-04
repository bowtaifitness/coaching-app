/*
  # Fix Ambiguous Column Reference in Delete Function

  1. Changes
    - Fix the DELETE statement that has ambiguous client_id reference
    - The issue is in the workout_exercises deletion subquery
    - Need to properly qualify the column names
*/

DROP FUNCTION IF EXISTS delete_client_completely(uuid);

CREATE OR REPLACE FUNCTION delete_client_completely(target_client_id uuid)
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
    WHERE id = target_client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises 
  WHERE workout_id IN (
    SELECT id FROM workouts WHERE workouts.client_id = target_client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts WHERE workouts.client_id = target_client_id;
  
  -- Delete coach-client assignments
  DELETE FROM coach_client_assignments WHERE coach_client_assignments.client_id = target_client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms WHERE client_intake_forms.user_id = target_client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages WHERE messages.sender_id = target_client_id OR messages.receiver_id = target_client_id;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics WHERE performance_metrics.client_id = target_client_id;
  
  -- Delete swing analyses (video analyses)
  DELETE FROM swing_analyses WHERE swing_analyses.client_id = target_client_id;
  
  -- Delete Stripe-related data
  -- First delete subscriptions and orders related to this customer
  DELETE FROM stripe_subscriptions 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE stripe_customers.user_id = target_client_id
  );
  
  DELETE FROM stripe_orders 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE stripe_customers.user_id = target_client_id
  );
  
  -- Then delete the customer record
  DELETE FROM stripe_customers WHERE stripe_customers.user_id = target_client_id;
  
  -- Finally, delete the profile (this should cascade to auth.users via trigger)
  DELETE FROM profiles WHERE profiles.id = target_client_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception so the error message is visible
    RAISE EXCEPTION 'Error deleting client: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;