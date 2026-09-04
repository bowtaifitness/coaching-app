/*
  # Fix assign_program_from_intake Function Schema

  1. Problem
    - Function uses wrong column names for workouts table:
      * user_id (should be client_id)
      * program_id (should be template_id)
      * status (should be completed boolean)
    - Missing required coach_id column
    
  2. Changes
    - Update INSERT to use correct column names
    - Fetch coach_id from coach_client_assignments
    - Set completed = false instead of status = 'scheduled'
    - Add proper error handling for missing coach
    
  3. Result
    - Program assignment will work correctly
    - Clients get workouts assigned after intake form
*/

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
  v_coach_id uuid;
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

  -- Get coach_id for this client
  SELECT coach_id INTO v_coach_id
  FROM coach_client_assignments
  WHERE client_id = v_intake_form.user_id
  LIMIT 1;

  -- If no coach assigned, return error
  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No coach assigned to client'
    );
  END IF;

  -- Parse workout frequency to days per week
  v_days_per_week := 2; -- default to 2 days
  
  IF v_intake_form.workout_frequency IS NOT NULL THEN
    IF v_intake_form.workout_frequency ILIKE '%3%' THEN
      v_days_per_week := 3;
    ELSIF v_intake_form.workout_frequency ILIKE '%4%' THEN
      v_days_per_week := 4;
    ELSIF v_intake_form.workout_frequency ILIKE '%5%' THEN
      v_days_per_week := 5;
    ELSIF v_intake_form.workout_frequency ILIKE '%6%' THEN
      v_days_per_week := 6;
    ELSIF v_intake_form.workout_frequency ILIKE '%2%' THEN
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
  v_start_date := v_start_date + (
    CASE 
      WHEN EXTRACT(DOW FROM v_start_date) = 1 THEN 7 -- If today is Monday, start next Monday
      WHEN EXTRACT(DOW FROM v_start_date) = 0 THEN 1 -- If Sunday, next day is Monday
      ELSE 8 - EXTRACT(DOW FROM v_start_date) -- Otherwise calculate days until Monday
    END
  )::integer;

  -- Create workout assignment with correct column names
  INSERT INTO workouts (client_id, coach_id, template_id, scheduled_date, completed, title, description)
  VALUES (
    v_intake_form.user_id, 
    v_coach_id,
    v_standard_program_id, 
    v_start_date, 
    false,
    'Assigned Program',
    'Auto-assigned based on intake form'
  )
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