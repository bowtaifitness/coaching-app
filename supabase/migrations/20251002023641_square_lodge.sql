/*
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
  );