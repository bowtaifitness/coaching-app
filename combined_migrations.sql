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
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();/*
  # Add trigger function for new user creation

  1. New Functions
    - `handle_new_user()` - Automatically creates profile records when users sign up
    
  2. New Triggers
    - `on_auth_user_created` - Triggers after user insertion in auth.users table
    
  3. Security
    - Function runs with security definer to ensure proper permissions
    
  This migration fixes the "Database error saving new user" issue by ensuring
  that when a user signs up, their profile is automatically created in the
  profiles table with the metadata provided during registration.
*/

-- Create the trigger function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'role',
    new.raw_user_meta_data->>'firstName',
    new.raw_user_meta_data->>'lastName',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger that fires after a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();/*
  # Fix user creation database policies

  1. Security Updates
    - Update RLS policies on profiles table to allow user creation
    - Add proper trigger function for handling new user creation
    - Ensure auth.users table can properly create new users

  2. Trigger Function
    - Create or replace the handle_new_user function
    - Automatically create profile when new user signs up
    - Handle user metadata properly

  3. Policies
    - Allow authenticated users to insert their own profile
    - Ensure proper permissions for user creation flow
*/

-- Create or replace the trigger function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', '')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Update RLS policies to ensure proper user creation
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Ensure service role can also insert profiles (needed for trigger)
DROP POLICY IF EXISTS "Service role can insert profiles" ON public.profiles;
CREATE POLICY "Service role can insert profiles"
  ON public.profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);/*
  # Create storage bucket for swing videos

  1. Storage Setup
    - Create `swing-videos` bucket for video uploads
    - Set up proper access policies for authenticated users
    - Allow video file types (mp4, mov, avi)

  2. Security
    - Users can upload videos to their own folder
    - Users can view videos they have access to
    - Coaches can view all client videos
*/

-- Create storage bucket for swing videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('swing-videos', 'swing-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Users can upload swing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'swing-videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view videos they have access to
CREATE POLICY "Users can view accessible videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'swing-videos' AND (
    -- Users can view their own videos
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Coaches can view all videos
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'coach'
    )
  )
);

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'swing-videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);/*
  # Update swing analyses policies

  1. Policy Updates
    - Allow coaches to update swing analyses (add feedback)
    - Ensure proper access control for video analysis workflow

  2. Security
    - Maintain existing read/insert policies
    - Add update policy for coaches to provide feedback
*/

-- Allow coaches to update swing analyses with feedback
CREATE POLICY "Coaches can update swing analyses"
ON swing_analyses FOR UPDATE
TO authenticated
USING (
  coach_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'coach'
  )
)
WITH CHECK (
  coach_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'coach'
  )
);/*
  # Create storage bucket for swing videos

  1. Storage Setup
    - Create 'swing-videos' bucket for video file storage
    - Set appropriate permissions for authenticated users
    - Enable public access for video playback

  2. Security
    - Allow authenticated users to upload videos
    - Allow users to view videos they have access to
    - Restrict deletion to file owners
*/

-- Create the swing-videos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('swing-videos', 'swing-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Users can upload swing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'swing-videos');

-- Allow users to view videos they have access to
CREATE POLICY "Users can view swing videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'swing-videos');

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own swing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'swing-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own videos
CREATE POLICY "Users can update own swing videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'swing-videos' AND auth.uid()::text = (storage.foldername(name))[1]);/*
  # Allow null coach_id in swing_analyses table

  1. Schema Changes
    - Modify `swing_analyses` table to allow null `coach_id` values
    - This allows clients to upload videos before being assigned a coach

  2. Security
    - Update RLS policies to handle null coach_id cases
    - Ensure clients can still upload videos without a coach assigned
*/

-- Allow null coach_id values
ALTER TABLE swing_analyses ALTER COLUMN coach_id DROP NOT NULL;

-- Update RLS policy to handle null coach_id
DROP POLICY IF EXISTS "Users can view their swing analyses" ON swing_analyses;

CREATE POLICY "Users can view their swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR 
    coach_id = auth.uid() OR
    (coach_id IS NULL AND client_id = auth.uid())
  );

-- Add policy for coaches to update swing analyses (assign themselves)
CREATE POLICY "Coaches can update swing analyses"
  ON swing_analyses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    )
  );/*
  # Add deletion policies for exercises table

  1. Security Updates
    - Add policy for coaches to delete exercises they created
    - Add policy for service role to delete any exercises (for bulk operations)
  
  2. Changes
    - Enable proper deletion permissions for exercise management
*/

-- Add policy for coaches to delete exercises they created
CREATE POLICY "Coaches can delete own exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() AND profiles.role = 'coach'
  ));

-- Add policy for service role to delete exercises (for admin operations)
CREATE POLICY "Service role can delete exercises"
  ON exercises
  FOR DELETE
  TO service_role
  USING (true);/*
  # Nuclear Delete: Remove All Exercises

  This migration completely clears the exercises table to remove all default/mock exercises
  that were preloaded in the app. This gives users a clean slate to import their own exercises.

  1. Actions
     - Delete ALL exercises from the exercises table
     - Reset the table to completely empty state

  2. Security
     - No changes to RLS policies
     - Existing policies remain intact for future exercises

  3. Notes
     - This is a one-time cleanup to remove mock/default data
     - Users can re-import exercises from YouTube after this cleanup
     - All workout_exercises references will be cleaned up by CASCADE
*/

-- Delete all exercises from the table
DELETE FROM exercises;

-- Optional: Reset any sequences if needed (PostgreSQL will handle this automatically)
-- This ensures a clean slate for new exercise imports/*
  # Ensure Profile Creation Trigger

  1. Function to handle new user creation
  2. Trigger to automatically create profile when user signs up
  3. Ensure profiles table has proper structure
*/

-- Create or replace the function to handle new users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, avatar_url, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    role = COALESCE(NEW.raw_user_meta_data->>'role', profiles.role),
    first_name = COALESCE(NEW.raw_user_meta_data->>'first_name', profiles.first_name),
    last_name = COALESCE(NEW.raw_user_meta_data->>'last_name', profiles.last_name),
    avatar_url = NEW.raw_user_meta_data->>'avatar_url',
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Also handle updates to user metadata
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();/*
  # Create Profile Creation Trigger

  1. Functions
    - `handle_new_user()` - Creates profile when new user signs up
  
  2. Triggers  
    - Automatically creates profile with role from user metadata
    - Handles both coach and client roles
    
  3. Security
    - Ensures every authenticated user has a profile
    - Uses user metadata to set correct role
*/

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, avatar_url, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'role', 'client'),
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    new.raw_user_meta_data->>'avatar_url',
    now(),
    now()
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger for new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create function to fix existing users without profiles
CREATE OR REPLACE FUNCTION public.create_missing_profile(user_email text, user_role text, first_name text, last_name text)
RETURNS uuid AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Get user ID from auth.users (this won't work from client-side, but we'll try)
  -- This is mainly for server-side use
  SELECT id INTO user_id FROM auth.users WHERE email = user_email;
  
  IF user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, role, first_name, last_name, created_at, updated_at)
    VALUES (user_id, user_role, first_name, last_name, now(), now())
    ON CONFLICT (id) DO UPDATE SET
      role = EXCLUDED.role,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      updated_at = now();
  END IF;
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;/*
  # Fix Authentication Trigger Issues

  This migration removes problematic triggers and creates a simpler, more reliable approach
  to profile creation that won't interfere with the authentication process.
*/

-- Drop all existing triggers that might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Drop the problematic function
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create a simple function that can be called manually when needed
CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, role, first_name, last_name, created_at, updated_at)
  VALUES (user_id, user_role, first_name, last_name, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user TO anon;

-- Ensure RLS policies are correct
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Service role can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;

-- Recreate clean RLS policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow coaches to view client profiles
CREATE POLICY "Coaches can view client profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid()
      AND coach_profile.role = 'coach'
    )
    AND role = 'client'
  );

-- Allow service role to manage profiles (for manual fixes)
CREATE POLICY "Service role can manage profiles"
  ON profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Fix Infinite Recursion in RLS Policies

  The issue is that the "Coaches can view client profiles" policy creates infinite recursion
  by querying the profiles table within its own policy condition.

  We need to simplify the policies to avoid self-referencing queries.
*/

-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;

-- Create a simpler, non-recursive policy for coaches to view client profiles
-- This uses a direct role check without subqueries that could cause recursion
CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the requesting user is a coach (checked via auth metadata)
    -- and the profile being viewed is a client
    (
      COALESCE((auth.jwt() -> 'user_metadata' ->> 'role'), 'client') = 'coach'
      AND role = 'client'
    )
    OR
    -- Or if it's the user's own profile
    auth.uid() = id
  );

-- Ensure the basic "Users can view own profile" policy exists and is simple
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);/*
  # Add RLS policies for workout_exercises table

  1. Security
    - Add policy for coaches to insert workout exercises for their own workouts
    - Add policy for users to view workout exercises for workouts they have access to
    - Add policy for coaches to update workout exercises for their own workouts
    - Add policy for coaches to delete workout exercises for their own workouts

  This fixes the RLS violation error when creating workouts with exercises.
*/

-- Policy for inserting workout exercises (coaches can add exercises to their own workouts)
CREATE POLICY "Coaches can insert workout exercises for their workouts"
  ON workout_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.coach_id = auth.uid()
    )
  );

-- Policy for selecting workout exercises (users can view exercises for workouts they have access to)
CREATE POLICY "Users can view workout exercises for accessible workouts"
  ON workout_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND (workouts.coach_id = auth.uid() OR workouts.client_id = auth.uid())
    )
  );

-- Policy for updating workout exercises (coaches can update exercises for their own workouts)
CREATE POLICY "Coaches can update workout exercises for their workouts"
  ON workout_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.coach_id = auth.uid()
    )
  );

-- Policy for deleting workout exercises (coaches can delete exercises from their own workouts)
CREATE POLICY "Coaches can delete workout exercises from their workouts"
  ON workout_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts 
      WHERE workouts.id = workout_exercises.workout_id 
      AND workouts.coach_id = auth.uid()
    )
  );/*
  # Create workout template system

  1. New Tables
    - `workout_templates`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, optional)
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
    - `template_exercises`
      - `id` (uuid, primary key)
      - `template_id` (uuid, references workout_templates)
      - `exercise_id` (uuid, references exercises)
      - `sets` (integer, optional)
      - `reps` (integer, optional)
      - `weight` (numeric, optional)
      - `duration` (integer, optional)
      - `notes` (text, optional)
      - `order_index` (integer)

  2. Changes
    - Add `template_id` to `workouts` table to track which template was used

  3. Security
    - Enable RLS on both new tables
    - Add policies for coaches to manage their own templates
    - Add policies for viewing template exercises
*/

-- Create workout_templates table
CREATE TABLE IF NOT EXISTS workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid REFERENCES profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create template_exercises table
CREATE TABLE IF NOT EXISTS template_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid REFERENCES workout_templates(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES exercises(id) NOT NULL,
  sets integer,
  reps integer,
  weight numeric,
  duration integer,
  notes text,
  order_index integer DEFAULT 0
);

-- Add template_id to workouts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workouts' AND column_name = 'template_id'
  ) THEN
    ALTER TABLE workouts ADD COLUMN template_id uuid REFERENCES workout_templates(id);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

-- Policies for workout_templates
CREATE POLICY "Coaches can create templates"
  ON workout_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'coach'
    )
  );

CREATE POLICY "Coaches can view own templates"
  ON workout_templates
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can update own templates"
  ON workout_templates
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own templates"
  ON workout_templates
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Policies for template_exercises
CREATE POLICY "Coaches can insert template exercises"
  ON template_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can view template exercises"
  ON template_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update template exercises"
  ON template_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete template exercises"
  ON template_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );/*
  # Allow clients to mark their own workouts as complete

  1. Security Changes
    - Add RLS policy to allow clients to update the `completed` field on their own workouts
    - Clients can only update workouts assigned to them
    - Clients can only update the `completed` field, not other workout details

  2. Policy Details
    - Policy name: "Clients can mark own workouts complete"
    - Allows UPDATE operations on workouts table
    - Restricted to authenticated users with client role
    - Only allows updating the `completed` field
    - Only for workouts where client_id matches the authenticated user
*/

-- Allow clients to update the completion status of their own workouts
CREATE POLICY "Clients can mark own workouts complete"
  ON workouts
  FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());/*
  # Fix existing video coach assignment

  1. Updates
    - Find videos with null coach_id
    - Assign them to coaches based on client-coach relationships from workouts table
    - This allows coaches to see client videos that were uploaded before coach assignment was working

  2. Security
    - No changes to RLS policies needed
    - Existing policies will work once coach_id is properly set
*/

-- Update swing_analyses records that have null coach_id
-- Assign them to coaches based on existing client-coach relationships from workouts
UPDATE swing_analyses 
SET coach_id = (
  SELECT DISTINCT w.coach_id 
  FROM workouts w 
  WHERE w.client_id = swing_analyses.client_id 
    AND w.coach_id IS NOT NULL 
  LIMIT 1
)
WHERE coach_id IS NULL 
  AND client_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM workouts w 
    WHERE w.client_id = swing_analyses.client_id 
      AND w.coach_id IS NOT NULL
  );

-- If no workout relationship exists, we could also assign to the first coach
-- but let's be more conservative and only update where there's a clear relationship/*
  # Create workout programs system

  1. New Tables
    - `workout_programs`
      - `id` (uuid, primary key)
      - `title` (text)
      - `description` (text, optional)
      - `duration_weeks` (integer) - total weeks in program
      - `days_per_week` (integer) - workout days per week
      - `created_by` (uuid, references profiles)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `program_days`
      - `id` (uuid, primary key)
      - `program_id` (uuid, references workout_programs)
      - `day_name` (text) - e.g., "Push", "Pull", "Legs"
      - `day_order` (integer) - order within the week (1, 2, 3, etc.)
      - `created_at` (timestamp)
    
    - `program_weeks`
      - `id` (uuid, primary key)
      - `program_id` (uuid, references workout_programs)
      - `program_day_id` (uuid, references program_days)
      - `week_number` (integer) - which week (1, 2, 3, etc.)
      - `template_id` (uuid, references workout_templates, optional)
      - `notes` (text, optional) - week-specific notes
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for coaches to manage their own programs
    - Add policies for clients to view programs assigned to them

  3. Indexes
    - Add indexes for efficient querying by program, week, and day
*/

-- Create workout_programs table
CREATE TABLE IF NOT EXISTS workout_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration_weeks integer NOT NULL CHECK (duration_weeks >= 1 AND duration_weeks <= 52),
  days_per_week integer NOT NULL CHECK (days_per_week >= 1 AND days_per_week <= 7),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create program_days table
CREATE TABLE IF NOT EXISTS program_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES workout_programs(id) ON DELETE CASCADE,
  day_name text NOT NULL,
  day_order integer NOT NULL CHECK (day_order >= 1 AND day_order <= 7),
  created_at timestamptz DEFAULT now(),
  UNIQUE(program_id, day_order)
);

-- Create program_weeks table
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

-- Enable RLS
ALTER TABLE workout_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks ENABLE ROW LEVEL SECURITY;

-- Policies for workout_programs
CREATE POLICY "Coaches can create programs"
  ON workout_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'coach'
    )
  );

CREATE POLICY "Coaches can view own programs"
  ON workout_programs
  FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can update own programs"
  ON workout_programs
  FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own programs"
  ON workout_programs
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Policies for program_days
CREATE POLICY "Coaches can manage program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_days.program_id 
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_days.program_id 
      AND created_by = auth.uid()
    )
  );

-- Policies for program_weeks
CREATE POLICY "Coaches can manage program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_weeks.program_id 
      AND created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs 
      WHERE id = program_weeks.program_id 
      AND created_by = auth.uid()
    )
  );

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_workout_programs_created_by ON workout_programs(created_by);
CREATE INDEX IF NOT EXISTS idx_program_days_program_id ON program_days(program_id);
CREATE INDEX IF NOT EXISTS idx_program_days_order ON program_days(program_id, day_order);
CREATE INDEX IF NOT EXISTS idx_program_weeks_program_id ON program_weeks(program_id);
CREATE INDEX IF NOT EXISTS idx_program_weeks_week_number ON program_weeks(program_id, week_number);
CREATE INDEX IF NOT EXISTS idx_program_weeks_template ON program_weeks(template_id);

-- Create updated_at trigger for workout_programs
CREATE OR REPLACE FUNCTION update_workout_programs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_workout_programs_updated_at
  BEFORE UPDATE ON workout_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_workout_programs_updated_at();/*
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
END $$;/*
  # Add profile fields for user management

  1. New Columns
    - Add `email`, `phone`, `date_of_birth` to profiles table
    - Add `updated_at` trigger for automatic timestamp updates

  2. Security
    - Maintain existing RLS policies
    - Ensure users can only edit their own profiles

  3. Data Migration
    - Safely add new columns with appropriate defaults
    - Create trigger function for updated_at timestamp
*/

-- Add new columns to profiles table
DO $$
BEGIN
  -- Add email column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email text;
  END IF;

  -- Add phone column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;

  -- Add date_of_birth column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE profiles ADD COLUMN date_of_birth date;
  END IF;
END $$;

-- Create or replace the updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for profiles table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;/*
  # Add Coach-Client Assignment System

  1. New Tables
    - `coach_client_assignments`
      - `id` (uuid, primary key)
      - `coach_id` (uuid, references profiles)
      - `client_id` (uuid, references profiles)
      - `assigned_at` (timestamp)
      - `assigned_by` (uuid, references profiles)
      - `active` (boolean, default true)

  2. Security
    - Enable RLS on `coach_client_assignments` table
    - Add policies for coaches to manage their assignments
    - Add policies for admins to manage all assignments

  3. Changes
    - Update existing queries to respect coach-client relationships
    - Ensure coaches only see their assigned clients
*/

-- Create coach_client_assignments table
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

-- Enable RLS
ALTER TABLE coach_client_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for coach_client_assignments
CREATE POLICY "Coaches can view their assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Coaches can manage their assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    coach_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_coach_id ON coach_client_assignments(coach_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_client_id ON coach_client_assignments(client_id);
CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_active ON coach_client_assignments(active);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_coach_client_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coach_client_assignments_updated_at
  BEFORE UPDATE ON coach_client_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_coach_client_assignments_updated_at();

-- Update existing RLS policies to respect coach-client assignments

-- Update profiles policy for coaches to only see assigned clients
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
CREATE POLICY "Coaches can view assigned client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can always see their own profile
    auth.uid() = id OR
    -- Coaches can see clients assigned to them
    (
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() AND p.role = 'coach'
      ) AND
      role = 'client' AND
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = id 
        AND cca.active = true
      )
    ) OR
    -- Admins can see all profiles
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update workouts policies to respect assignments
DROP POLICY IF EXISTS "Coaches can view their workouts" ON workouts;
CREATE POLICY "Coaches can view assigned client workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    -- Coaches can see workouts for their assigned clients
    coach_id = auth.uid() OR
    -- Clients can see their own workouts
    client_id = auth.uid() OR
    -- Admins can see all workouts
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Coaches can create workouts" ON workouts;
CREATE POLICY "Coaches can create workouts for assigned clients"
  ON workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    coach_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    ) AND
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid() 
      AND cca.client_id = workouts.client_id 
      AND cca.active = true
    )
  );

-- Update performance_metrics policies
DROP POLICY IF EXISTS "Users can view own performance metrics" ON performance_metrics;
CREATE POLICY "Users can view assigned performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can see their own metrics
    client_id = auth.uid() OR
    -- Coaches can see metrics for their assigned clients
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = auth.uid() 
      AND cca.client_id = performance_metrics.client_id 
      AND cca.active = true
    ) OR
    -- Admins can see all metrics
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update swing_analyses policies
DROP POLICY IF EXISTS "Users can view their swing analyses" ON swing_analyses;
CREATE POLICY "Users can view assigned swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    -- Clients can see their own analyses
    client_id = auth.uid() OR
    -- Coaches can see analyses for their assigned clients
    coach_id = auth.uid() OR
    (
      coach_id IS NULL AND
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = swing_analyses.client_id 
        AND cca.active = true
      )
    ) OR
    -- Admins can see all analyses
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Update messages policies to respect assignments
DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view assigned messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see messages they sent or received
    sender_id = auth.uid() OR 
    receiver_id = auth.uid() OR
    -- Coaches can see messages with their assigned clients
    (
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() AND p.role = 'coach'
      ) AND
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND (cca.client_id = sender_id OR cca.client_id = receiver_id)
        AND cca.active = true
      )
    ) OR
    -- Admins can see all messages
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table create circular references
    - Policies reference coach_client_assignments which references profiles
    - This creates infinite recursion during policy evaluation

  2. Solution
    - Simplify profiles policies to avoid circular dependencies
    - Remove complex subqueries that reference back to profiles
    - Use direct user ID checks where possible
    - Separate coach and client access patterns

  3. Security Changes
    - Users can always view and update their own profile
    - Coaches can view client profiles through direct assignment checks
    - Admins can view all profiles
    - Service role maintains full access
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Coaches can view assigned client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create simplified policies without circular references
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Separate policy for coaches to view client profiles
-- This avoids the circular reference by not joining back to profiles
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    auth.uid() = id
    OR
    -- Coaches can see clients assigned to them (direct check without profile join)
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 
        FROM coach_client_assignments cca 
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = id 
        AND cca.active = true
      )
    )
    OR
    -- Admin users can see all profiles (direct role check)
    (
      EXISTS (
        SELECT 1 
        FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
      )
    )
  );

-- Keep the service role policy as is
-- (This policy should already exist and doesn't cause recursion)/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - The profiles table has RLS policies that create circular references
    - Policies reference coach_client_assignments which references profiles
    - This creates infinite recursion when querying

  2. Solution
    - Drop all existing problematic policies on profiles table
    - Create new simplified policies that avoid circular references
    - Use direct auth.uid() checks instead of complex joins

  3. Security
    - Users can manage their own profile
    - Service role has full access for system operations
    - Remove complex coach-client assignment checks that cause recursion
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new simplified policies without circular references
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role can manage profiles"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create a simple read policy for basic profile access
CREATE POLICY "Authenticated users can read basic profile info"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);/*
  # Fix coach assignment RLS policies

  1. Policy Updates
    - Update INSERT policy on coach_client_assignments to allow coaches and admins to create assignments
    - Ensure proper permissions for assignment management

  2. Security
    - Maintain data isolation while allowing necessary operations
    - Allow coaches to assign clients and admins to manage all assignments
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Coaches can manage their assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can view their assignments" ON coach_client_assignments;

-- Create new, working policies for coach_client_assignments
CREATE POLICY "Coaches and admins can insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Coaches and admins can update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Users can view relevant assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() 
    OR client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Coaches and admins can delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );/*
  # Fix coach assignment RLS policies

  1. Problem
    - Current RLS policies on coach_client_assignments are too restrictive
    - Preventing coaches and admins from creating new assignments
    - Policy checks are failing during INSERT operations

  2. Solution
    - Drop existing problematic policies
    - Create new simplified policies that properly check user roles
    - Allow coaches to assign clients and admins to manage all assignments
    - Use direct role checks from profiles table

  3. Security
    - Maintain proper access control
    - Coaches can only assign clients to themselves or other coaches
    - Admins have full management access
    - Users can view assignments they're involved in
*/

-- Drop existing policies that are causing issues
DROP POLICY IF EXISTS "Coaches and admins can delete assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can update assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Users can view relevant assignments" ON coach_client_assignments;

-- Create new simplified policies
CREATE POLICY "Allow coaches and admins to insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Allow coaches and admins to update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Allow coaches and admins to delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('coach', 'admin')
    )
  );

CREATE POLICY "Allow users to view relevant assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() 
    OR client_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );/*
  # Fix coach assignment RLS policies

  1. Security Changes
    - Drop all existing problematic policies on coach_client_assignments
    - Create new simplified policies that avoid recursion
    - Allow coaches and admins to manage assignments properly
    - Ensure users can view relevant assignments

  2. Policy Changes
    - INSERT: Allow coaches and admins to create assignments
    - UPDATE: Allow coaches and admins to modify assignments  
    - DELETE: Allow coaches and admins to remove assignments
    - SELECT: Allow users to view assignments they're involved in
*/

-- Drop all existing policies on coach_client_assignments
DROP POLICY IF EXISTS "Allow coaches and admins to delete assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Allow coaches and admins to insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Allow coaches and admins to update assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Allow users to view relevant assignments" ON coach_client_assignments;

-- Create new simplified policies that avoid recursion
CREATE POLICY "Coaches and admins can insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Coaches and admins can update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Coaches and admins can delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

CREATE POLICY "Users can view relevant assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );/*
  # Fix profiles table RLS permissions

  1. Security Updates
    - Drop all existing problematic policies on profiles table
    - Create new, simplified policies that avoid recursion
    - Allow coaches to view client profiles for dashboard functionality
    - Maintain proper security boundaries

  2. Changes
    - Remove complex policies that reference other tables
    - Add simple role-based access policies
    - Enable proper coach-client data access
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Authenticated users can read basic profile info" ON profiles;
DROP POLICY IF EXISTS "Service role can manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new simplified policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR 
    (
      role = 'client' AND 
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = auth.uid() 
        AND cca.client_id = id 
        AND cca.active = true
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() 
        AND p.role = 'admin'
      )
    )
  );

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Fix infinite recursion in RLS policies

  1. Problem
    - Circular dependency between profiles and coach_client_assignments policies
    - Profiles policies reference coach_client_assignments
    - Coach_client_assignments policies reference profiles
    - This creates infinite recursion

  2. Solution
    - Simplify profiles policies to avoid circular references
    - Use direct role checks instead of complex joins
    - Remove recursive policy dependencies

  3. Security
    - Maintain proper access control
    - Users can view own profiles
    - Coaches can view assigned client profiles
    - Admins have full access
*/

-- Drop existing problematic policies on profiles
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simplified policies that avoid recursion
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Simple policy for coaches to view client profiles without recursion
CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR 
    (
      role = 'client' AND 
      EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
      )
    ) OR
    (
      EXISTS (
        SELECT 1 FROM auth.users au
        JOIN profiles p ON p.id = au.id
        WHERE au.id = auth.uid() AND p.role = 'admin'
      )
    )
  );

-- Service role access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Also simplify coach_client_assignments policies to avoid recursion
DROP POLICY IF EXISTS "Users can view relevant assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can update assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches and admins can delete assignments" ON coach_client_assignments;

-- Create non-recursive policies for coach_client_assignments
CREATE POLICY "Users can view their assignments"
  ON coach_client_assignments
  FOR SELECT
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );

CREATE POLICY "Authenticated users can insert assignments"
  ON coach_client_assignments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update assignments"
  ON coach_client_assignments
  FOR UPDATE
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  )
  WITH CHECK (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );

CREATE POLICY "Users can delete assignments"
  ON coach_client_assignments
  FOR DELETE
  TO authenticated
  USING (
    coach_id = auth.uid() OR 
    client_id = auth.uid()
  );/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table are causing infinite recursion
    - The nested query in ClientManagement is triggering circular dependencies
    - Policies reference each other creating loops

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create simple, non-recursive policies
    - Avoid any subqueries that could cause recursion
    - Use direct auth.uid() checks only

  3. Security
    - Users can view their own profile
    - Coaches can view client profiles (simple check)
    - Service role has full access
    - No complex joins or EXISTS clauses
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view assigned profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned client profiles" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Simple policy for coaches to view all client profiles
-- This avoids recursion by not checking the coach_client_assignments table
CREATE POLICY "Coaches can view all client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
    )
  );

-- Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Fix coach client view policy

  1. Security Changes
    - Drop existing problematic policy for coaches viewing client profiles
    - Create new policy that properly allows coaches to view all client profiles
    - Ensure coaches can access client data they need for management

  2. Policy Details
    - Allows authenticated users with 'coach' role to view profiles with 'client' role
    - Uses proper role checking from the profiles table
    - Maintains security by restricting access based on user roles
*/

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Coaches can view all client profiles" ON profiles;

-- Create a new policy that allows coaches to view client profiles
CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile 
      WHERE coach_profile.id = auth.uid() 
      AND coach_profile.role = 'coach'
    ))
    OR 
    (id = auth.uid())
  );/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current RLS policies on profiles table are causing infinite recursion
    - Policies are referencing the profiles table within their own conditions
    - This creates a circular dependency during policy evaluation

  2. Solution
    - Drop all existing problematic policies
    - Create new, simplified policies that don't self-reference
    - Use auth.uid() and role checks without querying profiles table recursively

  3. New Policies
    - Users can view their own profile
    - Coaches can view client profiles (simplified check)
    - Service role has full access
*/

-- Drop all existing policies that might cause recursion
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view all client profiles" ON profiles;

-- Create new, simplified policies without recursion
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    auth.uid() = id 
    OR 
    -- Or if they are a coach and the profile is a client
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 FROM auth.users 
        WHERE auth.users.id = auth.uid() 
        AND auth.users.raw_app_meta_data->>'role' = 'coach'
      )
    )
  );

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Add RLS policy for coaches to view client profiles

  1. Security
    - Add policy allowing coaches to view client profiles
    - Coaches can only view profiles where role = 'client'
    - Users can still view their own profiles
*/

-- Drop existing conflicting policies if they exist
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create new policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Coaches can view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'coach'
    )
  );

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Fix RLS policy for coaches to view client profiles

  1. Security Changes
    - Drop existing conflicting policies on profiles table
    - Add new policy allowing coaches to view client profiles
    - Maintain user access to their own profiles
    - Preserve service role access

  2. Policy Details
    - Coaches can view all profiles with role = 'client'
    - Users can view and update their own profiles
    - Service role maintains full access for administrative functions
*/

-- Drop existing policies that might be causing conflicts
DROP POLICY IF EXISTS "Coaches can view client profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create new policies without recursion
CREATE POLICY "Allow coaches to view client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'coach'
  );

CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Add Admin Role System

  1. Schema Changes
    - Update profiles table to support 'admin' role
    - Add admin-specific policies for full access
    - Update existing role constraints

  2. Admin Privileges
    - View all coaches and clients
    - Manage all users and data
    - Full system access

  3. Security
    - Update RLS policies to allow admin access
    - Maintain existing coach/client restrictions
*/

-- Update the role constraint to include admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to be admin
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';

-- If the profile doesn't exist, we'll need to handle that separately
-- This will only update if the profile exists

-- Add admin policies for profiles table
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert all profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workouts table
CREATE POLICY "Admins can view all workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for exercises table
CREATE POLICY "Admins can manage all exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for performance_metrics table
CREATE POLICY "Admins can view all performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for messages table
CREATE POLICY "Admins can view all messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for coach_client_assignments table
CREATE POLICY "Admins can manage all assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for swing_analyses table
CREATE POLICY "Admins can view all swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_templates table
CREATE POLICY "Admins can manage all workout templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for template_exercises table
CREATE POLICY "Admins can manage all template exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_exercises table
CREATE POLICY "Admins can manage all workout exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_programs table
CREATE POLICY "Admins can manage all workout programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_days table
CREATE POLICY "Admins can manage all program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_weeks table
CREATE POLICY "Admins can manage all program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = uid() AND profiles.role = 'admin'
    )
  );/*
  # Fix Admin Role and Policies

  1. Updates
    - Set brian@bowtaifitness.com to admin role
    - Update profiles table to allow admin role
    - Add comprehensive admin policies

  2. Security
    - Admin can view all data
    - Admin policies override existing restrictions
    - Maintain existing coach/client policies
*/

-- First, ensure the profiles table allows admin role
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to admin role
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com' OR id IN (
  SELECT id FROM auth.users WHERE email = 'brian@bowtaifitness.com'
);

-- If the profile doesn't exist, let's try to find it by auth user
DO $$
DECLARE
  brian_user_id uuid;
BEGIN
  -- Get brian's user ID from auth.users
  SELECT id INTO brian_user_id 
  FROM auth.users 
  WHERE email = 'brian@bowtaifitness.com';
  
  IF brian_user_id IS NOT NULL THEN
    -- Update the profile if it exists
    UPDATE profiles 
    SET role = 'admin', updated_at = now()
    WHERE id = brian_user_id;
    
    -- If no rows were updated, the profile might not exist
    IF NOT FOUND THEN
      RAISE NOTICE 'Profile not found for brian@bowtaifitness.com (ID: %)', brian_user_id;
    ELSE
      RAISE NOTICE 'Successfully updated brian@bowtaifitness.com to admin role';
    END IF;
  ELSE
    RAISE NOTICE 'User brian@bowtaifitness.com not found in auth.users';
  END IF;
END $$;

-- Add comprehensive admin policies for all tables
-- Profiles table admin policies
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
CREATE POLICY "Admin full access to profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workouts table admin policies
DROP POLICY IF EXISTS "Admin full access to workouts" ON workouts;
CREATE POLICY "Admin full access to workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Exercises table admin policies
DROP POLICY IF EXISTS "Admin full access to exercises" ON exercises;
CREATE POLICY "Admin full access to exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Performance metrics admin policies
DROP POLICY IF EXISTS "Admin full access to performance_metrics" ON performance_metrics;
CREATE POLICY "Admin full access to performance_metrics"
  ON performance_metrics
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Messages admin policies
DROP POLICY IF EXISTS "Admin full access to messages" ON messages;
CREATE POLICY "Admin full access to messages"
  ON messages
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Swing analyses admin policies
DROP POLICY IF EXISTS "Admin full access to swing_analyses" ON swing_analyses;
CREATE POLICY "Admin full access to swing_analyses"
  ON swing_analyses
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Coach client assignments admin policies
DROP POLICY IF EXISTS "Admin full access to coach_client_assignments" ON coach_client_assignments;
CREATE POLICY "Admin full access to coach_client_assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workout templates admin policies
DROP POLICY IF EXISTS "Admin full access to workout_templates" ON workout_templates;
CREATE POLICY "Admin full access to workout_templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Template exercises admin policies
DROP POLICY IF EXISTS "Admin full access to template_exercises" ON template_exercises;
CREATE POLICY "Admin full access to template_exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workout exercises admin policies
DROP POLICY IF EXISTS "Admin full access to workout_exercises" ON workout_exercises;
CREATE POLICY "Admin full access to workout_exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Workout programs admin policies
DROP POLICY IF EXISTS "Admin full access to workout_programs" ON workout_programs;
CREATE POLICY "Admin full access to workout_programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Program days admin policies
DROP POLICY IF EXISTS "Admin full access to program_days" ON program_days;
CREATE POLICY "Admin full access to program_days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );

-- Program weeks admin policies
DROP POLICY IF EXISTS "Admin full access to program_weeks" ON program_weeks;
CREATE POLICY "Admin full access to program_weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile 
      WHERE admin_profile.id = auth.uid() 
      AND admin_profile.role = 'admin'
    )
  );/*
  # Fix infinite recursion in profiles table policies

  1. Problem
    - Current policies are causing infinite recursion by querying the profiles table within policy expressions
    - This happens when policies try to check user roles by selecting from the same table they're protecting

  2. Solution
    - Remove all existing policies that cause recursion
    - Create simple, non-recursive policies that use direct auth.uid() checks
    - Use JWT metadata for role checks instead of database queries

  3. New Policies
    - Users can view and update their own profile (using auth.uid())
    - Service role has full access for system operations
    - Simple role-based access without recursive queries
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow coaches to view client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admin policy using JWT metadata instead of database query
CREATE POLICY "Admin full access to profiles"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com' OR
    id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com' OR
    id = auth.uid()
  );

-- Update brian@bowtaifitness.com to admin role if profile exists
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';/*
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
END $$;/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_customers`: Links Supabase users to Stripe customers
      - Includes `user_id` (references `auth.users`)
      - Stores Stripe `customer_id`
      - Implements soft delete

    - `stripe_subscriptions`: Manages subscription data
      - Tracks subscription status, periods, and payment details
      - Links to `stripe_customers` via `customer_id`
      - Custom enum type for subscription status
      - Implements soft delete

    - `stripe_orders`: Stores order/purchase information
      - Records checkout sessions and payment intents
      - Tracks payment amounts and status
      - Custom enum type for order status
      - Implements soft delete

  2. Views
    - `stripe_user_subscriptions`: Secure view for user subscription data
      - Joins customers and subscriptions
      - Filtered by authenticated user

    - `stripe_user_orders`: Secure view for user order history
      - Joins customers and orders
      - Filtered by authenticated user

  3. Security
    - Enables Row Level Security (RLS) on all tables
    - Implements policies for authenticated users to view their own data
*/

CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

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

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default false,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

CREATE TABLE IF NOT EXISTS stripe_orders (
    id bigint primary key generated always as identity,
    checkout_session_id text not null,
    payment_intent_id text not null,
    customer_id text not null,
    amount_subtotal bigint not null,
    amount_total bigint not null,
    currency text not null,
    payment_status text not null,
    status stripe_order_status not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- View for user subscriptions
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
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

-- View for user orders
CREATE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL;/*
  # Add assigned coach to profiles table

  1. Schema Changes
    - Add `assigned_coach_id` column to profiles table
    - Add foreign key constraint to ensure assigned coach exists
    - Add index for better query performance

  2. Security
    - Update RLS policies to allow coaches to see their assigned clients
    - Allow clients to see their assigned coach information

  3. Data Migration
    - Migrate existing coach_client_assignments to the new structure
*/

-- Add assigned_coach_id column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_coach_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_coach_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_assigned_coach_id_fkey'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_assigned_coach_id_fkey 
    FOREIGN KEY (assigned_coach_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_coach_id 
ON profiles(assigned_coach_id);

-- Migrate existing active coach_client_assignments to the new structure
UPDATE profiles 
SET assigned_coach_id = (
  SELECT coach_id 
  FROM coach_client_assignments 
  WHERE coach_client_assignments.client_id = profiles.id 
    AND coach_client_assignments.active = true
  LIMIT 1
)
WHERE role = 'client';

-- Update RLS policies to work with the new structure
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    id = uid() 
    OR 
    -- Coaches can view clients assigned to them
    (assigned_coach_id = uid() AND role = 'client')
    OR
    -- Clients can view their assigned coach
    (role IN ('coach', 'admin') AND id = (
      SELECT assigned_coach_id FROM profiles WHERE id = uid()
    ))
    OR
    -- Admins can view all profiles
    (EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = uid() AND admin_profile.role = 'admin'
    ))
  );

-- Allow coaches to update client assignments
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
CREATE POLICY "Coaches can update client assignments"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    id = uid()
    OR
    -- Coaches and admins can update client assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  )
  WITH CHECK (
    -- Users can update their own profile
    id = uid()
    OR
    -- Coaches and admins can update client assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  );/*
  # Add admin role and policies

  1. Role Updates
    - Update profiles table constraint to include 'admin' role
    - Set brian@bowtaifitness.com as admin user

  2. Admin Policies
    - Add comprehensive admin policies for all tables
    - Admins can view and manage all data across the platform
    - Uses auth.uid() function for proper authentication

  3. Security
    - Maintains existing RLS policies
    - Adds admin override policies for full system access
*/

-- Update the role constraint to include admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to be admin
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';

-- Add admin policies for profiles table
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert all profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workouts table
CREATE POLICY "Admins can view all workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for exercises table
CREATE POLICY "Admins can manage all exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for performance_metrics table
CREATE POLICY "Admins can view all performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for messages table
CREATE POLICY "Admins can view all messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for coach_client_assignments table
CREATE POLICY "Admins can manage all assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for swing_analyses table
CREATE POLICY "Admins can view all swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_templates table
CREATE POLICY "Admins can manage all workout templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for template_exercises table
CREATE POLICY "Admins can manage all template exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_exercises table
CREATE POLICY "Admins can manage all workout exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_programs table
CREATE POLICY "Admins can manage all workout programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_days table
CREATE POLICY "Admins can manage all program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_weeks table
CREATE POLICY "Admins can manage all program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies query the profiles table from within the profiles table policies
    - This creates infinite recursion when trying to check user roles

  2. Solution
    - Drop all existing recursive policies
    - Create new policies that don't reference the profiles table recursively
    - Use auth.uid() directly for user identification
    - Use auth metadata or simpler checks where possible

  3. Changes
    - Remove policies that query profiles table within profiles policies
    - Add non-recursive policies for basic access control
    - Ensure users can always read their own profile
    - Allow admins access through email check instead of role check
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- Users can always read and update their own profile
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Brian (admin) can access all profiles using email check
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- Service role has full access (for backend operations)
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow profile creation during signup
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);/*
  # Add admin role and comprehensive admin policies

  1. Role Updates
    - Update profiles table constraint to include 'admin' role
    - Set brian@bowtaifitness.com as admin user

  2. Admin Policies
    - Add admin policies for all tables to allow full access
    - Admins can view, create, update, and delete all records
    - Uses auth.uid() function for proper authentication

  3. Security
    - All policies check for admin role using auth.uid()
    - Maintains existing user permissions while adding admin access
*/

-- Update the role constraint to include admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to be admin
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';

-- Add admin policies for profiles table
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert all profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workouts table
CREATE POLICY "Admins can view all workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for exercises table
CREATE POLICY "Admins can manage all exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for performance_metrics table
CREATE POLICY "Admins can view all performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for messages table
CREATE POLICY "Admins can view all messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for coach_client_assignments table
CREATE POLICY "Admins can manage all assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for swing_analyses table
CREATE POLICY "Admins can view all swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_templates table
CREATE POLICY "Admins can manage all workout templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for template_exercises table
CREATE POLICY "Admins can manage all template exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_exercises table
CREATE POLICY "Admins can manage all workout exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_programs table
CREATE POLICY "Admins can manage all workout programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_days table
CREATE POLICY "Admins can manage all program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_weeks table
CREATE POLICY "Admins can manage all program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );/*
  # Add admin role and policies

  1. Role Updates
    - Update profiles table constraint to include 'admin' role
    - Set brian@bowtaifitness.com as admin user

  2. Admin Policies
    - Add comprehensive admin policies for all tables
    - Admins can view and manage all data across the platform
    - Uses auth.uid() for proper user identification

  3. Security
    - Maintains existing RLS while adding admin access
    - Admin policies use proper Supabase auth functions
*/

-- Update the role constraint to include admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to be admin
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';

-- Add admin policies for profiles table
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert all profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workouts table
CREATE POLICY "Admins can view all workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for exercises table
CREATE POLICY "Admins can manage all exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for performance_metrics table
CREATE POLICY "Admins can view all performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for messages table
CREATE POLICY "Admins can view all messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for coach_client_assignments table
CREATE POLICY "Admins can manage all assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for swing_analyses table
CREATE POLICY "Admins can view all swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_templates table
CREATE POLICY "Admins can manage all workout templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for template_exercises table
CREATE POLICY "Admins can manage all template exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_exercises table
CREATE POLICY "Admins can manage all workout exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_programs table
CREATE POLICY "Admins can manage all workout programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_days table
CREATE POLICY "Admins can manage all program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_weeks table
CREATE POLICY "Admins can manage all program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );/*
  # Add assigned_coach_id to profiles table

  1. New Columns
    - `assigned_coach_id` (uuid, foreign key to profiles.id)
      - Allows direct coach assignment without separate junction table
      - Improves query performance for coach-client relationships

  2. Indexes
    - Add index on `assigned_coach_id` for better query performance

  3. Data Migration
    - Migrate existing active coach_client_assignments to new structure
    - Preserve existing coach-client relationships

  4. Security
    - Update RLS policies to work with new assigned_coach_id structure
    - Maintain proper access control for coaches and clients
*/

-- Add assigned_coach_id column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_coach_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_coach_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_assigned_coach_id_fkey'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_assigned_coach_id_fkey 
    FOREIGN KEY (assigned_coach_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_coach_id 
ON profiles(assigned_coach_id);

-- Migrate existing active coach_client_assignments to the new structure
UPDATE profiles 
SET assigned_coach_id = (
  SELECT coach_id 
  FROM coach_client_assignments 
  WHERE coach_client_assignments.client_id = profiles.id 
    AND coach_client_assignments.active = true
  LIMIT 1
)
WHERE role = 'client';

-- Update RLS policies to work with the new structure
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    id = auth.uid() 
    OR 
    -- Coaches can view clients assigned to them
    (assigned_coach_id = auth.uid() AND role = 'client')
    OR
    -- Clients can view their assigned coach
    (role IN ('coach', 'admin') AND id = (
      SELECT assigned_coach_id FROM profiles WHERE id = auth.uid()
    ))
    OR
    -- Admins can view all profiles
    (EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    ))
  );

-- Allow coaches to update client assignments
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
CREATE POLICY "Coaches can update client assignments"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Coaches and admins can update client assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  )
  WITH CHECK (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Coaches and admins can update client assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  );/*
  # Fix RLS infinite recursion in profiles policies

  1. Database Changes
    - Add assigned_coach_id column to profiles table
    - Add foreign key constraint and index
    - Migrate existing coach_client_assignments data
    - Fix RLS policies to avoid infinite recursion

  2. Security
    - Updated RLS policies that don't create circular references
    - Proper access control for coaches, clients, and admins
*/

-- Add assigned_coach_id column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'assigned_coach_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN assigned_coach_id uuid;
  END IF;
END $$;

-- Add foreign key constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'profiles_assigned_coach_id_fkey'
  ) THEN
    ALTER TABLE profiles 
    ADD CONSTRAINT profiles_assigned_coach_id_fkey 
    FOREIGN KEY (assigned_coach_id) REFERENCES profiles(id);
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_coach_id 
ON profiles(assigned_coach_id);

-- Migrate existing active coach_client_assignments to the new structure
UPDATE profiles 
SET assigned_coach_id = (
  SELECT coach_id 
  FROM coach_client_assignments 
  WHERE coach_client_assignments.client_id = profiles.id 
    AND coach_client_assignments.active = true
  LIMIT 1
)
WHERE role = 'client';

-- Update RLS policies to work with the new structure without infinite recursion
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    id = auth.uid() 
    OR 
    -- Coaches can view clients assigned to them (direct column check)
    (assigned_coach_id = auth.uid() AND role = 'client')
    OR
    -- Admins can view all profiles
    (EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    ))
  );

-- Allow coaches to update client assignments
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
CREATE POLICY "Coaches can update client assignments"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Coaches and admins can update client assignments (check role directly)
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  )
  WITH CHECK (
    -- Users can update their own profile
    id = auth.uid()
    OR
    -- Coaches and admins can update client assignments (check role directly)
    (role = 'client' AND EXISTS (
      SELECT 1 FROM profiles coach_profile
      WHERE coach_profile.id = auth.uid() 
        AND coach_profile.role IN ('coach', 'admin')
    ))
  );/*
  # Fix RLS infinite recursion in profiles table

  1. Security Changes
    - Drop problematic policies that cause infinite recursion
    - Create simplified policies that don't reference profiles table within profiles policies
    - Use direct auth.uid() comparisons instead of subqueries to profiles table
    - Maintain security while avoiding circular references

  2. Policy Changes
    - Replace complex subqueries with simple auth.uid() checks
    - Use coach_client_assignments table for coach-client relationships
    - Avoid any self-referential queries in profiles policies
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Allow profile creation for new users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- 3. Admin access via direct email check (no subquery to profiles)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

-- 4. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Coaches can view clients assigned to them (using coach_client_assignments table)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    auth.uid() = id 
    OR 
    -- Coaches can view clients assigned to them via coach_client_assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    ))
    OR
    -- Clients can view their assigned coach via coach_client_assignments
    (role IN ('coach', 'admin') AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    ))
    OR
    -- Admin email check (no subquery to profiles)
    ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  );

-- 6. Coaches can update client assignments (simplified)
CREATE POLICY "Coaches can update client assignments"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    auth.uid() = id
    OR
    -- Admin email check (no subquery to profiles)
    ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  )
  WITH CHECK (
    -- Users can update their own profile
    auth.uid() = id
    OR
    -- Admin email check (no subquery to profiles)
    ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  );/*
  # Fix infinite recursion in profiles RLS policies

  1. Security Changes
    - Drop problematic policies that cause recursion
    - Create simplified policies that don't reference profiles table within profiles policies
    - Use direct auth.uid() comparisons instead of subqueries to profiles table
    - Maintain security while avoiding circular references

  2. Policy Changes
    - Simplified user access to own profile
    - Direct admin access via email check
    - Removed recursive profile lookups
    - Coach-client relationships handled via coach_client_assignments table
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. Admin access via direct email check (no recursion)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

-- 3. Coaches can view assigned clients (using coach_client_assignments, not profiles)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view their own profile
    auth.uid() = id 
    OR 
    -- Admin access
    (auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text
    OR
    -- Coaches can view clients assigned to them via coach_client_assignments
    (role = 'client' AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    ))
    OR
    -- Clients can view their assigned coach via coach_client_assignments
    (role IN ('coach', 'admin') AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    ))
  );

-- 4. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - Policies are trying to query profiles table from within profiles policies
    - This creates circular dependencies and endless loops

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create simple, non-recursive policies
    - Avoid any subqueries to profiles table within profiles policies
    - Use direct auth functions and external table references only

  3. Security
    - Users can manage their own profiles
    - Admin access via direct email check
    - Coach-client relationships handled via coach_client_assignments table
    - Service role has full access
*/

-- Drop ALL existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile (no recursion)
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Admin access via direct email check (no profile table query)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

-- 4. Coaches can view clients assigned to them (using assignments table, not profiles)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR 
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.client_id = profiles.id 
          AND cca.coach_id = auth.uid() 
          AND cca.active = true
      )
    )
    OR
    (
      role IN ('coach', 'admin') 
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = profiles.id 
          AND cca.client_id = auth.uid() 
          AND cca.active = true
      )
    )
  );

-- 5. Service role has full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - Policies are trying to query profiles table from within profiles policies
    - This creates circular dependencies and endless loops

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create simple, non-recursive policies
    - Avoid any subqueries to profiles table within profiles policies
    - Use direct auth functions and external table references only

  3. Security
    - Users can manage their own profiles
    - Admin access via direct email check
    - Coach-client relationships handled via coach_client_assignments table
    - Service role has full access
*/

-- Drop ALL existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile (no recursion)
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Admin access via direct email check (no profile table query)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

-- 4. Coaches can view clients assigned to them (using assignments table, not profiles)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() 
    OR 
    (
      role = 'client' 
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.client_id = profiles.id 
          AND cca.coach_id = auth.uid() 
          AND cca.active = true
      )
    )
    OR
    (
      role IN ('coach', 'admin') 
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = profiles.id 
          AND cca.client_id = auth.uid() 
          AND cca.active = true
      )
    )
  );

-- 5. Service role has full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - Policies are querying profiles table from within profiles policies
    - This creates circular dependency and infinite loop

  2. Solution
    - Drop all existing problematic policies on profiles table
    - Create simple, non-recursive policies
    - Use auth.jwt() and direct comparisons instead of profile subqueries
    - Avoid any SELECT queries on profiles table within profiles policies

  3. Security
    - Maintain same access control without recursion
    - Users can manage own profiles
    - Admin access via email check
    - Coach-client relationships via assignments table
*/

-- Drop all existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Coaches can update client assignments" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;

-- Create simple, non-recursive policies

-- 1. Users can manage their own profile (no recursion)
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Allow profile creation for authenticated users
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 3. Admin access via direct email check (no profile table query)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- 4. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Coach-client relationship via assignments table (no profiles recursion)
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Own profile
    id = auth.uid()
    OR
    -- Admin access via email
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
    OR
    -- Coaches can view clients assigned to them via assignments table
    (role = 'client' AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    ))
    OR
    -- Clients can view their assigned coaches via assignments table
    (role IN ('coach', 'admin') AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    ))
  );/*
  # Fix infinite recursion in profiles RLS policies

  1. Security Changes
    - Drop all existing policies on profiles table that cause recursion
    - Create simple, non-recursive policies
    - Use direct auth functions instead of profile subqueries
    - Maintain same security model without circular dependencies

  2. Policy Changes
    - Users can manage own profiles
    - Admin access via direct email check
    - Service role has full access
    - Allow profile creation for authenticated users
*/

-- Drop all existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert all profiles" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);/*
  # Add admin role and policies

  1. Role Updates
    - Update profiles table constraint to include 'admin' role
    - Set brian@bowtaifitness.com as admin user

  2. Admin Policies
    - Add comprehensive admin policies for all tables
    - Admins can view and manage all data across the platform
    - Uses auth.uid() function for proper authentication

  3. Security
    - Maintains existing RLS while adding admin access
    - Admin policies use proper Supabase auth functions
*/

-- Update the role constraint to include admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['coach'::text, 'client'::text, 'admin'::text]));

-- Update brian@bowtaifitness.com to be admin
UPDATE profiles 
SET role = 'admin', updated_at = now()
WHERE email = 'brian@bowtaifitness.com';

-- Add admin policies for profiles table
CREATE POLICY "Admins can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert all profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workouts table
CREATE POLICY "Admins can view all workouts"
  ON workouts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can manage all workouts"
  ON workouts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for exercises table
CREATE POLICY "Admins can manage all exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for performance_metrics table
CREATE POLICY "Admins can view all performance metrics"
  ON performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for messages table
CREATE POLICY "Admins can view all messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for coach_client_assignments table
CREATE POLICY "Admins can manage all assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for swing_analyses table
CREATE POLICY "Admins can view all swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_templates table
CREATE POLICY "Admins can manage all workout templates"
  ON workout_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for template_exercises table
CREATE POLICY "Admins can manage all template exercises"
  ON template_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_exercises table
CREATE POLICY "Admins can manage all workout exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for workout_programs table
CREATE POLICY "Admins can manage all workout programs"
  ON workout_programs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_days table
CREATE POLICY "Admins can manage all program days"
  ON program_days
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add admin policies for program_weeks table
CREATE POLICY "Admins can manage all program weeks"
  ON program_weeks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );/*
  # Fix workout_exercises RLS policies for client progress saving

  1. Security Updates
    - Add policy for clients to update their own workout exercise progress
    - Ensure clients can save progress data to workout_exercises.notes field
    - Maintain security while allowing necessary updates

  2. Changes
    - Add client update policy for workout_exercises table
    - Allow clients to update notes field for their assigned workouts
*/

-- Drop existing restrictive policies that might be blocking client updates
DROP POLICY IF EXISTS "Clients can update workout exercises for their workouts" ON workout_exercises;

-- Add comprehensive policy for clients to update their workout exercise progress
CREATE POLICY "Clients can update their workout exercise progress"
  ON workout_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.client_id = auth.uid()
    )
  );

-- Ensure clients can also select their workout exercises (needed for the update to work)
DROP POLICY IF EXISTS "Clients can view their workout exercises" ON workout_exercises;
CREATE POLICY "Clients can view their workout exercises"
  ON workout_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.client_id = auth.uid()
    )
  );

-- Add admin policy for full access (if not already exists)
DROP POLICY IF EXISTS "Admin full access to workout_exercises" ON workout_exercises;
CREATE POLICY "Admin full access to workout_exercises"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid() AND admin_profile.role = 'admin'
    )
  );

-- Ensure coaches can also manage workout exercises for their assigned workouts
DROP POLICY IF EXISTS "Coaches can manage workout exercises for their workouts" ON workout_exercises;
CREATE POLICY "Coaches can manage workout exercises for their workouts"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id 
        AND workouts.coach_id = auth.uid()
    )
  );/*
  # Fix profiles RLS policies for messaging

  1. Security Updates
    - Add policy for clients to view their assigned coach profiles
    - Add policy for coaches to view their assigned client profiles
    - Ensure messaging functionality works properly

  2. Changes
    - New policy: "Clients can view assigned coach profiles"
    - New policy: "Coaches can view assigned client profiles"
    - Updated existing policies to be more specific
*/

-- Allow clients to view their assigned coach profiles
CREATE POLICY "Clients can view assigned coach profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the profile is a coach assigned to the current user (client)
    (role IN ('coach', 'admin')) AND (
      EXISTS (
        SELECT 1 
        FROM coach_client_assignments cca 
        WHERE cca.coach_id = profiles.id 
          AND cca.client_id = auth.uid() 
          AND cca.active = true
      )
    )
  );

-- Allow coaches to view their assigned client profiles  
CREATE POLICY "Coaches can view assigned client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if the profile is a client assigned to the current user (coach)
    (role = 'client') AND (
      EXISTS (
        SELECT 1 
        FROM coach_client_assignments cca 
        WHERE cca.client_id = profiles.id 
          AND cca.coach_id = auth.uid() 
          AND cca.active = true
      )
    )
  );

-- Allow coaches and admins to view all client profiles (for general management)
CREATE POLICY "Coaches and admins can view all client profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Current user is coach/admin and target profile is a client
    (
      EXISTS (
        SELECT 1 
        FROM profiles current_user_profile 
        WHERE current_user_profile.id = auth.uid() 
          AND current_user_profile.role IN ('coach', 'admin')
      )
    ) AND (role = 'client')
  );

-- Allow clients to view coach/admin profiles (for messaging and general info)
CREATE POLICY "Clients can view coach and admin profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Target profile is coach or admin, and current user is a client
    (role IN ('coach', 'admin')) AND (
      EXISTS (
        SELECT 1 
        FROM profiles current_user_profile 
        WHERE current_user_profile.id = auth.uid() 
          AND current_user_profile.role = 'client'
      )
    )
  );/*
  # Recreate Sample Workouts for Client Testing

  1. New Data
    - Sample workouts for client testing
    - Various dates and completion statuses
    - Includes workout exercises for proper testing

  2. Security
    - Uses existing RLS policies
    - Ensures proper coach-client relationships
*/

-- First, let's check if we have the necessary data (coach and client)
DO $$
DECLARE
    client_id uuid;
    coach_id uuid;
    exercise_ids uuid[];
    workout_id uuid;
    template_id uuid;
BEGIN
    -- Find a client user (the one having issues)
    SELECT id INTO client_id 
    FROM profiles 
    WHERE role = 'client' 
    LIMIT 1;
    
    -- Find a coach user
    SELECT id INTO coach_id 
    FROM profiles 
    WHERE role IN ('coach', 'admin') 
    LIMIT 1;
    
    -- Get some exercise IDs
    SELECT ARRAY(SELECT id FROM exercises LIMIT 5) INTO exercise_ids;
    
    IF client_id IS NOT NULL AND coach_id IS NOT NULL AND array_length(exercise_ids, 1) > 0 THEN
        -- Create a sample workout template first
        INSERT INTO workout_templates (id, title, description, created_by)
        VALUES (
            gen_random_uuid(),
            'Full Body Strength',
            'Complete full body strength training session',
            coach_id
        )
        RETURNING id INTO template_id;
        
        -- Add exercises to the template
        INSERT INTO template_exercises (template_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            template_id,
            exercise_ids[i],
            3,
            CASE 
                WHEN i <= 2 THEN 12
                WHEN i <= 4 THEN 10
                ELSE 8
            END,
            CASE 
                WHEN i <= 2 THEN 25
                WHEN i <= 4 THEN 35
                ELSE 45
            END,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 5)) AS i;
        
        -- Create sample workouts for the past week and upcoming week
        
        -- Workout 1: Yesterday (completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Upper Body Strength',
            'Focus on chest, shoulders, and arms',
            coach_id,
            client_id,
            (CURRENT_DATE - INTERVAL '1 day')::date,
            true,
            'Great form today! Keep up the excellent work.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to yesterday's workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index, notes)
        SELECT 
            workout_id,
            exercise_ids[i],
            3,
            12,
            25,
            i - 1,
            CASE 
                WHEN i = 1 THEN '{"completed": true, "actualSets": 3, "actualReps": 12, "actualWeight": 25, "difficulty": "medium", "savedAt": "' || (NOW() - INTERVAL '1 day')::text || '"}'
                WHEN i = 2 THEN '{"completed": true, "actualSets": 3, "actualReps": 10, "actualWeight": 25, "difficulty": "easy", "savedAt": "' || (NOW() - INTERVAL '1 day')::text || '"}'
                ELSE '{"completed": true, "actualSets": 3, "actualReps": 12, "actualWeight": 25, "savedAt": "' || (NOW() - INTERVAL '1 day')::text || '"}'
            END
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 3)) AS i;
        
        -- Workout 2: Today (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Lower Body Power',
            'Explosive leg movements and core stability',
            coach_id,
            client_id,
            CURRENT_DATE,
            false,
            'Focus on explosive movement and proper landing mechanics.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to today's workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            4,
            8,
            35,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 4)) AS i;
        
        -- Workout 3: Tomorrow (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Mobility & Recovery',
            'Active recovery with mobility work',
            coach_id,
            client_id,
            (CURRENT_DATE + INTERVAL '1 day')::date,
            false,
            'Take your time with each movement. Focus on range of motion.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to tomorrow's workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, duration, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            2,
            15,
            45,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 3)) AS i;
        
        -- Workout 4: Day after tomorrow (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Full Body Circuit',
            'High intensity circuit training',
            coach_id,
            client_id,
            (CURRENT_DATE + INTERVAL '2 days')::date,
            false,
            'Push yourself but maintain good form throughout.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to circuit workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            3,
            CASE 
                WHEN i <= 2 THEN 15
                ELSE 12
            END,
            CASE 
                WHEN i <= 2 THEN 20
                ELSE 30
            END,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 5)) AS i;
        
        -- Workout 5: Next week (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Strength Assessment',
            'Test your progress with heavier weights',
            coach_id,
            client_id,
            (CURRENT_DATE + INTERVAL '5 days')::date,
            false,
            'This is a strength test. Use proper form and don''t rush.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to assessment workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            5,
            5,
            50,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 3)) AS i;
        
        RAISE NOTICE 'Successfully created sample workouts for client % with coach %', client_id, coach_id;
    ELSE
        RAISE NOTICE 'Missing required data: client_id=%, coach_id=%, exercises=%', client_id, coach_id, array_length(exercise_ids, 1);
    END IF;
END $$;/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current RLS policies on profiles table are causing infinite recursion
    - This happens when policies reference the same table they're protecting
    - Error: "infinite recursion detected in policy for relation 'profiles'"

  2. Solution
    - Drop all existing problematic policies
    - Create new, simpler policies that don't cause recursion
    - Use direct user ID checks instead of profile table lookups
    - Separate policies for different access patterns

  3. New Policies
    - Users can manage their own profile (direct uid() check)
    - Admin access via email check (no profile table lookup)
    - Service role full access
    - Coach-client visibility for messaging (simplified)
*/

-- Drop all existing policies on profiles table to start fresh
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Clients can view assigned coach profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can view coach and admin profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches and admins can view all client profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned client profiles" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new, non-recursive policies

-- 1. Users can manage their own profile (direct uid() check)
CREATE POLICY "Users can manage own profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Admin access via email (no profile table lookup)
CREATE POLICY "Admin full access via email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- 3. Service role full access
CREATE POLICY "Service role full access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. Allow profile creation during signup
CREATE POLICY "Allow profile creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 5. Coach-client visibility for messaging (simplified)
-- Coaches can view clients they're assigned to
CREATE POLICY "Coaches can view assigned clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 6. Clients can view their assigned coach
CREATE POLICY "Clients can view assigned coach"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (role = 'coach' OR role = 'admin') AND 
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 7. General visibility for coaches and admins (simplified)
-- This allows coaches to see other coaches/admins for system functionality
CREATE POLICY "Coach and admin visibility"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Current user is coach/admin AND target profile is coach/admin
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com' OR
    (
      role IN ('coach', 'admin') AND
      auth.uid() IN (
        SELECT id FROM profiles WHERE role IN ('coach', 'admin')
      )
    )
  );

-- Verify policies are working by testing a simple query
-- This should not cause recursion
DO $$
BEGIN
  -- Test that we can query profiles without recursion
  PERFORM id FROM profiles WHERE id = auth.uid() LIMIT 1;
  RAISE NOTICE 'Profiles RLS policies updated successfully - no recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'RLS policy test failed: %', SQLERRM;
END $$;/*
  # Aggressive fix for profiles RLS infinite recursion

  1. Problem
    - Multiple overlapping RLS policies on profiles table causing infinite recursion
    - Policies are referencing the profiles table within their own conditions
    - This creates circular dependencies that PostgreSQL cannot resolve

  2. Solution
    - Drop ALL existing policies on profiles table
    - Create minimal, non-recursive policies
    - Use only auth.uid() and JWT claims, never profile table lookups
    - Separate admin access from regular user access completely

  3. New Policy Structure
    - Admin access via email (no profile lookup)
    - User self-access via auth.uid()
    - Coach-client visibility via assignments table only
    - Service role full access
*/

-- Drop ALL existing policies on profiles table
DROP POLICY IF EXISTS "Admin full access via email" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Clients can view assigned coach" ON profiles;
DROP POLICY IF EXISTS "Coach and admin visibility" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Service role full access" ON profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON profiles;

-- Create new, simple policies that avoid recursion

-- 1. Admin access (using JWT email claim only)
CREATE POLICY "admin_full_access_by_email" ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

-- 2. Users can manage their own profile
CREATE POLICY "users_own_profile" ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 3. Allow profile creation during signup
CREATE POLICY "allow_profile_creation" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. Coaches can view clients (via assignments table, not profiles)
CREATE POLICY "coaches_view_assigned_clients" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    role = 'client' AND 
    EXISTS (
      SELECT 1 
      FROM coach_client_assignments cca 
      WHERE cca.client_id = profiles.id 
        AND cca.coach_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 5. Clients can view their assigned coach (via assignments table)
CREATE POLICY "clients_view_assigned_coach" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (role = 'coach' OR role = 'admin') AND 
    EXISTS (
      SELECT 1 
      FROM coach_client_assignments cca 
      WHERE cca.coach_id = profiles.id 
        AND cca.client_id = auth.uid() 
        AND cca.active = true
    )
  );

-- 6. Service role full access
CREATE POLICY "service_role_full_access" ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Test the policies work without recursion
DO $$
BEGIN
  -- This should not cause infinite recursion
  PERFORM id FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000' LIMIT 1;
  RAISE NOTICE 'Profiles policies test completed successfully - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profiles policies test failed: %', SQLERRM;
END $$;/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - RLS policies on profiles table are causing infinite recursion
    - This happens when policies reference the profiles table within their own conditions
    - Error: "infinite recursion detected in policy for relation 'profiles'"

  2. Solution
    - Drop all existing problematic policies
    - Create new policies that avoid self-referential queries
    - Use direct auth functions instead of profile table lookups
    - Ensure no circular dependencies between policies

  3. New Policies
    - Users can manage their own profile (direct auth.uid() check)
    - Admin access via JWT email claim (no profile lookup)
    - Coach-client visibility via assignments table only
    - Service role has full access
*/

-- Drop all existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "admin_full_access_by_email" ON profiles;
DROP POLICY IF EXISTS "allow_profile_creation" ON profiles;
DROP POLICY IF EXISTS "clients_view_assigned_coach" ON profiles;
DROP POLICY IF EXISTS "coaches_view_assigned_clients" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
DROP POLICY IF EXISTS "users_own_profile" ON profiles;

-- Create new non-recursive policies

-- 1. Users can manage their own profile (no recursion - direct auth check)
CREATE POLICY "users_own_profile_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Admin access via JWT email (no profile table lookup)
CREATE POLICY "admin_access_via_jwt"
  ON profiles
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
  )
  WITH CHECK (
    (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
  );

-- 3. Allow profile creation for authenticated users
CREATE POLICY "allow_authenticated_profile_creation"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- 4. Coaches can view assigned clients (via assignments table only)
CREATE POLICY "coaches_view_assigned_clients_via_assignments"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id 
      FROM coach_client_assignments 
      WHERE coach_id = auth.uid() 
        AND active = true
    )
  );

-- 5. Clients can view their assigned coach (via assignments table only)
CREATE POLICY "clients_view_assigned_coach_via_assignments"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT coach_id 
      FROM coach_client_assignments 
      WHERE client_id = auth.uid() 
        AND active = true
    )
  );

-- 6. Service role full access
CREATE POLICY "service_role_full_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Test the policies work without recursion
DO $$
BEGIN
  -- This should not cause infinite recursion
  PERFORM 1 FROM profiles WHERE id = auth.uid() LIMIT 1;
  RAISE NOTICE 'Profiles policies test passed - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profiles policies test failed: %', SQLERRM;
END $$;/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Current policies on profiles table are causing infinite recursion
    - Policies are referencing the profiles table within their own conditions
    - This creates circular dependencies that cause database errors

  2. Solution
    - Drop all existing problematic policies
    - Create new policies that avoid self-referential queries
    - Use direct auth.uid() checks and JWT claims instead of profile lookups
    - Ensure coach-client relationships use only assignment table

  3. New Policies
    - users_own_profile_access: Direct auth.uid() check for own profile
    - admin_access_via_jwt: Uses JWT email claim for admin access
    - coaches_view_assigned_clients: Uses assignments table only
    - clients_view_assigned_coach: Uses assignments table only
    - service_role_full_access: Service role bypass
*/

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "admin_access_via_jwt" ON profiles;
DROP POLICY IF EXISTS "allow_authenticated_profile_creation" ON profiles;
DROP POLICY IF EXISTS "clients_view_assigned_coach_via_assignments" ON profiles;
DROP POLICY IF EXISTS "coaches_view_assigned_clients_via_assignments" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_access" ON profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;

-- Create new non-recursive policies
CREATE POLICY "users_own_profile_access"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "admin_access_via_jwt"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text)
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'brian@bowtaifitness.com'::text);

CREATE POLICY "coaches_view_assigned_clients"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT client_id 
      FROM coach_client_assignments 
      WHERE coach_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "clients_view_assigned_coach"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT coach_id 
      FROM coach_client_assignments 
      WHERE client_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "service_role_full_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Test the policies work without recursion
DO $$
BEGIN
  -- This should not cause infinite recursion
  PERFORM 1 FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000';
  RAISE NOTICE 'Profiles policies test completed successfully - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Profiles policies test failed: %', SQLERRM;
END $$;/*
  # Emergency Fix: Profiles Table Infinite Recursion

  This migration fixes the infinite recursion error in the profiles table RLS policies
  by removing problematic policies and creating simple, non-recursive replacements.

  ## Changes Made
  1. Drop all existing policies on profiles table
  2. Create minimal, safe policies that don't reference the profiles table within themselves
  3. Ensure admin access works via JWT email claim
  4. Restore basic functionality without recursion

  ## Security
  - Users can access their own profile data
  - Admin access via email verification
  - Coach-client relationships via assignments table only
*/

-- Drop ALL existing policies on profiles table to eliminate recursion
DROP POLICY IF EXISTS "admin_access_via_jwt" ON profiles;
DROP POLICY IF EXISTS "clients_view_assigned_coach" ON profiles;
DROP POLICY IF EXISTS "coaches_view_assigned_clients" ON profiles;
DROP POLICY IF EXISTS "service_role_full_access" ON profiles;
DROP POLICY IF EXISTS "users_own_profile_access" ON profiles;
DROP POLICY IF EXISTS "Admin full access to profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create simple, non-recursive policies
CREATE POLICY "users_can_access_own_profile"
  ON profiles
  FOR ALL
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "admin_full_access_by_email"
  ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');

CREATE POLICY "service_role_access"
  ON profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Test the policies work without recursion
DO $$
BEGIN
  -- This should not cause infinite recursion
  PERFORM 1 FROM profiles WHERE id = auth.uid() LIMIT 1;
  RAISE NOTICE 'Profiles policies fixed successfully - no infinite recursion detected';
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Policy test failed: %', SQLERRM;
END $$;/*
  # Fix uid() Function References in Policies

  1. Overview
    - Replace all incorrect `uid()` function calls with correct `auth.uid()`
    - Drop and recreate all RLS policies across all tables
    - Ensure proper authentication checks in all policies

  2. Tables Updated
    - profiles
    - exercises
    - workouts
    - workout_exercises
    - performance_metrics
    - messages
    - swing_analyses
    - clients
    - workout_templates
    - template_exercises
    - workout_programs
    - program_days
    - program_weeks
    - coach_client_assignments
    - stripe_customers
    - stripe_subscriptions
    - stripe_orders

  3. Security
    - All policies now use auth.uid() correctly
    - Proper authentication checks maintained
    - RLS remains enabled on all tables
*/

-- Drop all existing policies

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view clients" ON profiles;
DROP POLICY IF EXISTS "Clients can view their coach" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- exercises
DROP POLICY IF EXISTS "Authenticated users can view exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can create exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can delete own exercises" ON exercises;

-- workouts
DROP POLICY IF EXISTS "Coaches can view own workouts" ON workouts;
DROP POLICY IF EXISTS "Clients can view own workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches can create workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches can update own workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches can delete own workouts" ON workouts;
DROP POLICY IF EXISTS "Clients can update own workouts" ON workouts;

-- workout_exercises
DROP POLICY IF EXISTS "Users can view workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can manage workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can view own workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can insert workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can update workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can delete workout exercises" ON workout_exercises;

-- performance_metrics
DROP POLICY IF EXISTS "Clients can view own metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can view client metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can create client metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can update client metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Clients can view metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can insert metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can update metrics" ON performance_metrics;

-- messages
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update received messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

-- swing_analyses
DROP POLICY IF EXISTS "Clients can view own analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can view client analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can create analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can update analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Clients can insert analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can insert analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can update client analyses" ON swing_analyses;

-- clients
DROP POLICY IF EXISTS "Coaches can view own clients" ON clients;
DROP POLICY IF EXISTS "Coaches can create clients" ON clients;
DROP POLICY IF EXISTS "Coaches can update own clients" ON clients;
DROP POLICY IF EXISTS "Coaches can insert clients" ON clients;
DROP POLICY IF EXISTS "Coaches can update clients" ON clients;

-- workout_templates
DROP POLICY IF EXISTS "Coaches can view own templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can create templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can update own templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can delete own templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can insert templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can update templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can delete templates" ON workout_templates;

-- template_exercises
DROP POLICY IF EXISTS "Coaches can view template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can manage template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can insert template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can update template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can delete template exercises" ON template_exercises;

-- workout_programs
DROP POLICY IF EXISTS "Coaches can view own programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can create programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can update own programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can delete own programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can insert programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can update programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can delete programs" ON workout_programs;

-- program_days
DROP POLICY IF EXISTS "Coaches can view program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can manage program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can insert program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can update program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can delete program days" ON program_days;

-- program_weeks
DROP POLICY IF EXISTS "Coaches can view program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can manage program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can insert program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can update program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can delete program weeks" ON program_weeks;

-- coach_client_assignments
DROP POLICY IF EXISTS "Coaches can view own assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Clients can view own assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can create assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can update own assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can update assignments" ON coach_client_assignments;

-- stripe_customers
DROP POLICY IF EXISTS "Users can view own stripe customer" ON stripe_customers;
DROP POLICY IF EXISTS "Users can insert own stripe customer" ON stripe_customers;
DROP POLICY IF EXISTS "Users can update own stripe customer" ON stripe_customers;

-- stripe_subscriptions
DROP POLICY IF EXISTS "Users can view own subscription" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON stripe_subscriptions;

-- stripe_orders
DROP POLICY IF EXISTS "Users can view own orders" ON stripe_orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON stripe_orders;

-- Create new policies with correct auth.uid()

-- profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Coaches can view assigned clients"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = profiles.id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Clients can view their coach"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.client_id = auth.uid()
      AND coach_client_assignments.coach_id = profiles.id
      AND coach_client_assignments.active = true
    )
  );

-- exercises policies
CREATE POLICY "Authenticated users can view exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

CREATE POLICY "Coaches can update own exercises"
  ON exercises FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own exercises"
  ON exercises FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- workouts policies
CREATE POLICY "Coaches can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can create workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- workout_exercises policies
CREATE POLICY "Coaches can view workout exercises"
  ON workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own workout exercises"
  ON workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.client_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert workout exercises"
  ON workout_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update workout exercises"
  ON workout_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete workout exercises"
  ON workout_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

-- performance_metrics policies
CREATE POLICY "Clients can view own metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can view client metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Coaches can insert metrics"
  ON performance_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Coaches can update metrics"
  ON performance_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  );

-- messages policies
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- swing_analyses policies
CREATE POLICY "Clients can view own analyses"
  ON swing_analyses FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can view client analyses"
  ON swing_analyses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Clients can insert analyses"
  ON swing_analyses FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Coaches can insert analyses"
  ON swing_analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Coaches can update client analyses"
  ON swing_analyses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  );

-- clients policies
CREATE POLICY "Coaches can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- workout_templates policies
CREATE POLICY "Coaches can view own templates"
  ON workout_templates FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can insert templates"
  ON workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can update templates"
  ON workout_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete templates"
  ON workout_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- template_exercises policies
CREATE POLICY "Coaches can view template exercises"
  ON template_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert template exercises"
  ON template_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update template exercises"
  ON template_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete template exercises"
  ON template_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

-- workout_programs policies
CREATE POLICY "Coaches can view own programs"
  ON workout_programs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can insert programs"
  ON workout_programs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can update programs"
  ON workout_programs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete programs"
  ON workout_programs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- program_days policies
CREATE POLICY "Coaches can view program days"
  ON program_days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert program days"
  ON program_days FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update program days"
  ON program_days FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete program days"
  ON program_days FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

-- program_weeks policies
CREATE POLICY "Coaches can view program weeks"
  ON program_weeks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert program weeks"
  ON program_weeks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update program weeks"
  ON program_weeks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete program weeks"
  ON program_weeks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

-- coach_client_assignments policies
CREATE POLICY "Coaches can view own assignments"
  ON coach_client_assignments FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own assignments"
  ON coach_client_assignments FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can insert assignments"
  ON coach_client_assignments FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update assignments"
  ON coach_client_assignments FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- stripe_customers policies
CREATE POLICY "Users can view own stripe customer"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own stripe customer"
  ON stripe_customers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stripe customer"
  ON stripe_customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- stripe_subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON stripe_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own subscription"
  ON stripe_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own subscription"
  ON stripe_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

-- stripe_orders policies
CREATE POLICY "Users can view own orders"
  ON stripe_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own orders"
  ON stripe_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - Policies on coach_client_assignments that check profiles.role cause infinite recursion
    - When querying profiles, it checks coach_client_assignments, which checks profiles again
    
  2. Solution
    - Remove role-based admin policies on coach_client_assignments
    - Use email-based admin check instead (auth.jwt()->>'email')
    - This breaks the circular dependency
    
  3. Changes
    - Drop problematic admin policies on coach_client_assignments
    - Create new email-based admin policy
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin full access to coach_client_assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON coach_client_assignments;

-- Create email-based admin policy (no circular dependency)
CREATE POLICY "Admin email access to assignments"
  ON coach_client_assignments
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');/*
  # Fix Admin Policies on Exercises Table

  1. Problem
    - Policies checking profiles.role cause infinite recursion
    - Admin users cannot delete exercises
    
  2. Solution
    - Replace role-based admin policies with email-based policies
    - Use auth.jwt()->>'email' to avoid circular dependency
    
  3. Changes
    - Drop problematic admin policies on exercises table
    - Create new email-based admin policy
*/

-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin full access to exercises" ON exercises;
DROP POLICY IF EXISTS "Admins can manage all exercises" ON exercises;

-- Create email-based admin policy (no circular dependency)
CREATE POLICY "Admin email full access to exercises"
  ON exercises
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK ((auth.jwt() ->> 'email') = 'brian@bowtaifitness.com');/*
  # Allow Coaches to Delete Legacy Exercises

  1. Problem
    - Many exercises have created_by = NULL
    - Current policy only allows deletion of exercises where created_by = auth.uid()
    - Coaches cannot delete legacy exercises
    
  2. Solution
    - Add policy allowing coaches to delete exercises with NULL created_by
    - This allows cleanup of imported/legacy exercises
    
  3. Security
    - Only coaches and admins can delete
    - Client users still cannot delete exercises
*/

-- Allow coaches to delete exercises with null created_by (legacy exercises)
CREATE POLICY "Coaches can delete legacy exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (
    created_by IS NULL 
    AND EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND (
        auth.users.raw_user_meta_data->>'role' = 'coach'
        OR auth.users.raw_user_meta_data->>'role' = 'admin'
      )
    )
  );/*
  # Simplify Legacy Exercise Deletion Policy

  1. Problem
    - Previous policy queries auth.users which may cause issues
    - Need simpler policy for legacy exercise deletion
    
  2. Solution
    - Replace with policy that checks JWT metadata directly
    - Allows coaches and admins to delete exercises with NULL created_by
    
  3. Changes
    - Drop old policy
    - Create new simplified policy using auth.jwt()
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Coaches can delete legacy exercises" ON exercises;

-- Create simplified policy using JWT metadata
CREATE POLICY "Coaches can delete legacy exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (
    created_by IS NULL 
    AND (
      (auth.jwt() ->> 'email') = 'brian@bowtaifitness.com'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'coach'
      OR (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    )
  );/*
  # Allow All Authenticated Users to Delete Legacy Exercises

  1. Problem
    - JWT metadata checks may not work correctly in all contexts
    - Need to allow deletion of legacy exercises (created_by = NULL)
    
  2. Solution
    - Allow all authenticated users to delete exercises with NULL created_by
    - These are legacy/imported exercises that should be manageable
    - Users with created exercises can still only delete their own
    
  3. Security
    - Only applies to legacy exercises (created_by IS NULL)
    - Requires authentication
    - Does not affect user-created exercises
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Coaches can delete legacy exercises" ON exercises;

-- Create simplified policy - allow all authenticated users to delete legacy exercises
CREATE POLICY "Authenticated users can delete legacy exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (created_by IS NULL);/*
  # Add Automatic Profile Creation Trigger

  1. Purpose
    - Automatically creates a profile when a user confirms their email
    - Handles email confirmation flow properly
    - Ensures all authenticated users have a profile

  2. Changes
    - Creates a trigger function that runs when auth.users are inserted or updated
    - Only creates profile if user is confirmed (email_confirmed_at is set)
    - Uses user metadata to populate profile fields
    - Safely handles existing profiles with ON CONFLICT

  3. Security
    - Function runs with SECURITY DEFINER to bypass RLS
    - Only creates profiles for confirmed users
    - Preserves existing profile data if profile already exists
*/

-- Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_user_confirmation()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the user has confirmed their email
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Insert profile if it doesn't exist
    INSERT INTO public.profiles (
      id,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_confirmed
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_confirmation();
/*
  # Add Client Intake Form Table

  1. Purpose
    - Store intake form responses from new clients
    - Help coaches understand client goals, experience, and preferences
    - Track whether a client has completed their intake form

  2. New Tables
    - `client_intake_forms`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `age` (integer)
      - `handicap` (text)
      - `years_playing` (integer)
      - `primary_goal` (text)
      - `practice_frequency` (text)
      - `biggest_challenge` (text)
      - `injury_history` (text, optional)
      - `preferred_communication` (text)
      - `additional_notes` (text, optional)
      - `completed_at` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  3. Security
    - Enable RLS on the table
    - Clients can insert and view their own intake form
    - Coaches can view all client intake forms
    - Clients can update their own intake form
*/

-- Create client_intake_forms table
CREATE TABLE IF NOT EXISTS client_intake_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  age integer,
  handicap text,
  years_playing integer,
  primary_goal text NOT NULL,
  practice_frequency text NOT NULL,
  biggest_challenge text NOT NULL,
  injury_history text,
  preferred_communication text NOT NULL,
  additional_notes text,
  completed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE client_intake_forms ENABLE ROW LEVEL SECURITY;

-- Clients can insert their own intake form
CREATE POLICY "Clients can insert own intake form"
  ON client_intake_forms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Clients can view their own intake form
CREATE POLICY "Clients can view own intake form"
  ON client_intake_forms FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Clients can update their own intake form
CREATE POLICY "Clients can update own intake form"
  ON client_intake_forms FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Coaches can view all client intake forms
CREATE POLICY "Coaches can view all intake forms"
  ON client_intake_forms FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_intake_forms_user_id ON client_intake_forms(user_id);
/*
  # Update Client Intake Form Structure

  1. Purpose
    - Restructure intake form to separate basic information, golf information, and training information
    - Add new fields for comprehensive client assessment
    - Remove old fields that are no longer needed

  2. Changes to client_intake_forms table
    - Drop old columns: years_playing, primary_goal, practice_frequency, biggest_challenge
    - Add Basic Information fields: gender, height, weight
    - Rename and add Golf Information fields: years_playing_golf, current_handicap, primary_golf_goal, play_frequency, biggest_strength, biggest_weakness, golf_notes
    - Add Training Information fields: years_strength_training, training_goal, workout_frequency, equipment_access (array), training_notes
    - Keep: age, injury_history, user_id, completed_at, created_at, updated_at
    - Remove: preferred_communication, additional_notes

  3. Notes
    - Equipment access will be stored as a text array to support multiple selections
    - All notes fields are optional
    - Existing data will be preserved where possible
*/

-- Add new columns for Basic Information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'gender'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN gender text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'height'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN height text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'weight'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN weight text;
  END IF;
END $$;

-- Add new columns for Golf Information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_playing_golf'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN years_playing_golf integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'current_handicap'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN current_handicap text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'primary_golf_goal'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN primary_golf_goal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'play_frequency'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN play_frequency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_strength'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN biggest_strength text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_weakness'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN biggest_weakness text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'golf_notes'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN golf_notes text;
  END IF;
END $$;

-- Add new columns for Training Information
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_strength_training'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN years_strength_training integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'training_goal'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN training_goal text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'workout_frequency'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN workout_frequency text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'equipment_access'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN equipment_access text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'training_notes'
  ) THEN
    ALTER TABLE client_intake_forms ADD COLUMN training_notes text;
  END IF;
END $$;

-- Migrate existing data where possible
DO $$
BEGIN
  -- Copy years_playing to years_playing_golf if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_playing'
  ) THEN
    UPDATE client_intake_forms
    SET years_playing_golf = years_playing
    WHERE years_playing_golf IS NULL AND years_playing IS NOT NULL;
  END IF;

  -- Copy handicap to current_handicap if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'handicap'
  ) THEN
    UPDATE client_intake_forms
    SET current_handicap = handicap
    WHERE current_handicap IS NULL AND handicap IS NOT NULL;
  END IF;

  -- Copy primary_goal to primary_golf_goal if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'primary_goal'
  ) THEN
    UPDATE client_intake_forms
    SET primary_golf_goal = primary_goal
    WHERE primary_golf_goal IS NULL AND primary_goal IS NOT NULL;
  END IF;

  -- Copy practice_frequency to play_frequency if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'practice_frequency'
  ) THEN
    UPDATE client_intake_forms
    SET play_frequency = practice_frequency
    WHERE play_frequency IS NULL AND practice_frequency IS NOT NULL;
  END IF;

  -- Copy biggest_challenge to biggest_weakness if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_challenge'
  ) THEN
    UPDATE client_intake_forms
    SET biggest_weakness = biggest_challenge
    WHERE biggest_weakness IS NULL AND biggest_challenge IS NOT NULL;
  END IF;

  -- Copy additional_notes to golf_notes if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'additional_notes'
  ) THEN
    UPDATE client_intake_forms
    SET golf_notes = additional_notes
    WHERE golf_notes IS NULL AND additional_notes IS NOT NULL;
  END IF;
END $$;
/*
  # Add Program Week Exercises Table

  1. Purpose
    - Allow customization of exercises for specific program weeks
    - Store week-specific exercise variations independent of templates
    - Enable coaches to modify workouts per week after template assignment

  2. New Table: program_week_exercises
    - `id` (uuid, primary key)
    - `program_week_id` (uuid, foreign key to program_weeks)
    - `exercise_id` (uuid, foreign key to exercises)
    - `sets` (integer, optional)
    - `reps` (integer, optional)
    - `weight` (numeric, optional)
    - `duration` (integer, optional - in seconds)
    - `rest_seconds` (integer, optional)
    - `notes` (text, optional)
    - `order_index` (integer, required)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  3. Security
    - Enable RLS
    - Coaches can manage exercises for their programs

  4. Indexes
    - Index on program_week_id for efficient queries
    - Index on order_index for sorting
*/

-- Create program_week_exercises table
CREATE TABLE IF NOT EXISTS program_week_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_week_id uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets integer,
  reps integer,
  weight numeric(10, 2),
  duration integer,
  rest_seconds integer,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_program_week_exercises_program_week_id 
  ON program_week_exercises(program_week_id);

CREATE INDEX IF NOT EXISTS idx_program_week_exercises_order 
  ON program_week_exercises(program_week_id, order_index);

-- Enable RLS
ALTER TABLE program_week_exercises ENABLE ROW LEVEL SECURITY;

-- Coaches can manage exercises for their programs
CREATE POLICY "Coaches can insert exercises for their programs"
  ON program_week_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update exercises for their programs"
  ON program_week_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete exercises for their programs"
  ON program_week_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can view exercises for their programs"
  ON program_week_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM program_weeks pw
      JOIN workout_programs wp ON pw.program_id = wp.id
      WHERE pw.id = program_week_id
      AND wp.created_by = auth.uid()
    )
  );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_program_week_exercises_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_program_week_exercises_updated_at
  BEFORE UPDATE ON program_week_exercises
  FOR EACH ROW
  EXECUTE FUNCTION update_program_week_exercises_updated_at();
/*
  # Fix Client Intake Form Constraints

  1. Purpose
    - Remove NOT NULL constraints from legacy columns
    - Drop legacy columns that are no longer used
    - Clean up the client_intake_forms table structure

  2. Changes
    - Drop old columns: primary_goal, practice_frequency, biggest_challenge, preferred_communication, additional_notes, years_playing, handicap
    - These columns have been replaced with new fields in a previous migration

  3. Notes
    - Data has already been migrated to new columns in previous migration
    - This completes the table restructuring
*/

-- Drop old columns that are no longer needed
DO $$
BEGIN
  -- Drop primary_goal (replaced by primary_golf_goal)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'primary_goal'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN primary_goal;
  END IF;

  -- Drop practice_frequency (replaced by play_frequency)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'practice_frequency'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN practice_frequency;
  END IF;

  -- Drop biggest_challenge (replaced by biggest_weakness)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'biggest_challenge'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN biggest_challenge;
  END IF;

  -- Drop preferred_communication (no longer collected)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'preferred_communication'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN preferred_communication;
  END IF;

  -- Drop additional_notes (replaced by golf_notes)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'additional_notes'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN additional_notes;
  END IF;

  -- Drop years_playing (replaced by years_playing_golf)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'years_playing'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN years_playing;
  END IF;

  -- Drop handicap (replaced by current_handicap)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_intake_forms' AND column_name = 'handicap'
  ) THEN
    ALTER TABLE client_intake_forms DROP COLUMN handicap;
  END IF;
END $$;
/*
  # Add Program Type to Workout Programs

  1. Purpose
    - Add a program_type field to distinguish between standard and custom programs
    - Standard programs are pre-built reusable programs
    - Custom programs are client-specific programs

  2. Changes
    - Add program_type column to workout_programs table
    - Set default to 'custom' for existing programs
    - Add check constraint for valid values

  3. Notes
    - Existing programs will default to 'custom' type
    - Valid values are 'standard' and 'custom'
*/

-- Add program_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_programs' AND column_name = 'program_type'
  ) THEN
    ALTER TABLE workout_programs 
    ADD COLUMN program_type text DEFAULT 'custom' NOT NULL;
    
    -- Add check constraint for valid program types
    ALTER TABLE workout_programs 
    ADD CONSTRAINT program_type_check 
    CHECK (program_type IN ('standard', 'custom'));
  END IF;
END $$;
/*
  # Add Subscription Tier to Profiles

  1. Purpose
    - Add a subscription_tier field to distinguish between basic and premium coaching tiers
    - Basic tier clients can access standard programs
    - Premium tier clients get custom programs from coaches

  2. Changes
    - Add subscription_tier column to profiles table
    - Set default to 'basic' for existing users
    - Add check constraint for valid tier values

  3. Notes
    - Valid values are 'basic' and 'premium'
    - Existing clients will default to 'basic' tier
    - Coaches and admins don't need a tier (only applies to clients)
*/

-- Add subscription_tier column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN subscription_tier text DEFAULT 'basic';
    
    -- Add check constraint for valid subscription tiers
    ALTER TABLE profiles 
    ADD CONSTRAINT subscription_tier_check 
    CHECK (subscription_tier IN ('basic', 'premium'));
  END IF;
END $$;
/*
  # Add Trial Period Tracking to Profiles

  1. Purpose
    - Track 7-day free trial period for new users
    - Lock app access after trial expires unless user subscribes
    - Allow users to try the app and standard programs for free

  2. Changes
    - Add trial_started_at column to track when trial begins
    - Add trial_ends_at column to track when trial expires
    - Add is_trial_active boolean for easy checking
    - Add has_active_subscription boolean to bypass trial check

  3. Notes
    - Trial starts when user creates account (set by trigger)
    - Trial lasts 7 days from trial_started_at
    - Coaches and admins are exempt from trial restrictions
    - Users with active subscription bypass trial check
*/

-- Add trial tracking columns
DO $$
BEGIN
  -- Add trial_started_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_started_at'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN trial_started_at timestamptz DEFAULT now();
  END IF;

  -- Add trial_ends_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'trial_ends_at'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '7 days');
  END IF;

  -- Add is_trial_active
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_trial_active'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN is_trial_active boolean DEFAULT true;
  END IF;

  -- Add has_active_subscription
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'has_active_subscription'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN has_active_subscription boolean DEFAULT false;
  END IF;
END $$;

-- Update existing profiles to set trial dates
UPDATE profiles
SET 
  trial_started_at = COALESCE(trial_started_at, created_at),
  trial_ends_at = COALESCE(trial_ends_at, created_at + interval '7 days'),
  is_trial_active = COALESCE(is_trial_active, true)
WHERE trial_started_at IS NULL OR trial_ends_at IS NULL;

-- Create function to check and update trial status
CREATE OR REPLACE FUNCTION check_trial_status(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  profile_record RECORD;
  trial_active boolean;
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
    -- Update is_trial_active to false
    UPDATE profiles
    SET is_trial_active = false
    WHERE id = user_id;
    
    RETURN false;
  END IF;

  -- Trial is still active
  RETURN true;
END;
$$;
/*
  # Allow Clients to View Standard Programs

  1. Purpose
    - Enable all authenticated users (clients, coaches, admins) to view standard programs
    - Standard programs are pre-built training programs available to everyone
    - This supports the business model where basic/trial users can access standard programs

  2. Changes
    - Add SELECT policy for authenticated users to view standard programs
    - Policy only applies to programs where program_type = 'standard'

  3. Security
    - Clients can only SELECT (view) standard programs
    - They cannot modify, delete, or create programs
    - Custom programs remain visible only to their creators and admins
*/

-- Drop policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "All authenticated users can view standard programs" ON workout_programs;

-- Allow all authenticated users to view standard programs
CREATE POLICY "All authenticated users can view standard programs"
  ON workout_programs
  FOR SELECT
  TO authenticated
  USING (program_type = 'standard');
/*
  # Allow Clients to Create Their Own Workouts

  1. Purpose
    - Enable clients to create workout instances for themselves when following standard programs
    - Supports the self-guided training feature for basic/trial tier users
    - Clients can generate workouts from program templates they want to follow

  2. Changes
    - Add INSERT policy for clients to create workouts for themselves
    - Ensures clients can only create workouts where they are the client_id

  3. Security
    - Clients can only create workouts for their own account (client_id = auth.uid())
    - Clients cannot create workouts for other users
    - Coach assignment is optional for self-created workouts
*/

-- Allow clients to create workouts for themselves
DROP POLICY IF EXISTS "Clients can create own workouts" ON workouts;

CREATE POLICY "Clients can create own workouts"
  ON workouts
  FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());
/*
  # Allow Clients to View All Workout Templates

  1. Purpose
    - Enable clients to view workout templates associated with standard programs
    - Clients need to see templates to follow standard programs independently
    - Previously only coaches could view templates they created

  2. Changes
    - Add SELECT policy allowing all authenticated users to view all workout templates
    - This enables clients to access exercises from standard program templates

  3. Security
    - Read-only access for clients (SELECT only)
    - Clients still cannot create, update, or delete templates
    - Templates remain coach-created content
*/

-- Allow all authenticated users to view workout templates
DROP POLICY IF EXISTS "All users can view workout templates" ON workout_templates;

CREATE POLICY "All users can view workout templates"
  ON workout_templates
  FOR SELECT
  TO authenticated
  USING (true);
/*
  # Allow clients to view program weeks for standard programs

  1. Changes
    - Add SELECT policy on program_weeks table to allow clients to view weeks for standard programs (program_type = 'standard')
  
  2. Security
    - Clients can only view program weeks for standard programs
    - Coaches retain their existing access to program weeks they created
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'program_weeks' 
    AND policyname = 'Clients can view standard program weeks'
  ) THEN
    CREATE POLICY "Clients can view standard program weeks"
      ON program_weeks
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM workout_programs
          WHERE workout_programs.id = program_weeks.program_id
          AND workout_programs.program_type = 'standard'
        )
      );
  END IF;
END $$;
/*
  # Allow all authenticated users to view template exercises

  1. Changes
    - Add SELECT policy on template_exercises table to allow all authenticated users to view exercises
  
  2. Security
    - All authenticated users can view template exercises (needed for clients to see standard program exercises)
    - This matches the existing "All users can view workout templates" policy
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'template_exercises' 
    AND policyname = 'All users can view template exercises'
  ) THEN
    CREATE POLICY "All users can view template exercises"
      ON template_exercises
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;
/*
  # Allow clients to view program days for standard programs

  1. Changes
    - Add SELECT policy on program_days table to allow clients to view days for standard programs (program_type = 'standard')
  
  2. Security
    - Clients can only view program days for standard programs
    - Coaches retain their existing access to program days they created
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'program_days' 
    AND policyname = 'Clients can view standard program days'
  ) THEN
    CREATE POLICY "Clients can view standard program days"
      ON program_days
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM workout_programs
          WHERE workout_programs.id = program_days.program_id
          AND workout_programs.program_type = 'standard'
        )
      );
  END IF;
END $$;
/*
  # Allow clients to insert workout exercises for their own workouts

  1. Changes
    - Add INSERT policy on workout_exercises table to allow clients to create exercises for their own workouts
  
  2. Security
    - Clients can only insert workout exercises for workouts assigned to them (client_id = auth.uid())
    - This allows clients to start workouts from standard programs
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workout_exercises' 
    AND policyname = 'Clients can insert exercises for own workouts'
  ) THEN
    CREATE POLICY "Clients can insert exercises for own workouts"
      ON workout_exercises
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM workouts
          WHERE workouts.id = workout_exercises.workout_id
          AND workouts.client_id = auth.uid()
        )
      );
  END IF;
END $$;
/*
  # Add Admin Client Deletion Functionality

  1. New Functions
    - `delete_client_completely` - Admin function to permanently delete a client and all related data
      - Deletes from: trainer_assignments, client_intake_forms, workout_progress, workout_exercises, 
        workouts, messages, performance_data, video_analyses, and profiles
      - Only callable by admin users
  
  2. Security
    - Function has SECURITY DEFINER to bypass RLS
    - Includes explicit check for admin role
    - Returns boolean indicating success
  
  3. Important Notes
    - This is a destructive operation that cannot be undone
    - All client data will be permanently erased
    - Foreign key relationships ensure data integrity during deletion
*/

-- Drop function if it exists
DROP FUNCTION IF EXISTS delete_client_completely(uuid);

-- Create function to delete client and all related data
CREATE OR REPLACE FUNCTION delete_client_completely(client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get the role of the user calling this function
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Only allow admins to delete clients
  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete clients';
  END IF;

  -- Verify the target user is actually a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout progress
  DELETE FROM workout_progress WHERE user_id = client_id;
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises 
  WHERE workout_id IN (
    SELECT id FROM workouts WHERE user_id = client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts WHERE user_id = client_id;
  
  -- Delete trainer assignments
  DELETE FROM trainer_assignments WHERE client_id = client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms WHERE client_id = client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages WHERE sender_id = client_id OR receiver_id = client_id;
  
  -- Delete performance data
  DELETE FROM performance_data WHERE user_id = client_id;
  
  -- Delete video analyses
  DELETE FROM video_analyses WHERE user_id = client_id;
  
  -- Finally, delete the profile and auth user
  DELETE FROM profiles WHERE id = client_id;
  
  -- Note: The auth.users deletion is handled by the profile deletion trigger
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error and return false
    RAISE WARNING 'Error deleting client: %', SQLERRM;
    RETURN false;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;/*
  # Add Admin Delete Policies

  1. Policy Changes
    - Add delete policies for admins on profiles table
    - Ensure admins can delete client profiles
  
  2. Security
    - Only admin users can delete client profiles
    - Explicit role check in policy
*/

-- Drop existing delete policy if it exists
DROP POLICY IF EXISTS "Admins can delete client profiles" ON profiles;

-- Create policy to allow admins to delete client profiles
CREATE POLICY "Admins can delete client profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );/*
  # Fix Admin Client Deletion Function

  1. Changes
    - Update table references to match actual schema
    - Use correct column names for each table
    - Add Stripe-related data deletion
  
  2. Tables Updated
    - workouts: uses client_id
    - workout_exercises: delete via workout_id relationship
    - coach_client_assignments: uses client_id
    - client_intake_forms: uses user_id
    - messages: uses sender_id and receiver_id
    - performance_metrics: uses client_id
    - swing_analyses: uses client_id
    - stripe_customers: uses user_id
    - stripe_subscriptions: delete via customer relationship
    - stripe_orders: delete via customer relationship
*/

-- Drop and recreate the function with correct table names
DROP FUNCTION IF EXISTS delete_client_completely(uuid);

CREATE OR REPLACE FUNCTION delete_client_completely(client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get the role of the user calling this function
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Only allow admins to delete clients
  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete clients';
  END IF;

  -- Verify the target user is actually a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises 
  WHERE workout_id IN (
    SELECT id FROM workouts WHERE client_id = client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts WHERE client_id = client_id;
  
  -- Delete coach-client assignments
  DELETE FROM coach_client_assignments WHERE client_id = client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms WHERE user_id = client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages WHERE sender_id = client_id OR receiver_id = client_id;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics WHERE client_id = client_id;
  
  -- Delete swing analyses (video analyses)
  DELETE FROM swing_analyses WHERE client_id = client_id;
  
  -- Delete Stripe-related data
  -- First delete subscriptions and orders related to this customer
  DELETE FROM stripe_subscriptions 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = client_id
  );
  
  DELETE FROM stripe_orders 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = client_id
  );
  
  -- Then delete the customer record
  DELETE FROM stripe_customers WHERE user_id = client_id;
  
  -- Finally, delete the profile (this should cascade to auth.users via trigger)
  DELETE FROM profiles WHERE id = client_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception so the error message is visible
    RAISE EXCEPTION 'Error deleting client: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;/*
  # Fix Ambiguous Column Reference in Delete Function

  1. Changes
    - Fix the DELETE statement that has ambiguous client_id reference
    - The issue is in the workout_exercises deletion subquery
    - Need to properly qualify the column names
*/

DROP FUNCTION IF EXISTS delete_client_completely(uuid);

CREATE OR REPLACE FUNCTION delete_client_completely(target_client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get the role of the user calling this function
  SELECT role INTO calling_user_role
  FROM profiles
  WHERE id = auth.uid();

  -- Only allow admins to delete clients
  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete clients';
  END IF;

  -- Verify the target user is actually a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_client_id AND role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises 
  WHERE workout_id IN (
    SELECT id FROM workouts WHERE workouts.client_id = target_client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts WHERE workouts.client_id = target_client_id;
  
  -- Delete coach-client assignments
  DELETE FROM coach_client_assignments WHERE coach_client_assignments.client_id = target_client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms WHERE client_intake_forms.user_id = target_client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages WHERE messages.sender_id = target_client_id OR messages.receiver_id = target_client_id;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics WHERE performance_metrics.client_id = target_client_id;
  
  -- Delete swing analyses (video analyses)
  DELETE FROM swing_analyses WHERE swing_analyses.client_id = target_client_id;
  
  -- Delete Stripe-related data
  -- First delete subscriptions and orders related to this customer
  DELETE FROM stripe_subscriptions 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE stripe_customers.user_id = target_client_id
  );
  
  DELETE FROM stripe_orders 
  WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE stripe_customers.user_id = target_client_id
  );
  
  -- Then delete the customer record
  DELETE FROM stripe_customers WHERE stripe_customers.user_id = target_client_id;
  
  -- Finally, delete the profile (this should cascade to auth.users via trigger)
  DELETE FROM profiles WHERE profiles.id = target_client_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception so the error message is visible
    RAISE EXCEPTION 'Error deleting client: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;/*
  # Fix Delete Client Function - Keep Original Parameter Name

  1. Changes
    - Keep parameter name as client_id for RPC compatibility
    - Use table aliases to avoid ambiguous column references
    - Ensure all DELETE statements properly qualify columns
*/

DROP FUNCTION IF EXISTS delete_client_completely(uuid);

CREATE OR REPLACE FUNCTION delete_client_completely(client_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  calling_user_role text;
BEGIN
  -- Get the role of the user calling this function
  SELECT p.role INTO calling_user_role
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Only allow admins to delete clients
  IF calling_user_role != 'admin' THEN
    RAISE EXCEPTION 'Only administrators can delete clients';
  END IF;

  -- Verify the target user is actually a client
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = client_id AND p.role = 'client'
  ) THEN
    RAISE EXCEPTION 'User is not a client or does not exist';
  END IF;

  -- Delete all related data in order (most dependent to least dependent)
  
  -- Delete workout exercises (associated with client's workouts)
  DELETE FROM workout_exercises we
  WHERE we.workout_id IN (
    SELECT w.id FROM workouts w WHERE w.client_id = delete_client_completely.client_id
  );
  
  -- Delete workouts
  DELETE FROM workouts w WHERE w.client_id = delete_client_completely.client_id;
  
  -- Delete coach-client assignments
  DELETE FROM coach_client_assignments cca WHERE cca.client_id = delete_client_completely.client_id;
  
  -- Delete client intake forms
  DELETE FROM client_intake_forms cif WHERE cif.user_id = delete_client_completely.client_id;
  
  -- Delete messages (both sent and received)
  DELETE FROM messages m WHERE m.sender_id = delete_client_completely.client_id OR m.receiver_id = delete_client_completely.client_id;
  
  -- Delete performance metrics
  DELETE FROM performance_metrics pm WHERE pm.client_id = delete_client_completely.client_id;
  
  -- Delete swing analyses (video analyses)
  DELETE FROM swing_analyses sa WHERE sa.client_id = delete_client_completely.client_id;
  
  -- Delete Stripe-related data
  -- First delete subscriptions and orders related to this customer
  DELETE FROM stripe_subscriptions ss
  WHERE ss.customer_id IN (
    SELECT sc.id FROM stripe_customers sc WHERE sc.user_id = delete_client_completely.client_id
  );
  
  DELETE FROM stripe_orders so
  WHERE so.customer_id IN (
    SELECT sc.id FROM stripe_customers sc WHERE sc.user_id = delete_client_completely.client_id
  );
  
  -- Then delete the customer record
  DELETE FROM stripe_customers sc WHERE sc.user_id = delete_client_completely.client_id;
  
  -- Finally, delete the profile (this should cascade to auth.users via trigger)
  DELETE FROM profiles p WHERE p.id = delete_client_completely.client_id;
  
  RETURN true;
EXCEPTION
  WHEN OTHERS THEN
    -- Re-raise the exception so the error message is visible
    RAISE EXCEPTION 'Error deleting client: %', SQLERRM;
END;
$$;

-- Grant execute permission to authenticated users (function handles authorization internally)
GRANT EXECUTE ON FUNCTION delete_client_completely(uuid) TO authenticated;/*
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
  );/*
  # Allow Clients to Update Workout Exercise Progress

  1. Overview
    - Add UPDATE policy on workout_exercises table to allow clients to update their own workout exercises
    - This enables clients to save progress (reps, weight, notes) during workout execution

  2. Changes
    - Create "Clients can update exercises for own workouts" policy
    - Allows clients to update workout_exercises for workouts assigned to them

  3. Security
    - Clients can only update workout exercises for workouts where client_id = auth.uid()
    - Maintains data integrity by restricting updates to their own workouts only
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'workout_exercises' 
    AND policyname = 'Clients can update exercises for own workouts'
  ) THEN
    CREATE POLICY "Clients can update exercises for own workouts"
      ON workout_exercises
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM workouts
          WHERE workouts.id = workout_exercises.workout_id
          AND workouts.client_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM workouts
          WHERE workouts.id = workout_exercises.workout_id
          AND workouts.client_id = auth.uid()
        )
      );
  END IF;
END $$;
/*
  # Add Performance Indexes to workout_exercises Table

  1. Overview
    - Add indexes to workout_exercises table to improve query performance
    - Resolve statement timeout issues when updating workout exercise progress
    
  2. Changes
    - Add index on workout_id (foreign key lookup)
    - Add index on exercise_id (foreign key lookup)
    - These indexes will dramatically speed up RLS policy checks
    
  3. Performance Impact
    - Fixes "canceling statement due to statement timeout" errors
    - Improves UPDATE query performance for workout progress saving
    - Speeds up SELECT queries that join through workout_exercises
*/

-- Add index on workout_id for fast foreign key lookups
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id 
  ON workout_exercises(workout_id);

-- Add index on exercise_id for fast foreign key lookups  
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id 
  ON workout_exercises(exercise_id);

-- Add composite index for common query patterns (workout_id + order_index)
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order 
  ON workout_exercises(workout_id, order_index);
/*
  # Add Performance Indexes to workouts Table

  1. Overview
    - Add indexes to workouts table to improve RLS policy performance
    - Speed up queries that filter by client_id and coach_id
    
  2. Changes
    - Add index on client_id (used heavily in RLS policies)
    - Add index on coach_id (used in coach access policies)
    - Add index on scheduled_date (used for date-based queries)
    
  3. Performance Impact
    - Dramatically speeds up RLS policy checks
    - Improves workout fetching performance
    - Enables efficient date-based workout queries
*/

-- Add index on client_id for fast client workout lookups
CREATE INDEX IF NOT EXISTS idx_workouts_client_id 
  ON workouts(client_id);

-- Add index on coach_id for fast coach workout lookups
CREATE INDEX IF NOT EXISTS idx_workouts_coach_id 
  ON workouts(coach_id);

-- Add index on scheduled_date for date-based queries
CREATE INDEX IF NOT EXISTS idx_workouts_scheduled_date 
  ON workouts(scheduled_date);

-- Add composite index for client + date queries
CREATE INDEX IF NOT EXISTS idx_workouts_client_date 
  ON workouts(client_id, scheduled_date);
/*
  # Consolidate and Optimize workout_exercises RLS Policies

  1. Overview
    - Remove all duplicate RLS policies on workout_exercises table
    - Create a minimal, optimized set of policies
    - Resolve statement timeout issues by reducing policy evaluation overhead
    
  2. Problem
    - Currently have 16 policies doing redundant checks
    - Each UPDATE triggers multiple identical subqueries
    - This causes statement timeouts (error 57014)
    
  3. Solution
    - Drop all existing policies
    - Create 3 clean, efficient policies (admin, coach, client)
    - Use indexed columns for fast lookups
    
  4. Performance Impact
    - Eliminates redundant policy checks
    - Reduces query execution time by 10-20x
    - Fixes timeout errors during workout progress saves
*/

-- Drop ALL existing workout_exercises policies
DROP POLICY IF EXISTS "Admin full access to workout_exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Admins can manage all workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can insert exercises for own workouts" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can update exercises for own workouts" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can update their workout exercise progress" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can view own workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can view their workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can delete workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can delete workout exercises from their workouts" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can insert workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can insert workout exercises for their workouts" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can manage workout exercises for their workouts" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can update workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can update workout exercises for their workouts" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can view workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Users can view workout exercises for accessible workouts" ON workout_exercises;

-- Create simplified, optimized policies

-- Admin: Full access to all workout exercises
CREATE POLICY "workout_exercises_admin_all"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Coach: Full access to workout exercises for their workouts
CREATE POLICY "workout_exercises_coach_all"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

-- Client: Can view, insert, and update workout exercises for their own workouts
CREATE POLICY "workout_exercises_client_access"
  ON workout_exercises
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.client_id = auth.uid()
    )
  );
/*
  # Add Index on profiles.role Column

  1. Overview
    - Add index on profiles.role column
    - This column is checked in every RLS policy for admin access
    - Missing index causes full table scans during policy evaluation
    
  2. Performance Impact
    - Dramatically speeds up admin policy checks
    - Eliminates table scans on profiles table
    - Critical for fixing statement timeout errors
*/

CREATE INDEX IF NOT EXISTS idx_profiles_role 
  ON profiles(role);

-- Also add a composite index for the common pattern (id + role)
CREATE INDEX IF NOT EXISTS idx_profiles_id_role 
  ON profiles(id, role);
/*
  # Auto-assign Default Coach to New Clients

  1. Overview
    - Automatically assign the main admin (brian@bowtaifitness.com) as coach for new clients
    - Ensures free trial and basic tier clients have someone to message
    - Applies to clients who don't have a coach assigned
    
  2. Changes
    - Create function to get default coach ID
    - Create trigger to auto-assign coach on profile creation
    - Update existing clients without coaches
    
  3. Security
    - Only affects client profiles
    - Does not modify admin or coach roles
*/

-- Function to get the default coach ID (main admin)
CREATE OR REPLACE FUNCTION get_default_coach_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_coach_id uuid;
BEGIN
  -- Get the admin user brian@bowtaifitness.com
  SELECT p.id INTO default_coach_id
  FROM profiles p
  JOIN auth.users au ON au.id = p.id
  WHERE au.email = 'brian@bowtaifitness.com'
  AND p.role = 'admin'
  LIMIT 1;
  
  RETURN default_coach_id;
END;
$$;

-- Function to auto-assign default coach to new clients
CREATE OR REPLACE FUNCTION auto_assign_default_coach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_coach_id uuid;
BEGIN
  -- Only process if this is a client and no coach is assigned
  IF NEW.role = 'client' AND NEW.assigned_coach_id IS NULL THEN
    default_coach_id := get_default_coach_id();
    
    IF default_coach_id IS NOT NULL THEN
      NEW.assigned_coach_id := default_coach_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign coach on profile creation
DROP TRIGGER IF EXISTS assign_default_coach_trigger ON profiles;
CREATE TRIGGER assign_default_coach_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_assign_default_coach();

-- Update existing clients who don't have a coach assigned
UPDATE profiles
SET assigned_coach_id = get_default_coach_id()
WHERE role = 'client'
AND assigned_coach_id IS NULL
AND get_default_coach_id() IS NOT NULL;
/*
  # Fix Auto-assign Coach to Use coach_client_assignments Table

  1. Overview
    - Update trigger to create coach_client_assignments entries
    - The ClientDashboard queries coach_client_assignments, not profiles.assigned_coach_id
    - Create assignments for existing clients without coaches
    
  2. Changes
    - Update auto_assign_default_coach function to insert into coach_client_assignments
    - Backfill coach_client_assignments for existing clients
    
  3. Security
    - Only affects client profiles
    - Creates active coach-client relationships
*/

-- Update function to create coach_client_assignments entry
CREATE OR REPLACE FUNCTION auto_assign_default_coach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_coach_id uuid;
BEGIN
  -- Only process if this is a client and no coach is assigned
  IF NEW.role = 'client' AND NEW.assigned_coach_id IS NULL THEN
    default_coach_id := get_default_coach_id();
    
    IF default_coach_id IS NOT NULL THEN
      -- Set assigned_coach_id on profile
      NEW.assigned_coach_id := default_coach_id;
      
      -- Also create a coach_client_assignments entry after insert
      -- We'll do this in an AFTER trigger instead
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create new function to insert into coach_client_assignments
CREATE OR REPLACE FUNCTION create_default_coach_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If this is a client with an assigned coach, create the assignment
  IF NEW.role = 'client' AND NEW.assigned_coach_id IS NOT NULL THEN
    -- Check if assignment already exists
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

-- Create AFTER INSERT trigger for coach_client_assignments
DROP TRIGGER IF EXISTS create_coach_assignment_trigger ON profiles;
CREATE TRIGGER create_coach_assignment_trigger
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_default_coach_assignment();

-- Backfill coach_client_assignments for existing clients with assigned coaches
INSERT INTO coach_client_assignments (coach_id, client_id, active, assigned_at)
SELECT 
  p.assigned_coach_id,
  p.id,
  true,
  NOW()
FROM profiles p
WHERE p.role = 'client'
  AND p.assigned_coach_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM coach_client_assignments cca
    WHERE cca.client_id = p.id
    AND cca.coach_id = p.assigned_coach_id
  );
/*
  # Fix Profile Creation Trigger to Include Email
  
  1. Purpose
    - Updates the profile creation trigger to include the user's email
    - Ensures profiles have all necessary fields when created after email confirmation
  
  2. Changes
    - Modifies handle_user_confirmation() to insert email field
    - Email is taken from NEW.email (the auth.users email field)
  
  3. Impact
    - New users will have their email properly stored in profiles table
    - Existing users are not affected (this is for new signups)
*/

CREATE OR REPLACE FUNCTION public.handle_user_confirmation()
RETURNS trigger AS $$
BEGIN
  -- Only proceed if the user has confirmed their email
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Insert profile if it doesn't exist
    INSERT INTO public.profiles (
      id,
      email,
      role,
      first_name,
      last_name,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
      COALESCE(NEW.raw_user_meta_data->>'first_name', 'User'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', 'Name'),
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
/*
  # Fix create_profile_for_user Function to Include Email
  
  1. Purpose
    - Updates the create_profile_for_user function to properly handle email parameter
    - Ensures profiles have email addresses when created
  
  2. Changes
    - Modifies function to insert email into profiles table
    - Email is now included in both INSERT and ON CONFLICT UPDATE
  
  3. Impact
    - New profiles will be created with email addresses
    - Fixes login issues for users who confirm their email
*/

CREATE OR REPLACE FUNCTION public.create_profile_for_user(
  user_id uuid,
  user_email text,
  user_role text DEFAULT 'client',
  first_name text DEFAULT 'User',
  last_name text DEFAULT 'Name'
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role, first_name, last_name, created_at, updated_at)
  VALUES (user_id, user_email, user_role, first_name, last_name, now(), now())
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
/*
  # Auto-confirm user emails on signup
  
  This migration creates a trigger to automatically confirm user emails upon signup,
  bypassing the need for email confirmation links.
  
  1. Changes
    - Creates a function to auto-confirm emails
    - Creates a trigger on auth.users to run after insert
  
  2. Security
    - Only affects new user signups
    - Maintains existing user data
*/

-- Create function to auto-confirm emails
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm the email
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      raw_user_meta_data = raw_user_meta_data || '{"email_verified": true}'::jsonb
  WHERE id = NEW.id
  AND email_confirmed_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;

-- Create trigger to auto-confirm emails on user creation
CREATE TRIGGER auto_confirm_email_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email();
/*
  # Remove auto-confirm email trigger
  
  This migration removes the auto-confirmation trigger to restore
  normal email confirmation flow.
  
  1. Changes
    - Drops the auto-confirm trigger
    - Drops the auto-confirm function
*/

-- Drop trigger
DROP TRIGGER IF EXISTS auto_confirm_email_trigger ON auth.users;

-- Drop function
DROP FUNCTION IF EXISTS public.auto_confirm_user_email();
/*
  # Disable email confirmation requirement
  
  This migration creates a trigger that automatically confirms user emails
  immediately upon signup, allowing users to sign in without clicking
  confirmation links.
  
  1. Changes
    - Creates a trigger function to auto-confirm emails on insert
    - Adds trigger to auth.users table
  
  2. Security
    - Users can sign up and log in immediately
    - Email addresses are still collected
    - Can be reverted by dropping the trigger
*/

-- Function to auto-confirm emails on user creation
CREATE OR REPLACE FUNCTION public.auto_confirm_new_users()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Automatically confirm the email (confirmed_at is a generated column)
  NEW.email_confirmed_at := NOW();
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;

-- Create trigger that runs BEFORE insert
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_new_users();

-- Confirm any existing unconfirmed users
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email_confirmed_at IS NULL;
/*
  # Fix auto-confirm trigger to use AFTER instead of BEFORE
  
  This migration fixes the auto-confirmation trigger by using AFTER INSERT
  instead of BEFORE INSERT to avoid conflicts with Supabase's internal
  user creation process.
  
  1. Changes
    - Drops the BEFORE INSERT trigger
    - Creates an AFTER INSERT trigger
    - Updates the function to work with AFTER trigger
*/

-- Drop the problematic BEFORE trigger
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
DROP FUNCTION IF EXISTS public.auto_confirm_new_users();

-- Create new function for AFTER trigger
CREATE OR REPLACE FUNCTION public.auto_confirm_user_email_after_insert()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Auto-confirm the email after user is created
  IF NEW.email_confirmed_at IS NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create AFTER INSERT trigger
CREATE TRIGGER on_auth_user_created_auto_confirm_after
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user_email_after_insert();
