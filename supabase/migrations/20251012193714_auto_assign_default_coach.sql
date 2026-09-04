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
