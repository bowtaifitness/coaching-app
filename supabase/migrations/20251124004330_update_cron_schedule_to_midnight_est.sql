/*
  # Update Cron Schedule to Midnight EST

  1. Purpose
    - Change trial expiration processing time from 2:00 AM UTC to 12:00 AM EST
    - 12:00 AM EST = 5:00 AM UTC (EST is UTC-5)
    - Note: During daylight saving time (EDT), 12:00 AM EDT = 4:00 AM UTC

  2. Changes
    - Update cron schedule to run at 5:00 AM UTC (12:00 AM EST)
    - Keep same job name and function

  3. How It Works
    - Cron job runs at 5:00 AM UTC daily
    - This translates to 12:00 AM EST (or 1:00 AM EDT during daylight saving)
    - Processes all clients with expired trials and charges them

  4. Note
    - Using 5:00 AM UTC for consistency (always 12:00 AM EST)
    - If you need it to adjust for daylight saving time automatically, you would need to manage two schedules
*/

-- Unschedule existing job
SELECT cron.unschedule('process-trial-expirations-daily');

-- Schedule new job to run at 5:00 AM UTC (12:00 AM EST)
SELECT cron.schedule(
  'process-trial-expirations-daily',
  '0 5 * * *',  -- Run at 5:00 AM UTC (12:00 AM EST)
  'SELECT process_trial_expirations();'
);