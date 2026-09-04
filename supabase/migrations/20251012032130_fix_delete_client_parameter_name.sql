/*
  # Fix Delete Client Function - Keep Original Parameter Name

  1. Changes
    - Keep parameter name as client_id for RPC compatibility
    - Use table aliases to avoid ambiguous column references
    - Ensure all DELETE statements properly qualify columns
*/

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
  SELECT p.role INTO calling_user_role
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Only allow admins to delete clients
  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete clients';
  END IF;

  -- Verify the target user is actually a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = client_id AND p.role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises we
  WHERE we.workout_id IN (
    SELECT w.id FROM workouts w WHERE w.client_id = delete_client_completely.client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts w WHERE w.client_id = delete_client_completely.client_id;
  
  -- Delete coach-client assignments
  DELETE FROM coach_client_assignments cca WHERE cca.client_id = delete_client_completely.client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms cif WHERE cif.user_id = delete_client_completely.client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages m WHERE m.sender_id = delete_client_completely.client_id OR m.receiver_id = delete_client_completely.client_id;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics pm WHERE pm.client_id = delete_client_completely.client_id;
  
  -- Delete swing analyses (video analyses)
  DELETE FROM swing_analyses sa WHERE sa.client_id = delete_client_completely.client_id;
  
  -- Delete Stripe-related data
  -- First delete subscriptions and orders related to this customer
  DELETE FROM stripe_subscriptions ss
  WHERE ss.customer_id IN (
    SELECT sc.id FROM stripe_customers sc WHERE sc.user_id = delete_client_completely.client_id
  );
  
  DELETE FROM stripe_orders so
  WHERE so.customer_id IN (
    SELECT sc.id FROM stripe_customers sc WHERE sc.user_id = delete_client_completely.client_id
  );
  
  -- Then delete the customer record
  DELETE FROM stripe_customers sc WHERE sc.user_id = delete_client_completely.client_id;
  
  -- Finally, delete the profile (this should cascade to auth.users via trigger)
  DELETE FROM profiles p WHERE p.id = delete_client_completely.client_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception so the error message is visible
    RAISE EXCEPTION 'Error deleting client: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;