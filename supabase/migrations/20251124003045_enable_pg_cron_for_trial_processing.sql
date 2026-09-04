/*
  # Enable pg_cron for Automated Trial Processing

  1. Purpose
    - Enable the pg_cron extension for scheduling automated database jobs
    - Set up daily automated processing of trial expirations
    - Automatically charge clients when their free trial ends

  2. What This Does
    - Enables pg_cron extension (PostgreSQL job scheduler)
    - Creates a daily cron job that runs at 2:00 AM UTC
    - Automatically calls the process-trial-expirations Edge Function
    - Processes expired trials and creates Stripe subscriptions

  3. How It Works
    - Job runs every day at 2:00 AM UTC
    - Finds clients whose trial has expired and opted into auto-subscribe
    - Creates Stripe subscriptions and charges their saved payment method
    - Updates profile and subscription records in the database

  4. Security
    - Uses pg_net extension to make HTTP calls
    - Calls Edge Function with service role authentication
*/

-- Enable pg_cron extension for scheduling jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for making HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule daily job to process trial expirations at 2:00 AM UTC
SELECT cron.schedule(
  'process-trial-expirations-daily',
  '0 2 * * *',  -- Run at 2:00 AM UTC every day
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/process-trial-expirations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);