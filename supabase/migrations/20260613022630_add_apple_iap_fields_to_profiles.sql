-- Add Apple In-App Purchase tracking fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS apple_product_id text,
  ADD COLUMN IF NOT EXISTS apple_transaction_id text,
  ADD COLUMN IF NOT EXISTS apple_subscription_expires_at timestamptz;

-- Index for looking up users by Apple transaction
CREATE INDEX IF NOT EXISTS idx_profiles_apple_transaction_id
  ON profiles (apple_transaction_id)
  WHERE apple_transaction_id IS NOT NULL;
