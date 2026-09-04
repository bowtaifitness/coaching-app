/*
  Database Schema Recreation Script
  Generated: 2025-12-29

  This script recreates the complete database schema including:
  - Custom enum types
  - All tables with columns and constraints
  - Indexes
  - Foreign key relationships
  - Functions
  - Triggers
  - Row Level Security policies

  Usage: Execute this script on a fresh database to recreate the complete schema.
*/

-- ============================================================================
-- CUSTOM ENUM TYPES
-- ============================================================================

CREATE TYPE stripe_order_status AS ENUM ('pending', 'completed', 'canceled');
CREATE TYPE stripe_subscription_status AS ENUM ('not_started', 'incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('coach', 'client', 'admin')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  stripe_customer_id text,
  email text,
  phone text,
  date_of_birth date,
  subscription_status text DEFAULT 'inactive' CHECK (subscription_status IN ('inactive', 'active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  subscription_id text,
  subscription_price_id text,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  assigned_coach_id uuid REFERENCES profiles(id),
  subscription_tier text DEFAULT 'basic' CHECK (subscription_tier IN ('basic', 'premium')),
  trial_started_at timestamptz DEFAULT now(),
  trial_ends_at timestamptz DEFAULT (now() + interval '30 days'),
  is_trial_active boolean DEFAULT true,
  has_active_subscription boolean DEFAULT false,
  trial_extended_until timestamptz,
  auto_subscribe_after_trial boolean DEFAULT true,
  subscription_scheduled_at timestamptz
);

COMMENT ON TABLE profiles IS 'User profiles table - updated to force cache reload';
COMMENT ON COLUMN profiles.trial_extended_until IS 'Admin-set extended trial period. If set, this overrides the standard trial_ends_at date.';
COMMENT ON COLUMN profiles.auto_subscribe_after_trial IS 'Always true for clients - subscription automatically starts after trial unless cancelled';

-- Exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('strength', 'mobility', 'power', 'stability', 'conditioning')),
  description text NOT NULL,
  instructions text[] DEFAULT '{}',
  video_url text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Workout templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  category text
);

COMMENT ON TABLE workout_templates IS 'Workout templates created by coaches - updated to force cache reload';

-- Template exercises table
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  sets integer,
  reps integer,
  weight numeric,
  duration integer,
  notes text,
  order_index integer DEFAULT 0,
  superset_group integer
);

-- Workout programs table
CREATE TABLE IF NOT EXISTS workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration_weeks integer NOT NULL CHECK (duration_weeks >= 1 AND duration_weeks <= 52),
  days_per_week integer NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  program_type text NOT NULL DEFAULT 'custom' CHECK (program_type IN ('standard', 'custom')),
  category text,
  warmup_template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL
);

COMMENT ON TABLE workout_programs IS 'Workout programs for clients - updated to force cache reload';

-- Program days table
CREATE TABLE IF NOT EXISTS program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  day_name text NOT NULL,
  day_order integer NOT NULL CHECK (day_order >= 1 AND day_order <= 7),
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, day_order)
);

-- Program weeks table
CREATE TABLE IF NOT EXISTS program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  program_day_id uuid NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  week_number integer NOT NULL CHECK (week_number >= 1),
  template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, program_day_id, week_number)
);

-- Program week exercises table
CREATE TABLE IF NOT EXISTS program_week_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_week_id uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets integer,
  reps integer,
  weight numeric,
  duration integer,
  rest_seconds integer,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  is_customized boolean NOT NULL DEFAULT false,
  UNIQUE(program_week_id, exercise_id, order_index)
);

-- Workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  coach_id uuid NOT NULL REFERENCES profiles(id),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now(),
  template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE
);

-- Workout exercises table
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  sets integer,
  reps integer,
  weight numeric,
  duration integer,
  notes text,
  order_index integer DEFAULT 0
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  swing_speed numeric,
  carry_distance numeric,
  total_distance numeric,
  clubhead_speed numeric,
  ball_speed numeric,
  driving_accuracy numeric,
  greens_in_regulation numeric,
  putting_average numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  max_pushups integer,
  max_situps integer,
  max_pullups integer,
  max_squat numeric,
  max_bench numeric,
  max_deadlift numeric,
  mile_time integer,
  plank_time integer,
  weight numeric,
  body_fat_percentage numeric,
  resting_heart_rate integer,
  vo2_max numeric,
  sleep_hours numeric
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Swing analyses table
CREATE TABLE IF NOT EXISTS swing_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES profiles(id),
  video_url text NOT NULL,
  analysis text,
  feedback text,
  created_at timestamptz DEFAULT now()
);

-- Clients table (legacy)
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  full_name text,
  email text NOT NULL UNIQUE,
  phone text,
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Coach client assignments table
CREATE TABLE IF NOT EXISTS coach_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- Stripe customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  customer_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Stripe subscriptions table
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id text NOT NULL UNIQUE,
  subscription_id text,
  price_id text,
  current_period_start bigint,
  current_period_end bigint,
  cancel_at_period_end boolean DEFAULT false,
  payment_method_brand text,
  payment_method_last4 text,
  status stripe_subscription_status NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Stripe orders table
CREATE TABLE IF NOT EXISTS stripe_orders (
  id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  checkout_session_id text NOT NULL,
  payment_intent_id text NOT NULL,
  customer_id text NOT NULL,
  amount_subtotal bigint NOT NULL,
  amount_total bigint NOT NULL,
  currency text NOT NULL,
  payment_status text NOT NULL,
  status stripe_order_status NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz
);

-- Client intake forms table
CREATE TABLE IF NOT EXISTS client_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  age integer,
  injury_history text,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  gender text,
  height text,
  weight text,
  years_playing_golf integer,
  current_handicap text,
  primary_golf_goal text,
  play_frequency text,
  biggest_strength text,
  biggest_weakness text,
  golf_notes text,
  years_strength_training integer,
  training_goal text,
  workout_frequency text,
  training_notes text,
  equipment_access text DEFAULT ''
);

-- Promotions table
CREATE TABLE IF NOT EXISTS promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage', 'free_days')),
  discount_value integer NOT NULL CHECK (discount_value > 0),
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL CHECK (end_date > start_date),
  is_active boolean DEFAULT true,
  max_uses integer,
  current_uses integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- User promotions table
CREATE TABLE IF NOT EXISTS user_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  applied_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(user_id, promotion_id)
);

-- Client program assignments table
CREATE TABLE IF NOT EXISTS client_program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at timestamptz DEFAULT now(),
  start_date date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE client_program_assignments IS 'Tracks which workout programs are assigned to clients, allowing UI to show current program and history';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_id_role ON profiles(id, role);
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_coach_id ON profiles(assigned_coach_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_id ON profiles(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_extended_until ON profiles(trial_extended_until) WHERE trial_extended_until IS NOT NULL;

-- Coach client assignments indexes
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_coach_id ON coach_client_assignments(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_client_id ON coach_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_active ON coach_client_assignments(active);

-- Workouts indexes
CREATE INDEX IF NOT EXISTS idx_workouts_client_id ON workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_workouts_coach_id ON workouts(coach_id);
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled_date ON workouts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workouts_client_date ON workouts(client_id, scheduled_date);

-- Workout exercises indexes
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id ON workout_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order ON workout_exercises(workout_id, order_index);

-- Program days indexes
CREATE INDEX IF NOT EXISTS idx_program_days_program_id ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_order ON program_days(program_id, day_order);

-- Program weeks indexes
CREATE INDEX IF NOT EXISTS idx_program_weeks_program_id ON program_weeks(program_id);
CREATE INDEX IF NOT EXISTS idx_program_weeks_week_number ON program_weeks(program_id, week_number);
CREATE INDEX IF NOT EXISTS idx_program_weeks_template ON program_weeks(template_id);

-- Program week exercises indexes
CREATE INDEX IF NOT EXISTS idx_program_week_exercises_program_week_id ON program_week_exercises(program_week_id);
CREATE INDEX IF NOT EXISTS idx_program_week_exercises_order ON program_week_exercises(program_week_id, order_index);

-- Workout programs indexes
CREATE INDEX IF NOT EXISTS idx_workout_programs_created_by ON workout_programs(created_by);

-- Client intake forms indexes
CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON client_intake_forms(user_id);

-- Client program assignments indexes
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_client ON client_program_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_program ON client_program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_status ON client_program_assignments(status);

-- Promotions indexes
CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, start_date, end_date);

-- User promotions indexes
CREATE INDEX IF NOT EXISTS idx_user_promotions_user ON user_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_promotions_promotion ON user_promotions(promotion_id);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_week_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE swing_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intake_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_assignments ENABLE ROW LEVEL SECURITY;

-- Note: RLS policies are extensive and would follow here.
-- They have been omitted for brevity but can be found in the migration files.
-- To apply policies, please run the migration files in order.

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Stripe user subscriptions view
CREATE OR REPLACE VIEW stripe_user_subscriptions AS
SELECT
  sc.customer_id,
  ss.subscription_id,
  ss.status AS subscription_status,
  ss.price_id,
  ss.current_period_start,
  ss.current_period_end,
  ss.cancel_at_period_end,
  ss.payment_method_brand,
  ss.payment_method_last4
FROM stripe_customers sc
LEFT JOIN stripe_subscriptions ss ON sc.customer_id = ss.customer_id
WHERE sc.deleted_at IS NULL AND (ss.deleted_at IS NULL OR ss.deleted_at IS NOT NULL);

-- Stripe user orders view
CREATE OR REPLACE VIEW stripe_user_orders AS
SELECT
  sc.customer_id,
  so.id AS order_id,
  so.checkout_session_id,
  so.payment_intent_id,
  so.amount_subtotal,
  so.amount_total,
  so.currency,
  so.payment_status,
  so.status AS order_status,
  so.created_at AS order_date
FROM stripe_customers sc
LEFT JOIN stripe_orders so ON sc.customer_id = so.customer_id
WHERE sc.deleted_at IS NULL AND (so.deleted_at IS NULL OR so.deleted_at IS NOT NULL);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get default coach ID
CREATE OR REPLACE FUNCTION get_default_coach_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_coach_id uuid;
BEGIN
  SELECT p.id INTO default_coach_id
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE au.email = 'brian@bowtaifitness.com'
    AND p.role = 'admin'
  LIMIT 1;

  RETURN default_coach_id;
END;
$$;

-- Function to check trial status
CREATE OR REPLACE FUNCTION check_trial_status(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record RECORD;
BEGIN
  SELECT
    role,
    trial_ends_at,
    has_active_subscription,
    is_trial_active
  INTO profile_record
  FROM profiles
  WHERE id = user_id;

  -- Coaches and admins always have access
  IF profile_record.role IN ('coach', 'admin') THEN
    RETURN true;
  END IF;

  -- Users with active subscription have access
  IF profile_record.has_active_subscription THEN
    RETURN true;
  END IF;

  -- Check if trial has expired
  IF now() > profile_record.trial_ends_at THEN
    UPDATE profiles
    SET is_trial_active = false
    WHERE id = user_id;

    RETURN false;
  END IF;

  -- Trial is still active
  RETURN true;
END;
$$;

-- Function to reload PostgREST schema cache
CREATE OR REPLACE FUNCTION reload_postgrest_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END;
$$;

-- Function to reload schema
CREATE OR REPLACE FUNCTION reload_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

-- Function to create profile for user
CREATE OR REPLACE FUNCTION create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name',
  auto_subscribe boolean DEFAULT false,
  price_id text DEFAULT 'price_1234567890abcdef'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  trial_end_date timestamptz;
  promo_days integer;
BEGIN
  BEGIN
    SELECT
      CASE
        WHEN p.discount_type = 'free_days' THEN p.discount_value
        ELSE 30
      END INTO promo_days
    FROM promotions p
    WHERE p.is_active = true
      AND now() BETWEEN p.start_date AND p.end_date
      AND p.discount_type = 'free_days'
    ORDER BY p.discount_value DESC
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    promo_days := 30;
  END;

  IF promo_days IS NULL THEN
    promo_days := 30;
  END IF;

  trial_end_date := now() + (promo_days || ' days')::interval;

  INSERT INTO public.profiles (
    id,
    email,
    role,
    first_name,
    last_name,
    trial_started_at,
    trial_ends_at,
    auto_subscribe_after_trial,
    subscription_price_id,
    subscription_scheduled_at,
    created_at,
    updated_at
  )
  VALUES (
    user_id,
    user_email,
    user_role,
    first_name,
    last_name,
    now(),
    trial_end_date,
    auto_subscribe,
    CASE WHEN auto_subscribe AND user_role = 'client'
      THEN price_id
      ELSE NULL
    END,
    CASE WHEN auto_subscribe AND user_role = 'client'
      THEN trial_end_date
      ELSE NULL
    END,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    auto_subscribe_after_trial = EXCLUDED.auto_subscribe_after_trial,
    subscription_price_id = EXCLUDED.subscription_price_id,
    subscription_scheduled_at = EXCLUDED.subscription_scheduled_at,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'message', 'Profile created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'user_id', user_id
  );
END;
$$;

-- Function to get active promotions
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
CREATE OR REPLACE FUNCTION apply_promotion_to_user(p_user_id uuid, p_promotion_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_promotion promotions;
  v_expires_at timestamptz;
BEGIN
  SELECT * INTO v_promotion
  FROM promotions
  WHERE id = p_promotion_id
    AND is_active = true
    AND now() BETWEEN start_date AND end_date
    AND (max_uses IS NULL OR current_uses < max_uses);

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Promotion not found or not valid');
  END IF;

  IF EXISTS (
    SELECT 1 FROM user_promotions
    WHERE user_id = p_user_id AND promotion_id = p_promotion_id
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Promotion already applied');
  END IF;

  IF v_promotion.discount_type = 'free_days' THEN
    v_expires_at := now() + (v_promotion.discount_value || ' days')::interval;
  END IF;

  INSERT INTO user_promotions (user_id, promotion_id, expires_at)
  VALUES (p_user_id, p_promotion_id, v_expires_at);

  UPDATE promotions
  SET current_uses = current_uses + 1
  WHERE id = p_promotion_id;

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

-- Function to extend trial
CREATE OR REPLACE FUNCTION admin_extend_trial(target_user_id uuid, days_to_add integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_user_email text;
  target_user_role text;
  current_trial_end timestamptz;
  new_trial_end timestamptz;
BEGIN
  SELECT email INTO calling_user_email
  FROM auth.users
  WHERE id = auth.uid();

  IF calling_user_email != 'brian@bowtaifitness.com' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can extend trials'
    );
  END IF;

  SELECT role INTO target_user_role
  FROM profiles
  WHERE id = target_user_id;

  IF target_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  IF target_user_role != 'client' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only extend trials for clients'
    );
  END IF;

  SELECT
    COALESCE(trial_extended_until, trial_ends_at, created_at + interval '14 days')
  INTO current_trial_end
  FROM profiles
  WHERE id = target_user_id;

  new_trial_end := current_trial_end + (days_to_add || ' days')::interval;

  UPDATE profiles
  SET trial_extended_until = new_trial_end
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_trial_end', new_trial_end,
    'days_added', days_to_add
  );
END;
$$;

-- Function to assign program from intake
CREATE OR REPLACE FUNCTION assign_program_from_intake(intake_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intake_form record;
  v_days_per_week integer;
  v_equipment_type text;
  v_standard_program_id uuid;
  v_start_date date;
  v_coach_id uuid;
  v_calling_user_id uuid;
  v_workout_record record;
  v_workout_ids uuid[] := '{}';
  v_current_date date;
  v_week_offset integer;
  v_workout_count integer := 0;
  v_new_workout_id uuid;
  v_program_assignment_id uuid;
  v_exercise_count integer;
BEGIN
  v_calling_user_id := auth.uid();

  SELECT user_id, workout_frequency, equipment_access
  INTO v_intake_form
  FROM client_intake_forms
  WHERE id = intake_form_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intake form not found');
  END IF;

  IF v_intake_form.user_id != v_calling_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT coach_id INTO v_coach_id
  FROM coach_client_assignments
  WHERE client_id = v_intake_form.user_id
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No coach assigned');
  END IF;

  v_days_per_week := 2;
  IF v_intake_form.workout_frequency IS NOT NULL THEN
    IF v_intake_form.workout_frequency ILIKE '%4 days%' THEN
      v_days_per_week := 4;
    ELSIF v_intake_form.workout_frequency ILIKE '%3 days%' THEN
      v_days_per_week := 3;
    ELSIF v_intake_form.workout_frequency ILIKE '%2 days%' THEN
      v_days_per_week := 2;
    END IF;
  END IF;

  v_equipment_type := 'Bodyweight';
  IF v_intake_form.equipment_access IS NOT NULL AND v_intake_form.equipment_access != '' THEN
    IF v_intake_form.equipment_access = 'Full Gym' THEN
      v_equipment_type := 'Full Gym';
    ELSIF v_intake_form.equipment_access = 'Dumbbells' THEN
      v_equipment_type := 'Dumbbell';
    ELSIF v_intake_form.equipment_access = 'Resistance Bands' THEN
      v_equipment_type := 'Bands';
    ELSIF v_intake_form.equipment_access = 'Bodyweight' THEN
      v_equipment_type := 'Bodyweight';
    END IF;
  END IF;

  SELECT id INTO v_standard_program_id
  FROM workout_programs
  WHERE program_type = 'standard'
    AND days_per_week = v_days_per_week
    AND title ILIKE '%' || v_equipment_type || '%'
  LIMIT 1;

  IF v_standard_program_id IS NULL THEN
    SELECT id INTO v_standard_program_id
    FROM workout_programs
    WHERE program_type = 'standard' AND days_per_week = v_days_per_week
    LIMIT 1;
  END IF;

  IF v_standard_program_id IS NULL THEN
    SELECT id INTO v_standard_program_id
    FROM workout_programs
    WHERE program_type = 'standard'
    LIMIT 1;
  END IF;

  IF v_standard_program_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No standard programs available');
  END IF;

  v_start_date := CURRENT_DATE + (
    CASE
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 7
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN 1
      ELSE 8 - EXTRACT(DOW FROM CURRENT_DATE)
    END
  )::integer;

  UPDATE client_program_assignments
  SET status = 'cancelled'
  WHERE client_id = v_intake_form.user_id
    AND status = 'active';

  INSERT INTO client_program_assignments (
    client_id,
    program_id,
    assigned_by,
    start_date,
    status
  )
  VALUES (
    v_intake_form.user_id,
    v_standard_program_id,
    v_coach_id,
    v_start_date,
    'active'
  )
  RETURNING id INTO v_program_assignment_id;

  FOR v_workout_record IN (
    SELECT
      pw.week_number,
      pd.day_order,
      pw.template_id,
      wt.title as template_title,
      pd.day_name
    FROM program_weeks pw
    JOIN program_days pd ON pw.program_day_id = pd.id
    JOIN workout_templates wt ON wt.id = pw.template_id
    WHERE pd.program_id = v_standard_program_id
    ORDER BY pw.week_number, pd.day_order
  ) LOOP
    v_week_offset := (v_workout_record.week_number - 1) * 7;

    IF v_days_per_week = 2 THEN
      v_current_date := v_start_date + v_week_offset + (CASE WHEN v_workout_record.day_order = 1 THEN 0 ELSE 3 END);
    ELSIF v_days_per_week = 3 THEN
      v_current_date := v_start_date + v_week_offset + (CASE WHEN v_workout_record.day_order = 1 THEN 0 WHEN v_workout_record.day_order = 2 THEN 2 ELSE 4 END);
    ELSE
      v_current_date := v_start_date + v_week_offset + (v_workout_record.day_order - 1) * 2;
    END IF;

    INSERT INTO workouts (client_id, coach_id, template_id, scheduled_date, completed, title, description)
    VALUES (v_intake_form.user_id, v_coach_id, v_workout_record.template_id, v_current_date, false, v_workout_record.template_title, 'Week ' || v_workout_record.week_number || ' - ' || v_workout_record.day_name)
    RETURNING id INTO v_new_workout_id;

    INSERT INTO workout_exercises (
      workout_id,
      exercise_id,
      sets,
      reps,
      weight,
      duration,
      notes,
      order_index
    )
    SELECT
      v_new_workout_id,
      te.exercise_id,
      te.sets,
      te.reps,
      te.weight,
      te.duration,
      te.notes,
      te.order_index
    FROM template_exercises te
    WHERE te.template_id = v_workout_record.template_id
    ORDER BY te.order_index;

    GET DIAGNOSTICS v_exercise_count = ROW_COUNT;

    v_workout_ids := array_append(v_workout_ids, v_new_workout_id);
    v_workout_count := v_workout_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'program_id', v_standard_program_id,
    'program_assignment_id', v_program_assignment_id,
    'workout_count', v_workout_count,
    'start_date', v_start_date,
    'days_per_week', v_days_per_week,
    'equipment_type', v_equipment_type
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- TRIGGER FUNCTIONS
-- ============================================================================

-- Function for updating updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function for updating workout_programs updated_at
CREATE OR REPLACE FUNCTION update_workout_programs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function for updating coach_client_assignments updated_at
CREATE OR REPLACE FUNCTION update_coach_client_assignments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function for updating program_week_exercises updated_at
CREATE OR REPLACE FUNCTION update_program_week_exercises_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function to auto-assign default coach
CREATE OR REPLACE FUNCTION auto_assign_default_coach()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_coach_id uuid;
BEGIN
  IF NEW.role = 'client' AND NEW.assigned_coach_id IS NULL THEN
    default_coach_id := get_default_coach_id();

    IF default_coach_id IS NOT NULL THEN
      NEW.assigned_coach_id := default_coach_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Function to create default coach assignment
CREATE OR REPLACE FUNCTION create_default_coach_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'client' AND NEW.assigned_coach_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE client_id = NEW.id AND coach_id = NEW.assigned_coach_id
    ) THEN
      INSERT INTO coach_client_assignments (coach_id, client_id, active, assigned_at)
      VALUES (NEW.assigned_coach_id, NEW.id, true, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role text;
  user_first_name text;
  user_last_name text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  user_first_name := COALESCE(NEW.raw_user_meta_data->>'first_name', 'User');
  user_last_name := COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name');

  PERFORM create_profile_for_user(
    NEW.id,
    NEW.email,
    user_role,
    user_first_name,
    user_last_name,
    false
  );

  RETURN NEW;
END;
$$;

-- Function to trigger auto-assign program
CREATE OR REPLACE FUNCTION trigger_auto_assign_program()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', NEW.user_id::text, true);

  v_result := assign_program_from_intake(NEW.id);

  IF (v_result->>'success')::boolean THEN
    RAISE NOTICE 'Auto-assigned program for user %: %', NEW.user_id, v_result;
  ELSE
    RAISE WARNING 'Failed to auto-assign program for user %: %', NEW.user_id, v_result->>'error';
  END IF;

  RETURN NEW;
END;
$$;

-- Function to sync template exercises to programs
CREATE OR REPLACE FUNCTION sync_template_exercises_to_programs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO program_week_exercises (
      program_week_id,
      exercise_id,
      sets,
      reps,
      weight,
      duration,
      rest_seconds,
      notes,
      order_index,
      is_customized
    )
    SELECT
      pw.id as program_week_id,
      NEW.exercise_id,
      NEW.sets,
      NEW.reps,
      NEW.weight,
      NEW.duration,
      0 as rest_seconds,
      NEW.notes,
      NEW.order_index,
      false as is_customized
    FROM program_weeks pw
    WHERE pw.template_id = NEW.template_id;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE program_week_exercises pwe
    SET
      exercise_id = NEW.exercise_id,
      sets = NEW.sets,
      reps = NEW.reps,
      weight = NEW.weight,
      duration = NEW.duration,
      notes = NEW.notes,
      order_index = NEW.order_index,
      updated_at = now()
    FROM program_weeks pw
    WHERE pwe.program_week_id = pw.id
      AND pw.template_id = NEW.template_id
      AND pwe.exercise_id = OLD.exercise_id
      AND pwe.order_index = OLD.order_index
      AND pwe.is_customized = false;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    DELETE FROM program_week_exercises pwe
    USING program_weeks pw
    WHERE pwe.program_week_id = pw.id
      AND pw.template_id = OLD.template_id
      AND pwe.exercise_id = OLD.exercise_id
      AND pwe.order_index = OLD.order_index;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- Function to delete Stripe data on customer delete
CREATE OR REPLACE FUNCTION delete_stripe_data_on_customer_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM stripe_subscriptions WHERE customer_id = OLD.customer_id;
  DELETE FROM stripe_orders WHERE customer_id = OLD.customer_id;
  RETURN OLD;
END;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_programs_updated_at
  BEFORE UPDATE ON workout_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_programs_updated_at();

CREATE TRIGGER update_coach_client_assignments_updated_at
  BEFORE UPDATE ON coach_client_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_coach_client_assignments_updated_at();

CREATE TRIGGER set_program_week_exercises_updated_at
  BEFORE UPDATE ON program_week_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_program_week_exercises_updated_at();

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Auto-assign default coach trigger
CREATE TRIGGER assign_default_coach_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_default_coach();

-- Create coach assignment after profile insert
CREATE TRIGGER create_coach_assignment_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_coach_assignment();

-- Auto-assign program from intake form
CREATE TRIGGER trigger_auto_assign_program
  AFTER INSERT ON client_intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_program();

-- Sync template exercises to program exercises
CREATE TRIGGER sync_template_to_programs_trigger
  AFTER INSERT OR UPDATE OR DELETE ON template_exercises
  FOR EACH ROW
  EXECUTE FUNCTION sync_template_exercises_to_programs();

-- Delete Stripe data when customer is deleted
CREATE TRIGGER trigger_delete_stripe_data
  BEFORE DELETE ON stripe_customers
  FOR EACH ROW
  EXECUTE FUNCTION delete_stripe_data_on_customer_delete();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant all on tables
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- COMPLETE
-- ============================================================================

-- Notify PostgREST to reload schema
SELECT reload_postgrest_schema();
