/*
  # Fix uid() Function References in Policies

  1. Overview
    - Replace all incorrect `uid()` function calls with correct `auth.uid()`
    - Drop and recreate all RLS policies across all tables
    - Ensure proper authentication checks in all policies

  2. Tables Updated
    - profiles
    - exercises
    - workouts
    - workout_exercises
    - performance_metrics
    - messages
    - swing_analyses
    - clients
    - workout_templates
    - template_exercises
    - workout_programs
    - program_days
    - program_weeks
    - coach_client_assignments
    - stripe_customers
    - stripe_subscriptions
    - stripe_orders

  3. Security
    - All policies now use auth.uid() correctly
    - Proper authentication checks maintained
    - RLS remains enabled on all tables
*/

-- Drop all existing policies

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Coaches can view assigned clients" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Coaches can view clients" ON profiles;
DROP POLICY IF EXISTS "Clients can view their coach" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- exercises
DROP POLICY IF EXISTS "Authenticated users can view exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can create exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can update own exercises" ON exercises;
DROP POLICY IF EXISTS "Coaches can delete own exercises" ON exercises;

-- workouts
DROP POLICY IF EXISTS "Coaches can view own workouts" ON workouts;
DROP POLICY IF EXISTS "Clients can view own workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches can create workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches can update own workouts" ON workouts;
DROP POLICY IF EXISTS "Coaches can delete own workouts" ON workouts;
DROP POLICY IF EXISTS "Clients can update own workouts" ON workouts;

-- workout_exercises
DROP POLICY IF EXISTS "Users can view workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can manage workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Clients can view own workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can insert workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can update workout exercises" ON workout_exercises;
DROP POLICY IF EXISTS "Coaches can delete workout exercises" ON workout_exercises;

-- performance_metrics
DROP POLICY IF EXISTS "Clients can view own metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can view client metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can create client metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can update client metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Clients can view metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can insert metrics" ON performance_metrics;
DROP POLICY IF EXISTS "Coaches can update metrics" ON performance_metrics;

-- messages
DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can update received messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

-- swing_analyses
DROP POLICY IF EXISTS "Clients can view own analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can view client analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can create analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can update analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Clients can insert analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can insert analyses" ON swing_analyses;
DROP POLICY IF EXISTS "Coaches can update client analyses" ON swing_analyses;

-- clients
DROP POLICY IF EXISTS "Coaches can view own clients" ON clients;
DROP POLICY IF EXISTS "Coaches can create clients" ON clients;
DROP POLICY IF EXISTS "Coaches can update own clients" ON clients;
DROP POLICY IF EXISTS "Coaches can insert clients" ON clients;
DROP POLICY IF EXISTS "Coaches can update clients" ON clients;

-- workout_templates
DROP POLICY IF EXISTS "Coaches can view own templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can create templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can update own templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can delete own templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can insert templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can update templates" ON workout_templates;
DROP POLICY IF EXISTS "Coaches can delete templates" ON workout_templates;

-- template_exercises
DROP POLICY IF EXISTS "Coaches can view template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can manage template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can insert template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can update template exercises" ON template_exercises;
DROP POLICY IF EXISTS "Coaches can delete template exercises" ON template_exercises;

-- workout_programs
DROP POLICY IF EXISTS "Coaches can view own programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can create programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can update own programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can delete own programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can insert programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can update programs" ON workout_programs;
DROP POLICY IF EXISTS "Coaches can delete programs" ON workout_programs;

-- program_days
DROP POLICY IF EXISTS "Coaches can view program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can manage program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can insert program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can update program days" ON program_days;
DROP POLICY IF EXISTS "Coaches can delete program days" ON program_days;

-- program_weeks
DROP POLICY IF EXISTS "Coaches can view program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can manage program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can insert program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can update program weeks" ON program_weeks;
DROP POLICY IF EXISTS "Coaches can delete program weeks" ON program_weeks;

-- coach_client_assignments
DROP POLICY IF EXISTS "Coaches can view own assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Clients can view own assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can create assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can update own assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can insert assignments" ON coach_client_assignments;
DROP POLICY IF EXISTS "Coaches can update assignments" ON coach_client_assignments;

-- stripe_customers
DROP POLICY IF EXISTS "Users can view own stripe customer" ON stripe_customers;
DROP POLICY IF EXISTS "Users can insert own stripe customer" ON stripe_customers;
DROP POLICY IF EXISTS "Users can update own stripe customer" ON stripe_customers;

-- stripe_subscriptions
DROP POLICY IF EXISTS "Users can view own subscription" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscription" ON stripe_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscription" ON stripe_subscriptions;

-- stripe_orders
DROP POLICY IF EXISTS "Users can view own orders" ON stripe_orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON stripe_orders;

-- Create new policies with correct auth.uid()

-- profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Coaches can view assigned clients"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = profiles.id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Clients can view their coach"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.client_id = auth.uid()
      AND coach_client_assignments.coach_id = profiles.id
      AND coach_client_assignments.active = true
    )
  );

-- exercises policies
CREATE POLICY "Authenticated users can view exercises"
  ON exercises FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Coaches can create exercises"
  ON exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'coach'
    )
  );

CREATE POLICY "Coaches can update own exercises"
  ON exercises FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete own exercises"
  ON exercises FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- workouts policies
CREATE POLICY "Coaches can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own workouts"
  ON workouts FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can create workouts"
  ON workouts FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own workouts"
  ON workouts FOR DELETE
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can update own workouts"
  ON workouts FOR UPDATE
  TO authenticated
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

-- workout_exercises policies
CREATE POLICY "Coaches can view workout exercises"
  ON workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

CREATE POLICY "Clients can view own workout exercises"
  ON workout_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.client_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert workout exercises"
  ON workout_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can update workout exercises"
  ON workout_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete workout exercises"
  ON workout_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workouts
      WHERE workouts.id = workout_exercises.workout_id
      AND workouts.coach_id = auth.uid()
    )
  );

-- performance_metrics policies
CREATE POLICY "Clients can view own metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can view client metrics"
  ON performance_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Coaches can insert metrics"
  ON performance_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Coaches can update metrics"
  ON performance_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = performance_metrics.client_id
      AND coach_client_assignments.active = true
    )
  );

-- messages policies
CREATE POLICY "Users can view own messages"
  ON messages FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received messages"
  ON messages FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid())
  WITH CHECK (receiver_id = auth.uid());

-- swing_analyses policies
CREATE POLICY "Clients can view own analyses"
  ON swing_analyses FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can view client analyses"
  ON swing_analyses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Clients can insert analyses"
  ON swing_analyses FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Coaches can insert analyses"
  ON swing_analyses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  );

CREATE POLICY "Coaches can update client analyses"
  ON swing_analyses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments
      WHERE coach_client_assignments.coach_id = auth.uid()
      AND coach_client_assignments.client_id = swing_analyses.client_id
      AND coach_client_assignments.active = true
    )
  );

-- clients policies
CREATE POLICY "Coaches can view own clients"
  ON clients FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can insert clients"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can update clients"
  ON clients FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- workout_templates policies
CREATE POLICY "Coaches can view own templates"
  ON workout_templates FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can insert templates"
  ON workout_templates FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can update templates"
  ON workout_templates FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete templates"
  ON workout_templates FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- template_exercises policies
CREATE POLICY "Coaches can view template exercises"
  ON template_exercises FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert template exercises"
  ON template_exercises FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update template exercises"
  ON template_exercises FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete template exercises"
  ON template_exercises FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_templates
      WHERE workout_templates.id = template_exercises.template_id
      AND workout_templates.created_by = auth.uid()
    )
  );

-- workout_programs policies
CREATE POLICY "Coaches can view own programs"
  ON workout_programs FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Coaches can insert programs"
  ON workout_programs FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can update programs"
  ON workout_programs FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Coaches can delete programs"
  ON workout_programs FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- program_days policies
CREATE POLICY "Coaches can view program days"
  ON program_days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert program days"
  ON program_days FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update program days"
  ON program_days FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete program days"
  ON program_days FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_days.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

-- program_weeks policies
CREATE POLICY "Coaches can view program weeks"
  ON program_weeks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can insert program weeks"
  ON program_weeks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can update program weeks"
  ON program_weeks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

CREATE POLICY "Coaches can delete program weeks"
  ON program_weeks FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_programs
      WHERE workout_programs.id = program_weeks.program_id
      AND workout_programs.created_by = auth.uid()
    )
  );

-- coach_client_assignments policies
CREATE POLICY "Coaches can view own assignments"
  ON coach_client_assignments FOR SELECT
  TO authenticated
  USING (coach_id = auth.uid());

CREATE POLICY "Clients can view own assignments"
  ON coach_client_assignments FOR SELECT
  TO authenticated
  USING (client_id = auth.uid());

CREATE POLICY "Coaches can insert assignments"
  ON coach_client_assignments FOR INSERT
  TO authenticated
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update assignments"
  ON coach_client_assignments FOR UPDATE
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- stripe_customers policies
CREATE POLICY "Users can view own stripe customer"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own stripe customer"
  ON stripe_customers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own stripe customer"
  ON stripe_customers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- stripe_subscriptions policies
CREATE POLICY "Users can view own subscription"
  ON stripe_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own subscription"
  ON stripe_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own subscription"
  ON stripe_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_subscriptions.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

-- stripe_orders policies
CREATE POLICY "Users can view own orders"
  ON stripe_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own orders"
  ON stripe_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stripe_customers
      WHERE stripe_customers.customer_id = stripe_orders.customer_id
      AND stripe_customers.user_id = auth.uid()
    )
  );