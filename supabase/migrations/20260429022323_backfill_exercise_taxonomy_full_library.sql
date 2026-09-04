/*
  # Backfill taxonomy for the full exercise library (~1000 exercises)

  1. Problem
    Many exercises have NULL / empty `movement_patterns`, `body_regions`, or
    `swing_faults`. The custom workout generator (Phase I correctives,
    Phase II speed/power, Phase III strength, Phase IV rotary/core) filters
    by these three tag arrays, so untagged rows are invisible to the generator
    and slots can render empty.

  2. Approach — name-pattern inference
    Each UPDATE appends a tag only when the row doesn't already have it and
    the exercise name matches a known pattern (e.g. anything containing
    "Squat" gets the Squat pattern; anything containing "Row" gets Pull;
    anything containing "Hip Thrust" gets Hinge; etc.). Using
    `array_cat` + `SELECT DISTINCT unnest` keeps the migration idempotent.

  3. Safety
    - No rows are deleted; no columns are dropped.
    - Tags are appended, never overwritten.
    - Each statement is guarded by `NOT (tag = ANY(col))` so repeated runs are no-ops.
*/

-- ============================================================================
-- MOVEMENT PATTERNS
-- ============================================================================

-- Squat pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Squat'])))
) WHERE (
  name ILIKE '%squat%' OR name ILIKE '%lunge%' OR name ILIKE '%step up%' OR name ILIKE '%step down%'
  OR name ILIKE '%split stance%' OR name ILIKE '%wall sit%' OR name ILIKE '%leg press%' OR name ILIKE '%leg extension%'
  OR name ILIKE '%sissy squat%' OR name ILIKE '%pistol%' OR name ILIKE '%cossack%'
) AND NOT ('Squat' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Hinge pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Hinge'])))
) WHERE (
  name ILIKE '%deadlift%' OR name ILIKE '%rdl%' OR name ILIKE '%romanian%'
  OR name ILIKE '%hip thrust%' OR name ILIKE '%hip thruster%' OR name ILIKE '%glute bridge%'
  OR name ILIKE '%hyperextension%' OR name ILIKE '%back extension%' OR name ILIKE '%good morning%'
  OR name ILIKE '%kettlebell swing%' OR name ILIKE '%hamstring curl%' OR name ILIKE '%leg curl%'
  OR name ILIKE '%nordic%' OR name ILIKE '%frog pump%' OR name ILIKE '%hip hinge%'
  OR name ILIKE '%kickback%'
) AND NOT ('Hinge' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Push pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Push'])))
) WHERE (
  name ILIKE '%bench press%' OR name ILIKE '%chest press%' OR name ILIKE '%shoulder press%'
  OR name ILIKE '%overhead press%' OR name ILIKE '%push press%' OR name ILIKE '%push up%' OR name ILIKE '%pushup%'
  OR name ILIKE '%dip%' OR name ILIKE '%triceps extension%' OR name ILIKE '%skull crusher%'
  OR name ILIKE '%chest fly%' OR name ILIKE '%front raise%' OR name ILIKE '%lateral raise%'
  OR name ILIKE '%floor press%' OR name ILIKE '%incline press%' OR name ILIKE '%landmine press%'
  OR name ILIKE '%military press%' OR name ILIKE '%pec deck%' OR name ILIKE '%pec fly%'
  OR name ILIKE '%arnold press%' OR name ILIKE '%handstand%' OR name ILIKE '%triceps kickback%'
) AND NOT ('Push' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Pull pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Pull'])))
) WHERE (
  name ILIKE '%row%' OR name ILIKE '%pulldown%' OR name ILIKE '%pull down%'
  OR name ILIKE '%pull up%' OR name ILIKE '%pullup%' OR name ILIKE '%chin up%' OR name ILIKE '%chinup%'
  OR name ILIKE '%curl%' OR name ILIKE '%face pull%' OR name ILIKE '%facepull%'
  OR name ILIKE '%rear delt fly%' OR name ILIKE '%reverse fly%'
  OR name ILIKE '%shrug%' OR name ILIKE '%pull through%' OR name ILIKE '%pullover%'
  OR name ILIKE '%rack pull%' OR name ILIKE '%high pull%' OR name ILIKE '%snatch pull%'
  OR name ILIKE '%scapular pull%'
) AND NOT ('Pull' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Rotation pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Rotation'])))
) WHERE (
  name ILIKE '%rotation%' OR name ILIKE '%rotational%' OR name ILIKE '%twist%'
  OR name ILIKE '%russian twist%' OR name ILIKE '%wood chop%' OR name ILIKE '%chop%'
  OR name ILIKE '%windmill%' OR name ILIKE '%halo%' OR name ILIKE '%turkish%'
  OR name ILIKE '%scorpion%' OR name ILIKE '%open book%' OR name ILIKE '%thread the needle%'
  OR name ILIKE '%reach through%' OR name ILIKE '%spiderman%'
) AND NOT ('Rotation' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Anti-Rotation pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Anti-Rotation'])))
) WHERE (
  name ILIKE '%pallof%' OR name ILIKE '%anti-rotation%' OR name ILIKE '%anti rotation%'
  OR name ILIKE '%bird dog%' OR name ILIKE '%dead bug%' OR name ILIKE '%hollow%'
  OR name ILIKE '%plank%' OR name ILIKE '%side plank%' OR name ILIKE '%copenhagen%'
  OR name ILIKE '%suitcase%carry%' OR name ILIKE '%waiter%carry%' OR name ILIKE '%landmine anti%'
) AND NOT ('Anti-Rotation' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));

-- Locomotion pattern
UPDATE exercises SET movement_patterns = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(movement_patterns, ARRAY[]::text[]), ARRAY['Locomotion'])))
) WHERE (
  name ILIKE '%carry%' OR name ILIKE '%farmer%' OR name ILIKE '%sled%'
  OR name ILIKE '%march%' OR name ILIKE '%walk%' OR name ILIKE '%crawl%'
  OR name ILIKE '%bear walk%' OR name ILIKE '%broad jump%'
) AND NOT ('Locomotion' = ANY(COALESCE(movement_patterns, ARRAY[]::text[])));


-- ============================================================================
-- BODY REGIONS
-- ============================================================================

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['glutes'])))
) WHERE (
  name ILIKE '%glute%' OR name ILIKE '%hip thrust%' OR name ILIKE '%hip thruster%'
  OR name ILIKE '%hip abduction%' OR name ILIKE '%hip extension%' OR name ILIKE '%kickback%'
  OR name ILIKE '%squat%' OR name ILIKE '%deadlift%' OR name ILIKE '%hinge%' OR name ILIKE '%rdl%'
  OR name ILIKE '%lunge%' OR name ILIKE '%bridge%'
) AND NOT ('glutes' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['hips'])))
) WHERE (
  name ILIKE '%hip%' OR name ILIKE '%90/90%' OR name ILIKE '%90 90%' OR name ILIKE '%hip flexor%'
  OR name ILIKE '%frog%' OR name ILIKE '%adductor%' OR name ILIKE '%abductor%'
  OR name ILIKE '%cossack%' OR name ILIKE '%lateral lunge%'
) AND NOT ('hips' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['quads'])))
) WHERE (
  name ILIKE '%quad%' OR name ILIKE '%leg extension%' OR name ILIKE '%sissy%'
  OR name ILIKE '%split squat%' OR name ILIKE '%front squat%' OR name ILIKE '%step up%'
) AND NOT ('quads' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['hamstrings'])))
) WHERE (
  name ILIKE '%hamstring%' OR name ILIKE '%leg curl%' OR name ILIKE '%rdl%'
  OR name ILIKE '%romanian%' OR name ILIKE '%nordic%' OR name ILIKE '%good morning%'
) AND NOT ('hamstrings' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['calves'])))
) WHERE (
  name ILIKE '%calf%' OR name ILIKE '%calves%' OR name ILIKE '%heel raise%' OR name ILIKE '%toe raise%'
) AND NOT ('calves' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['chest'])))
) WHERE (
  name ILIKE '%bench press%' OR name ILIKE '%chest%' OR name ILIKE '%pec%'
  OR name ILIKE '%push up%' OR name ILIKE '%pushup%' OR name ILIKE '%dip%' OR name ILIKE '%floor press%'
) AND NOT ('chest' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['back'])))
) WHERE (
  name ILIKE '%row%' OR name ILIKE '%pulldown%' OR name ILIKE '%pull up%' OR name ILIKE '%pullup%'
  OR name ILIKE '%chin up%' OR name ILIKE '%chinup%' OR name ILIKE '%lat %' OR name ILIKE '%back extension%'
  OR name ILIKE '%shrug%' OR name ILIKE '%rack pull%'
) AND NOT ('back' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['shoulders'])))
) WHERE (
  name ILIKE '%shoulder%' OR name ILIKE '%deltoid%' OR name ILIKE '%delt %' OR name ILIKE '%delt fly%'
  OR name ILIKE '%lateral raise%' OR name ILIKE '%front raise%' OR name ILIKE '%overhead press%'
  OR name ILIKE '%shoulder press%' OR name ILIKE '%arnold%' OR name ILIKE '%scapular%'
  OR name ILIKE '%face pull%' OR name ILIKE '%y raise%' OR name ILIKE '%t raise%' OR name ILIKE '%w raise%'
) AND NOT ('shoulders' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['arms'])))
) WHERE (
  name ILIKE '%curl%' OR name ILIKE '%triceps%' OR name ILIKE '%biceps%'
  OR name ILIKE '%skull crusher%' OR name ILIKE '%kickback%' OR name ILIKE '%hammer curl%'
) AND NOT ('arms' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['core'])))
) WHERE (
  name ILIKE '%plank%' OR name ILIKE '%crunch%' OR name ILIKE '%sit up%' OR name ILIKE '%situp%'
  OR name ILIKE '%dead bug%' OR name ILIKE '%bird dog%' OR name ILIKE '%hollow%'
  OR name ILIKE '%russian twist%' OR name ILIKE '%pallof%' OR name ILIKE '%chop%'
  OR name ILIKE '%rotation%' OR name ILIKE '%woodchop%' OR name ILIKE '%toe touch%'
  OR name ILIKE '%leg raise%' OR name ILIKE '%v up%' OR name ILIKE '%ab wheel%'
  OR name ILIKE '%copenhagen%' OR name ILIKE '%vacuum%'
) AND NOT ('core' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['t_spine'])))
) WHERE (
  name ILIKE '%thoracic%' OR name ILIKE '%t-spine%' OR name ILIKE '%open book%'
  OR name ILIKE '%cat cow%' OR name ILIKE '%cat-cow%' OR name ILIKE '%windmill%'
  OR name ILIKE '%scorpion%' OR name ILIKE '%reach through%' OR name ILIKE '%rotation%'
) AND NOT ('t_spine' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['pelvis'])))
) WHERE (
  name ILIKE '%hip flexor%' OR name ILIKE '%psoas%' OR name ILIKE '%pelvic%'
) AND NOT ('pelvis' = ANY(COALESCE(body_regions, ARRAY[]::text[])));

UPDATE exercises SET body_regions = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(body_regions, ARRAY[]::text[]), ARRAY['wrists'])))
) WHERE (
  name ILIKE '%wrist%' OR name ILIKE '%forearm%' OR name ILIKE '%grip%'
) AND NOT ('wrists' = ANY(COALESCE(body_regions, ARRAY[]::text[])));


-- ============================================================================
-- SWING FAULTS — map body regions / movement patterns to likely faults
-- ============================================================================

-- Early Extension & Loss of Posture: hip/glute mobility, t-spine rotation, core
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Early Extension','Loss of Posture'])))
) WHERE category = 'Mobility/Reset' AND (
  'hips' = ANY(COALESCE(body_regions, ARRAY[]::text[]))
  OR 't_spine' = ANY(COALESCE(body_regions, ARRAY[]::text[]))
  OR 'core' = ANY(COALESCE(body_regions, ARRAY[]::text[]))
  OR 'Rotation' = ANY(COALESCE(movement_patterns, ARRAY[]::text[]))
) AND NOT ('Early Extension' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- S-Posture: anti-extension core, hip flexor work, glute bridges
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['S-Posture'])))
) WHERE (
  name ILIKE '%dead bug%' OR name ILIKE '%pallof%' OR name ILIKE '%hip flexor%'
  OR name ILIKE '%glute bridge%' OR name ILIKE '%plank%' OR name ILIKE '%hollow%'
  OR name ILIKE '%vacuum%' OR name ILIKE '%psoas%'
) AND NOT ('S-Posture' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- C-Posture: t-spine extension, scapular retraction, chest opening
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['C-Posture'])))
) WHERE (
  name ILIKE '%cat cow%' OR name ILIKE '%cat-cow%' OR name ILIKE '%thoracic extension%'
  OR name ILIKE '%open book%' OR name ILIKE '%pull apart%' OR name ILIKE '%face pull%'
  OR name ILIKE '%prone y%' OR name ILIKE '%prone t%' OR name ILIKE '%prone w%'
  OR name ILIKE '%scapular wall slide%' OR name ILIKE '%wall slide%'
) AND NOT ('C-Posture' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- Flat Shoulder Plane: t-spine rotation + shoulder mobility
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Flat Shoulder Plane'])))
) WHERE (
  (name ILIKE '%thoracic%rotation%' OR name ILIKE '%thoracic rotation%')
  OR name ILIKE '%open book%' OR name ILIKE '%windmill%'
  OR name ILIKE '%shoulder external rotation%' OR name ILIKE '%halo%'
  OR name ILIKE '%reach through%' OR name ILIKE '%scorpion%'
) AND NOT ('Flat Shoulder Plane' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- Over the Top: hip disassociation, rotation patterns, anti-rotation
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Over the Top'])))
) WHERE (
  name ILIKE '%pallof%' OR name ILIKE '%chop%' OR name ILIKE '%lift%'
  OR name ILIKE '%rotational%' OR name ILIKE '%90/90%' OR name ILIKE '%90 90%'
  OR name ILIKE '%hip internal rotation%' OR name ILIKE '%landmine rotation%'
) AND NOT ('Over the Top' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- Sway/Slide: lateral hip/adductor stability, single leg balance
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Sway/Slide'])))
) WHERE (
  name ILIKE '%adductor%' OR name ILIKE '%copenhagen%' OR name ILIKE '%lateral lunge%'
  OR name ILIKE '%cossack%' OR name ILIKE '%side plank%' OR name ILIKE '%single leg%balance%'
  OR name ILIKE '%hip abduction%'
) AND NOT ('Sway/Slide' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- Chicken Wing & Casting/Early Release: shoulder + wrist mobility
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Chicken Wing'])))
) WHERE (
  name ILIKE '%pull apart%' OR name ILIKE '%face pull%' OR name ILIKE '%rear delt%'
  OR name ILIKE '%external rotation%'
) AND NOT ('Chicken Wing' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Casting/Early Release'])))
) WHERE (
  name ILIKE '%wrist%' OR name ILIKE '%forearm%' OR name ILIKE '%grip%'
) AND NOT ('Casting/Early Release' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));

-- Reverse Spine Angle: anti-extension core + hip flexor
UPDATE exercises SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(COALESCE(swing_faults, ARRAY[]::text[]), ARRAY['Reverse Spine Angle'])))
) WHERE (
  name ILIKE '%dead bug%' OR name ILIKE '%hip flexor%' OR name ILIKE '%hollow%'
  OR name ILIKE '%anti-extension%'
) AND NOT ('Reverse Spine Angle' = ANY(COALESCE(swing_faults, ARRAY[]::text[])));
