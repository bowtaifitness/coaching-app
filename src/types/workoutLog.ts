// ── Workout Logging Types ──────────────────────────────────────────────

export type WorkoutLogStatus = 'in_progress' | 'completed' | 'partial' | 'skipped';

export interface WorkoutLog {
  id: string;
  client_id: string;
  workout_id: string | null;
  program_assignment_id: string | null;
  status: WorkoutLogStatus;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  overall_notes: string | null;
  coach_feedback: string | null;
  feedback_at: string | null;
  feedback_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseLog {
  id: string;
  workout_log_id: string;
  exercise_id: string;
  workout_exercise_id: string | null;
  set_number: number;
  prescribed_reps: number | null;
  prescribed_weight: number | null;
  prescribed_duration: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  actual_duration: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── Aggregated / UI Types ──────────────────────────────────────────────

/** A single set's logged data in the UI (before persisting) */
export interface SetLogEntry {
  set_number: number;
  prescribed_reps: number | null;
  prescribed_weight: number | null;
  prescribed_duration: number | null;
  actual_reps: number | null;
  actual_weight: number | null;
  actual_duration: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string;
}

/** Per-exercise state in the logging UI */
export interface ExerciseLogState {
  exercise_id: string;
  workout_exercise_id: string;
  exercise_name: string;
  exercise_category: string;
  sets: SetLogEntry[];
  notes: string;
  all_sets_completed: boolean;
}

/** Full workout log data for the logging UI */
export interface WorkoutLogState {
  workout_log_id: string | null;   // null until first save
  workout_id: string;
  status: WorkoutLogStatus;
  started_at: string;
  duration_seconds: number;
  overall_notes: string;
  exercises: ExerciseLogState[];
}

// ── Coach View Types ───────────────────────────────────────────────────

export interface WorkoutLogSummary {
  id: string;
  workout_id: string | null;
  status: WorkoutLogStatus;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  overall_notes: string | null;
  coach_feedback: string | null;
  feedback_at: string | null;
  workout_title: string;
  workout_date: string;
  total_exercises: number;
  completed_exercises: number;
  total_sets: number;
  completed_sets: number;
}

export interface ClientLogOverview {
  client_id: string;
  client_name: string;
  total_workouts: number;
  completed_workouts: number;
  partial_workouts: number;
  missed_workouts: number;
  recent_logs: WorkoutLogSummary[];
}

// ── Exercise History Types ─────────────────────────────────────────────

export interface ExerciseHistoryEntry {
  date: string;
  workout_title: string;
  sets: Array<{
    set_number: number;
    actual_reps: number | null;
    actual_weight: number | null;
    actual_duration: number | null;
    rpe: number | null;
  }>;
  max_weight: number;
  total_volume: number;   // sum of (weight × reps) across sets
  avg_rpe: number | null;
}

export interface ExercisePersonalBest {
  exercise_id: string;
  exercise_name: string;
  max_weight: number;
  max_reps_single_set: number;
  max_volume_session: number;
  achieved_at: string;
}
