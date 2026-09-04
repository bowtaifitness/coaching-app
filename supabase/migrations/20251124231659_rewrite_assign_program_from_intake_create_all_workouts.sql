/*
  # Rewrite assign_program_from_intake to Create All Program Workouts

  1. Problem
    - Function was trying to create a single workout pointing to a program
    - Workouts table requires template_id (references workout_templates)
    - Programs have multiple weeks with multiple days, each with a template
    - Need to create individual workouts for each week/day combination
    
  2. Changes
    - Query program_weeks to get all template_ids for the program
    - Create one workout per template with proper scheduling
    - Schedule workouts starting from next Monday
    - Space workouts appropriately (Mon/Thu for 2-day, Mon/Wed/Fri for 3-day, etc.)
    
  3. Result
    - Clients get full program assigned (all weeks/days)
    - Workouts appear in their schedule
    - Each workout has a specific date and template
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
  v_coach_id uuid;
  v_calling_user_id uuid;
  v_workout_record record;
  v_workout_ids uuid[];
  v_current_date date;
  v_day_counter integer;
  v_week_offset integer;
  v_workout_count integer := 0;
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

  -- Determine equipment type
  v_equipment_type := 'Bodyweight';
  
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
  SELECT id INTO v_standard_program_id
  FROM workout_programs
  WHERE program_type = 'standard'
    AND days_per_week = v_days_per_week
    AND title ILIKE '%' || v_equipment_type || '%'
  LIMIT 1;

  -- If no exact match, try any standard program with matching days
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

  -- If no standard programs exist, return error
  IF v_standard_program_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No standard programs available'
    );
  END IF;

  -- Calculate start date (next Monday)
  v_start_date := CURRENT_DATE + (
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 7
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN 1
      ELSE 8 - EXTRACT(DOW FROM CURRENT_DATE)
    END
  )::integer;

  -- Create workouts for each week/day in the program
  v_workout_ids := ARRAY[]::uuid[];
  v_day_counter := 0;
  
  FOR v_workout_record IN (
    SELECT 
      pw.week_number,
      pd.day_order,
      pw.template_id,
      wt.title as template_title,
      pd.day_name
    FROM program_weeks pw
    JOIN program_days pd ON pw.program_day_id = pd.id
    JOIN workout_templates wt ON wt.id = pw.template_id
    WHERE pd.program_id = v_standard_program_id
    ORDER BY pw.week_number, pd.day_order
  ) LOOP
    -- Calculate the date for this workout
    -- Week offset: 7 days per week
    v_week_offset := (v_workout_record.week_number - 1) * 7;
    
    -- Day offset within week: for 2-day programs use Mon(0) and Thu(3)
    -- For 3-day: Mon(0), Wed(2), Fri(4)
    IF v_days_per_week = 2 THEN
      v_current_date := v_start_date + v_week_offset + 
        (CASE WHEN v_workout_record.day_order = 1 THEN 0 ELSE 3 END);
    ELSIF v_days_per_week = 3 THEN
      v_current_date := v_start_date + v_week_offset + 
        (CASE 
          WHEN v_workout_record.day_order = 1 THEN 0 
          WHEN v_workout_record.day_order = 2 THEN 2
          ELSE 4
        END);
    ELSE
      -- For other frequencies, spread evenly
      v_current_date := v_start_date + v_week_offset + (v_workout_record.day_order - 1) * 2;
    END IF;

    -- Create the workout
    INSERT INTO workouts (
      client_id,
      coach_id,
      template_id,
      scheduled_date,
      completed,
      title,
      description
    )
    VALUES (
      v_intake_form.user_id,
      v_coach_id,
      v_workout_record.template_id,
      v_current_date,
      false,
      v_workout_record.template_title,
      'Week ' || v_workout_record.week_number || ' - ' || v_workout_record.day_name
    )
    RETURNING id INTO v_workout_ids[array_length(v_workout_ids, 1) + 1];
    
    v_workout_count := v_workout_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'program_id', v_standard_program_id,
    'workout_count', v_workout_count,
    'start_date', v_start_date,
    'days_per_week', v_days_per_week,
    'equipment_type', v_equipment_type,
    'workout_ids', v_workout_ids
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;