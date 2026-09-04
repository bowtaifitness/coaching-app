/*
  # Update Template Sync to Respect Customization Flag

  1. Changes
    - Modify sync_template_exercises_to_programs function to only update non-customized exercises
    - Exercises with is_customized = TRUE are skipped during template sync
    - New exercises from templates are created with is_customized = FALSE
  
  2. Behavior
    - INSERT: New exercises added to programs with is_customized = FALSE
    - UPDATE: Only updates exercises where is_customized = FALSE
    - DELETE: Removes exercises from programs (even if customized, since template exercise is gone)
  
  3. Notes
    - Coaches can customize individual program exercises without losing those changes
    - Template updates only affect exercises that haven't been customized
    - Best of both worlds: template sync + individual customization
*/

-- Update the sync function to respect is_customized flag
CREATE OR REPLACE FUNCTION sync_template_exercises_to_programs()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT: Add new exercise to all programs using this template
  IF TG_OP = 'INSERT' THEN
    INSERT INTO program_week_exercises (
      program_week_id,
      exercise_id,
      sets,
      reps,
      weight,
      duration,
      rest_seconds,
      notes,
      order_index,
      is_customized
    )
    SELECT 
      pw.id as program_week_id,
      NEW.exercise_id,
      NEW.sets,
      NEW.reps,
      NEW.weight,
      NEW.duration,
      0 as rest_seconds,
      NEW.notes,
      NEW.order_index,
      false as is_customized -- New exercises start as not customized
    FROM program_weeks pw
    WHERE pw.template_id = NEW.template_id;
    
    RETURN NEW;
  END IF;

  -- Handle UPDATE: Only update non-customized exercises in programs using this template
  IF TG_OP = 'UPDATE' THEN
    UPDATE program_week_exercises pwe
    SET 
      exercise_id = NEW.exercise_id,
      sets = NEW.sets,
      reps = NEW.reps,
      weight = NEW.weight,
      duration = NEW.duration,
      notes = NEW.notes,
      order_index = NEW.order_index,
      updated_at = now()
    FROM program_weeks pw
    WHERE pwe.program_week_id = pw.id
      AND pw.template_id = NEW.template_id
      AND pwe.exercise_id = OLD.exercise_id
      AND pwe.order_index = OLD.order_index
      AND pwe.is_customized = false; -- Only update non-customized exercises
    
    RETURN NEW;
  END IF;

  -- Handle DELETE: Remove exercise from all programs (even if customized, template exercise is gone)
  IF TG_OP = 'DELETE' THEN
    DELETE FROM program_week_exercises pwe
    USING program_weeks pw
    WHERE pwe.program_week_id = pw.id
      AND pw.template_id = OLD.template_id
      AND pwe.exercise_id = OLD.exercise_id
      AND pwe.order_index = OLD.order_index;
    
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists, just need to ensure it's using the updated function
-- The existing trigger will automatically use the new function definition
