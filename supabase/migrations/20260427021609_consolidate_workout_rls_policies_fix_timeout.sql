/*
  # Consolidate workout RLS policies to fix statement timeout

  ## Summary
  Saving workout progress was failing with "canceling statement due to statement
  timeout" (Postgres error 57014). Root cause: the `workout_exercises` UPDATE
  triggered RLS evaluation that recursed into `workouts` (which had 13 overlapping
  permissive policies) and then into `profiles` (with EXISTS subqueries against
  `coach_client_assignments`). The combined plan ballooned to ~95KB and timed
  out for clients with many workouts.

  ## Changes

  1. New helper function
    - `public.is_admin()` — SECURITY DEFINER function that checks the caller's
      role in `profiles` without triggering RLS recursion. Used by policies that
      need to grant admin-wide access.

  2. Workouts table policies
    - Drops 13 overlapping/duplicate policies.
    - Replaces with one policy per command (SELECT/INSERT/UPDATE/DELETE) that
      grants access to: the workout's client, the workout's coach, or admins.

  3. Workout_exercises table policies
    - Drops 3 broad `FOR ALL` policies that each ran EXISTS subqueries.
    - Replaces with one policy per command that joins to the parent workout
      once and uses `is_admin()` for admin access.

  ## Security
  - RLS remains enabled on both tables.
  - Access remains restricted to authenticated users.
  - Each policy still verifies ownership (client_id / coach_id) or admin role.
  - No data is dropped or modified.
*/

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Admin full access to workouts" ON public.workouts;
DROP POLICY IF EXISTS "Admins can manage all workouts" ON public.workouts;
DROP POLICY IF EXISTS "Admins can view all workouts" ON public.workouts;
DROP POLICY IF EXISTS "Clients can create own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Clients can delete own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Clients can mark own workouts complete" ON public.workouts;
DROP POLICY IF EXISTS "Clients can update own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Clients can view own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can create workouts" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can create workouts for assigned clients" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can delete own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can update own workouts" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can view assigned client workouts" ON public.workouts;
DROP POLICY IF EXISTS "Coaches can view own workouts" ON public.workouts;

CREATE POLICY "workouts_select"
  ON public.workouts FOR SELECT
  TO authenticated
  USING (
    client_id = (SELECT auth.uid())
    OR coach_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "workouts_insert"
  ON public.workouts FOR INSERT
  TO authenticated
  WITH CHECK (
    client_id = (SELECT auth.uid())
    OR coach_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "workouts_update"
  ON public.workouts FOR UPDATE
  TO authenticated
  USING (
    client_id = (SELECT auth.uid())
    OR coach_id = (SELECT auth.uid())
    OR public.is_admin()
  )
  WITH CHECK (
    client_id = (SELECT auth.uid())
    OR coach_id = (SELECT auth.uid())
    OR public.is_admin()
  );

CREATE POLICY "workouts_delete"
  ON public.workouts FOR DELETE
  TO authenticated
  USING (
    client_id = (SELECT auth.uid())
    OR coach_id = (SELECT auth.uid())
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "workout_exercises_admin_all" ON public.workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_client_access" ON public.workout_exercises;
DROP POLICY IF EXISTS "workout_exercises_coach_all" ON public.workout_exercises;

CREATE POLICY "workout_exercises_select"
  ON public.workout_exercises FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.client_id = (SELECT auth.uid()) OR w.coach_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "workout_exercises_insert"
  ON public.workout_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.client_id = (SELECT auth.uid()) OR w.coach_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "workout_exercises_update"
  ON public.workout_exercises FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.client_id = (SELECT auth.uid()) OR w.coach_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.client_id = (SELECT auth.uid()) OR w.coach_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "workout_exercises_delete"
  ON public.workout_exercises FOR DELETE
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.workouts w
      WHERE w.id = workout_exercises.workout_id
        AND (w.client_id = (SELECT auth.uid()) OR w.coach_id = (SELECT auth.uid()))
    )
  );
