/*
  # Workout Logging System

  Create the core tables for client workout logging:

  1. `workout_logs` – one row per client-workout session
     - Links to client, workout, and optionally program assignment
     - Stores completion status, duration, date, and overall notes
     - coach_feedback field for coach comments

  2. `exercise_logs` – per-set data for each exercise within a workout log
     - Stores prescribed vs actual values (reps, weight, duration)
     - RPE (rate of perceived exertion), notes, completion flag

  3. Security
     - RLS enabled on both tables
     - Clients can CRUD their own logs
     - Coaches can read their clients' logs and leave feedback
     - Admins have full access
*/

-- =============================================================================
-- workout_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS workout_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workout_id      uuid REFERENCES workouts(id) ON DELETE SET NULL,
  program_assignment_id uuid REFERENCES client_program_assignments(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'in_progress'
                    CHECK (status IN ('in_progress', 'completed', 'partial', 'skipped')),
  started_at      timestamptz DEFAULT now(),
  completed_at    timestamptz,
  duration_seconds integer,          -- total workout duration
  overall_notes   text,              -- client's overall workout notes
  coach_feedback  text,              -- coach's feedback on this session
  feedback_at     timestamptz,       -- when coach left feedback
  feedback_by     uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_workout_logs_client      ON workout_logs(client_id);
CREATE INDEX idx_workout_logs_workout     ON workout_logs(workout_id);
CREATE INDEX idx_workout_logs_status      ON workout_logs(status);
CREATE INDEX idx_workout_logs_started_at  ON workout_logs(started_at DESC);
CREATE INDEX idx_workout_logs_client_date ON workout_logs(client_id, started_at DESC);

-- =============================================================================
-- exercise_logs
-- =============================================================================
CREATE TABLE IF NOT EXISTS exercise_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_log_id    uuid NOT NULL REFERENCES workout_logs(id) ON DELETE CASCADE,
  exercise_id       uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  workout_exercise_id uuid REFERENCES workout_exercises(id) ON DELETE SET NULL,
  set_number        integer NOT NULL DEFAULT 1,
  -- Prescribed values (snapshot from the workout plan)
  prescribed_reps   integer,
  prescribed_weight numeric(8,2),
  prescribed_duration integer,       -- seconds
  -- Actual logged values
  actual_reps       integer,
  actual_weight     numeric(8,2),
  actual_duration   integer,         -- seconds
  rpe               integer CHECK (rpe IS NULL OR (rpe >= 1 AND rpe <= 10)),
  completed         boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_exercise_logs_workout_log  ON exercise_logs(workout_log_id);
CREATE INDEX idx_exercise_logs_exercise     ON exercise_logs(exercise_id);
CREATE INDEX idx_exercise_logs_we           ON exercise_logs(workout_exercise_id);
CREATE INDEX idx_exercise_logs_exercise_date ON exercise_logs(exercise_id, created_at DESC);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_logs ENABLE ROW LEVEL SECURITY;

-- ---- workout_logs ----

-- Clients: full CRUD on own rows
CREATE POLICY "Clients can view own workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (auth.uid() = client_id);

CREATE POLICY "Clients can insert own workout logs"
  ON workout_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update own workout logs"
  ON workout_logs FOR UPDATE TO authenticated
  USING (auth.uid() = client_id)
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can delete own workout logs"
  ON workout_logs FOR DELETE TO authenticated
  USING (auth.uid() = client_id);

-- Coaches: read their clients' logs
CREATE POLICY "Coaches can view their clients workout logs"
  ON workout_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workout_logs.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

-- Coaches: update (for feedback)
CREATE POLICY "Coaches can update their clients workout logs"
  ON workout_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workout_logs.client_id
        AND p.role IN ('coach', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coach_client_assignments cca
      JOIN profiles p ON p.id = auth.uid()
      WHERE cca.coach_id = auth.uid()
        AND cca.client_id = workout_logs.client_id
        AND p.role IN ('coach', 'admin')
    )
  );

-- Admins: full access
CREATE POLICY "Admins full access to workout logs"
  ON workout_logs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- exercise_logs ----

-- Clients: full CRUD on rows that belong to their workout_logs
CREATE POLICY "Clients can view own exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = exercise_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can insert own exercise logs"
  ON exercise_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = exercise_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update own exercise logs"
  ON exercise_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = exercise_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = exercise_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can delete own exercise logs"
  ON exercise_logs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      WHERE wl.id = exercise_logs.workout_log_id
        AND wl.client_id = auth.uid()
    )
  );

-- Coaches: read their clients' exercise logs
CREATE POLICY "Coaches can view their clients exercise logs"
  ON exercise_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_logs wl
      JOIN coach_client_assignments cca ON cca.client_id = wl.client_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE wl.id = exercise_logs.workout_log_id
        AND cca.coach_id = auth.uid()
        AND p.role IN ('coach', 'admin')
    )
  );

-- Admins: full access
CREATE POLICY "Admins full access to exercise logs"
  ON exercise_logs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================================================
-- Updated_at trigger
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workout_logs_updated_at
  BEFORE UPDATE ON workout_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER exercise_logs_updated_at
  BEFORE UPDATE ON exercise_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE workout_logs IS 'Per-session workout log for a client, tracking completion status, duration, and coach feedback';
COMMENT ON TABLE exercise_logs IS 'Per-set exercise log within a workout session, tracking prescribed vs actual performance';
