/*
  # Reclassify EZ Bar and Swiss Bar exercises as barbell equipment

  1. Problem
    - Several EZ Bar and Swiss Bar exercises were mistakenly tagged as "bodyweight" equipment.
    - This caused the swing-analysis custom workout generator to pull these barbell exercises
      into "bodyweight only" programs.

  2. Changes
    - Updates the `equipment` array on 9 mislabeled exercises to `{barbell}`:
        - EZ Bar Biceps Curl w/ Pronated Grip
        - EZ Bar Flat Skull Crusher
        - EZ Bar Standing Biceps Curl Pronated Grip
        - EZ Bar Standing Biceps Curl Supinated Grip
        - EZ Bar Standing Front Raise
        - EZ Bar Standing Front Raise w/ Supinated Grip
        - EZ Bar Standing Overhead Triceps Extension
        - EZ Bar Upright Row
        - Swiss Bar Seal Row

  3. Safety
    - Targeted update by specific ids — no destructive operations.
    - Does not alter RLS, policies, or schema.
*/

UPDATE exercises
SET equipment = ARRAY['barbell']::text[]
WHERE id IN (
  '8474cad5-3162-43a1-8aa9-d48a29326526',
  'ad1b3bbe-148d-44a9-bf83-e2ec9b95b7de',
  '8e6abcfd-7b66-42bc-b4b0-98e50b1f30b6',
  '08ecd360-7273-47e9-bc6d-c4ad719f0eda',
  'eb3b61c1-9dd4-4c0e-b3bc-db5c66b81a4f',
  'd550777e-a3df-489a-999c-07ab550bbea4',
  'df0686d2-92f6-43c4-9095-06edd63a4b20',
  'f467eeee-eafe-4ee3-a920-90dd3e5a9a02',
  '46560e65-39be-40b1-b71a-05328b690886'
);
