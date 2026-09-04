/*
  # Allow clients to view program days for standard programs

  1. Changes
    - Add SELECT policy on program_days table to allow clients to view days for standard programs (program_type = 'standard')
  
  2. Security
    - Clients can only view program days for standard programs
    - Coaches retain their existing access to program days they created
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'program_days' 
    AND policyname = 'Clients can view standard program days'
  ) THEN
    CREATE POLICY "Clients can view standard program days"
      ON program_days
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM workout_programs
          WHERE workout_programs.id = program_days.program_id
          AND workout_programs.program_type = 'standard'
        )
      );
  END IF;
END $$;
