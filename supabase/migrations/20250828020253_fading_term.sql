/*
  # Add Stripe customer ID to profiles

  1. Changes
    - Add `stripe_customer_id` column to profiles table
    - This will store the Stripe customer ID for each user

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;
END $$;