/*
  # Security hardening pass

  Addresses Supabase advisor findings:

  1. Pinned `search_path` on flagged functions (defends against role-mutable
     search-path hijacking).
  2. Locked down EXECUTE on SECURITY DEFINER functions
     - Trigger-only functions: revoked from PUBLIC/anon/authenticated.
     - User RPCs: revoked from PUBLIC/anon, granted to authenticated.
     - Service-only RPCs (reload_*, process_trial_expirations): revoked
       from all login roles; only owner / service_role can call them.
  3. Recreated `client_streak_summary` view with `security_invoker = true`
     so RLS of underlying tables is enforced.
  4. Removed always-true RLS policies on `coach_client_assignments` and
     `user_promotions`; replaced the user-promotion INSERT policy with one
     that requires the user to own the row or be an admin.
  5. Removed broad SELECT policies on storage.objects for the public
     `attachments` and `swing-videos` buckets to prevent file listing.
     Direct public-URL access still works.
  6. Reinstalled `pg_net` extension into a dedicated `extensions` schema.

  Notes:
    - Auth OTP expiry, leaked-password protection, and Postgres minor-version
      upgrades are dashboard-level settings and cannot be set via SQL.
*/

-- ============================================================
-- 1. PIN search_path FOR FLAGGED FUNCTIONS
-- ============================================================

ALTER FUNCTION public.update_workout_programs_updated_at()              SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at_column()                        SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_coach_client_assignments_updated_at()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_default_coach_id()                            SET search_path = public, pg_catalog;
ALTER FUNCTION public.auto_confirm_user_email()                         SET search_path = public, pg_catalog;
ALTER FUNCTION public.reload_schema()                                   SET search_path = public, pg_catalog;
ALTER FUNCTION public.reload_postgrest_schema()                         SET search_path = public, pg_catalog;
ALTER FUNCTION public.get_active_promotions()                           SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_program_week_exercises_updated_at()        SET search_path = public, pg_catalog;
ALTER FUNCTION public.check_trial_status(uuid)                          SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_missing_profile(text, text, text, text)    SET search_path = public, pg_catalog;
ALTER FUNCTION public.auto_assign_default_coach()                       SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_default_coach_assignment()                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.admin_force_delete_user_by_email(text)            SET search_path = public, pg_catalog;
ALTER FUNCTION public.apply_promotion_to_user(uuid, uuid)               SET search_path = public, pg_catalog;
ALTER FUNCTION public.admin_extend_trial(uuid, integer)                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.sync_template_exercises_to_programs()             SET search_path = public, pg_catalog;
ALTER FUNCTION public.trigger_auto_assign_program()                     SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_default_trial_period(integer)              SET search_path = public, pg_catalog;
ALTER FUNCTION public.handle_new_user()                                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_profile_for_user(uuid, text, text, text, text, boolean, text)
  SET search_path = public, pg_catalog;
ALTER FUNCTION public.assign_program_from_intake(uuid)                  SET search_path = public, pg_catalog;
ALTER FUNCTION public.delete_stripe_data_on_customer_delete()           SET search_path = public, pg_catalog;
ALTER FUNCTION public.process_trial_expirations()                       SET search_path = public, pg_catalog;
ALTER FUNCTION public._swing_programs_touch_updated_at()                SET search_path = public, pg_catalog;

-- ============================================================
-- 2. EXECUTE PRIVILEGE LOCKDOWN
-- ============================================================

DO $$
DECLARE
  fn text;
BEGIN
  FOR fn IN
    SELECT format('public.%I()', proname)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'auto_assign_default_coach',
        'auto_confirm_user_email',
        'create_default_coach_assignment',
        'handle_new_user',
        'sync_template_exercises_to_programs',
        'trigger_auto_assign_program',
        '_swing_programs_touch_updated_at',
        'delete_stripe_data_on_customer_delete',
        'update_workout_programs_updated_at',
        'update_updated_at_column',
        'update_coach_client_assignments_updated_at',
        'update_program_week_exercises_updated_at'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer)              FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_force_delete_user_by_email(text)         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_default_trial_period(integer)           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.process_trial_expirations()                    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reload_schema()                                FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reload_postgrest_schema()                      FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin()                                     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.check_trial_status(uuid)                       FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_active_promotions()                        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_default_coach_id()                         FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.apply_promotion_to_user(uuid, uuid)            FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_program_from_intake(uuid)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_profile_for_user(uuid, text, text, text, text, boolean, text)
  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_missing_profile(text, text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin()                                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_trial_status(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_promotions()                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_coach_id()                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_promotion_to_user(uuid, uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_program_from_intake(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile_for_user(uuid, text, text, text, text, boolean, text)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_missing_profile(text, text, text, text)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_extend_trial(uuid, integer)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_force_delete_user_by_email(text)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_default_trial_period(integer)            TO authenticated;

-- ============================================================
-- 3. RECREATE client_streak_summary AS SECURITY INVOKER
-- ============================================================

DROP VIEW IF EXISTS public.client_streak_summary;

CREATE VIEW public.client_streak_summary
  WITH (security_invoker = true) AS
WITH completed_rows AS (
  SELECT swing_training_progress.user_id,
    COALESCE(swing_training_progress.completed_at, swing_training_progress.updated_at) AS stamp
  FROM public.swing_training_progress
  WHERE swing_training_progress.completed = true
    AND COALESCE(swing_training_progress.completed_at, swing_training_progress.updated_at) IS NOT NULL
), per_day AS (
  SELECT user_id,
    ((stamp AT TIME ZONE 'UTC')::date) AS day,
    COUNT(*)::integer AS day_count,
    MAX(stamp) AS last_stamp
  FROM completed_rows
  GROUP BY user_id, ((stamp AT TIME ZONE 'UTC')::date)
), user_totals AS (
  SELECT user_id,
    COUNT(*)::integer AS total_completions,
    MAX(stamp) AS last_completed_at,
    COUNT(*) FILTER (WHERE stamp >= now() - INTERVAL '7 days')::integer AS this_week_count
  FROM completed_rows
  GROUP BY user_id
), ordered AS (
  SELECT user_id, day, day_count,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day) AS rn
  FROM per_day
), runs AS (
  SELECT user_id, day, day_count,
    (day - ((rn || ' days')::interval)) AS run_key
  FROM ordered
), run_lengths AS (
  SELECT user_id, run_key,
    COUNT(*)::integer AS run_length,
    MAX(day) AS run_end
  FROM runs
  GROUP BY user_id, run_key
), longest AS (
  SELECT user_id, MAX(run_length) AS longest_streak
  FROM run_lengths
  GROUP BY user_id
), current_run AS (
  SELECT DISTINCT ON (user_id)
    user_id,
    CASE
      WHEN run_end >= ((now() AT TIME ZONE 'UTC')::date - 1) THEN run_length
      ELSE 0
    END AS current_streak
  FROM run_lengths
  ORDER BY user_id, run_end DESC
), day_counts AS (
  SELECT user_id, COUNT(*)::integer AS days_active
  FROM per_day
  GROUP BY user_id
)
SELECT ut.user_id,
  ut.total_completions,
  ut.last_completed_at,
  ut.this_week_count,
  COALESCE(dc.days_active, 0) AS days_active,
  COALESCE(l.longest_streak, 0) AS longest_streak,
  COALESCE(c.current_streak, 0) AS current_streak
FROM user_totals ut
LEFT JOIN day_counts dc  ON dc.user_id = ut.user_id
LEFT JOIN longest    l   ON l.user_id  = ut.user_id
LEFT JOIN current_run c  ON c.user_id  = ut.user_id;

GRANT SELECT ON public.client_streak_summary TO authenticated;

-- ============================================================
-- 4. TIGHTEN OVER-PERMISSIVE RLS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can insert assignments"
  ON public.coach_client_assignments;

DROP POLICY IF EXISTS "System can insert user promotions"
  ON public.user_promotions;

CREATE POLICY "Owners or admins can insert user promotions"
  ON public.user_promotions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'admin'
    )
  );

-- ============================================================
-- 5. REMOVE BROAD STORAGE LISTING POLICIES
-- ============================================================

DROP POLICY IF EXISTS "Users can view message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can view swing videos"        ON storage.objects;

-- ============================================================
-- 6. MOVE pg_net OUT OF public SCHEMA
-- ============================================================
-- pg_net does not support ALTER EXTENSION ... SET SCHEMA, so we drop and
-- reinstall it in a dedicated extensions schema. Verified that
-- net.http_request_queue has zero pending rows before running this.

CREATE SCHEMA IF NOT EXISTS extensions;
GRANT USAGE ON SCHEMA extensions TO postgres, anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'pg_net' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'DROP EXTENSION pg_net CASCADE';
    EXECUTE 'CREATE EXTENSION pg_net WITH SCHEMA extensions';
  END IF;
END $$;
