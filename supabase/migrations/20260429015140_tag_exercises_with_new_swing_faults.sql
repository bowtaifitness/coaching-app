/*
  # Tag exercises with new swing fault vocabulary

  1. Context
    The swing analyzer now detects three additional faults: `C-Posture`,
    `S-Posture`, and `Flat Shoulder Plane` (along with the existing
    `Over the Top`). The program generator creates one Phase I corrective
    slot per detected fault and filters library exercises by the
    `swing_faults` array. Prior to this migration, no exercises carried
    those labels, so those corrective slots silently fell back to generic
    mobility picks without a "FIXES X" badge.

  2. Changes
    Appends the new fault labels to appropriate existing exercises, de-duplicating
    so we never add the same tag twice. No exercise rows are deleted.

    - `C-Posture` is added to T-spine extension work, scapular retraction
      (rows / band pull-aparts), and chest-opening mobility.
    - `S-Posture` is added to anti-extension core (dead bug, vacuum),
      hip flexor stretches, and glute bridge patterns (trains hip extension
      without lumbar compensation).
    - `Flat Shoulder Plane` is added to T-spine rotation and shoulder
      mobility work.

  3. Safety
    Uses `array_cat` + `SELECT DISTINCT unnest` to dedupe so the migration
    is idempotent. No destructive operations.
*/

-- C-Posture: T-spine extension, scapular retraction, chest-opening mobility
UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(swing_faults, ARRAY['C-Posture'])))
)
WHERE name IN (
  'Cat Cow',
  'Cat Cow from Elbows',
  'Cat-Cow Flow',
  'Thoracic Open Books',
  'Foam Roller Thoracic Extension',
  'Banded Pull Apart',
  'Banded Pull Apart Overhead',
  'Banded Straight Arm Pulldown to Overhead Raise',
  'Child''s Pose w/ Shoulder Flexion',
  'Quadruped Reach Through w/ Thoracic Rotation',
  'TRX Facepull to External Rotation',
  'Jefferson Curl'
);

-- S-Posture: anti-extension core, hip flexor stretches, glute bridges
UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(swing_faults, ARRAY['S-Posture'])))
)
WHERE name IN (
  'Dead Bug',
  'Dead Bug w/ Foam Roller Press',
  'Feet Elevated Vacuum Breathing',
  'Half Kneeling Hip Flexor Rockback',
  'Half Kneeling Hip Flexor Stretch w/ Banded Distraction',
  'Half Kneeling Hip Flexor Stretch w/ Rear Foot Elevated',
  'Rear Elevated Hip Flexor Stretch',
  'Self Myofascial Release Hip Flexor (SMR)',
  'Seated Hip Flexor March',
  'Seated Straight Leg Hip Flexor Raise'
);

-- Also tag any Pallof Press / plank / dead bug variants found by pattern
UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(swing_faults, ARRAY['S-Posture'])))
)
WHERE (
  name ILIKE '%Pallof%'
  OR name ILIKE '%Dead Bug%'
  OR name ILIKE '%Plank%'
  OR name ILIKE '%Hollow%'
  OR name ILIKE '%Vacuum%'
  OR name ILIKE '%Hip Flexor Stretch%'
  OR name ILIKE '%Glute Bridge%'
)
AND NOT ('S-Posture' = ANY(swing_faults));

-- Flat Shoulder Plane: T-spine rotation and shoulder mobility work
UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(swing_faults, ARRAY['Flat Shoulder Plane'])))
)
WHERE name IN (
  'Quadruped Thoracic Spine Rotation',
  'Spiderman with Rotation',
  'Quadruped Reach Through w/ Thoracic Rotation',
  'Thoracic Open Books',
  'Banded Lateral Step w/ Rotation',
  'Kneeling Adductor Stretch w/ Thoracic Rotation',
  'Deep Squat with Thoracic Spine Rotation',
  'Foam Roller Thoracic Extension',
  'Standing Shoulder Controlled Articular Rotations (CARs)',
  'Prone Shoulder Controlled Articular Rotations (CARs)',
  'Quadruped Bench Supported Shoulder External Rotation',
  'Banded Shoulder External Rotation',
  'Banded Shoulder External Rotation at 90 90',
  'Banded Shoulder Internal Rotation',
  'Child''s Pose w/ Shoulder Flexion',
  'Lying Windmill',
  'Supine Windmill',
  'TRX Facepull to External Rotation'
);

-- Also tag any rotation/windmill/open book variants by pattern
UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(swing_faults, ARRAY['Flat Shoulder Plane'])))
)
WHERE category = 'Mobility/Reset'
  AND (
    name ILIKE '%Windmill%'
    OR name ILIKE '%Open Book%'
    OR name ILIKE '%Thoracic Rotation%'
    OR name ILIKE '%Shoulder External Rotation%'
  )
  AND NOT ('Flat Shoulder Plane' = ANY(swing_faults));

-- Over the Top: hip mobility / disassociation work (top-up any missed ones)
UPDATE exercises
SET swing_faults = (
  SELECT ARRAY(SELECT DISTINCT unnest(array_cat(swing_faults, ARRAY['Over the Top'])))
)
WHERE (
  name ILIKE '%Pallof%'
  OR name ILIKE '%Chop%'
  OR name ILIKE '%Lift%'
  OR name ILIKE '%Med Ball%Rotational%'
  OR name ILIKE '%90/90%'
  OR name ILIKE '%Hip Internal Rotation%'
)
AND category IN ('Mobility/Reset', 'Rotary/Core')
AND NOT ('Over the Top' = ANY(swing_faults));
