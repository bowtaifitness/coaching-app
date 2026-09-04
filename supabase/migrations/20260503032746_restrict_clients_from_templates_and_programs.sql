/*
  # Restrict Clients from Workout Templates and Standard Programs

  With the swing-analyzer driven workflow, clients only need access to their
  own assigned program. Standard programs and workout templates are now
  admin/coach-only assets.

  1. Policy Changes
    - workout_templates: drop overly-permissive "All users can view workout templates"
    - template_exercises: drop "All users can view template exercises"
    - workout_programs: drop "All authenticated users can view standard programs"
    - program_weeks: drop "Clients can view standard program weeks"
    - program_days: drop "Clients can view standard program days"
    - client_program_assignments: drop "Clients can self-assign programs" INSERT

  2. New Client Policies
    - workout_programs: clients can view only programs they have been assigned
    - program_weeks: clients can view weeks for their assigned programs only
    - program_days: clients can view days for their assigned programs only

  3. Notes
    - Admins and coaches retain full access via existing policies.
    - Clients still read/write their own workouts and workout_exercises.
*/

DROP POLICY IF EXISTS "All users can view workout templates" ON workout_templates;
DROP POLICY IF EXISTS "All users can view template exercises" ON template_exercises;
DROP POLICY IF EXISTS "All authenticated users can view standard programs" ON workout_programs;
DROP POLICY IF EXISTS "Clients can view standard program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Clients can view standard program days" ON program_days;
DROP POLICY IF EXISTS "Clients can self-assign programs" ON client_program_assignments;

CREATE POLICY "Clients can view assigned programs"
  ON workout_programs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_assignments cpa
      WHERE cpa.program_id = workout_programs.id
        AND cpa.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Clients can view weeks of assigned programs"
  ON program_weeks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_assignments cpa
      WHERE cpa.program_id = program_weeks.program_id
        AND cpa.client_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Clients can view days of assigned programs"
  ON program_days
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM client_program_assignments cpa
      WHERE cpa.program_id = program_days.program_id
        AND cpa.client_id = (SELECT auth.uid())
    )
  );
