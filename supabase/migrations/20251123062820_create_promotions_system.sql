/*
  # Create Promotions System

  1. New Tables
    - `promotions`
      - `id` (uuid, primary key)
      - `name` (text) - Display name for the promotion (e.g., "Cyber Monday Sale")
      - `code` (text, unique, nullable) - Optional promo code
      - `discount_type` (text) - 'percentage' or 'free_days'
      - `discount_value` (integer) - Percentage off or number of free days
      - `start_date` (timestamptz) - When promotion becomes active
      - `end_date` (timestamptz) - When promotion expires
      - `is_active` (boolean) - Manual override to enable/disable
      - `max_uses` (integer, nullable) - Optional limit on total uses
      - `current_uses` (integer) - Counter for how many times used
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
    
    - `user_promotions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `promotion_id` (uuid, foreign key to promotions)
      - `applied_at` (timestamptz)
      - `expires_at` (timestamptz, nullable) - When the promotion benefit expires for this user

  2. Security
    - Enable RLS on both tables
    - Admins can manage promotions
    - All authenticated users can view active promotions
    - Users can view their own applied promotions
*/

-- Create promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'free_days')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  max_uses integer,
  current_uses integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Create user_promotions table
CREATE TABLE IF NOT EXISTS user_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  promotion_id uuid REFERENCES promotions(id) ON DELETE CASCADE NOT NULL,
  applied_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(user_id, promotion_id)
);

-- Enable RLS
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_promotions ENABLE ROW LEVEL SECURITY;

-- Promotions policies
CREATE POLICY "Admins can manage all promotions"
  ON promotions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "All users can view active promotions"
  ON promotions FOR SELECT
  TO authenticated
  USING (
    is_active = true
    AND now() BETWEEN start_date AND end_date
  );

-- User promotions policies
CREATE POLICY "Admins can view all user promotions"
  ON user_promotions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own promotions"
  ON user_promotions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert user promotions"
  ON user_promotions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_promotions_user ON user_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_promotions_promotion ON user_promotions(promotion_id);

-- Function to get currently active promotions
CREATE OR REPLACE FUNCTION get_active_promotions()
RETURNS SETOF promotions
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT *
  FROM promotions
  WHERE is_active = true
    AND now() BETWEEN start_date AND end_date
    AND (max_uses IS NULL OR current_uses < max_uses)
  ORDER BY discount_value DESC;
$$;

-- Function to apply promotion to user
CREATE OR REPLACE FUNCTION apply_promotion_to_user(
  p_user_id uuid,
  p_promotion_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion promotions;
  v_expires_at timestamptz;
  v_result json;
BEGIN
  -- Get promotion details
  SELECT * INTO v_promotion
  FROM promotions
  WHERE id = p_promotion_id
    AND is_active = true
    AND now() BETWEEN start_date AND end_date
    AND (max_uses IS NULL OR current_uses < max_uses);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Promotion not found or not valid');
  END IF;

  -- Check if user already used this promotion
  IF EXISTS (
    SELECT 1 FROM user_promotions
    WHERE user_id = p_user_id AND promotion_id = p_promotion_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Promotion already applied');
  END IF;

  -- Calculate expiration if it's a free_days promotion
  IF v_promotion.discount_type = 'free_days' THEN
    v_expires_at := now() + (v_promotion.discount_value || ' days')::interval;
  END IF;

  -- Apply promotion to user
  INSERT INTO user_promotions (user_id, promotion_id, expires_at)
  VALUES (p_user_id, p_promotion_id, v_expires_at);

  -- Increment usage counter
  UPDATE promotions
  SET current_uses = current_uses + 1
  WHERE id = p_promotion_id;

  -- If free_days promotion, extend trial
  IF v_promotion.discount_type = 'free_days' THEN
    UPDATE profiles
    SET trial_end_date = GREATEST(
      COALESCE(trial_end_date, now()),
      now()
    ) + (v_promotion.discount_value || ' days')::interval
    WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'promotion', row_to_json(v_promotion),
    'expires_at', v_expires_at
  );
END;
$$;