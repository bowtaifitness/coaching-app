/*
  # Sync Template Updates to Assigned Programs

  1. Changes
    - Create trigger function to sync template_exercises changes to program_week_exercises
    - When template exercises are updated/added/deleted, sync to all program_weeks using that template
    - Maintains the relationship between templates and assigned programs
  
  2. Behavior
    - INSERT on template_exercises: Add to all programs using that template
    - UPDATE on template_exercises: Update in all programs using that template
    - DELETE on template_exercises: Remove from all programs using that template
  
  3. Notes
    - This keeps programs in sync with their source templates
    - Coaches can update templates and changes propagate to all assigned programs
    - Individual program customizations are preserved (only template-sourced exercises are synced)
*/

-- Function to sync template exercises to program week exercises
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
      order_index
    )
    SELECT 
      pw.id as program_week_id,
      NEW.exercise_id,
      NEW.sets,
      NEW.reps,
      NEW.weight,
      NEW.duration,
      0 as rest_seconds, -- default value since template_exercises doesn't have this
      NEW.notes,
      NEW.order_index
    FROM program_weeks pw
    WHERE pw.template_id = NEW.template_id;
    
    RETURN NEW;
  END IF;

  -- Handle UPDATE: Update exercise in all programs using this template
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
      AND pwe.order_index = OLD.order_index;
    
    RETURN NEW;
  END IF;

  -- Handle DELETE: Remove exercise from all programs using this template
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

-- Create trigger on template_exercises
DROP TRIGGER IF EXISTS sync_template_to_programs_trigger ON template_exercises;

CREATE TRIGGER sync_template_to_programs_trigger
AFTER INSERT OR UPDATE OR DELETE ON template_exercises
FOR EACH ROW
EXECUTE FUNCTION sync_template_exercises_to_programs();
