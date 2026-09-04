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
