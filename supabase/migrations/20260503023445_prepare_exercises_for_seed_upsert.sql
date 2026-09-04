/*
  # Prepare `exercises` table for seedExercises.ts upsert

  1. Why
    The `src/data/exerciseLibrary.ts` seed file is the local source of truth for
    our TPI-taxonomy seed exercises. We need to upsert this into `exercises`.
    The DB primary key is uuid (referenced by 5 FK tables, cannot change), so
    we use `name` as the upsert conflict key — the natural business key for an
    exercise library.

  2. Changes
    - Add a `muscle_group` text column (single-value convenience field matching
      the seed file's TPI `muscleGroup` field). Existing `body_regions` array
      stays as-is for generator filtering.
    - Deduplicate any rows with duplicate names (keep oldest `created_at`) so
      we can add a UNIQUE(name) constraint.
    - Add UNIQUE(name) so `supabase.from('exercises').upsert(..., { onConflict: 'name' })`
      works reliably.

  3. Safety
    - De-dupe step re-homes FK references (workout_exercises, template_exercises,
      program_week_exercises, corrective_workout_exercises) to the kept row
      BEFORE deleting the duplicate. No workout history is lost.
*/

-- Step 1: Add muscle_group column (nullable)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'muscle_group'
  ) THEN
    ALTER TABLE exercises ADD COLUMN muscle_group text;
  END IF;
END $$;

-- Step 2: For any duplicate names, migrate FK references to the kept row, then delete dupes
WITH ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS keep_id
  FROM exercises
),
duplicates AS (
  SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1
)
UPDATE workout_exercises we
SET exercise_id = d.keep_id
FROM duplicates d
WHERE we.exercise_id = d.dup_id;

WITH ranked AS (
  SELECT
    id, name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS keep_id
  FROM exercises
),
duplicates AS (SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1)
UPDATE template_exercises te
SET exercise_id = d.keep_id
FROM duplicates d
WHERE te.exercise_id = d.dup_id;

WITH ranked AS (
  SELECT
    id, name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS keep_id
  FROM exercises
),
duplicates AS (SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1)
UPDATE program_week_exercises pwe
SET exercise_id = d.keep_id
FROM duplicates d
WHERE pwe.exercise_id = d.dup_id;

WITH ranked AS (
  SELECT
    id, name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn,
    FIRST_VALUE(id) OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS keep_id
  FROM exercises
),
duplicates AS (SELECT id AS dup_id, keep_id FROM ranked WHERE rn > 1)
UPDATE corrective_workout_exercises cwe
SET exercise_id = d.keep_id
FROM duplicates d
WHERE cwe.exercise_id = d.dup_id;

-- Now safe to delete duplicate exercise rows
WITH ranked AS (
  SELECT
    id, name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC, id ASC) AS rn
  FROM exercises
)
DELETE FROM exercises
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: Add UNIQUE(name) constraint for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'exercises_name_unique'
  ) THEN
    ALTER TABLE exercises ADD CONSTRAINT exercises_name_unique UNIQUE (name);
  END IF;
END $$;
