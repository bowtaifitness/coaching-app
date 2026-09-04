/*
  # Copy Template Exercises When Assigning Program

  1. Problem
    - Workouts are created with template_id but no exercises
    - Need to copy exercises from template_exercises to workout_exercises
    
  2. Changes
    - After creating each workout, copy all exercises from the template
    - Maintain sets, reps, weight, duration, notes, and order
    
  3. Result
    - Workouts have actual exercises that clients can complete
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
  v_workout_ids uuid[] := '{}';
  v_current_date date;
  v_week_offset integer;
  v_workout_count integer := 0;
  v_new_workout_id uuid;
  v_program_assignment_id uuid;
  v_exercise_count integer;
BEGIN
  v_calling_user_id := auth.uid();
  
  SELECT user_id, workout_frequency, equipment_access
  INTO v_intake_form
  FROM client_intake_forms
  WHERE id = intake_form_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Intake form not found');
  END IF;

  IF v_intake_form.user_id != v_calling_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT coach_id INTO v_coach_id
  FROM coach_client_assignments
  WHERE client_id = v_intake_form.user_id
  LIMIT 1;

  IF v_coach_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No coach assigned');
  END IF;

  -- Parse workout frequency
  v_days_per_week := 2;
  IF v_intake_form.workout_frequency IS NOT NULL THEN
    IF v_intake_form.workout_frequency ILIKE '%4-6%' OR v_intake_form.workout_frequency ILIKE '%4 to 6%' THEN
      v_days_per_week := 4;
    ELSIF v_intake_form.workout_frequency ILIKE '%2-3%' OR v_intake_form.workout_frequency ILIKE '%2 to 3%' THEN
      v_days_per_week := 2;
    ELSIF v_intake_form.workout_frequency ILIKE '%6%' THEN
      v_days_per_week := 6;
    ELSIF v_intake_form.workout_frequency ILIKE '%5%' THEN
      v_days_per_week := 5;
    ELSIF v_intake_form.workout_frequency ILIKE '%4%' THEN
      v_days_per_week := 4;
    ELSIF v_intake_form.workout_frequency ILIKE '%3%' THEN
      v_days_per_week := 3;
    END IF;
  END IF;

  -- Determine equipment type
  v_equipment_type := 'Bodyweight';
  IF v_intake_form.equipment_access IS NOT NULL AND array_length(v_intake_form.equipment_access, 1) > 0 THEN
    IF 'Full Gym' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Full Gym';
    ELSIF 'Dumbbells' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Dumbbell';
    ELSIF 'Resistance Bands' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Bands';
    ELSIF 'Bodyweight' = ANY(v_intake_form.equipment_access) THEN
      v_equipment_type := 'Bodyweight';
    END IF;
  END IF;

  -- Find matching program
  SELECT id INTO v_standard_program_id
  FROM workout_programs
  WHERE program_type = 'standard' 
    AND days_per_week = v_days_per_week 
    AND title ILIKE '%(' || v_equipment_type || ')%'
  LIMIT 1;

  IF v_standard_program_id IS NULL THEN
    SELECT id INTO v_standard_program_id 
    FROM workout_programs 
    WHERE program_type = 'standard' AND days_per_week = v_days_per_week 
    LIMIT 1;
  END IF;

  IF v_standard_program_id IS NULL THEN
    SELECT id INTO v_standard_program_id 
    FROM workout_programs 
    WHERE program_type = 'standard' 
    LIMIT 1;
  END IF;

  IF v_standard_program_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No standard programs available');
  END IF;

  -- Calculate start date (next Monday)
  v_start_date := CURRENT_DATE + (
    CASE 
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 1 THEN 7
      WHEN EXTRACT(DOW FROM CURRENT_DATE) = 0 THEN 1
      ELSE 8 - EXTRACT(DOW FROM CURRENT_DATE)
    END
  )::integer;

  -- Cancel any existing active program assignments
  UPDATE client_program_assignments
  SET status = 'cancelled'
  WHERE client_id = v_intake_form.user_id
    AND status = 'active';

  -- Create program assignment record
  INSERT INTO client_program_assignments (
    client_id,
    program_id,
    assigned_by,
    start_date,
    status
  )
  VALUES (
    v_intake_form.user_id,
    v_standard_program_id,
    v_coach_id,
    v_start_date,
    'active'
  )
  RETURNING id INTO v_program_assignment_id;

  -- Create workouts and copy exercises
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
    v_week_offset := (v_workout_record.week_number - 1) * 7;
    
    IF v_days_per_week = 2 THEN
      v_current_date := v_start_date + v_week_offset + (CASE WHEN v_workout_record.day_order = 1 THEN 0 ELSE 3 END);
    ELSIF v_days_per_week = 3 THEN
      v_current_date := v_start_date + v_week_offset + (CASE WHEN v_workout_record.day_order = 1 THEN 0 WHEN v_workout_record.day_order = 2 THEN 2 ELSE 4 END);
    ELSE
      v_current_date := v_start_date + v_week_offset + (v_workout_record.day_order - 1) * 2;
    END IF;

    -- Create workout
    INSERT INTO workouts (client_id, coach_id, template_id, scheduled_date, completed, title, description)
    VALUES (v_intake_form.user_id, v_coach_id, v_workout_record.template_id, v_current_date, false, v_workout_record.template_title, 'Week ' || v_workout_record.week_number || ' - ' || v_workout_record.day_name)
    RETURNING id INTO v_new_workout_id;
    
    -- Copy exercises from template to workout
    INSERT INTO workout_exercises (
      workout_id,
      exercise_id,
      sets,
      reps,
      weight,
      duration,
      notes,
      order_index
    )
    SELECT
      v_new_workout_id,
      te.exercise_id,
      te.sets,
      te.reps,
      te.weight,
      te.duration,
      te.notes,
      te.order_index
    FROM template_exercises te
    WHERE te.template_id = v_workout_record.template_id
    ORDER BY te.order_index;
    
    -- Get exercise count for this workout
    GET DIAGNOSTICS v_exercise_count = ROW_COUNT;
    
    v_workout_ids := array_append(v_workout_ids, v_new_workout_id);
    v_workout_count := v_workout_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'program_id', v_standard_program_id,
    'program_assignment_id', v_program_assignment_id,
    'workout_count', v_workout_count,
    'start_date', v_start_date,
    'days_per_week', v_days_per_week,
    'equipment_type', v_equipment_type
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;