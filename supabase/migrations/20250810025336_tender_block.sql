/*
  # Allow null coach_id in swing_analyses table

  1. Schema Changes
    - Modify `swing_analyses` table to allow null `coach_id` values
    - This allows clients to upload videos before being assigned a coach

  2. Security
    - Update RLS policies to handle null coach_id cases
    - Ensure clients can still upload videos without a coach assigned
*/

-- Allow null coach_id values
ALTER TABLE swing_analyses ALTER COLUMN coach_id DROP NOT NULL;

-- Update RLS policy to handle null coach_id
DROP POLICY IF EXISTS "Users can view their swing analyses" ON swing_analyses;

CREATE POLICY "Users can view their swing analyses"
  ON swing_analyses
  FOR SELECT
  TO authenticated
  USING (
    client_id = auth.uid() OR 
    coach_id = auth.uid() OR
    (coach_id IS NULL AND client_id = auth.uid())
  );

-- Add policy for coaches to update swing analyses (assign themselves)
CREATE POLICY "Coaches can update swing analyses"
  ON swing_analyses
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'coach'
    )
  );