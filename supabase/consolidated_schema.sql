-- ============================================================================
-- Bowtai Fitness — Consolidated Database Schema
-- Generated: 2026-09-04
-- Target: Supabase project slhjhmfxjgvhhzwjyztq (brand-new instance)
--
-- This file replaces 190 incremental migrations from the legacy Birdies by
-- Bowtai golf-fitness project. Run it once in the Supabase SQL Editor to
-- bootstrap every table, enum, index, RLS policy, trigger, view, and
-- function the application requires.
--
-- NO golf-specific data remains (swing faults, handicap, TPI, etc.).
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid / gen_random_bytes

-- ============================================================================
-- 1. CUSTOM ENUM TYPES
-- ============================================================================

-- Stripe subscription lifecycle states
CREATE TYPE stripe_subscription_status AS ENUM (
  'not_started',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

-- Stripe one-time order states
CREATE TYPE stripe_order_status AS ENUM (
  'pending',
  'completed',
  'canceled'
);

-- ============================================================================
-- 2. TABLES
-- ============================================================================

-- ─── profiles ───────────────────────────────────────────────────────────────
-- Extends auth.users with application-specific fields. Every authenticated
-- user has exactly one row, created automatically on signup.
CREATE TABLE IF NOT EXISTS profiles (
  id                          uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email                       text,
  role                        text NOT NULL DEFAULT 'client'
                                CHECK (role IN ('coach', 'client', 'admin')),
  first_name                  text NOT NULL DEFAULT '',
  last_name                   text NOT NULL DEFAULT '',
  avatar_url                  text,
  phone                       text,
  date_of_birth               date,

  -- Stripe / payment
  stripe_customer_id          text,
  subscription_status         text,
  subscription_id             text,
  subscription_price_id       text,
  subscription_start_date     timestamptz,
  subscription_end_date       timestamptz,
  subscription_tier           text DEFAULT 'basic'
                                CHECK (subscription_tier IN ('basic', 'premium')),

  -- Trial tracking
  trial_started_at            timestamptz,
  trial_ends_at               timestamptz DEFAULT (now() + interval '30 days'),
  trial_extended_until        timestamptz,
  is_trial_active             boolean DEFAULT true,
  has_active_subscription     boolean DEFAULT false,

  -- Auto-subscription
  auto_subscribe_after_trial  boolean DEFAULT true,
  subscription_scheduled_at   timestamptz,

  -- Apple IAP
  apple_product_id            text,
  apple_transaction_id        text,
  apple_subscription_expires_at timestamptz,

  -- Coach assignment (client → coach FK)
  assigned_coach_id           uuid REFERENCES profiles(id),

  -- Notification preferences (email toggles stored as JSONB)
  notification_preferences    jsonb DEFAULT '{
    "email_upcoming_workout": false,
    "email_completed": false,
    "email_block_end": false
  }'::jsonb,

  created_at                  timestamptz DEFAULT now(),
  updated_at                  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role               ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_coach_id   ON profiles(assigned_coach_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id  ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON profiles(subscription_status);
CREATE INDEX IF NOT EXISTS idx_profiles_trial_extended_until
  ON profiles(trial_extended_until) WHERE trial_extended_until IS NOT NULL;

COMMENT ON TABLE profiles IS 'User profile extending auth.users — roles, subscription, trial, coach assignment, notification prefs';

-- ─── exercises ──────────────────────────────────────────────────────────────
-- Master exercise library shared across all coaches and clients.
CREATE TABLE IF NOT EXISTS exercises (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  category          text NOT NULL
                      CHECK (category IN (
                        'Mobility/Reset', 'Speed/Power', 'Primary Strength', 'Rotary/Core',
                        'strength', 'mobility', 'power', 'stability', 'conditioning'
                      )),
  description       text NOT NULL DEFAULT '',
  instructions      text[] DEFAULT '{}',
  video_url         text,

  -- Taxonomy arrays
  tags              text[] DEFAULT '{}',
  body_regions      text[] DEFAULT '{}',
  movement_patterns text[] DEFAULT '{}',
  physical_traits   text[] DEFAULT '{}',
  equipment         text[] DEFAULT '{}',

  -- Convenience single-value fields
  muscle_group      text,

  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz DEFAULT now(),

  CONSTRAINT exercises_name_unique UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS idx_exercises_category   ON exercises(category);
CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON exercises(created_by);

COMMENT ON TABLE exercises IS 'Master exercise library with taxonomy tags, equipment, and video references';

-- ─── workout_templates ──────────────────────────────────────────────────────
-- Coach-created reusable workout blueprints.
CREATE TABLE IF NOT EXISTS workout_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_templates_created_by ON workout_templates(created_by);

COMMENT ON TABLE workout_templates IS 'Coach-created reusable workout blueprints';

-- ─── template_exercises ─────────────────────────────────────────────────────
-- Exercises within a workout template with prescribed sets/reps/weight/duration.
CREATE TABLE IF NOT EXISTS template_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id     uuid NOT NULL REFERENCES exercises(id),
  sets            integer,
  reps            integer,
  weight          numeric,
  duration        integer,          -- seconds
  notes           text,
  order_index     integer DEFAULT 0,
  superset_group  integer           -- exercises sharing the same number form a superset
);

CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(template_id);
CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise ON template_exercises(exercise_id);

COMMENT ON TABLE template_exercises IS 'Exercises within a workout template (sets, reps, weight, duration, superset groups, order)';

-- ─── workout_programs ───────────────────────────────────────────────────────
-- Multi-week training programs created by coaches.
CREATE TABLE IF NOT EXISTS workout_programs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  duration_weeks  integer NOT NULL CHECK (duration_weeks >= 1 AND duration_weeks <= 52),
  days_per_week   integer NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
  archived        boolean NOT NULL DEFAULT false,
  created_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workout_programs_created_by ON workout_programs(created_by);

COMMENT ON TABLE workout_programs IS 'Multi-week training programs created by coaches';

-- ─── program_days ───────────────────────────────────────────────────────────
-- Named training days within a program (e.g. "Push", "Pull", "Legs").
CREATE TABLE IF NOT EXISTS program_days (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  day_name    text NOT NULL,
  day_order   integer NOT NULL CHECK (day_order >= 1 AND day_order <= 7),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(program_id, day_order)
);

CREATE INDEX IF NOT EXISTS idx_program_days_program_id ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_order      ON program_days(program_id, day_order);

COMMENT ON TABLE program_days IS 'Named training days within a program (e.g. Push, Pull, Legs)';

-- ─── program_weeks ──────────────────────────────────────────────────────────
-- Per-week configuration for each program day; optionally linked to a template.
CREATE TABLE IF NOT EXISTS program_weeks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  program_day_id  uuid NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  week_number     integer NOT NULL CHECK (week_number >= 1),
  template_id     uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  notes           text,
  created_at      timestamptz DEFAULT now(),
  UNIQUE(program_id, program_day_id, week_number)
);

CREATE INDEX IF NOT EXISTS idx_program_weeks_program_id  ON program_weeks(program_id);
CREATE INDEX IF NOT EXISTS idx_program_weeks_week_number ON program_weeks(program_id, week_number);
CREATE INDEX IF NOT EXISTS idx_program_weeks_template    ON program_weeks(template_id);

COMMENT ON TABLE program_weeks IS 'Per-week configuration for each program day, optionally linked to a template';

-- ─── program_week_exercises ─────────────────────────────────────────────────
-- Week-specific exercise overrides independent of the linked template.
CREATE TABLE IF NOT EXISTS program_week_exercises (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_week_id  uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets             integer,
  reps             integer,
  weight           numeric(10, 2),
  duration         integer,          -- seconds
  rest_seconds     integer,
  notes            text,
  order_index      integer NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_week_exercises_program_week_id
  ON program_week_exercises(program_week_id);
CREATE INDEX IF NOT EXISTS idx_program_week_exercises_order
  ON program_week_exercises(program_week_id, order_index);

COMMENT ON TABLE program_week_exercises IS 'Week-specific exercise overrides within a program, independent of linked template';

-- ─── workouts ───────────────────────────────────────────────────────────────
-- Assigned workout instances scheduled for a specific client on a date.
CREATE TABLE IF NOT EXISTS workouts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  description     text,
  coach_id        uuid NOT NULL REFERENCES profiles(id),
  client_id       uuid NOT NULL REFERENCES profiles(id),
  template_id     uuid REFERENCES workout_templates(id),
  scheduled_date  date NOT NULL,
  completed       boolean DEFAULT false,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workouts_coach_id       ON workouts(coach_id);
CREATE INDEX IF NOT EXISTS idx_workouts_client_id      ON workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled_date ON workouts(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workouts_template_id    ON workouts(template_id);

COMMENT ON TABLE workouts IS 'Assigned workout instances scheduled for a specific client on a date';

-- ─── workout_exercises ──────────────────────────────────────────────────────
-- Exercises within an assigned workout.
CREATE TABLE IF NOT EXISTS workout_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id      uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id     uuid NOT NULL REFERENCES exercises(id),
  sets            integer,
  reps            integer,
  weight          decimal,
  duration        integer,           -- seconds
  notes           text,
  order_index     integer DEFAULT 0,
  superset_group  integer
);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout  ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise ON workout_exercises(exercise_id);

COMMENT ON TABLE workout_exercises IS 'Exercises within an assigned workout (sets, reps, weight, duration, superset group, order)';

-- ─── coach_client_assignments ───────────────────────────────────────────────
-- Tracks which coach manages which client.
CREATE TABLE IF NOT EXISTS coach_client_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES profiles(id),
  active      boolean DEFAULT true,
  notes       text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_coach_id  ON coach_client_assignments(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_client_id ON coach_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_active    ON coach_client_assignments(active);

COMMENT ON TABLE coach_client_assignments IS 'Coach ↔ client relationship table';

-- ─── client_program_assignments ─────────────────────────────────────────────
-- Tracks which program is assigned to a client and its lifecycle.
CREATE TABLE IF NOT EXISTS client_program_assignments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  program_id   uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  assigned_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_at  timestamptz DEFAULT now(),
  start_date   date NOT NULL,
  status       text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'completed', 'cancelled')),
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_program_assignments_client  ON client_program_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_program ON client_program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_client_program_assignments_status  ON client_program_assignments(status);

COMMENT ON TABLE client_program_assignments IS 'Tracks which workout programs are assigned to clients, allowing UI to show current program and history';

-- ─── workout_logs ───────────────────────────────────────────────────────────
-- Per-session workout log for a client, tracking completion, duration, and coach feedback.
CREATE TABLE IF NOT EXISTS workout_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id            uuid REFERENCES workouts(id) ON DELETE SET NULL,
  program_assignment_id uuid REFERENCES client_program_assignments(id) ON DELETE SET NULL,
  status                text NOT NULL DEFAULT 'in_progress'
                          CHECK (status IN ('in_progress', 'completed', 'partial', 'skipped')),
  started_at            timestamptz DEFAULT now(),
  completed_at          timestamptz,
  duration_seconds      integer,
  overall_notes         text,
  coach_feedback        text,
  feedback_at           timestamptz,
  feedback_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_workout_logs_client      ON workout_logs(client_id);
CREATE INDEX idx_workout_logs_workout     ON workout_logs(workout_id);
CREATE INDEX idx_workout_logs_status      ON workout_logs(status);
CREATE INDEX idx_workout_logs_started_at  ON workout_logs(started_at DESC);
CREATE INDEX idx_workout_logs_client_date ON workout_logs(client_id, started_at DESC);

COMMENT ON TABLE workout_logs IS 'Per-session workout log for a client, tracking completion status, duration, and coach feedback';

-- ─── exercise_logs ──────────────────────────────────────────────────────────
-- Per-set exercise log within a workout session.
CREATE TABLE IF NOT EXISTS exercise_logs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id      uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id         uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  workout_exercise_id uuid REFERENCES workout_exercises(id) ON DELETE SET NULL,
  set_number          integer NOT NULL DEFAULT 1,
  -- Prescribed values (snapshot from the workout plan)
  prescribed_reps     integer,
  prescribed_weight   numeric(8,2),
  prescribed_duration integer,        -- seconds
  -- Actual logged values
  actual_reps         integer,
  actual_weight       numeric(8,2),
  actual_duration     integer,        -- seconds
  rpe                 integer CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  completed           boolean NOT NULL DEFAULT false,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_exercise_logs_workout_log   ON exercise_logs(workout_log_id);
CREATE INDEX idx_exercise_logs_exercise      ON exercise_logs(exercise_id);
CREATE INDEX idx_exercise_logs_we            ON exercise_logs(workout_exercise_id);
CREATE INDEX idx_exercise_logs_exercise_date ON exercise_logs(exercise_id, created_at DESC);

COMMENT ON TABLE exercise_logs IS 'Per-set exercise log within a workout session, tracking prescribed vs actual performance';

-- ─── scheduled_workouts ─────────────────────────────────────────────────────
-- Calendar-based workout scheduling linking templates to clients on specific dates.
CREATE TABLE IF NOT EXISTS scheduled_workouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  client_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date      date NOT NULL,
  status              text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'skipped')),
  title               text NOT NULL,
  notes               text,
  copied_from_id      uuid REFERENCES scheduled_workouts(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX idx_scheduled_workouts_client      ON scheduled_workouts(client_id);
CREATE INDEX idx_scheduled_workouts_coach       ON scheduled_workouts(coach_id);
CREATE INDEX idx_scheduled_workouts_date        ON scheduled_workouts(scheduled_date);
CREATE INDEX idx_scheduled_workouts_client_date ON scheduled_workouts(client_id, scheduled_date);
CREATE INDEX idx_scheduled_workouts_template    ON scheduled_workouts(workout_template_id);
CREATE INDEX idx_scheduled_workouts_status      ON scheduled_workouts(status);

COMMENT ON TABLE scheduled_workouts IS 'Calendar-based workout scheduling linking templates to clients on specific dates';

-- ─── scheduled_workout_exercises ────────────────────────────────────────────
-- Snapshot of exercises for a scheduled workout, copied from template at schedule time.
CREATE TABLE IF NOT EXISTS scheduled_workout_exercises (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_workout_id  uuid NOT NULL REFERENCES scheduled_workouts(id) ON DELETE CASCADE,
  exercise_id           uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets                  integer,
  reps                  integer,
  weight                numeric(8,2),
  duration              integer,       -- seconds
  notes                 text,
  order_index           integer NOT NULL DEFAULT 0,
  superset_group        integer,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_swe_scheduled_workout ON scheduled_workout_exercises(scheduled_workout_id);
CREATE INDEX idx_swe_exercise          ON scheduled_workout_exercises(exercise_id);

COMMENT ON TABLE scheduled_workout_exercises IS 'Snapshot of exercises for a scheduled workout, copied from template at schedule time';

-- ─── messages ───────────────────────────────────────────────────────────────
-- Coach ↔ client messaging with optional file attachments.
CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   uuid NOT NULL REFERENCES profiles(id),
  receiver_id uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL,
  read        boolean DEFAULT false,
  payload     jsonb,                 -- file attachment metadata { attachments: [...] }
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_read     ON messages(read);

COMMENT ON TABLE messages    IS 'Coach ↔ client messaging with optional file attachments';
COMMENT ON COLUMN messages.payload IS 'JSON payload for message attachments and metadata';

-- ─── client_intake_forms ────────────────────────────────────────────────────
-- General fitness intake questionnaire (NOT golf-specific).
CREATE TABLE IF NOT EXISTS client_intake_forms (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Basic Information
  age                      integer,
  gender                   text,
  height                   text,
  weight                   text,

  -- Fitness Information
  fitness_experience       integer,         -- years of general fitness experience
  primary_fitness_goal     text,            -- e.g. "Build Muscle", "Lose Weight", "Get Stronger"
  activity_frequency       text,            -- how often they work out
  biggest_strength         text,
  biggest_weakness         text,
  fitness_notes            text,

  -- Training Information
  years_strength_training  integer,
  training_goal            text,
  workout_frequency        text,
  equipment_access         text DEFAULT '',
  training_notes           text,

  -- General
  injury_history           text,
  completed_at             timestamptz DEFAULT now(),
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now(),

  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON client_intake_forms(user_id);

COMMENT ON TABLE client_intake_forms IS 'General fitness intake questionnaire filled by clients on onboarding';

-- ─── performance_metrics ────────────────────────────────────────────────────
-- Gym / fitness performance metrics tracked over time (no golf metrics).
CREATE TABLE IF NOT EXISTS performance_metrics (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id            uuid NOT NULL REFERENCES profiles(id),
  date                 date NOT NULL,

  -- Max-rep exercises
  max_pushups          integer,
  max_situps           integer,
  max_pullups          integer,

  -- Max-weight exercises (lbs)
  max_squat            numeric,
  max_bench            numeric,
  max_deadlift         numeric,

  -- Cardio
  mile_time            integer,          -- seconds
  plank_time           integer,          -- seconds

  -- Body composition
  weight               numeric,          -- lbs
  body_fat_percentage  numeric,

  -- Lifestyle / vitals
  resting_heart_rate   integer,          -- bpm
  vo2_max              numeric,
  sleep_hours          numeric,

  notes                text,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_client ON performance_metrics(client_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_date   ON performance_metrics(date);

COMMENT ON TABLE performance_metrics IS 'Client fitness performance metrics tracked over time';

-- ─── stripe_customers ───────────────────────────────────────────────────────
-- Links Supabase auth users to Stripe customer IDs.
CREATE TABLE IF NOT EXISTS stripe_customers (
  id          bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id     uuid NOT NULL UNIQUE REFERENCES auth.users(id),
  customer_id text NOT NULL UNIQUE,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz DEFAULT NULL
);

COMMENT ON TABLE stripe_customers IS 'Supabase user ↔ Stripe customer mapping (soft-deletable)';

-- ─── stripe_subscriptions ───────────────────────────────────────────────────
-- Stripe subscription lifecycle data.
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id                     bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_id            text UNIQUE NOT NULL,
  subscription_id        text,
  price_id               text,
  current_period_start   bigint,
  current_period_end     bigint,
  cancel_at_period_end   boolean DEFAULT false,
  payment_method_brand   text,
  payment_method_last4   text,
  status                 stripe_subscription_status NOT NULL,
  created_at             timestamptz DEFAULT now(),
  updated_at             timestamptz DEFAULT now(),
  deleted_at             timestamptz DEFAULT NULL
);

COMMENT ON TABLE stripe_subscriptions IS 'Stripe subscription lifecycle data';

-- ─── stripe_orders ──────────────────────────────────────────────────────────
-- Stripe one-time order / checkout records.
CREATE TABLE IF NOT EXISTS stripe_orders (
  id                   bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  checkout_session_id  text NOT NULL,
  payment_intent_id    text NOT NULL,
  customer_id          text NOT NULL,
  amount_subtotal      bigint NOT NULL,
  amount_total         bigint NOT NULL,
  currency             text NOT NULL,
  payment_status       text NOT NULL,
  status               stripe_order_status NOT NULL DEFAULT 'pending',
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now(),
  deleted_at           timestamptz DEFAULT NULL
);

COMMENT ON TABLE stripe_orders IS 'Stripe one-time order / checkout records';

-- ─── promotions ─────────────────────────────────────────────────────────────
-- Admin-managed promotional offers (percentage discounts or free trial days).
CREATE TABLE IF NOT EXISTS promotions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text UNIQUE,
  discount_type   text NOT NULL CHECK (discount_type IN ('percentage', 'free_days')),
  discount_value  integer NOT NULL CHECK (discount_value > 0),
  start_date      timestamptz NOT NULL,
  end_date        timestamptz NOT NULL,
  is_active       boolean DEFAULT true,
  max_uses        integer,
  current_uses    integer DEFAULT 0,
  created_by      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_promotions_code         ON promotions(code) WHERE code IS NOT NULL;

COMMENT ON TABLE promotions IS 'Admin-managed promotional offers (discounts or free trial days)';

-- ─── user_promotions ────────────────────────────────────────────────────────
-- Tracks which promotions have been applied to which users.
CREATE TABLE IF NOT EXISTS user_promotions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  applied_at   timestamptz DEFAULT now(),
  expires_at   timestamptz,
  UNIQUE(user_id, promotion_id)
);

CREATE INDEX IF NOT EXISTS idx_user_promotions_user      ON user_promotions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_promotions_promotion ON user_promotions(promotion_id);

COMMENT ON TABLE user_promotions IS 'Junction table tracking which promotions have been applied to which users';

-- ─── invitations ────────────────────────────────────────────────────────────
-- Admin-generated invite tokens for coach/trainer sign-up.
CREATE TABLE IF NOT EXISTS invitations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  role       text NOT NULL CHECK (role IN ('trainer', 'coach')),
  token      text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  invited_by uuid NOT NULL REFERENCES profiles(id),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at    timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token   ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email   ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_used_at ON invitations(used_at);

COMMENT ON TABLE invitations IS 'Admin-generated invite tokens for coach/trainer sign-up';

-- ============================================================================
-- 3. ROW LEVEL SECURITY — enable on all tables
-- ============================================================================

ALTER TABLE profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_programs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days                ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_week_exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_client_assignments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_workouts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intake_forms         ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_subscriptions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_orders               ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_promotions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations                 ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================

-- ─── profiles ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Coaches can view assigned client profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    (
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'coach'
      )
      AND role = 'client'
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid()
          AND cca.client_id = profiles.id
          AND cca.active = true
      )
    )
  );

CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── exercises ──────────────────────────────────────────────────────────────

CREATE POLICY "Everyone can view exercises"
  ON exercises FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Coaches can create exercises"
  ON exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

CREATE POLICY "Coaches can update exercises"
  ON exercises FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

CREATE POLICY "Coaches can delete exercises"
  ON exercises FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

-- ─── workout_templates ──────────────────────────────────────────────────────

CREATE POLICY "Coaches can create templates"
  ON workout_templates FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

CREATE POLICY "Coaches can view own templates"
  ON workout_templates FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can update own templates"
  ON workout_templates FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own templates"
  ON workout_templates FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ─── template_exercises ─────────────────────────────────────────────────────

CREATE POLICY "Coaches can insert template exercises"
  ON template_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE id = template_exercises.template_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view template exercises"
  ON template_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE id = template_exercises.template_id
        AND (created_by = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can update template exercises"
  ON template_exercises FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE id = template_exercises.template_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE id = template_exercises.template_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete template exercises"
  ON template_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE id = template_exercises.template_id AND created_by = auth.uid()
    )
  );

-- ─── workout_programs ───────────────────────────────────────────────────────

CREATE POLICY "Coaches can create programs"
  ON workout_programs FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

CREATE POLICY "Coaches can view own programs"
  ON workout_programs FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can update own programs"
  ON workout_programs FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own programs"
  ON workout_programs FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Clients can view programs assigned to them
CREATE POLICY "Clients can view assigned programs"
  ON workout_programs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_assignments cpa
      WHERE cpa.program_id = workout_programs.id
        AND cpa.client_id = auth.uid()
    )
  );

-- ─── program_days ───────────────────────────────────────────────────────────

CREATE POLICY "Coaches can manage program days"
  ON program_days FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE id = program_days.program_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE id = program_days.program_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Clients can view assigned program days"
  ON program_days FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_assignments cpa
      JOIN workout_programs wp ON wp.id = cpa.program_id
      WHERE wp.id = program_days.program_id AND cpa.client_id = auth.uid()
    )
  );

-- ─── program_weeks ──────────────────────────────────────────────────────────

CREATE POLICY "Coaches can manage program weeks"
  ON program_weeks FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE id = program_weeks.program_id AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE id = program_weeks.program_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Clients can view assigned program weeks"
  ON program_weeks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_assignments cpa
      JOIN workout_programs wp ON wp.id = cpa.program_id
      WHERE wp.id = program_weeks.program_id AND cpa.client_id = auth.uid()
    )
  );

-- ─── program_week_exercises ─────────────────────────────────────────────────

CREATE POLICY "Coaches can manage program week exercises"
  ON program_week_exercises FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Clients can view assigned program week exercises"
  ON program_week_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN client_program_assignments cpa ON cpa.program_id = pw.program_id
      WHERE pw.id = program_week_exercises.program_week_id AND cpa.client_id = auth.uid()
    )
  );

-- ─── workouts ───────────────────────────────────────────────────────────────

CREATE POLICY "Coaches can view assigned client workouts"
  ON workouts FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can create workouts for assigned clients"
  ON workouts FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
    AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workouts.client_id
        AND cca.active = true
    )
  );

CREATE POLICY "Coaches can update their workouts"
  ON workouts FOR UPDATE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can delete their workouts"
  ON workouts FOR DELETE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── workout_exercises ──────────────────────────────────────────────────────

CREATE POLICY "Users can view workout exercises"
  ON workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.coach_id = auth.uid() OR w.client_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can insert workout exercises"
  ON workout_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can update workout exercises"
  ON workout_exercises FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can delete workout exercises"
  ON workout_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- ─── coach_client_assignments ───────────────────────────────────────────────

CREATE POLICY "Users can view their assignments"
  ON coach_client_assignments FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR client_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can manage their assignments"
  ON coach_client_assignments FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can update their assignments"
  ON coach_client_assignments FOR UPDATE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can delete their assignments"
  ON coach_client_assignments FOR DELETE TO authenticated
  USING (
    coach_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── client_program_assignments ─────────────────────────────────────────────

CREATE POLICY "Clients can view own program assignments"
  ON client_program_assignments FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Coaches can view their clients program assignments"
  ON client_program_assignments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can insert program assignments for their clients"
  ON client_program_assignments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can update their clients program assignments"
  ON client_program_assignments FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = client_program_assignments.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Admins can manage all program assignments"
  ON client_program_assignments FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── workout_logs ───────────────────────────────────────────────────────────

CREATE POLICY "Clients can view own workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can insert own workout logs"
  ON workout_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own workout logs"
  ON workout_logs FOR UPDATE TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can delete own workout logs"
  ON workout_logs FOR DELETE TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Coaches can view their clients workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workout_logs.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches can update their clients workout logs"
  ON workout_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workout_logs.client_id
        AND p.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workout_logs.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Admins full access to workout logs"
  ON workout_logs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── exercise_logs ──────────────────────────────────────────────────────────

CREATE POLICY "Clients can view own exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = exercise_logs.workout_log_id AND wl.client_id = auth.uid())
  );

CREATE POLICY "Clients can insert own exercise logs"
  ON exercise_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = exercise_logs.workout_log_id AND wl.client_id = auth.uid())
  );

CREATE POLICY "Clients can update own exercise logs"
  ON exercise_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = exercise_logs.workout_log_id AND wl.client_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = exercise_logs.workout_log_id AND wl.client_id = auth.uid())
  );

CREATE POLICY "Clients can delete own exercise logs"
  ON exercise_logs FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM workout_logs wl WHERE wl.id = exercise_logs.workout_log_id AND wl.client_id = auth.uid())
  );

CREATE POLICY "Coaches can view their clients exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      JOIN coach_client_assignments cca ON cca.client_id = wl.client_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE wl.id = exercise_logs.workout_log_id
        AND cca.coach_id = auth.uid()
        AND p.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Admins full access to exercise logs"
  ON exercise_logs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── scheduled_workouts ─────────────────────────────────────────────────────

CREATE POLICY "Users can view scheduled workouts"
  ON scheduled_workouts FOR SELECT TO authenticated
  USING (
    auth.uid() = coach_id
    OR auth.uid() = client_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can insert scheduled workouts"
  ON scheduled_workouts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can update scheduled workouts"
  ON scheduled_workouts FOR UPDATE TO authenticated
  USING (
    auth.uid() = coach_id
    OR auth.uid() = client_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = coach_id
    OR auth.uid() = client_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can delete scheduled workouts"
  ON scheduled_workouts FOR DELETE TO authenticated
  USING (
    auth.uid() = coach_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── scheduled_workout_exercises ────────────────────────────────────────────

CREATE POLICY "Users can view scheduled workout exercises"
  ON scheduled_workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid() OR sw.client_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can insert scheduled workout exercises"
  ON scheduled_workout_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can update scheduled workout exercises"
  ON scheduled_workout_exercises FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can delete scheduled workout exercises"
  ON scheduled_workout_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- ─── messages ───────────────────────────────────────────────────────────────

CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── client_intake_forms ────────────────────────────────────────────────────

CREATE POLICY "Clients can insert own intake form"
  ON client_intake_forms FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clients can view own intake form"
  ON client_intake_forms FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Clients can update own intake form"
  ON client_intake_forms FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Coaches can view all intake forms"
  ON client_intake_forms FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
  );

-- ─── performance_metrics ────────────────────────────────────────────────────

CREATE POLICY "Users can view assigned performance metrics"
  ON performance_metrics FOR SELECT TO authenticated
  USING (
    client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = performance_metrics.client_id
        AND cca.active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Clients can insert own performance metrics"
  ON performance_metrics FOR INSERT TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update own performance metrics"
  ON performance_metrics FOR UPDATE TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can insert client performance metrics"
  ON performance_metrics FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = performance_metrics.client_id
        AND cca.active = true
    )
  );

-- ─── stripe_customers ───────────────────────────────────────────────────────

CREATE POLICY "Users can view their own customer data"
  ON stripe_customers FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND deleted_at IS NULL);

-- ─── stripe_subscriptions ───────────────────────────────────────────────────

CREATE POLICY "Users can view their own subscription data"
  ON stripe_subscriptions FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ─── stripe_orders ──────────────────────────────────────────────────────────

CREATE POLICY "Users can view their own order data"
  ON stripe_orders FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT customer_id FROM stripe_customers
      WHERE user_id = auth.uid() AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

-- ─── promotions ─────────────────────────────────────────────────────────────

CREATE POLICY "Admins can manage all promotions"
  ON promotions FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "All users can view active promotions"
  ON promotions FOR SELECT TO authenticated
  USING (
    is_active = true AND now() BETWEEN start_date AND end_date
  );

-- ─── user_promotions ────────────────────────────────────────────────────────

CREATE POLICY "Admins can view all user promotions"
  ON user_promotions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view their own promotions"
  ON user_promotions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Authenticated users can insert user promotions"
  ON user_promotions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── invitations ────────────────────────────────────────────────────────────

CREATE POLICY "Admins can view all invitations"
  ON invitations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================================
-- 5. VIEWS
-- ============================================================================

-- Secure view joining stripe_customers → stripe_subscriptions for the logged-in user.
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
  c.customer_id,
  s.subscription_id,
  s.status              AS subscription_status,
  s.price_id,
  s.current_period_start,
  s.current_period_end,
  s.cancel_at_period_end,
  s.payment_method_brand,
  s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
  AND c.deleted_at IS NULL
  AND s.deleted_at IS NULL;

GRANT SELECT ON stripe_user_subscriptions TO authenticated;

-- Secure view joining stripe_customers → stripe_orders for the logged-in user.
CREATE VIEW stripe_user_orders WITH (security_invoker = true) AS
SELECT
  c.customer_id,
  o.id                  AS order_id,
  o.checkout_session_id,
  o.payment_intent_id,
  o.amount_subtotal,
  o.amount_total,
  o.currency,
  o.payment_status,
  o.status              AS order_status,
  o.created_at          AS order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
  AND c.deleted_at IS NULL
  AND o.deleted_at IS NULL;

GRANT SELECT ON stripe_user_orders TO authenticated;

-- ============================================================================
-- 6. FUNCTIONS
-- ============================================================================

-- ─── Generic updated_at trigger function ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public, pg_catalog;

-- ─── is_admin() helper ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── create_profile_for_user ────────────────────────────────────────────────
-- Called from AuthContext on signup (email + OAuth). SECURITY DEFINER to bypass
-- RLS for the initial profile insert.
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id     uuid,
  user_email  text,
  user_role   text    DEFAULT 'client',
  first_name  text    DEFAULT 'User',
  last_name   text    DEFAULT 'Name',
  auto_subscribe boolean DEFAULT false,
  price_id    text    DEFAULT 'price_1234567890abcdef'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  trial_end_date timestamptz;
  promo_days     integer;
BEGIN
  -- Check for active free-days promotion; fall back to 30-day default
  BEGIN
    SELECT
      CASE WHEN p.discount_type = 'free_days' THEN p.discount_value ELSE 30 END
    INTO promo_days
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
    id, email, role, first_name, last_name,
    trial_started_at, trial_ends_at,
    auto_subscribe_after_trial, subscription_price_id, subscription_scheduled_at,
    created_at, updated_at
  )
  VALUES (
    user_id, user_email, user_role, first_name, last_name,
    now(), trial_end_date,
    auto_subscribe,
    CASE WHEN auto_subscribe AND user_role = 'client' THEN price_id ELSE NULL END,
    CASE WHEN auto_subscribe AND user_role = 'client' THEN trial_end_date ELSE NULL END,
    now(), now()
  )
  ON CONFLICT (id) DO UPDATE SET
    email                      = EXCLUDED.email,
    role                       = EXCLUDED.role,
    first_name                 = EXCLUDED.first_name,
    last_name                  = EXCLUDED.last_name,
    auto_subscribe_after_trial = EXCLUDED.auto_subscribe_after_trial,
    subscription_price_id      = EXCLUDED.subscription_price_id,
    subscription_scheduled_at  = EXCLUDED.subscription_scheduled_at,
    updated_at                 = now();

  RETURN jsonb_build_object(
    'success', true,
    'user_id', user_id,
    'message', 'Profile created successfully'
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error',   SQLERRM,
    'user_id', user_id
  );
END;
$$;

-- ─── handle_new_user (auth trigger) ─────────────────────────────────────────
-- Fires after INSERT on auth.users to ensure a profile row always exists.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'client'),
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog;

-- ─── get_active_promotions ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_active_promotions()
RETURNS SETOF promotions
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT *
  FROM promotions
  WHERE is_active = true
    AND now() BETWEEN start_date AND end_date
    AND (max_uses IS NULL OR current_uses < max_uses)
  ORDER BY discount_value DESC;
$$;

-- ─── apply_promotion_to_user ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.apply_promotion_to_user(
  p_user_id      uuid,
  p_promotion_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_promotion  promotions;
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

  UPDATE promotions SET current_uses = current_uses + 1 WHERE id = p_promotion_id;

  IF v_promotion.discount_type = 'free_days' THEN
    UPDATE profiles
    SET trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now())
                        + (v_promotion.discount_value || ' days')::interval
    WHERE id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success',    true,
    'promotion',  row_to_json(v_promotion),
    'expires_at', v_expires_at
  );
END;
$$;

-- ─── validate_invitation_token ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.validate_invitation_token(
  p_token text,
  p_email text,
  p_role  text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_invitation invitations;
BEGIN
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND email = p_email
    AND role  = p_role
    AND used_at IS NULL
    AND expires_at > now();

  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid, expired, or already used invitation token'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid',         true,
    'invitation_id', v_invitation.id,
    'role',          v_invitation.role
  );
END;
$$;

-- ─── mark_invitation_used ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_invitation_used(
  p_token text,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE invitations
  SET used_at = now()
  WHERE token = p_token
    AND email = p_email
    AND used_at IS NULL;
  RETURN FOUND;
END;
$$;

-- ─── admin_extend_trial ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_extend_trial(
  target_user_id uuid,
  days_to_add    integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  target_user_role text;
  current_trial_end timestamptz;
  new_trial_end     timestamptz;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only administrators can extend trials');
  END IF;

  SELECT role INTO target_user_role FROM profiles WHERE id = target_user_id;

  IF target_user_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  IF target_user_role != 'client' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Can only extend trials for clients');
  END IF;

  SELECT COALESCE(trial_extended_until, trial_ends_at, created_at + interval '30 days')
  INTO current_trial_end
  FROM profiles WHERE id = target_user_id;

  new_trial_end := current_trial_end + (days_to_add || ' days')::interval;

  UPDATE profiles SET trial_extended_until = new_trial_end WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success',       true,
    'new_trial_end', new_trial_end,
    'days_added',    days_to_add
  );
END;
$$;

-- ─── admin_delete_client ────────────────────────────────────────────────────
-- Removes a client and all associated data. Admin-only.
CREATE OR REPLACE FUNCTION public.admin_delete_client(
  target_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only administrators can delete clients');
  END IF;

  -- Delete from profiles (cascades to most child tables)
  DELETE FROM profiles WHERE id = target_user_id;

  -- Delete from auth.users (requires SECURITY DEFINER)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Client deleted successfully');

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─── update_default_trial_period ────────────────────────────────────────────
-- Admin function to change the default trial length for new signups.
CREATE OR REPLACE FUNCTION public.update_default_trial_period(new_trial_days integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF new_trial_days < 1 OR new_trial_days > 365 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Trial period must be between 1 and 365 days');
  END IF;

  -- Update the profiles column default
  EXECUTE format(
    'ALTER TABLE profiles ALTER COLUMN trial_ends_at SET DEFAULT (now() + interval ''%s days'')',
    new_trial_days
  );

  RETURN jsonb_build_object(
    'success',        true,
    'message',        'Trial period updated to ' || new_trial_days || ' days',
    'new_trial_days', new_trial_days
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ============================================================================
-- 7. TRIGGERS
-- ============================================================================

-- Auto-create profile on auth.users INSERT
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER workout_programs_updated_at
  BEFORE UPDATE ON workout_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER coach_client_assignments_updated_at
  BEFORE UPDATE ON coach_client_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER program_week_exercises_updated_at
  BEFORE UPDATE ON program_week_exercises
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER workout_logs_updated_at
  BEFORE UPDATE ON workout_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER exercise_logs_updated_at
  BEFORE UPDATE ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER scheduled_workouts_updated_at
  BEFORE UPDATE ON scheduled_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. EXECUTE PRIVILEGE LOCKDOWN
-- ============================================================================

-- Revoke EXECUTE from PUBLIC/anon on security-sensitive functions;
-- grant only to authenticated where appropriate.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column()          FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_profile_for_user(uuid, text, text, text, text, boolean, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_profile_for_user(uuid, text, text, text, text, boolean, text)
  TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin()                          FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin()                          TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_active_promotions()             FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.get_active_promotions()             TO authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_promotion_to_user(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.apply_promotion_to_user(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_invitation_token(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.validate_invitation_token(text, text, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_invitation_used(text, text)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.mark_invitation_used(text, text)    TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer)   FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer)   TO authenticated;

REVOKE EXECUTE ON FUNCTION public.admin_delete_client(uuid)           FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.admin_delete_client(uuid)           TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_default_trial_period(integer) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.update_default_trial_period(integer) TO authenticated;

-- ============================================================================
-- 9. STORAGE BUCKETS
-- ============================================================================

-- Attachments bucket for message file attachments and avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated uploads to user-scoped folders
CREATE POLICY "Users can upload attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow viewing own files
CREATE POLICY "Users can view own attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow deleting own files
CREATE POLICY "Users can delete own attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
-- DONE — The schema is now ready for the Bowtai Fitness app.
-- ============================================================================
