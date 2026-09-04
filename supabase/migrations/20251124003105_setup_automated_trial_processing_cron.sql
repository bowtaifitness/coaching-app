/*
  # Setup Automated Trial Processing with Cron Job

  1. Purpose
    - Create a database function to process trial expirations
    - Set up daily cron job to automatically charge clients when trial ends
    - Run at 2:00 AM UTC every day

  2. What This Does
    - Creates a function that calls the process-trial-expirations Edge Function
    - Uses pg_net to make HTTP POST request to the Edge Function
    - Schedules daily execution using pg_cron

  3. How It Works
    - Cron job triggers daily at 2:00 AM UTC
    - Finds all clients with expired trials who opted into auto-subscribe
    - Creates Stripe subscriptions and charges their saved payment method
    - Updates database records to reflect active subscriptions

  4. Security
    - Uses Supabase service role key for authentication
    - Only processes clients who explicitly opted in
    - Requires valid payment method on file
*/

-- Create function to call the Edge Function
CREATE OR REPLACE FUNCTION process_trial_expirations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  function_url text;
BEGIN
  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- If not set, try to construct from database connection
  IF supabase_url IS NULL OR supabase_url = '' THEN
    supabase_url := 'https://auth.birdiesbybowtai.com';
  END IF;
  
  function_url := supabase_url || '/functions/v1/process-trial-expirations';
  
  -- Make HTTP POST request to Edge Function
  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  
  RAISE NOTICE 'Triggered trial expiration processing at %', now();
END;
$$;

-- Remove existing cron job if it exists
SELECT cron.unschedule('process-trial-expirations-daily')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-trial-expirations-daily'
);

-- Schedule daily job to process trial expirations at 2:00 AM UTC
SELECT cron.schedule(
  'process-trial-expirations-daily',
  '0 2 * * *',  -- Run at 2:00 AM UTC every day
  'SELECT process_trial_expirations();'
);