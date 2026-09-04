/*
  # Final pass: tag remaining 96 exercises with sensible movement_patterns

  Handles:
    - Speed/Power: jumps/hops/slams/sprints — get Vertical/Linear or Rotational
      power via movement patterns (Squat for jumps, Rotation for slams/cyclones)
    - Rotary/Core: stability ball / rollout / pike — Anti-Rotation
    - Primary Strength: hanging knee raises, calf raises, oblique bends, etc.
    - Mobility/Reset: catch-all — assign Rotation if t_spine body region,
      otherwise default to Squat (joint-prep for locomotion lower body) or
      Push/Pull for shoulder-region mobility. Mobility generator slots don't
      strictly require movement_patterns, but tagging ensures proper filtering.
*/

-- Speed/Power: jumps and linear power → Squat pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Squat'])))
) WHERE category = 'Speed/Power' AND (
  name ILIKE '%jump%' OR name ILIKE '%hop%' OR name ILIKE '%bound%'
  OR name ILIKE '%pogo%' OR name ILIKE '%jack%' OR name ILIKE '%high knees%'
  OR name ILIKE '%butt kick%' OR name ILIKE '%mountain climber%' OR name ILIKE '%depth%'
)
AND NOT ('Squat' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Speed/Power: slams / cyclones / snatches / cleans → Rotation (for rotational) or Hinge
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Rotation'])))
) WHERE category = 'Speed/Power' AND (
  name ILIKE '%cyclone%' OR name ILIKE '%side slam%' OR name ILIKE '%lateral swing%'
  OR name ILIKE '%lateral%'
)
AND NOT ('Rotation' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Hinge'])))
) WHERE category = 'Speed/Power' AND (
  name ILIKE '%snatch%' OR name ILIKE '%clean%' OR name ILIKE '%front slam%'
  OR name ILIKE '%slam%'
)
AND NOT ('Hinge' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Rotary/Core: stability ball pike/rollout/pot stirrer → Anti-Rotation
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Anti-Rotation'])))
) WHERE category = 'Rotary/Core'
  AND (movement_patterns IS NULL OR array_length(movement_patterns,1) IS NULL);

-- Primary Strength: hanging knee raise / oblique side bend / rollout → Anti-Rotation or Rotation
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Anti-Rotation'])))
) WHERE category = 'Primary Strength' AND (
  name ILIKE '%knee raise%' OR name ILIKE '%knee tuck%' OR name ILIKE '%fallout%'
  OR name ILIKE '%pike%' OR name ILIKE '%side bend%' OR name ILIKE '%oblique%'
)
AND NOT ('Anti-Rotation' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Primary Strength: calf raises and anterior tib raises → Squat (lower body accessory)
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Squat'])))
) WHERE category = 'Primary Strength' AND (
  name ILIKE '%calf raise%' OR name ILIKE '%tibialis%'
)
AND NOT ('Squat' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Primary Strength: hip adduction / kickback → Hinge
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Hinge'])))
) WHERE category = 'Primary Strength' AND (
  name ILIKE '%adduction%' OR name ILIKE '%kick back%' OR name ILIKE '%kickback%'
)
AND NOT ('Hinge' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Primary Strength: six way raise → Push (shoulder isolation)
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Push'])))
) WHERE category = 'Primary Strength' AND name ILIKE '%six way%'
AND NOT ('Push' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Mobility/Reset: any remaining with shoulder body region → Push
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Push'])))
) WHERE category = 'Mobility/Reset'
  AND (movement_patterns IS NULL OR array_length(movement_patterns,1) IS NULL)
  AND 'shoulders' = ANY(COALESCE(body_regions, ARRAY[]::text[]));

-- Mobility/Reset: any remaining with hips body region → Hinge (hip hinge mobility)
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Hinge'])))
) WHERE category = 'Mobility/Reset'
  AND (movement_patterns IS NULL OR array_length(movement_patterns,1) IS NULL)
  AND ('hips' = ANY(COALESCE(body_regions, ARRAY[]::text[])) OR 'glutes' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

-- Mobility/Reset: any remaining with t_spine → Rotation
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Rotation'])))
) WHERE category = 'Mobility/Reset'
  AND (movement_patterns IS NULL OR array_length(movement_patterns,1) IS NULL)
  AND 't_spine' = ANY(COALESCE(body_regions, ARRAY[]::text[]));

-- Mobility/Reset: any remaining with wrists → Pull (grip/wrist prep)
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Pull'])))
) WHERE category = 'Mobility/Reset'
  AND (movement_patterns IS NULL OR array_length(movement_patterns,1) IS NULL)
  AND 'wrists' = ANY(COALESCE(body_regions, ARRAY[]::text[]));

-- Final catch-all: any truly remaining — assign Rotation (safe mobility default)
UPDATE exercises SET movement_patterns = ARRAY['Rotation']
WHERE (movement_patterns IS NULL OR array_length(movement_patterns,1) IS NULL);
