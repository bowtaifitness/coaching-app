/*
  # Update Client Intake Form to Single Selections
  
  1. Changes
    - Convert equipment_access from array to single text value
    - Update existing data to use first array element
    - Reflects form changes where clients select ONE equipment option instead of multiple
  
  2. Data Migration
    - Safely converts existing array data to single values
    - Uses the first element of existing arrays
    - Sets NULL values to empty string for consistency
*/

-- First, update existing data to convert arrays to single values
UPDATE client_intake_forms
SET equipment_access = CASE 
  WHEN equipment_access IS NULL OR array_length(equipment_access, 1) IS NULL THEN ARRAY[]::text[]
  WHEN array_length(equipment_access, 1) > 0 THEN ARRAY[equipment_access[1]]
  ELSE ARRAY[]::text[]
END
WHERE equipment_access IS NOT NULL;

-- Drop the array column and recreate as text
ALTER TABLE client_intake_forms 
DROP COLUMN IF EXISTS equipment_access;

ALTER TABLE client_intake_forms 
ADD COLUMN equipment_access text DEFAULT '';

-- Update any NULL values to empty string
UPDATE client_intake_forms
SET equipment_access = ''
WHERE equipment_access IS NULL;