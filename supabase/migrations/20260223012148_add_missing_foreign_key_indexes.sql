/*
  # Add Missing Foreign Key Indexes

  1. Problem
    - Multiple tables have foreign keys without covering indexes
    - This causes suboptimal query performance on joins and cascading operations

  2. Indexes Added
    - `client_program_assignments.assigned_by`
    - `clients.created_by`
    - `coach_client_assignments.assigned_by`
    - `exercises.created_by`
    - `messages.receiver_id`
    - `messages.sender_id`
    - `performance_metrics.client_id`
    - `program_week_exercises.exercise_id`
    - `program_weeks.program_day_id`
    - `promotions.created_by`
    - `swing_analyses.client_id`
    - `swing_analyses.coach_id`
    - `template_exercises.exercise_id`
    - `template_exercises.template_id`
    - `workout_programs.warmup_template_id`
    - `workout_templates.created_by`
    - `workouts.template_id`

  3. Notes
    - All indexes use IF NOT EXISTS to prevent errors if they already exist
    - These indexes improve JOIN performance and foreign key constraint checks
*/

CREATE INDEX IF NOT EXISTS idx_client_program_assignments_assigned_by
  ON public.client_program_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_clients_created_by
  ON public.clients (created_by);

CREATE INDEX IF NOT EXISTS idx_coach_client_assignments_assigned_by
  ON public.coach_client_assignments (assigned_by);

CREATE INDEX IF NOT EXISTS idx_exercises_created_by
  ON public.exercises (created_by);

CREATE INDEX IF NOT EXISTS idx_messages_receiver_id
  ON public.messages (receiver_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id
  ON public.messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_client_id
  ON public.performance_metrics (client_id);

CREATE INDEX IF NOT EXISTS idx_program_week_exercises_exercise_id
  ON public.program_week_exercises (exercise_id);

CREATE INDEX IF NOT EXISTS idx_program_weeks_program_day_id
  ON public.program_weeks (program_day_id);

CREATE INDEX IF NOT EXISTS idx_promotions_created_by
  ON public.promotions (created_by);

CREATE INDEX IF NOT EXISTS idx_swing_analyses_client_id
  ON public.swing_analyses (client_id);

CREATE INDEX IF NOT EXISTS idx_swing_analyses_coach_id
  ON public.swing_analyses (coach_id);

CREATE INDEX IF NOT EXISTS idx_template_exercises_exercise_id
  ON public.template_exercises (exercise_id);

CREATE INDEX IF NOT EXISTS idx_template_exercises_template_id
  ON public.template_exercises (template_id);

CREATE INDEX IF NOT EXISTS idx_workout_programs_warmup_template_id
  ON public.workout_programs (warmup_template_id);

CREATE INDEX IF NOT EXISTS idx_workout_templates_created_by
  ON public.workout_templates (created_by);

CREATE INDEX IF NOT EXISTS idx_workouts_template_id
  ON public.workouts (template_id);