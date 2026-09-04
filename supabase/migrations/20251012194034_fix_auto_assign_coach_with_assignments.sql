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
