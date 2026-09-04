/*
  # Optimize RLS Policies - Use (select auth.uid()) Pattern

  1. Problem
    - All RLS policies call auth.uid() and auth.jwt() directly, which causes
      re-evaluation per row instead of being computed once per query
    - This creates suboptimal performance at scale

  2. Fix
    - Drop and recreate every affected policy with auth.uid() wrapped in (select auth.uid())
    - Same for auth.jwt() wrapped in (select auth.jwt())
    - This allows PostgreSQL to evaluate the auth function once and reuse the result

  3. Tables Affected
    - profiles, clients, exercises, messages, workouts, workout_exercises,
      workout_templates, workout_programs, template_exercises, program_days,
      program_weeks, program_week_exercises, performance_metrics, swing_analyses,
      swing_diagnoses, coach_client_assignments, client_intake_forms,
      client_program_assignments, promotions, user_promotions,
      stripe_customers, stripe_subscriptions, stripe_orders

  4. Notes
    - Policy logic is NOT changed, only the auth function wrapping
    - Policies with qual = 'true' or that don't use auth functions are skipped
*/

-- ============================================
-- profiles
-- ============================================
DROP POLICY IF EXISTS "users_can_access_own_profile" ON profiles;
CREATE POLICY "users_can_access_own_profile" ON profiles FOR ALL TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "admin_full_access_by_email" ON profiles;
CREATE POLICY "admin_full_access_by_email" ON profiles FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK (((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com');

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
CREATE POLICY "Coaches can view assigned clients" ON profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = profiles.id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Clients can view their coach" ON profiles;
CREATE POLICY "Clients can view their coach" ON profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.client_id = (select auth.uid())
      AND coach_client_assignments.coach_id = profiles.id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Admins can delete client profiles" ON profiles;
CREATE POLICY "Admins can delete client profiles" ON profiles FOR DELETE TO authenticated
  USING ((((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com') AND (role = 'client'));

-- ============================================
-- clients
-- ============================================
DROP POLICY IF EXISTS "client can read own row" ON clients;
CREATE POLICY "client can read own row" ON clients FOR SELECT TO public
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "coach/admin can manage clients" ON clients;
CREATE POLICY "coach/admin can manage clients" ON clients FOR ALL TO public
  USING ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = ANY (ARRAY['coach', 'admin']))
  WITH CHECK ((((select auth.jwt()) -> 'app_metadata') ->> 'role') = ANY (ARRAY['coach', 'admin']));

DROP POLICY IF EXISTS "Coaches can view own clients" ON clients;
CREATE POLICY "Coaches can view own clients" ON clients FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can insert clients" ON clients;
CREATE POLICY "Coaches can insert clients" ON clients FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can update clients" ON clients;
CREATE POLICY "Coaches can update clients" ON clients FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- ============================================
-- exercises
-- ============================================
DROP POLICY IF EXISTS "Admin email full access to exercises" ON exercises;
CREATE POLICY "Admin email full access to exercises" ON exercises FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK (((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com');

DROP POLICY IF EXISTS "Coaches can create exercises" ON exercises;
CREATE POLICY "Coaches can create exercises" ON exercises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'coach'
  ));

DROP POLICY IF EXISTS "Coaches can delete own exercises" ON exercises;
CREATE POLICY "Coaches can delete own exercises" ON exercises FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can update own exercises" ON exercises;
CREATE POLICY "Coaches can update own exercises" ON exercises FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- ============================================
-- messages
-- ============================================
DROP POLICY IF EXISTS "Admin full access to messages" ON messages;
CREATE POLICY "Admin full access to messages" ON messages FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can view all messages" ON messages;
CREATE POLICY "Admins can view all messages" ON messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can view own messages" ON messages;
CREATE POLICY "Users can view own messages" ON messages FOR SELECT TO authenticated
  USING (sender_id = (select auth.uid()) OR receiver_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view assigned messages" ON messages;
CREATE POLICY "Users can view assigned messages" ON messages FOR SELECT TO authenticated
  USING (
    sender_id = (select auth.uid())
    OR receiver_id = (select auth.uid())
    OR (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = (select auth.uid()) AND p.role = 'coach')
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = (select auth.uid())
          AND (cca.client_id = messages.sender_id OR cca.client_id = messages.receiver_id)
          AND cca.active = true
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update received messages" ON messages;
CREATE POLICY "Users can update received messages" ON messages FOR UPDATE TO authenticated
  USING (receiver_id = (select auth.uid()))
  WITH CHECK (receiver_id = (select auth.uid()));

-- ============================================
-- workouts
-- ============================================
DROP POLICY IF EXISTS "Admin full access to workouts" ON workouts;
CREATE POLICY "Admin full access to workouts" ON workouts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage all workouts" ON workouts;
CREATE POLICY "Admins can manage all workouts" ON workouts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can view all workouts" ON workouts;
CREATE POLICY "Admins can view all workouts" ON workouts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Clients can view own workouts" ON workouts;
CREATE POLICY "Clients can view own workouts" ON workouts FOR SELECT TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can create own workouts" ON workouts;
CREATE POLICY "Clients can create own workouts" ON workouts FOR INSERT TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can update own workouts" ON workouts;
CREATE POLICY "Clients can update own workouts" ON workouts FOR UPDATE TO authenticated
  USING (client_id = (select auth.uid()))
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can mark own workouts complete" ON workouts;
CREATE POLICY "Clients can mark own workouts complete" ON workouts FOR UPDATE TO authenticated
  USING (client_id = (select auth.uid()))
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can delete own workouts" ON workouts;
CREATE POLICY "Clients can delete own workouts" ON workouts FOR DELETE TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can view own workouts" ON workouts;
CREATE POLICY "Coaches can view own workouts" ON workouts FOR SELECT TO authenticated
  USING (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can create workouts" ON workouts;
CREATE POLICY "Coaches can create workouts" ON workouts FOR INSERT TO authenticated
  WITH CHECK (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can create workouts for assigned clients" ON workouts;
CREATE POLICY "Coaches can create workouts for assigned clients" ON workouts FOR INSERT TO authenticated
  WITH CHECK (
    coach_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'coach')
    AND EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = (select auth.uid()) AND cca.client_id = workouts.client_id AND cca.active = true
    )
  );

DROP POLICY IF EXISTS "Coaches can update own workouts" ON workouts;
CREATE POLICY "Coaches can update own workouts" ON workouts FOR UPDATE TO authenticated
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can delete own workouts" ON workouts;
CREATE POLICY "Coaches can delete own workouts" ON workouts FOR DELETE TO authenticated
  USING (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can view assigned client workouts" ON workouts;
CREATE POLICY "Coaches can view assigned client workouts" ON workouts FOR SELECT TO authenticated
  USING (
    coach_id = (select auth.uid())
    OR client_id = (select auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
  );

-- ============================================
-- workout_exercises
-- ============================================
DROP POLICY IF EXISTS "workout_exercises_admin_all" ON workout_exercises;
CREATE POLICY "workout_exercises_admin_all" ON workout_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "workout_exercises_client_access" ON workout_exercises;
CREATE POLICY "workout_exercises_client_access" ON workout_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.client_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.client_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "workout_exercises_coach_all" ON workout_exercises;
CREATE POLICY "workout_exercises_coach_all" ON workout_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.coach_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workouts WHERE workouts.id = workout_exercises.workout_id AND workouts.coach_id = (select auth.uid())
  ));

-- ============================================
-- workout_templates
-- ============================================
DROP POLICY IF EXISTS "Admin full access to workout_templates" ON workout_templates;
CREATE POLICY "Admin full access to workout_templates" ON workout_templates FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage all workout templates" ON workout_templates;
CREATE POLICY "Admins can manage all workout templates" ON workout_templates FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Coaches can view own templates" ON workout_templates;
CREATE POLICY "Coaches can view own templates" ON workout_templates FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can insert templates" ON workout_templates;
CREATE POLICY "Coaches can insert templates" ON workout_templates FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can update templates" ON workout_templates;
CREATE POLICY "Coaches can update templates" ON workout_templates FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can delete templates" ON workout_templates;
CREATE POLICY "Coaches can delete templates" ON workout_templates FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================
-- template_exercises
-- ============================================
DROP POLICY IF EXISTS "Admin full access to template_exercises" ON template_exercises;
CREATE POLICY "Admin full access to template_exercises" ON template_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage all template exercises" ON template_exercises;
CREATE POLICY "Admins can manage all template exercises" ON template_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can view template exercises" ON template_exercises;
CREATE POLICY "Users can view template exercises" ON template_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can view template exercises" ON template_exercises;
CREATE POLICY "Coaches can view template exercises" ON template_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can insert template exercises" ON template_exercises;
CREATE POLICY "Coaches can insert template exercises" ON template_exercises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can update template exercises" ON template_exercises;
CREATE POLICY "Coaches can update template exercises" ON template_exercises FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can delete template exercises" ON template_exercises;
CREATE POLICY "Coaches can delete template exercises" ON template_exercises FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_templates
    WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = (select auth.uid())
  ));

-- ============================================
-- workout_programs
-- ============================================
DROP POLICY IF EXISTS "Admin full access to workout_programs" ON workout_programs;
CREATE POLICY "Admin full access to workout_programs" ON workout_programs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage all workout programs" ON workout_programs;
CREATE POLICY "Admins can manage all workout programs" ON workout_programs FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Coaches can view own programs" ON workout_programs;
CREATE POLICY "Coaches can view own programs" ON workout_programs FOR SELECT TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can insert programs" ON workout_programs;
CREATE POLICY "Coaches can insert programs" ON workout_programs FOR INSERT TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can update programs" ON workout_programs;
CREATE POLICY "Coaches can update programs" ON workout_programs FOR UPDATE TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can delete programs" ON workout_programs;
CREATE POLICY "Coaches can delete programs" ON workout_programs FOR DELETE TO authenticated
  USING (created_by = (select auth.uid()));

-- ============================================
-- program_days
-- ============================================
DROP POLICY IF EXISTS "Admin full access to program_days" ON program_days;
CREATE POLICY "Admin full access to program_days" ON program_days FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage all program days" ON program_days;
CREATE POLICY "Admins can manage all program days" ON program_days FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Coaches can view program days" ON program_days;
CREATE POLICY "Coaches can view program days" ON program_days FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_days.program_id AND workout_programs.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can insert program days" ON program_days;
CREATE POLICY "Coaches can insert program days" ON program_days FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_days.program_id AND workout_programs.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can update program days" ON program_days;
CREATE POLICY "Coaches can update program days" ON program_days FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_days.program_id AND workout_programs.created_by = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_days.program_id AND workout_programs.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can delete program days" ON program_days;
CREATE POLICY "Coaches can delete program days" ON program_days FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_days.program_id AND workout_programs.created_by = (select auth.uid())
  ));

-- ============================================
-- program_weeks
-- ============================================
DROP POLICY IF EXISTS "Admin full access to program_weeks" ON program_weeks;
CREATE POLICY "Admin full access to program_weeks" ON program_weeks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can manage all program weeks" ON program_weeks;
CREATE POLICY "Admins can manage all program weeks" ON program_weeks FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Coaches can view program weeks" ON program_weeks;
CREATE POLICY "Coaches can view program weeks" ON program_weeks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_weeks.program_id AND workout_programs.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can insert program weeks" ON program_weeks;
CREATE POLICY "Coaches can insert program weeks" ON program_weeks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_weeks.program_id AND workout_programs.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can update program weeks" ON program_weeks;
CREATE POLICY "Coaches can update program weeks" ON program_weeks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_weeks.program_id AND workout_programs.created_by = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_weeks.program_id AND workout_programs.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can delete program weeks" ON program_weeks;
CREATE POLICY "Coaches can delete program weeks" ON program_weeks FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workout_programs
    WHERE workout_programs.id = program_weeks.program_id AND workout_programs.created_by = (select auth.uid())
  ));

-- ============================================
-- program_week_exercises
-- ============================================
DROP POLICY IF EXISTS "Coaches can view exercises for their programs" ON program_week_exercises;
CREATE POLICY "Coaches can view exercises for their programs" ON program_week_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON pw.program_id = wp.id
    WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can insert exercises for their programs" ON program_week_exercises;
CREATE POLICY "Coaches can insert exercises for their programs" ON program_week_exercises FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON pw.program_id = wp.id
    WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can update exercises for their programs" ON program_week_exercises;
CREATE POLICY "Coaches can update exercises for their programs" ON program_week_exercises FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON pw.program_id = wp.id
    WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON pw.program_id = wp.id
    WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Coaches can delete exercises for their programs" ON program_week_exercises;
CREATE POLICY "Coaches can delete exercises for their programs" ON program_week_exercises FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM program_weeks pw
    JOIN workout_programs wp ON pw.program_id = wp.id
    WHERE pw.id = program_week_exercises.program_week_id AND wp.created_by = (select auth.uid())
  ));

-- ============================================
-- performance_metrics
-- ============================================
DROP POLICY IF EXISTS "Admin full access to performance_metrics" ON performance_metrics;
CREATE POLICY "Admin full access to performance_metrics" ON performance_metrics FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can view all performance metrics" ON performance_metrics;
CREATE POLICY "Admins can view all performance metrics" ON performance_metrics FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Clients can view own metrics" ON performance_metrics;
CREATE POLICY "Clients can view own metrics" ON performance_metrics FOR SELECT TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can insert own performance metrics" ON performance_metrics;
CREATE POLICY "Clients can insert own performance metrics" ON performance_metrics FOR INSERT TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can view client metrics" ON performance_metrics;
CREATE POLICY "Coaches can view client metrics" ON performance_metrics FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Coaches can insert metrics" ON performance_metrics;
CREATE POLICY "Coaches can insert metrics" ON performance_metrics FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Coaches can update metrics" ON performance_metrics;
CREATE POLICY "Coaches can update metrics" ON performance_metrics FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Users can view assigned performance metrics" ON performance_metrics;
CREATE POLICY "Users can view assigned performance metrics" ON performance_metrics FOR SELECT TO authenticated
  USING (
    client_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      WHERE cca.coach_id = (select auth.uid())
        AND cca.client_id = performance_metrics.client_id
        AND cca.active = true
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
    )
  );

-- ============================================
-- swing_analyses
-- ============================================
DROP POLICY IF EXISTS "Admin full access to swing_analyses" ON swing_analyses;
CREATE POLICY "Admin full access to swing_analyses" ON swing_analyses FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles admin_profile
    WHERE admin_profile.id = (select auth.uid()) AND admin_profile.role = 'admin'
  ));

DROP POLICY IF EXISTS "Admins can view all swing analyses" ON swing_analyses;
CREATE POLICY "Admins can view all swing analyses" ON swing_analyses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Clients can view own analyses" ON swing_analyses;
CREATE POLICY "Clients can view own analyses" ON swing_analyses FOR SELECT TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can upload swing videos" ON swing_analyses;
CREATE POLICY "Clients can upload swing videos" ON swing_analyses FOR INSERT TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can insert analyses" ON swing_analyses;
CREATE POLICY "Clients can insert analyses" ON swing_analyses FOR INSERT TO authenticated
  WITH CHECK (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can view client analyses" ON swing_analyses;
CREATE POLICY "Coaches can view client analyses" ON swing_analyses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Coaches can insert analyses" ON swing_analyses;
CREATE POLICY "Coaches can insert analyses" ON swing_analyses FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Coaches can update swing analyses" ON swing_analyses;
CREATE POLICY "Coaches can update swing analyses" ON swing_analyses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'coach'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'coach'
  ));

DROP POLICY IF EXISTS "Coaches can update client analyses" ON swing_analyses;
CREATE POLICY "Coaches can update client analyses" ON swing_analyses FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
  ));

DROP POLICY IF EXISTS "Users can view assigned swing analyses" ON swing_analyses;
CREATE POLICY "Users can view assigned swing analyses" ON swing_analyses FOR SELECT TO authenticated
  USING (
    client_id = (select auth.uid())
    OR coach_id = (select auth.uid())
    OR (
      coach_id IS NULL
      AND EXISTS (
        SELECT 1 FROM coach_client_assignments cca
        WHERE cca.coach_id = (select auth.uid())
          AND cca.client_id = swing_analyses.client_id
          AND cca.active = true
      )
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin')
  );

-- ============================================
-- swing_diagnoses
-- ============================================
DROP POLICY IF EXISTS "Users can read own swing diagnoses" ON swing_diagnoses;
CREATE POLICY "Users can read own swing diagnoses" ON swing_diagnoses FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own swing diagnoses" ON swing_diagnoses;
CREATE POLICY "Users can insert own swing diagnoses" ON swing_diagnoses FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Coaches can read assigned client diagnoses" ON swing_diagnoses;
CREATE POLICY "Coaches can read assigned client diagnoses" ON swing_diagnoses FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments
    WHERE coach_client_assignments.client_id = swing_diagnoses.user_id
      AND coach_client_assignments.coach_id = (select auth.uid())
      AND coach_client_assignments.active = true
  ));

-- ============================================
-- coach_client_assignments
-- ============================================
DROP POLICY IF EXISTS "Admin email access to assignments" ON coach_client_assignments;
CREATE POLICY "Admin email access to assignments" ON coach_client_assignments FOR ALL TO authenticated
  USING (((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com')
  WITH CHECK (((select auth.jwt()) ->> 'email') = 'brian@bowtaifitness.com');

DROP POLICY IF EXISTS "Coaches can view own assignments" ON coach_client_assignments;
CREATE POLICY "Coaches can view own assignments" ON coach_client_assignments FOR SELECT TO authenticated
  USING (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Clients can view own assignments" ON coach_client_assignments;
CREATE POLICY "Clients can view own assignments" ON coach_client_assignments FOR SELECT TO authenticated
  USING (client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their assignments" ON coach_client_assignments;
CREATE POLICY "Users can view their assignments" ON coach_client_assignments FOR SELECT TO authenticated
  USING (coach_id = (select auth.uid()) OR client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can insert assignments" ON coach_client_assignments;
CREATE POLICY "Coaches can insert assignments" ON coach_client_assignments FOR INSERT TO authenticated
  WITH CHECK (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Coaches can update assignments" ON coach_client_assignments;
CREATE POLICY "Coaches can update assignments" ON coach_client_assignments FOR UPDATE TO authenticated
  USING (coach_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update assignments" ON coach_client_assignments;
CREATE POLICY "Users can update assignments" ON coach_client_assignments FOR UPDATE TO authenticated
  USING (coach_id = (select auth.uid()) OR client_id = (select auth.uid()))
  WITH CHECK (coach_id = (select auth.uid()) OR client_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete assignments" ON coach_client_assignments;
CREATE POLICY "Users can delete assignments" ON coach_client_assignments FOR DELETE TO authenticated
  USING (coach_id = (select auth.uid()) OR client_id = (select auth.uid()));

-- ============================================
-- client_intake_forms
-- ============================================
DROP POLICY IF EXISTS "Clients can insert own intake form" ON client_intake_forms;
CREATE POLICY "Clients can insert own intake form" ON client_intake_forms FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can view own intake form" ON client_intake_forms;
CREATE POLICY "Clients can view own intake form" ON client_intake_forms FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Clients can update own intake form" ON client_intake_forms;
CREATE POLICY "Clients can update own intake form" ON client_intake_forms FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Coaches and admins can view all intake forms" ON client_intake_forms;
CREATE POLICY "Coaches and admins can view all intake forms" ON client_intake_forms FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = (select auth.uid()) AND profiles.role = ANY (ARRAY['coach', 'admin'])
  ));

-- ============================================
-- client_program_assignments
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all program assignments" ON client_program_assignments;
CREATE POLICY "Admins can manage all program assignments" ON client_program_assignments FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Clients can view own program assignments" ON client_program_assignments;
CREATE POLICY "Clients can view own program assignments" ON client_program_assignments FOR SELECT TO authenticated
  USING ((select auth.uid()) = client_id);

DROP POLICY IF EXISTS "Clients can self-assign programs" ON client_program_assignments;
CREATE POLICY "Clients can self-assign programs" ON client_program_assignments FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = client_id
    AND EXISTS (
      SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'client'
    )
  );

DROP POLICY IF EXISTS "Coaches can view their clients' program assignments" ON client_program_assignments;
CREATE POLICY "Coaches can view their clients' program assignments" ON client_program_assignments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments cca
    JOIN profiles p ON p.id = (select auth.uid())
    WHERE cca.coach_id = (select auth.uid())
      AND cca.client_id = client_program_assignments.client_id
      AND p.role = 'coach'
  ));

DROP POLICY IF EXISTS "Coaches can insert program assignments for their clients" ON client_program_assignments;
CREATE POLICY "Coaches can insert program assignments for their clients" ON client_program_assignments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_client_assignments cca
    JOIN profiles p ON p.id = (select auth.uid())
    WHERE cca.coach_id = (select auth.uid())
      AND cca.client_id = client_program_assignments.client_id
      AND p.role = 'coach'
  ));

DROP POLICY IF EXISTS "Coaches can update their clients' program assignments" ON client_program_assignments;
CREATE POLICY "Coaches can update their clients' program assignments" ON client_program_assignments FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM coach_client_assignments cca
    JOIN profiles p ON p.id = (select auth.uid())
    WHERE cca.coach_id = (select auth.uid())
      AND cca.client_id = client_program_assignments.client_id
      AND p.role = 'coach'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM coach_client_assignments cca
    JOIN profiles p ON p.id = (select auth.uid())
    WHERE cca.coach_id = (select auth.uid())
      AND cca.client_id = client_program_assignments.client_id
      AND p.role = 'coach'
  ));

-- ============================================
-- promotions
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all promotions" ON promotions;
CREATE POLICY "Admins can manage all promotions" ON promotions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

-- ============================================
-- user_promotions
-- ============================================
DROP POLICY IF EXISTS "Admins can view all user promotions" ON user_promotions;
CREATE POLICY "Admins can view all user promotions" ON user_promotions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = (select auth.uid()) AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Users can view their own promotions" ON user_promotions;
CREATE POLICY "Users can view their own promotions" ON user_promotions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================
-- stripe_customers
-- ============================================
DROP POLICY IF EXISTS "Users can view own stripe customer" ON stripe_customers;
CREATE POLICY "Users can view own stripe customer" ON stripe_customers FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own customer data" ON stripe_customers;
CREATE POLICY "Users can view their own customer data" ON stripe_customers FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Users can insert own stripe customer" ON stripe_customers;
CREATE POLICY "Users can insert own stripe customer" ON stripe_customers FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own stripe customer" ON stripe_customers;
CREATE POLICY "Users can update own stripe customer" ON stripe_customers FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================
-- stripe_subscriptions
-- ============================================
DROP POLICY IF EXISTS "Users can view own subscription" ON stripe_subscriptions;
CREATE POLICY "Users can view own subscription" ON stripe_subscriptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stripe_customers
    WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view their own subscription data" ON stripe_subscriptions;
CREATE POLICY "Users can view their own subscription data" ON stripe_subscriptions FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT stripe_customers.customer_id FROM stripe_customers
      WHERE stripe_customers.user_id = (select auth.uid()) AND stripe_customers.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Users can insert own subscription" ON stripe_subscriptions;
CREATE POLICY "Users can insert own subscription" ON stripe_subscriptions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM stripe_customers
    WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can update own subscription" ON stripe_subscriptions;
CREATE POLICY "Users can update own subscription" ON stripe_subscriptions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stripe_customers
    WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = (select auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM stripe_customers
    WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = (select auth.uid())
  ));

-- ============================================
-- stripe_orders
-- ============================================
DROP POLICY IF EXISTS "Users can view own orders" ON stripe_orders;
CREATE POLICY "Users can view own orders" ON stripe_orders FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM stripe_customers
    WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = (select auth.uid())
  ));

DROP POLICY IF EXISTS "Users can view their own order data" ON stripe_orders;
CREATE POLICY "Users can view their own order data" ON stripe_orders FOR SELECT TO authenticated
  USING (
    customer_id IN (
      SELECT stripe_customers.customer_id FROM stripe_customers
      WHERE stripe_customers.user_id = (select auth.uid()) AND stripe_customers.deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Users can insert own orders" ON stripe_orders;
CREATE POLICY "Users can insert own orders" ON stripe_orders FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM stripe_customers
    WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = (select auth.uid())
  ));