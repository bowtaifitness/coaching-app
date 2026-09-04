-- ====================================================================
-- DEV DATABASE SETUP SCRIPT
-- Run this in Supabase SQL Editor for project: eeujuhdonnweoasstohm
-- ====================================================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('coach', 'client', 'admin')) DEFAULT 'client',
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  avatar_url text,
  phone text,
  date_of_birth date,
  stripe_customer_id text,
  subscription_status text,
  subscription_id text,
  subscription_price_id text,
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  assigned_coach_id uuid,
  subscription_tier text CHECK (subscription_tier IN ('free', 'premium', 'enterprise')) DEFAULT 'free',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  is_trial_active boolean DEFAULT false,
  has_active_subscription boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create coach_client_assignments table
CREATE TABLE IF NOT EXISTS coach_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  active boolean DEFAULT true,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(coach_id, client_id)
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('strength', 'mobility', 'power', 'stability', 'conditioning', 'flexibility', 'balance', 'cardio', 'plyometric', 'core')),
  description text NOT NULL DEFAULT '',
  instructions text[] DEFAULT '{}',
  equipment text[] DEFAULT '{}',
  duration integer,
  reps integer,
  sets integer,
  video_url text,
  created_by uuid REFERENCES profiles(id),
  is_template boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create workout_exercises table
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets integer DEFAULT 0,
  reps integer DEFAULT 0,
  weight decimal DEFAULT 0,
  duration integer DEFAULT 0,
  notes text DEFAULT '',
  order_index integer DEFAULT 0,
  completed boolean DEFAULT false
);

-- Create workout_templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create template_exercises table
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets integer DEFAULT 0,
  reps integer DEFAULT 0,
  duration integer DEFAULT 0,
  order_index integer DEFAULT 0
);

-- Create workout_programs table
CREATE TABLE IF NOT EXISTS workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_weeks integer NOT NULL DEFAULT 1,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  program_type text CHECK (program_type IN ('standard', 'custom')) DEFAULT 'standard',
  created_at timestamptz DEFAULT now()
);

-- Create program_weeks table
CREATE TABLE IF NOT EXISTS program_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  notes text,
  UNIQUE(program_id, week_number)
);

-- Create program_days table
CREATE TABLE IF NOT EXISTS program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  day_name text NOT NULL,
  notes text,
  UNIQUE(week_id, day_number)
);

-- Create program_week_exercises table
CREATE TABLE IF NOT EXISTS program_week_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets integer DEFAULT 0,
  reps integer DEFAULT 0,
  duration integer DEFAULT 0,
  notes text,
  order_index integer DEFAULT 0
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date date NOT NULL,
  swing_speed decimal,
  carry_distance decimal,
  total_distance decimal,
  clubhead_speed decimal,
  ball_speed decimal,
  driving_accuracy decimal,
  greens_in_regulation decimal,
  putting_average decimal,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create swing_analyses table
CREATE TABLE IF NOT EXISTS swing_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  analysis text,
  feedback text,
  created_at timestamptz DEFAULT now()
);

-- Create client_intake_forms table
CREATE TABLE IF NOT EXISTS client_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  goals text,
  experience_level text CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  injuries text,
  available_equipment text[] DEFAULT '{}',
  training_frequency integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_week_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE swing_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_intake_forms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
    DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
    DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
    DROP POLICY IF EXISTS "Clients can view their coach" ON profiles;
    DROP POLICY IF EXISTS "Admin full access" ON profiles;
    DROP POLICY IF EXISTS "Admins can delete client profiles" ON profiles;
    DROP POLICY IF EXISTS "Service role access" ON profiles;
    DROP POLICY IF EXISTS "admin_full_access_by_email" ON profiles;
    DROP POLICY IF EXISTS "users_can_access_own_profile" ON profiles;
END $$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Coaches can view assigned clients" ON profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM coach_client_assignments WHERE coach_id = auth.uid() AND client_id = profiles.id AND active = true)
);
CREATE POLICY "Clients can view their coach" ON profiles FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM coach_client_assignments WHERE client_id = auth.uid() AND coach_id = profiles.id AND active = true)
);
CREATE POLICY "Admin full access" ON profiles FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');
CREATE POLICY "Service role access" ON profiles FOR ALL TO service_role USING (true);

-- Coach-client assignments policies
DROP POLICY IF EXISTS "Coaches can view their assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Clients can view their assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Admin manages assignments" ON coach_client_assignments;

CREATE POLICY "Coaches can view their assignments" ON coach_client_assignments FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "Clients can view their assignments" ON coach_client_assignments FOR SELECT TO authenticated USING (client_id = auth.uid());
CREATE POLICY "Admin manages assignments" ON coach_client_assignments FOR ALL TO authenticated USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- Exercises policies
DROP POLICY IF EXISTS "Everyone can view exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can create exercises" ON exercises;
DROP POLICY IF EXISTS "Creators can update their exercises" ON exercises;
DROP POLICY IF EXISTS "Creators can delete their exercises" ON exercises;

CREATE POLICY "Everyone can view exercises" ON exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Coaches can create exercises" ON exercises FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
);
CREATE POLICY "Creators can update their exercises" ON exercises FOR UPDATE TO authenticated USING (created_by = auth.uid());
CREATE POLICY "Creators can delete their exercises" ON exercises FOR DELETE TO authenticated USING (created_by = auth.uid());

-- Workouts policies
DROP POLICY IF EXISTS "Users can view their workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches and clients can create workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches and clients can update workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches and clients can delete workouts" ON workouts;

CREATE POLICY "Users can view their workouts" ON workouts FOR SELECT TO authenticated USING (coach_id = auth.uid() OR client_id = auth.uid());
CREATE POLICY "Coaches and clients can create workouts" ON workouts FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid() OR client_id = auth.uid());
CREATE POLICY "Coaches and clients can update workouts" ON workouts FOR UPDATE TO authenticated USING (coach_id = auth.uid() OR client_id = auth.uid());
CREATE POLICY "Coaches and clients can delete workouts" ON workouts FOR DELETE TO authenticated USING (coach_id = auth.uid() OR client_id = auth.uid());

-- Workout exercises policies
DROP POLICY IF EXISTS "Users can view workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Users can manage workout exercises" ON workout_exercises;

CREATE POLICY "Users can view workout exercises" ON workout_exercises FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM workouts WHERE id = workout_id AND (coach_id = auth.uid() OR client_id = auth.uid()))
);
CREATE POLICY "Users can manage workout exercises" ON workout_exercises FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM workouts WHERE id = workout_id AND (coach_id = auth.uid() OR client_id = auth.uid()))
);

-- Templates policies
DROP POLICY IF EXISTS "Everyone can view public templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can create templates" ON workout_templates;
DROP POLICY IF EXISTS "Creators can manage templates" ON workout_templates;

CREATE POLICY "Everyone can view public templates" ON workout_templates FOR SELECT TO authenticated USING (is_public = true OR created_by = auth.uid());
CREATE POLICY "Coaches can create templates" ON workout_templates FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
);
CREATE POLICY "Creators can manage templates" ON workout_templates FOR ALL TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Template owners manage exercises" ON template_exercises;

CREATE POLICY "Users can view template exercises" ON template_exercises FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM workout_templates WHERE id = template_id AND (is_public = true OR created_by = auth.uid()))
);
CREATE POLICY "Template owners manage exercises" ON template_exercises FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM workout_templates WHERE id = template_id AND created_by = auth.uid())
);

-- Programs policies
DROP POLICY IF EXISTS "Users can view their programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can create programs" ON workout_programs;
DROP POLICY IF EXISTS "Creators can manage programs" ON workout_programs;

CREATE POLICY "Users can view their programs" ON workout_programs FOR SELECT TO authenticated USING (
  created_by = auth.uid() OR client_id = auth.uid() OR program_type = 'standard'
);
CREATE POLICY "Coaches can create programs" ON workout_programs FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('coach', 'admin'))
);
CREATE POLICY "Creators can manage programs" ON workout_programs FOR ALL TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can view program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Program owners manage weeks" ON program_weeks;

CREATE POLICY "Users can view program weeks" ON program_weeks FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM workout_programs WHERE id = program_id AND (created_by = auth.uid() OR client_id = auth.uid() OR program_type = 'standard'))
);
CREATE POLICY "Program owners manage weeks" ON program_weeks FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM workout_programs WHERE id = program_id AND created_by = auth.uid())
);

DROP POLICY IF EXISTS "Users can view program days" ON program_days;
DROP POLICY IF EXISTS "Program owners manage days" ON program_days;

CREATE POLICY "Users can view program days" ON program_days FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON wp.id = pw.program_id
    WHERE pw.id = week_id AND (wp.created_by = auth.uid() OR wp.client_id = auth.uid() OR wp.program_type = 'standard')
  )
);
CREATE POLICY "Program owners manage days" ON program_days FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON wp.id = pw.program_id
    WHERE pw.id = week_id AND wp.created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view program exercises" ON program_week_exercises;
DROP POLICY IF EXISTS "Program owners manage exercises" ON program_week_exercises;

CREATE POLICY "Users can view program exercises" ON program_week_exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Program owners manage exercises" ON program_week_exercises FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM program_days pd
    JOIN program_weeks pw ON pw.id = pd.week_id
    JOIN workout_programs wp ON wp.id = pw.program_id
    WHERE pd.id = day_id AND wp.created_by = auth.uid()
  )
);

-- Performance metrics policies
DROP POLICY IF EXISTS "Users can view their metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Clients can manage their metrics" ON performance_metrics;

CREATE POLICY "Users can view their metrics" ON performance_metrics FOR SELECT TO authenticated USING (
  client_id = auth.uid() OR EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE client_id = performance_metrics.client_id AND coach_id = auth.uid() AND active = true
  )
);
CREATE POLICY "Clients can manage their metrics" ON performance_metrics FOR ALL TO authenticated USING (client_id = auth.uid());

-- Messages policies
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;

CREATE POLICY "Users can view their messages" ON messages FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());

-- Swing analyses policies
DROP POLICY IF EXISTS "Users can view their analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Clients can upload analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can update analyses" ON swing_analyses;

CREATE POLICY "Users can view their analyses" ON swing_analyses FOR SELECT TO authenticated USING (client_id = auth.uid() OR coach_id = auth.uid());
CREATE POLICY "Clients can upload analyses" ON swing_analyses FOR INSERT TO authenticated WITH CHECK (client_id = auth.uid());
CREATE POLICY "Coaches can update analyses" ON swing_analyses FOR UPDATE TO authenticated USING (coach_id = auth.uid());

-- Client intake forms policies
DROP POLICY IF EXISTS "Users can view their form" ON client_intake_forms;
DROP POLICY IF EXISTS "Clients can manage their form" ON client_intake_forms;

CREATE POLICY "Users can view their form" ON client_intake_forms FOR SELECT TO authenticated USING (
  client_id = auth.uid() OR EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE client_id = client_intake_forms.client_id AND coach_id = auth.uid() AND active = true
  )
);
CREATE POLICY "Clients can manage their form" ON client_intake_forms FOR ALL TO authenticated USING (client_id = auth.uid());

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_coach ON coach_client_assignments(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_assignments_client ON coach_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_workouts_coach ON workouts(coach_id);
CREATE INDEX IF NOT EXISTS idx_workouts_client ON workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout ON workout_exercises(workout_id);

-- Helper function for profile creation
CREATE OR REPLACE FUNCTION create_profile_for_user(user_email text, user_id uuid, user_role text DEFAULT 'client')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO profiles (id, email, role, first_name, last_name)
  VALUES (user_id, user_email, user_role, '', '')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION create_profile_for_user(text, uuid, text) TO authenticated;

-- Auto-assign coach trigger function
CREATE OR REPLACE FUNCTION auto_assign_default_coach()
RETURNS TRIGGER AS $$
DECLARE
  default_coach_id uuid;
BEGIN
  IF NEW.role = 'client' THEN
    SELECT id INTO default_coach_id
    FROM profiles
    WHERE email = 'brian@bowtaifitness.com'
    LIMIT 1;

    IF default_coach_id IS NOT NULL THEN
      INSERT INTO coach_client_assignments (coach_id, client_id, active)
      VALUES (default_coach_id, NEW.id, true)
      ON CONFLICT (coach_id, client_id) DO NOTHING;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS assign_coach_to_new_client ON profiles;
CREATE TRIGGER assign_coach_to_new_client
  AFTER INSERT ON profiles
  FOR EACH ROW
  WHEN (NEW.role = 'client')
  EXECUTE FUNCTION auto_assign_default_coach();

-- Schema reload function
CREATE OR REPLACE FUNCTION reload_schema()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NOTIFY pgrst, 'reload schema';
END;
$$;

GRANT EXECUTE ON FUNCTION reload_schema() TO authenticated;

-- Reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
SELECT pg_notify('pgrst', 'reload config');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'DEV database schema created successfully!';
  RAISE NOTICE 'Tables created: profiles, coach_client_assignments, exercises, workouts, workout_exercises, workout_templates, template_exercises, workout_programs, program_weeks, program_days, program_week_exercises, performance_metrics, messages, swing_analyses, client_intake_forms';
END $$;
