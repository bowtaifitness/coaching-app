/*
  # Allow clients to view program weeks for standard programs

  1. Changes
    - Add SELECT policy on program_weeks table to allow clients to view weeks for standard programs (program_type = 'standard')
  
  2. Security
    - Clients can only view program weeks for standard programs
    - Coaches retain their existing access to program weeks they created
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'program_weeks' 
    AND policyname = 'Clients can view standard program weeks'
  ) THEN
    CREATE POLICY "Clients can view standard program weeks"
      ON program_weeks
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM workout_programs
          WHERE workout_programs.id = program_weeks.program_id
          AND workout_programs.program_type = 'standard'
        )
      );
  END IF;
END $$;
