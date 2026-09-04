/*
  # Second-pass backfill for remaining untagged exercises

  Covers exercises whose names didn't match the first-pass patterns:
    - SMR / Foam Roller work (Mobility/Reset)
    - Hip abduction / adduction (isolation)
    - Prone Y/T/W raises and scapular work
    - Decline / crossing crunches and leg raises (core)
    - Single-leg balance drills
    - Catch-all: any Mobility/Reset row still missing movement_patterns gets 'Rotation'
      if its body regions include t_spine, otherwise no pattern (patterns are
      optional for mobility), but we DO ensure body_regions + swing_faults are set.
*/

-- Additional movement pattern mapping: Push/Pull for prone delt raises
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Pull'])))
) WHERE (
  name ILIKE '%prone%rear delt%' OR name ILIKE '%prone y%' OR name ILIKE '%prone t%' OR name ILIKE '%prone w%'
  OR name ILIKE '%prone a raise%' OR name ILIKE '%prone a/t/y%' OR name ILIKE '%lu raise%'
  OR name ILIKE '%scapular%retraction%' OR name ILIKE '%scapular protraction%'
  OR name ILIKE '%rear delt raise%'
) AND NOT ('Pull' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Hip abduction / adduction → treat as Hinge for slot targeting
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Hinge'])))
) WHERE (
  name ILIKE '%hip abduction%' OR name ILIKE '%leg abduction%' OR name ILIKE '%hip raise%'
  OR name ILIKE '%adductor%' OR name ILIKE '%glute hamstring raise%'
) AND NOT ('Hinge' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Core / crunch variants → Anti-Rotation (Phase IV core slot)
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Anti-Rotation'])))
) WHERE (
  name ILIKE '%crunch%' OR name ILIKE '%sit up%' OR name ILIKE '%situp%'
  OR name ILIKE '%leg raise%' OR name ILIKE '%v up%' OR name ILIKE '%dragon flag%'
  OR name ILIKE '%hallow%' OR name ILIKE '%hollow%' OR name ILIKE '%toe touch%'
  OR name ILIKE '%ab wheel%' OR name ILIKE '%copenhagen%'
) AND NOT ('Anti-Rotation' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Body regions for SMR + mobility-only names
UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['shoulders'])))
) WHERE (
  name ILIKE '%shoulder%' OR name ILIKE '%dead hang%' OR name ILIKE '%bar hang%'
  OR name ILIKE '%sleeper stretch%' OR name ILIKE '%prone y%' OR name ILIKE '%prone t%' OR name ILIKE '%prone w%'
  OR name ILIKE '%wax on%' OR name ILIKE '%scapular%'
) AND NOT ('shoulders' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['t_spine'])))
) WHERE (
  name ILIKE '%bear hug%' OR name ILIKE '%spinal flexion%' OR name ILIKE '%foam roller thoracic%'
) AND NOT ('t_spine' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['wrists'])))
) WHERE (
  name ILIKE '%wrist%'
) AND NOT ('wrists' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['core'])))
) WHERE (
  name ILIKE '%vacuum%' OR name ILIKE '%hallow%' OR name ILIKE '%dragon flag%'
  OR name ILIKE '%decline%' OR name ILIKE '%straight leg%' OR name ILIKE '%crossing%'
) AND NOT ('core' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

-- SMR body regions
UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['glutes'])))
) WHERE name ILIKE '%SMR%glute%' OR name ILIKE '%SMR)%' AND name ILIKE '%glute%'
  AND NOT ('glutes' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['hamstrings'])))
) WHERE name ILIKE '%hamstring%' AND NOT ('hamstrings' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['back'])))
) WHERE name ILIKE '%lat%' AND NOT ('back' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

-- Fallback body_regions for remaining unclassified — default to 'core'
UPDATE exercises SET body_regions = ARRAY['core']
WHERE (body_regions IS NULL OR array_length(body_regions,1) IS NULL);

-- Default swing faults for Primary Strength isolation work → at least tag with general categories
-- Isolation lifts that don't match a specific fault get 'Early Extension' and 'Loss of Posture'
-- as sensible defaults so they're still pickable by the Phase III general pool (fallback).
-- NOTE: these are only applied where truly empty.
UPDATE exercises SET swing_faults = ARRAY['Early Extension','Loss of Posture']
WHERE category = 'Primary Strength'
  AND (swing_faults IS NULL OR array_length(swing_faults,1) IS NULL);

UPDATE exercises SET swing_faults = ARRAY['Early Extension','Loss of Posture']
WHERE category IN ('Speed/Power','Rotary/Core','Mobility/Reset')
  AND (swing_faults IS NULL OR array_length(swing_faults,1) IS NULL);
