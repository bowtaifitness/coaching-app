/*
  # Fix Client Deletion with Proper CASCADE Rules

  1. Changes
    - Drop the problematic delete_client_completely function
    - Add CASCADE rules to foreign keys (except Stripe tables which use text IDs)
    - Add admin DELETE policy on profiles table
    - Stripe data will be handled separately since it uses string customer_ids
    
  2. Security
    - Only admins can delete client profiles via RLS policy
*/

-- Drop the old function
DROP FUNCTION IF EXISTS delete_client_completely(uuid);

-- Update foreign key constraints to CASCADE where appropriate

-- Workouts: CASCADE delete when client is deleted
ALTER TABLE workouts DROP CONSTRAINT IF EXISTS workouts_client_id_fkey;
ALTER TABLE workouts ADD CONSTRAINT workouts_client_id_fkey 
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Performance metrics: CASCADE delete when client is deleted  
ALTER TABLE performance_metrics DROP CONSTRAINT IF EXISTS performance_metrics_client_id_fkey;
ALTER TABLE performance_metrics ADD CONSTRAINT performance_metrics_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Swing analyses: CASCADE delete when client is deleted
ALTER TABLE swing_analyses DROP CONSTRAINT IF EXISTS swing_analyses_client_id_fkey;
ALTER TABLE swing_analyses ADD CONSTRAINT swing_analyses_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Messages: CASCADE delete when sender or receiver is deleted
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Workout exercises: CASCADE through workouts
ALTER TABLE workout_exercises DROP CONSTRAINT IF EXISTS workout_exercises_workout_id_fkey;
ALTER TABLE workout_exercises ADD CONSTRAINT workout_exercises_workout_id_fkey
  FOREIGN KEY (workout_id) REFERENCES workouts(id) ON DELETE CASCADE;

-- Stripe customers: CASCADE delete when user is deleted
ALTER TABLE stripe_customers DROP CONSTRAINT IF EXISTS stripe_customers_user_id_fkey;
ALTER TABLE stripe_customers ADD CONSTRAINT stripe_customers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Add a trigger to handle Stripe subscription/order deletion when customer is deleted
-- (since they use text customer_id from Stripe, not our bigint id)
CREATE OR REPLACE FUNCTION delete_stripe_data_on_customer_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete subscriptions with this Stripe customer_id
  DELETE FROM stripe_subscriptions WHERE customer_id = OLD.customer_id;
  
  -- Delete orders with this Stripe customer_id
  DELETE FROM stripe_orders WHERE customer_id = OLD.customer_id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_delete_stripe_data ON stripe_customers;
CREATE TRIGGER trigger_delete_stripe_data
  BEFORE DELETE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION delete_stripe_data_on_customer_delete();

-- Add DELETE policy for admins on profiles table
DROP POLICY IF EXISTS "Admins can delete client profiles" ON profiles;
CREATE POLICY "Admins can delete client profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
    )
    AND role = 'client'
  );