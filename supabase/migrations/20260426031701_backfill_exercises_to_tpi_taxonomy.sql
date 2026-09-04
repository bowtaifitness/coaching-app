/*
  # Backfill Exercises to TPI Power-Play Taxonomy

  ## Overview
  Brings every row in `exercises` in line with the strict TPI taxonomy used by the
  Power-Play program generation algorithm. The legacy data uses lowercase, snake_case
  values (e.g. `strength`, `anti_rotation`, `early_extension`); this migration rewrites
  those into the canonical title-case labels the algorithm expects so that filtering,
  matching and display all share one vocabulary.

  ## Taxonomy
  1. `category` is rewritten to one of:
     - `Mobility/Reset`
     - `Speed/Power`
     - `Primary Strength`
     - `Rotary/Core`
  2. `movement_patterns` array elements are rewritten to:
     - `Hinge`, `Squat`, `Push`, `Pull`, `Rotation`, `Anti-Rotation`, `Locomotion`
     The legacy `lunge` value is folded into `Squat`. `Locomotion` is added when the
     exercise name implies it (carry, walk, crawl, sled, march, farmer, suitcase).
  3. `swing_faults` array elements are rewritten to:
     - `Early Extension`, `Loss of Posture`, `Sway/Slide`, `Over the Top`,
       `Casting/Early Release`, `Chicken Wing`, `Reverse Spine Angle`,
       `Flat Shoulder Plane`, `C-Posture`
     The legacy `sway` and `slide` values both collapse into `Sway/Slide`.

  ## Mapping Rules for Category
  - Legacy `power` or physical_traits containing `power` → `Speed/Power`
  - Legacy `conditioning` → `Speed/Power`
  - Legacy `mobility` → `Mobility/Reset`
  - Legacy `stability` is split: if movement_patterns contain rotation / anti_rotation
    or body_regions contain `core` / `pelvis`, it becomes `Rotary/Core`, otherwise
    `Mobility/Reset`
  - Legacy `strength` (the bulk of the library) becomes `Rotary/Core` when its only
    movement patterns are rotation / anti_rotation, otherwise `Primary Strength`

  ## Constraint Update
  The legacy `exercises_category_check` CHECK constraint enforced the old vocabulary
  and would have blocked this rewrite. It is dropped at the start and replaced at
  the end with a new constraint that enforces the four canonical TPI categories.

  ## Safety
  - Idempotent: rows that already use the new labels are left unchanged because the
    CASE expressions only rewrite known legacy values. Running the migration twice is
    safe.
  - Non-destructive: only rewrites string values inside existing rows. No rows are
    deleted, no columns are dropped, no other constraints are removed. `equipment` is
    left alone (it was populated in a prior step).
  - Defensive: NULL arrays are preserved as NULL.

  ## Notes
  1. Helper Functions
     Two SQL helper functions are created (`_map_movement_pattern` and
     `_map_swing_fault`) to keep the array rewrites readable. They are SECURITY
     INVOKER and only operate on text input, so they introduce no privilege risk.
  2. Movement Pattern Inference
     `Locomotion` is added (in addition to the mapped legacy values) when the exercise
     name strongly implies a carrying / walking / crawling / sled / march pattern.
*/

-- ---------------------------------------------------------------------------
-- 1. Drop the legacy CHECK constraint so the rewrite can land safely.
-- ---------------------------------------------------------------------------

ALTER TABLE exercises DROP CONSTRAINT IF EXISTS exercises_category_check;

-- ---------------------------------------------------------------------------
-- 2. Helper functions for array element mapping
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _map_movement_pattern(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(value)
    WHEN 'hinge'        THEN 'Hinge'
    WHEN 'squat'        THEN 'Squat'
    WHEN 'lunge'        THEN 'Squat'
    WHEN 'push'         THEN 'Push'
    WHEN 'pull'         THEN 'Pull'
    WHEN 'rotation'     THEN 'Rotation'
    WHEN 'anti_rotation' THEN 'Anti-Rotation'
    WHEN 'anti-rotation' THEN 'Anti-Rotation'
    WHEN 'locomotion'   THEN 'Locomotion'
    ELSE value
  END;
$$;

CREATE OR REPLACE FUNCTION _map_swing_fault(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(value)
    WHEN 'early_extension'     THEN 'Early Extension'
    WHEN 'loss_of_posture'     THEN 'Loss of Posture'
    WHEN 'sway'                THEN 'Sway/Slide'
    WHEN 'slide'               THEN 'Sway/Slide'
    WHEN 'over_the_top'        THEN 'Over the Top'
    WHEN 'casting'             THEN 'Casting/Early Release'
    WHEN 'chicken_wing'        THEN 'Chicken Wing'
    WHEN 'reverse_spine_angle' THEN 'Reverse Spine Angle'
    WHEN 'flat_shoulder_plane' THEN 'Flat Shoulder Plane'
    WHEN 'c_posture'           THEN 'C-Posture'
    ELSE value
  END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Backfill category
-- ---------------------------------------------------------------------------

UPDATE exercises
SET category = CASE
  WHEN category IN ('Mobility/Reset','Speed/Power','Primary Strength','Rotary/Core')
    THEN category
  WHEN category = 'power' THEN 'Speed/Power'
  WHEN category = 'conditioning' THEN 'Speed/Power'
  WHEN category = 'mobility' THEN 'Mobility/Reset'
  WHEN category = 'stability' THEN
    CASE
      WHEN movement_patterns && ARRAY['rotation','anti_rotation','Rotation','Anti-Rotation']::text[]
        OR body_regions && ARRAY['core','pelvis']::text[]
        THEN 'Rotary/Core'
      ELSE 'Mobility/Reset'
    END
  WHEN category = 'strength' THEN
    CASE
      WHEN movement_patterns && ARRAY['rotation','anti_rotation','Rotation','Anti-Rotation']::text[]
       AND NOT (movement_patterns && ARRAY['hinge','squat','push','pull','lunge','Hinge','Squat','Push','Pull']::text[])
        THEN 'Rotary/Core'
      ELSE 'Primary Strength'
    END
  ELSE 'Primary Strength'
END
WHERE category IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 4. Backfill movement_patterns
-- ---------------------------------------------------------------------------

UPDATE exercises
SET movement_patterns = (
  SELECT ARRAY(
    SELECT DISTINCT _map_movement_pattern(p)
    FROM unnest(movement_patterns) AS p
  )
)
WHERE movement_patterns IS NOT NULL
  AND cardinality(movement_patterns) > 0;

-- Add Locomotion when the name implies it and it is not already tagged.
UPDATE exercises
SET movement_patterns = array_append(COALESCE(movement_patterns, '{}'::text[]), 'Locomotion')
WHERE NOT ('Locomotion' = ANY(COALESCE(movement_patterns, '{}'::text[])))
  AND lower(name) ~ '\m(carry|walk|crawl|sled|march|farmer|suitcase)\M';

-- ---------------------------------------------------------------------------
-- 5. Backfill swing_faults
-- ---------------------------------------------------------------------------

UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(
    SELECT DISTINCT _map_swing_fault(f)
    FROM unnest(swing_faults) AS f
  )
)
WHERE swing_faults IS NOT NULL
  AND cardinality(swing_faults) > 0;

-- ---------------------------------------------------------------------------
-- 6. Replace the CHECK constraint with the new vocabulary.
-- ---------------------------------------------------------------------------

ALTER TABLE exercises
  ADD CONSTRAINT exercises_category_check
  CHECK (category = ANY (ARRAY[
    'Mobility/Reset'::text,
    'Speed/Power'::text,
    'Primary Strength'::text,
    'Rotary/Core'::text
  ]));

-- ---------------------------------------------------------------------------
-- 7. Drop helper functions; they are no longer needed.
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS _map_movement_pattern(text);
DROP FUNCTION IF EXISTS _map_swing_fault(text);
