/*
  # Disable Automatic Program Assignment on Intake Form

  1. Changes
    - Drops the `trigger_auto_assign_program` trigger from `client_intake_forms` table
    - Clients will no longer be auto-assigned a workout program when they complete their intake form
    - The swing analyzer and workout generator now handle program creation instead

  2. Notes
    - The `assign_program_from_intake` function is kept but not invoked automatically
    - The `trigger_auto_assign_program` function is kept for potential manual use
    - No data is deleted — existing assignments remain untouched
*/

DROP TRIGGER IF EXISTS trigger_auto_assign_program ON client_intake_forms;
