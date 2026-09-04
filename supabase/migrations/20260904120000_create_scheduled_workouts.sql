/*
  # Scheduled Workouts System

  Adds a `scheduled_workouts` table for calendar-based workout scheduling.
  This links workout templates to clients on specific dates, with status tracking.

  1. `scheduled_workouts` – one row per scheduled workout session
     - Links to workout_template, client, coach
     - scheduled_date, status (scheduled/completed/skipped/in_progress)
     - Optional notes, source tracking for copies

  2. Security
     - RLS enabled
     - Coaches can CRUD scheduled workouts for their clients
     - Clients can view and update status on their own
     - Admins have full access
*/

-- =============================================================================
-- scheduled_workouts
-- =============================================================================
CREATE TABLE IF NOT EXISTS scheduled_workouts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_template_id uuid REFERENCES workout_templates(id) ON DELETE SET NULL,
  client_id           uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coach_id            uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date      date NOT NULL,
  status              text NOT NULL DEFAULT 'scheduled'
                        CHECK (status IN ('scheduled', 'in_progress', 'completed', 'skipped')),
  title               text NOT NULL,
  notes               text,
  copied_from_id      uuid REFERENCES scheduled_workouts(id) ON DELETE SET NULL,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scheduled_workouts_client        ON scheduled_workouts(client_id);
CREATE INDEX idx_scheduled_workouts_coach         ON scheduled_workouts(coach_id);
CREATE INDEX idx_scheduled_workouts_date          ON scheduled_workouts(scheduled_date);
CREATE INDEX idx_scheduled_workouts_client_date   ON scheduled_workouts(client_id, scheduled_date);
CREATE INDEX idx_scheduled_workouts_template      ON scheduled_workouts(workout_template_id);
CREATE INDEX idx_scheduled_workouts_status        ON scheduled_workouts(status);

-- =============================================================================
-- scheduled_workout_exercises  (snapshot of exercises at schedule time)
-- =============================================================================
CREATE TABLE IF NOT EXISTS scheduled_workout_exercises (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_workout_id  uuid NOT NULL REFERENCES scheduled_workouts(id) ON DELETE CASCADE,
  exercise_id           uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  sets                  integer,
  reps                  integer,
  weight                numeric(8,2),
  duration              integer,
  notes                 text,
  order_index           integer NOT NULL DEFAULT 0,
  superset_group        integer,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_swe_scheduled_workout ON scheduled_workout_exercises(scheduled_workout_id);
CREATE INDEX idx_swe_exercise          ON scheduled_workout_exercises(exercise_id);

-- =============================================================================
-- RLS Policies
-- =============================================================================

ALTER TABLE scheduled_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_workout_exercises ENABLE ROW LEVEL SECURITY;

-- ---- scheduled_workouts ----

-- Coaches can manage scheduled workouts they created
CREATE POLICY "Coaches can view their scheduled workouts"
  ON scheduled_workouts FOR SELECT TO authenticated
  USING (
    auth.uid() = coach_id
    OR auth.uid() = client_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can insert scheduled workouts"
  ON scheduled_workouts FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = coach_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can update scheduled workouts"
  ON scheduled_workouts FOR UPDATE TO authenticated
  USING (
    auth.uid() = coach_id
    OR auth.uid() = client_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = coach_id
    OR auth.uid() = client_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Coaches can delete scheduled workouts"
  ON scheduled_workouts FOR DELETE TO authenticated
  USING (
    auth.uid() = coach_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- scheduled_workout_exercises ----

CREATE POLICY "Users can view scheduled workout exercises"
  ON scheduled_workout_exercises FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid() OR sw.client_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can insert scheduled workout exercises"
  ON scheduled_workout_exercises FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can update scheduled workout exercises"
  ON scheduled_workout_exercises FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Coaches can delete scheduled workout exercises"
  ON scheduled_workout_exercises FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_workouts sw
      WHERE sw.id = scheduled_workout_exercises.scheduled_workout_id
        AND (sw.coach_id = auth.uid()
             OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- =============================================================================
-- Updated_at trigger
-- =============================================================================
CREATE TRIGGER scheduled_workouts_updated_at
  BEFORE UPDATE ON scheduled_workouts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE scheduled_workouts IS 'Calendar-based workout scheduling linking templates to clients on specific dates';
COMMENT ON TABLE scheduled_workout_exercises IS 'Snapshot of exercises for a scheduled workout, copied from template at schedule time';
