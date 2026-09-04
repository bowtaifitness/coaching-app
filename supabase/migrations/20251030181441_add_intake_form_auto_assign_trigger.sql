/*
  # Add Trigger for Automatic Program Assignment

  1. New Triggers
    - `trigger_auto_assign_program` - Automatically assigns program when intake form is inserted
      - Fires AFTER INSERT on client_intake_forms
      - Calls assign_program_from_intake function
      - Logs success or failure
  
  2. Notes
    - Trigger runs automatically when client submits intake form
    - Assignment happens in background
    - Uses SECURITY DEFINER function for proper permissions
*/

-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_auto_assign_program()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Call the assignment function as the user who created the form
  -- This is safe because assign_program_from_intake validates ownership
  PERFORM set_config('request.jwt.claim.sub', NEW.user_id::text, true);
  
  -- Assign program based on intake form
  v_result := assign_program_from_intake(NEW.id);
  
  -- Log the result (optional, for debugging)
  IF (v_result->>'success')::boolean THEN
    RAISE NOTICE 'Auto-assigned program for user %: %', NEW.user_id, v_result;
  ELSE
    RAISE WARNING 'Failed to auto-assign program for user %: %', NEW.user_id, v_result->>'error';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_assign_program ON client_intake_forms;
CREATE TRIGGER trigger_auto_assign_program
  AFTER INSERT ON client_intake_forms
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_assign_program();

-- Add helpful comment
COMMENT ON FUNCTION trigger_auto_assign_program IS 'Trigger function that automatically assigns a standard program when a client completes their intake form.';