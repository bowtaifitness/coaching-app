/*
  # Add Auto-Subscription Fields

  1. Changes to profiles table
    - Add `auto_subscribe_after_trial` boolean to track if user agreed to auto-subscription
    - Add `subscription_price_id` to store which subscription they should be enrolled in
    - Add `subscription_scheduled_at` timestamp for when subscription should activate

  2. Security
    - No RLS changes needed - existing policies cover these fields
*/

-- Add auto-subscription fields to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS auto_subscribe_after_trial boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_price_id text,
ADD COLUMN IF NOT EXISTS subscription_scheduled_at timestamptz;