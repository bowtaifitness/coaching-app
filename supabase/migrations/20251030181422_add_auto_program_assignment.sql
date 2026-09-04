/*
  # Add Automatic Program Assignment Based on Intake Form

  1. New Functions
    - `assign_program_from_intake(intake_form_id)` - Analyzes intake form and assigns appropriate standard program
      - Checks workout_frequency (days per week)
      - Checks equipment_access (determines equipment type)
      - Finds matching standard program
      - Assigns program to client with start date on next Monday
  
  2. Logic
    - Maps workout frequency to days_per_week
    - Maps equipment access to program type (Full Gym, Dumbbell, Bands, Bodyweight)
    - Priority order: Full Gym > Dumbbell > Bands > Bodyweight
    - Start date is always the following Monday
  
  3. Security
    - Function is SECURITY DEFINER (runs with creator privileges)
    - Can only be called by authenticated users
    - Validates user owns the intake form
*/

-- Create function to assign program based on intake form
CREATE OR REPLACE FUNCTION assign_program_from_intake(intake_form_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_intake_form record;
  v_days_per_week integer;
  v_equipment_type text;
  v_standard_program_id uuid;
  v_start_date date;
  v_new_workout_id uuid;
  v_calling_user_id uuid;
BEGIN
  -- Get calling user
  v_calling_user_id := auth.uid();
  
  -- Get intake form data
  SELECT 
    user_id,
    workout_frequency,
    equipment_access
  INTO v_intake_form
  FROM client_intake_forms
  WHERE id = intake_form_id;

  -- Validate intake form exists
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Intake form not found'
    );
  END IF;

  -- Validate user owns this intake form
  IF v_intake_form.user_id != v_calling_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized'
    );
  END IF;

  -- Parse workout frequency to days per week
  -- Expected format: "2 days per week", "3 days per week", etc.
  v_days_per_week := 2; -- default to 2 days
  
  IF v_intake_form.workout_frequency IS NOT NULL THEN
    IF v_intake_form.workout_frequency ILIKE '%3%day%' THEN
      v_days_per_week := 3;
    ELSIF v_intake_form.workout_frequency ILIKE '%4%day%' THEN
      v_days_per_week := 4;
    ELSIF v_intake_form.workout_frequency ILIKE '%5%day%' THEN
      v_days_per_week := 5;
    ELSIF v_intake_form.workout_frequency ILIKE '%6%day%' THEN
      v_days_per_week := 6;
    ELSIF v_intake_form.workout_frequency ILIKE '%2%day%' THEN
      v_days_per_week := 2;
    END IF;
  END IF;

  -- Determine equipment type based on equipment_access array
  -- Priority: Full Gym > Dumbbell > Bands > Bodyweight
  v_equipment_type := 'Bodyweight'; -- default
  
  IF v_intake_form.equipment_access IS NOT NULL AND array_length(v_intake_form.equipment_access, 1) > 0 THEN
    IF 'Full Gym' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Full Gym';
    ELSIF 'Dumbbells' = ANY(v_intake_form.equipment_access) OR 'Dumbbell' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Dumbbell';
    ELSIF 'Resistance Bands' = ANY(v_intake_form.equipment_access) OR 'Bands' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Bands';
    END IF;
  END IF;

  -- Find matching standard program
  -- Look for program with matching days_per_week and equipment type
  SELECT id INTO v_standard_program_id
  FROM workout_programs
  WHERE program_type = 'standard'
    AND days_per_week = v_days_per_week
    AND title ILIKE '%' || v_equipment_type || '%'
  LIMIT 1;

  -- If no exact match, try to find any standard program with matching days
  IF v_standard_program_id IS NULL THEN
    SELECT id INTO v_standard_program_id
    FROM workout_programs
    WHERE program_type = 'standard'
      AND days_per_week = v_days_per_week
    LIMIT 1;
  END IF;

  -- If still no match, use any standard program
  IF v_standard_program_id IS NULL THEN
    SELECT id INTO v_standard_program_id
    FROM workout_programs
    WHERE program_type = 'standard'
    LIMIT 1;
  END IF;

  -- If no standard programs exist at all, return error
  IF v_standard_program_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No standard programs available'
    );
  END IF;

  -- Calculate start date (next Monday)
  v_start_date := CURRENT_DATE;
  
  -- Find next Monday
  -- date_part('dow', date) returns 0 for Sunday, 1 for Monday, etc.
  -- Days until next Monday: (8 - current_dow) % 7, or 7 if current_dow = 1 (Monday)
  v_start_date := v_start_date + (
    CASE 
      WHEN EXTRACT(DOW FROM v_start_date) = 1 THEN 7 -- If today is Monday, start next Monday
      WHEN EXTRACT(DOW FROM v_start_date) = 0 THEN 1 -- If Sunday, next day is Monday
      ELSE 8 - EXTRACT(DOW FROM v_start_date) -- Otherwise calculate days until Monday
    END
  )::integer;

  -- Create workout assignment
  INSERT INTO workouts (user_id, program_id, scheduled_date, status)
  VALUES (v_intake_form.user_id, v_standard_program_id, v_start_date, 'scheduled')
  RETURNING id INTO v_new_workout_id;

  RETURN jsonb_build_object(
    'success', true,
    'workout_id', v_new_workout_id,
    'program_id', v_standard_program_id,
    'start_date', v_start_date,
    'days_per_week', v_days_per_week,
    'equipment_type', v_equipment_type
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_program_from_intake TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION assign_program_from_intake IS 'Automatically assigns a standard program to a client based on their intake form responses. Analyzes workout frequency and equipment access to find the best matching program.';