/*
  # Initial Schema for Birdies by Bowtai Golf Coaching Platform

  1. New Tables
    - `profiles`
      - `id` (uuid, references auth.users)
      - `role` (text, 'coach' or 'client')
      - `first_name` (text)
      - `last_name` (text)
      - `avatar_url` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `exercises`
      - `id` (uuid, primary key)
      - `name` (text)
      - `category` (text: strength, mobility, power, stability, conditioning)
      - `description` (text)
      - `instructions` (text array)
      - `equipment` (text array)
      - `duration` (integer, minutes)
      - `reps` (integer, optional)
      - `sets` (integer, optional)
      - `video_url` (text, optional)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)

    - `workouts`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text)
      - `coach_id` (uuid, references profiles)
      - `client_id` (uuid, references profiles)
      - `scheduled_date` (date)
      - `completed` (boolean, default false)
      - `notes` (text, optional)
      - `created_at` (timestamp)

    - `workout_exercises`
      - `id` (uuid, primary key)
      - `workout_id` (uuid, references workouts)
      - `exercise_id` (uuid, references exercises)
      - `sets` (integer, optional)
      - `reps` (integer, optional)
      - `weight` (decimal, optional)
      - `duration` (integer, optional)
      - `notes` (text, optional)
      - `order_index` (integer)

    - `performance_metrics`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references profiles)
      - `date` (date)
      - `swing_speed` (decimal, optional)
      - `carry_distance` (decimal, optional)
      - `total_distance` (decimal, optional)
      - `clubhead_speed` (decimal, optional)
      - `ball_speed` (decimal, optional)
      - `driving_accuracy` (decimal, optional)
      - `greens_in_regulation` (decimal, optional)
      - `putting_average` (decimal, optional)
      - `notes` (text, optional)
      - `created_at` (timestamp)

    - `messages`
      - `id` (uuid, primary key)
      - `sender_id` (uuid, references profiles)
      - `receiver_id` (uuid, references profiles)
      - `content` (text)
      - `read` (boolean, default false)
      - `created_at` (timestamp)

    - `swing_analyses`
      - `id` (uuid, primary key)
      - `client_id` (uuid, references profiles)
      - `coach_id` (uuid, references profiles)
      - `video_url` (text)
      - `analysis` (text, optional)
      - `feedback` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users based on roles
    - Coaches can manage their clients' data
    - Clients can only access their own data
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('coach', 'client')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create exercises table
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('strength', 'mobility', 'power', 'stability', 'conditioning')),
  description text NOT NULL,
  instructions text[] DEFAULT '{}',
  equipment text[] DEFAULT '{}',
  duration integer,
  reps integer,
  sets integer,
  video_url text,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create workouts table
CREATE TABLE IF NOT EXISTS workouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  coach_id uuid NOT NULL REFERENCES profiles(id),
  client_id uuid NOT NULL REFERENCES profiles(id),
  scheduled_date date NOT NULL,
  completed boolean DEFAULT false,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create workout_exercises table
CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id uuid NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  sets integer,
  reps integer,
  weight decimal,
  duration integer,
  notes text,
  order_index integer DEFAULT 0
);

-- Create performance_metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id),
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
  sender_id uuid NOT NULL REFERENCES profiles(id),
  receiver_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create swing_analyses table
CREATE TABLE IF NOT EXISTS swing_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES profiles(id),
  coach_id uuid NOT NULL REFERENCES profiles(id),
  video_url text NOT NULL,
  analysis text,
  feedback text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE swing_analyses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Exercises policies
CREATE POLICY "Everyone can view exercises"
  ON exercises
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create exercises"
  ON exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Workouts policies
CREATE POLICY "Coaches can view their workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );

CREATE POLICY "Coaches can create workouts"
  ON workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

-- Performance metrics policies
CREATE POLICY "Users can view own performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.id = auth.uid() 
      AND p1.role = 'coach'
      AND p2.id = client_id
      AND p2.role = 'client'
    )
  );

CREATE POLICY "Clients can insert own performance metrics"
  ON performance_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view their messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages"
  ON messages
  FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- Swing analyses policies
CREATE POLICY "Users can view their swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (client_id = auth.uid() OR coach_id = auth.uid());

CREATE POLICY "Clients can upload swing videos"
  ON swing_analyses
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- Insert sample exercises
INSERT INTO exercises (name, category, description, instructions, equipment, duration, reps, sets) VALUES
('Golf-Specific Hip Rotation', 'mobility', 'Improve hip mobility for better rotation in your golf swing', 
 ARRAY['Stand with feet shoulder-width apart', 'Place hands on hips', 'Slowly rotate hips in clockwise motion', 'Complete 10 rotations each direction'], 
 ARRAY['None'], 10, 10, 2),

('Core Power Rotation', 'power', 'Build rotational power for increased clubhead speed',
 ARRAY['Hold medicine ball at chest level', 'Rotate torso left and right explosively', 'Keep feet planted', 'Complete 3 sets of 12 reps'],
 ARRAY['Medicine Ball'], 15, 12, 3),

('Single-Leg Balance', 'stability', 'Improve balance and stability for consistent ball striking',
 ARRAY['Stand on one leg', 'Hold position for 30 seconds', 'Close eyes for added difficulty', 'Repeat on both legs'],
 ARRAY['None'], 8, null, null),

('Glute Bridge', 'strength', 'Strengthen glutes for more powerful hip drive',
 ARRAY['Lie on back with knees bent', 'Squeeze glutes and lift hips up', 'Hold for 2 seconds at top', 'Lower slowly and repeat'],
 ARRAY['None'], 12, 15, 3),

('Shoulder Mobility Sequence', 'mobility', 'Improve shoulder range of motion for better swing mechanics',
 ARRAY['Hold resistance band with both hands', 'Stretch arms overhead', 'Move through full range of motion', 'Hold stretches for 30 seconds each'],
 ARRAY['Resistance Band'], 15, null, null),

('Plyometric Jump Squats', 'power', 'Develop explosive leg power for distance',
 ARRAY['Start in squat position', 'Jump up explosively', 'Land softly in squat', 'Complete 3 sets of 8 reps'],
 ARRAY['None'], 10, 8, 3);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, role, first_name, last_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data ->> 'role', 'client'),
    COALESCE(new.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(new.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN new;
END;
$$ language plpgsql security definer;

-- Trigger to automatically create profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();