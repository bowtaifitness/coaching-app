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
