/*
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
$$ LANGUAGE plpgsql SECURITY DEFINER;