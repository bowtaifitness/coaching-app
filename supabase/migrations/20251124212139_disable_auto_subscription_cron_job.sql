/*
  # Disable Automatic Trial Subscription Processing
  
  1. Purpose
    - Remove cron job that automatically charges clients after trial
    - Clients must manually subscribe after trial expires
    
  2. Changes
    - Unschedule the daily cron job
    - Keep function in place in case needed for manual processing
    
  3. Security
    - No security changes, just removing automation
*/

-- Remove the cron job that automatically processes trial expirations
SELECT cron.unschedule('process-trial-expirations-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-trial-expirations-daily'
);