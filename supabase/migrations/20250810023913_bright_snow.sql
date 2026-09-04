/*
  # Update swing analyses policies

  1. Policy Updates
    - Allow coaches to update swing analyses (add feedback)
    - Ensure proper access control for video analysis workflow

  2. Security
    - Maintain existing read/insert policies
    - Add update policy for coaches to provide feedback
*/

-- Allow coaches to update swing analyses with feedback
CREATE POLICY "Coaches can update swing analyses"
ON swing_analyses FOR UPDATE
TO authenticated
USING (
  coach_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'coach'
  )
)
WITH CHECK (
  coach_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'coach'
  )
);