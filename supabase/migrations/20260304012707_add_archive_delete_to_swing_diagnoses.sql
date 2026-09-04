/*
  # Add archive and delete support for swing diagnoses

  1. Modified Tables
    - `swing_diagnoses`
      - Added `archived_at` (timestamptz, nullable) - when set, the diagnosis is archived

  2. Security
    - Added UPDATE policy so users can archive their own diagnoses
    - Added DELETE policy so users can delete their own diagnoses
    - Added DELETE policy on corrective_workout_exercises for cascade cleanup
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'swing_diagnoses' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE swing_diagnoses ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

CREATE POLICY "Users can update own swing diagnoses"
  ON swing_diagnoses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own swing diagnoses"
  ON swing_diagnoses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'corrective_workout_exercises'
    AND policyname = 'Users can delete own corrective workout exercises'
  ) THEN
    CREATE POLICY "Users can delete own corrective workout exercises"
      ON corrective_workout_exercises
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM swing_diagnoses
          WHERE swing_diagnoses.id = corrective_workout_exercises.diagnosis_id
          AND swing_diagnoses.user_id = auth.uid()
        )
      );
  END IF;
END $$;
