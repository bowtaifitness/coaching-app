/*
  # Setup daily workout notification cron job

  1. New Functions
    - `notify_upcoming_workouts()` - Finds workouts scheduled for today, sends
      notification to each user via the send-workout-notifications Edge Function
    - `notify_block_end()` - Detects users whose last workout in a training block
      is today (block boundary = every 3 weeks), sends block_end notification

  2. Cron Jobs
    - `daily-workout-notifications` - Runs at 6 AM US/Eastern (11:00 UTC) daily
      calling both notification functions

  3. Security
    - Functions use SECURITY DEFINER to access profiles
    - pg_net is used to make HTTP calls to the Edge Function
    - Service role key stored in vault for secure access

  4. Notes
    - Edge Function handles preference checking internally
    - If a user has notifications disabled, the edge function returns gracefully
    - Non-blocking: failures for one user don't affect others
*/

-- Store the service role key in vault for use by pg_net calls
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6Z2R1emx2YXFicnVla2N0dHlpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDc3NzM2MSwiZXhwIjoyMDcwMzUzMzYxfQ.V4YM0clDnlIwi0GZ-MnbMkmQvFIqyMFJLOPRGFnnfoc',
  'service_role_key',
  'Supabase service role key for internal edge function calls'
);

-- Function to send upcoming workout notifications
CREATE OR REPLACE FUNCTION public.notify_upcoming_workouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  service_key TEXT;
  edge_url TEXT;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'notify_upcoming_workouts: service_role_key not found in vault';
    RETURN;
  END IF;

  edge_url := 'https://auth.birdiesbybowtai.com/functions/v1/send-workout-notifications';

  -- Find all non-completed workouts scheduled for today
  FOR rec IN
    SELECT DISTINCT
      w.client_id AS user_id,
      w.title,
      w.scheduled_date::text AS scheduled_date
    FROM workouts w
    WHERE w.scheduled_date = CURRENT_DATE
      AND w.completed = false
      AND w.archived IS NOT TRUE
  LOOP
    -- Fire-and-forget HTTP call via pg_net
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'user_id', rec.user_id,
        'notification_type', 'upcoming_workout',
        'workout_details', jsonb_build_object(
          'title', rec.title,
          'scheduled_date', rec.scheduled_date
        )
      )
    );
  END LOOP;
END;
$$;

-- Function to send block-end notifications
-- A "block" ends when the user has no more workouts in the current 3-week period
CREATE OR REPLACE FUNCTION public.notify_block_end()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  service_key TEXT;
  edge_url TEXT;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF service_key IS NULL THEN
    RAISE WARNING 'notify_block_end: service_role_key not found in vault';
    RETURN;
  END IF;

  edge_url := 'https://auth.birdiesbybowtai.com/functions/v1/send-workout-notifications';

  -- Find users whose last workout in their current assignment block is today
  -- (i.e., today is the last scheduled_date and it's either completed today or was the last one)
  FOR rec IN
    SELECT
      w.client_id AS user_id,
      cpa.id AS assignment_id,
      wp.title AS program_title,
      -- Calculate which 3-week block the workout falls in
      CEIL(
        EXTRACT(DAY FROM (w.scheduled_date - cpa.start_date::date) + 1)::numeric / 21
      )::int AS block_number
    FROM workouts w
    JOIN client_program_assignments cpa ON cpa.client_id = w.client_id AND cpa.status = 'active'
    JOIN workout_programs wp ON wp.id = cpa.program_id
    WHERE w.scheduled_date = CURRENT_DATE
      AND w.archived IS NOT TRUE
      -- This is the last workout in this block period
      AND NOT EXISTS (
        SELECT 1 FROM workouts w2
        WHERE w2.client_id = w.client_id
          AND w2.scheduled_date > CURRENT_DATE
          AND w2.scheduled_date <= cpa.start_date::date + (
            CEIL(EXTRACT(DAY FROM (w.scheduled_date - cpa.start_date::date) + 1)::numeric / 21) * 21
          )::int
          AND w2.archived IS NOT TRUE
      )
    GROUP BY w.client_id, cpa.id, wp.title,
      CEIL(EXTRACT(DAY FROM (w.scheduled_date - cpa.start_date::date) + 1)::numeric / 21)
  LOOP
    PERFORM net.http_post(
      url := edge_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'user_id', rec.user_id,
        'notification_type', 'block_end',
        'workout_details', jsonb_build_object(
          'title', rec.program_title,
          'block_number', rec.block_number,
          'summary', 'You''ve completed all workouts in this training block. Check your app for what''s next!'
        )
      )
    );
  END LOOP;
END;
$$;

-- Create a wrapper function that calls both notification functions
CREATE OR REPLACE FUNCTION public.run_daily_workout_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.notify_upcoming_workouts();
  PERFORM public.notify_block_end();
END;
$$;

-- Schedule the cron job: 6 AM Eastern = 11:00 UTC (during EDT) / 11:00 UTC
-- Using 10:00 UTC to cover EST (6 AM EST = 11 UTC, 6 AM EDT = 10 UTC)
-- We'll use 11 UTC which is 6 AM EST / 7 AM EDT as a safe default
SELECT cron.unschedule('daily-workout-notifications')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-workout-notifications'
);

SELECT cron.schedule(
  'daily-workout-notifications',
  '0 11 * * *',
  $$SELECT public.run_daily_workout_notifications()$$
);
