/*
  # Add Stripe integration fields to profiles table

  1. New Columns
    - `subscription_status` (text) - Current subscription status (active, canceled, etc.)
    - `subscription_id` (text) - Stripe subscription ID
    - `subscription_price_id` (text) - Stripe price ID for the subscription
    - `subscription_start_date` (timestamp) - When subscription started
    - `subscription_end_date` (timestamp) - When subscription ends/ended

  2. Security
    - No additional RLS policies needed as existing policies cover these fields

  3. Indexes
    - Add index on stripe_customer_id for faster lookups
    - Add index on subscription_status for filtering
*/

-- Add subscription-related fields to profiles table
DO $$
BEGIN
  -- Add subscription_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_status text DEFAULT 'inactive';
  END IF;

  -- Add subscription_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_id text;
  END IF;

  -- Add subscription_price_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_price_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_price_id text;
  END IF;

  -- Add subscription_start_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_start_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_start_date timestamptz;
  END IF;

  -- Add subscription_end_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_end_date timestamptz;
  END IF;
END $$;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);

-- Add constraint for subscription_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_subscription_status_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_subscription_status_check 
    CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due', 'unpaid', 'trialing'));
  END IF;
END $$;