/*
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();