import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useFloatingVideo } from '../../contexts/FloatingVideoContext';
import { useSyncWorkoutLog } from '../../hooks/useSyncWorkoutLog';
import ExerciseHistoryModal from './ExerciseHistoryModal';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  Clock,
  Dumbbell,
  Save,
  Loader,
  AlertCircle,
  Target,
  RotateCcw,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Timer,
  Award,
  TrendingUp,
  History,
  Zap,
} from 'lucide-react';

interface WorkoutExercise {
  id: string;
  exercise_id: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  notes?: string;
  order_index?: number;
  exercise: {
    id: string;
    name: string;
    category: string;
    description: string;
    instructions: string[];
    video_url?: string;
  };
}

interface Workout {
  id: string;
  title: string;
  description?: string;
  scheduled_date: string;
  completed: boolean;
  notes?: string;
  workout_exercises: WorkoutExercise[];
}

interface ExerciseProgress {
  completed: boolean;
  actualSets?: number;
  actualReps?: number;
  actualWeight?: number;
  actualDuration?: number;
  notes?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  setProgress?: Array<{
    completed: boolean;
    reps?: number;
    weight?: number;
    duration?: number;
    rpe?: number;
  }>;
  savedAt?: string;
  swing_fault_reason?: string;
  swing_date?: string;
}

type SwingFaultMap = { [workoutExerciseId: string]: { reason: string; date: string } };

const PHASE_DETAILS: Record<1 | 2 | 3 | 4, { label: string; name: string; duration: string }> = {
  1: { label: 'Phase I', name: 'Mobility & Reset', duration: '10-15 Mins' },
  2: { label: 'Phase II', name: 'Speed & Power', duration: '10 Mins' },
  3: { label: 'Phase III', name: 'Primary Strength', duration: '20 Mins' },
  4: { label: 'Phase IV', name: 'Rotary Stability & Core', duration: '10 Mins' },
};

const CATEGORY_TO_PHASE: Record<string, 1 | 2 | 3 | 4> = {
  'Mobility/Reset': 1,
  'Speed/Power': 2,
  'Primary Strength': 3,
  'Rotary/Core': 4,
};


function extractPhaseTag(rawNotes?: string): string | null {
  if (!rawNotes) return null;
  try {
    const parsed = JSON.parse(rawNotes);
    if (parsed && typeof parsed === 'object') {
      if (typeof (parsed as Record<string, unknown>).phaseTag === 'string') {
        return (parsed as Record<string, string>).phaseTag;
      }
      if (typeof (parsed as Record<string, unknown>).notes === 'string') {
        const inner = (parsed as Record<string, string>).notes;
        if (/Phase\s+\d/i.test(inner)) return inner;
      }
    }
  } catch {
    // not JSON; the raw text may itself be the phase tag
    if (/Phase\s+\d/i.test(rawNotes)) return rawNotes;
  }
  return null;
}

function getPhaseNumber(we: WorkoutExercise): 1 | 2 | 3 | 4 | null {
  const tag = extractPhaseTag(we.notes);
  if (tag) {
    const m = tag.match(/Phase\s+(\d)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n === 1 || n === 2 || n === 3 || n === 4) return n;
    }
  }
  return CATEGORY_TO_PHASE[we.exercise.category] ?? null;
}

type ExerciseProgressMap = { [workoutExerciseId: string]: ExerciseProgress };

interface WorkoutExecutionViewProps {
  workoutId: string;
  onBack: () => void;
  viewOnly?: boolean;
}

const WorkoutExecutionView: React.FC<WorkoutExecutionViewProps> = ({ workoutId, onBack, viewOnly = false }) => {
  const { user } = useAuth();
  const { openVideo } = useFloatingVideo();
  const { syncToWorkoutLog } = useSyncWorkoutLog();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [exerciseProgress, setExerciseProgress] = useState<ExerciseProgressMap>({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [timer, setTimer] = useState(0);
  const [restTimer, setRestTimer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showLastSession, setShowLastSession] = useState(false);
  const [swingFaultTips, setSwingFaultTips] = useState<SwingFaultMap>({});
  const [lastSession, setLastSession] = useState<{
    workout_date: string;
    workout_title: string;
    sets: number;
    reps: number;
    weight: number;
    notes?: string;
  } | null>(null);
  const [loadingLastSession, setLoadingLastSession] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const restTimerRef = useRef<NodeJS.Timeout | null>(null);
  const exerciseCardRef = useRef<HTMLDivElement | null>(null);

  const sendCompletionNotification = (userId: string, title: string, scheduledDate: string) => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-workout-notifications`;
    fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        notification_type: 'completed',
        workout_details: { title, scheduled_date: scheduledDate },
      }),
    }).catch((err) => console.error('Notification send failed:', err));
  };

  useEffect(() => {
    fetchWorkout();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (restTimerRef.current) clearInterval(restTimerRef.current);
      autoSaveOnExit();
    };
  }, [workoutId]);

  // Fetch last completed session for the currently selected exercise
  useEffect(() => {
    const fetchLastSession = async () => {
      if (!workout) return;
      const current = workout.workout_exercises[currentExerciseIndex];
      if (!current) {
        setLastSession(null);
        return;
      }
      try {
        setLoadingLastSession(true);
        const { data: exerciseData } = await supabase
          .from('exercises')
          .select('name')
          .eq('id', current.exercise_id)
          .maybeSingle();
        if (!exerciseData) {
          setLastSession(null);
          return;
        }
        const { data } = await supabase
          .from('workout_exercises')
          .select(`
            sets, reps, weight, notes,
            exercises!inner(name),
            workouts!inner(scheduled_date, title, completed, client_id, id)
          `)
          .eq('exercises.name', exerciseData.name)
          .eq('workouts.client_id', (workout as any).client_id)
          .eq('workouts.completed', true)
          .neq('workouts.id', workout.id);

        if (!data || data.length === 0) {
          setLastSession(null);
          return;
        }
        const sorted = [...data].sort((a: any, b: any) =>
          new Date(b.workouts.scheduled_date).getTime() - new Date(a.workouts.scheduled_date).getTime()
        );
        const item: any = sorted[0];
        let actualSets = item.sets;
        let actualReps = item.reps;
        let actualWeight = item.weight;
        let plainNotes = '';
        if (item.notes) {
          try {
            const parsed = JSON.parse(item.notes);
            if (parsed && typeof parsed === 'object') {
              if (Array.isArray(parsed.setProgress)) {
                const completed = parsed.setProgress.filter((s: any) => s && (s.reps > 0 || s.weight > 0));
                if (completed.length > 0) {
                  actualSets = completed.length;
                  actualReps = Math.round(completed.reduce((sum: number, s: any) => sum + (s.reps || 0), 0) / completed.length);
                  actualWeight = Math.max(...completed.map((s: any) => s.weight || 0));
                }
              }
              if (parsed.actualSets !== undefined) actualSets = parsed.actualSets;
              if (parsed.actualReps !== undefined) actualReps = parsed.actualReps;
              if (parsed.actualWeight !== undefined) actualWeight = parsed.actualWeight;
              if (parsed.notes) plainNotes = parsed.notes;
            }
          } catch {
            plainNotes = item.notes;
          }
        }
        setLastSession({
          workout_date: item.workouts.scheduled_date,
          workout_title: item.workouts.title,
          sets: actualSets || 0,
          reps: actualReps || 0,
          weight: actualWeight || 0,
          notes: plainNotes,
        });
      } catch (err) {
        console.error('Error loading last session:', err);
        setLastSession(null);
      } finally {
        setLoadingLastSession(false);
      }
    };
    fetchLastSession();
  }, [currentExerciseIndex, workout?.id]);

  // Scroll to top when exercise changes
  useEffect(() => {
    if (exerciseCardRef.current) {
      exerciseCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentExerciseIndex]);

  const autoSaveOnExit = async () => {
    if (viewOnly) return;
    if (!workout || Object.keys(exerciseProgress).length === 0) return;

    const hasAnyProgress = Object.values(exerciseProgress).some(progress =>
      progress.completed ||
      progress.actualSets ||
      progress.actualReps ||
      progress.actualWeight ||
      progress.actualDuration ||
      progress.notes ||
      progress.difficulty ||
      (progress.setProgress && progress.setProgress.some(set => set && (set.reps || set.weight)))
    );

    if (hasAnyProgress) {
      console.log('Auto-saving progress on exit...');
      await saveProgressSilent();
    }
  };

  const saveProgressSilent = async () => {
    try {
      if (!workout) {
        console.log('saveProgressSilent: No workout data available');
        return;
      }

      console.log('saveProgressSilent: Starting auto-save...');
      console.log('saveProgressSilent: Current exercise progress state:', exerciseProgress);

      const exercisesToProcess = [...workout.workout_exercises].sort((a, b) =>
        (a.order_index ?? 0) - (b.order_index ?? 0)
      );

      console.log(`saveProgressSilent: Processing ${exercisesToProcess.length} exercises`);

      const savePromises = exercisesToProcess.map(async (we) => {
        console.log(`saveProgressSilent: Checking exercise ${we.exercise.name} (ID: ${we.id})`);
        const progress = exerciseProgress[we.id];

        if (!progress) {
          console.log(`saveProgressSilent: No progress found for workout_exercise ID ${we.id}`);
          return;
        }

        const hasProgressData = progress.completed ||
          progress.actualSets ||
          progress.actualReps ||
          progress.actualWeight ||
          progress.actualDuration ||
          progress.notes ||
          progress.difficulty ||
          (progress.setProgress && progress.setProgress.some(set => set && ((set.reps !== null && set.reps !== undefined) || (set.weight !== null && set.weight !== undefined))));

        if (!hasProgressData) {
          console.log(`saveProgressSilent: No meaningful progress data for ${we.exercise.name}, skipping`);
          return;
        }

        console.log(`saveProgressSilent: Saving progress for ${we.exercise.name}:`, progress);

        const faultTip = swingFaultTips[we.id];
        const phaseTag = extractPhaseTag(we.notes);
        const progressToSave: Record<string, unknown> = {
          completed: progress.completed || false,
          actualSets: progress.actualSets,
          actualReps: progress.actualReps,
          actualWeight: progress.actualWeight,
          actualDuration: progress.actualDuration,
          notes: progress.notes,
          difficulty: progress.difficulty,
          setProgress: progress.setProgress || [],
          savedAt: new Date().toISOString(),
        };
        if (phaseTag) {
          progressToSave.phaseTag = phaseTag;
        }

        if (faultTip) {
          progressToSave.swing_fault_reason = faultTip.reason;
          progressToSave.swing_date = faultTip.date;
        }

        const progressJson = JSON.stringify(progressToSave);

        const { error } = await supabase
          .from('workout_exercises')
          .update({ notes: progressJson })
          .eq('id', we.id);

        if (error) {
          console.error(`saveProgressSilent: ERROR saving ${we.exercise.name}:`, error);
        } else {
          console.log(`saveProgressSilent: SUCCESS saving ${we.exercise.name}`);
        }
      });

      await Promise.all(savePromises);

      const allExercisesCompleted = exercisesToProcess.every(we => {
        const progress = exerciseProgress[we.id];
        return progress?.completed || false;
      });

      if (allExercisesCompleted && !workout.completed) {
        await supabase
          .from('workouts')
          .update({ completed: true })
          .eq('id', workoutId);
      }

      console.log('saveProgressSilent: Auto-save completed successfully');
    } catch (err) {
      console.error('saveProgressSilent: ERROR during auto-save:', err);
      console.error('saveProgressSilent: Error details:', JSON.stringify(err, null, 2));
    }
  };

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: workoutData, error } = await supabase
        .from('workouts')
        .select(`
          id,
          title,
          description,
          scheduled_date,
          completed,
          notes,
          client_id,
          workout_exercises(
            id,
            exercise_id,
            sets,
            reps,
            weight,
            duration,
            notes,
            order_index,
            exercise:exercises(
              id,
              name,
              category,
              description,
              instructions,
              video_url
            )
          )
        `)
        .eq('id', workoutId)
        .single();

      if (error) throw error;
      if (!workoutData) throw new Error('Workout not found');

      const sortedExercises = [...workoutData.workout_exercises].sort((a, b) =>
        (a.order_index || 0) - (b.order_index || 0)
      );

      setWorkout({ ...workoutData, workout_exercises: sortedExercises });

      const progressData: ExerciseProgressMap = {};
      const faultTips: SwingFaultMap = {};

      sortedExercises.forEach((we, index) => {
        if (we.notes) {
          try {
            const savedData = JSON.parse(we.notes);
            if (savedData && typeof savedData === 'object') {
              if (savedData.swing_fault_reason) {
                faultTips[we.id] = {
                  reason: savedData.swing_fault_reason,
                  date: savedData.swing_date || '',
                };
              }

              if ('completed' in savedData || 'setProgress' in savedData) {
                progressData[we.id] = savedData;
                if (savedData.swing_fault_reason) {
                  faultTips[we.id] = {
                    reason: savedData.swing_fault_reason,
                    date: savedData.swing_date || '',
                  };
                }
              } else if (savedData.swing_fault_reason && !('completed' in savedData)) {
                progressData[we.id] = {
                  completed: false,
                  swing_fault_reason: savedData.swing_fault_reason,
                  swing_date: savedData.swing_date,
                  setProgress: we.sets ? Array.from({ length: we.sets }, () => ({
                    reps: we.reps || null,
                    weight: null,
                    completed: false
                  })) : []
                };
              } else {
                progressData[we.id] = savedData;
              }
            }
          } catch {
            progressData[we.id] = {
              completed: false,
              notes: we.notes,
              setProgress: we.sets ? Array.from({ length: we.sets }, () => ({
                reps: we.reps || null,
                weight: null,
                completed: false
              })) : []
            };
          }
        } else {
          progressData[we.id] = {
            completed: false,
            setProgress: we.sets ? Array.from({ length: we.sets }, () => ({
              reps: we.reps || null,
              weight: null,
              completed: false
            })) : []
          };
        }
      });

      setSwingFaultTips(faultTips);
      setExerciseProgress(progressData);

      const firstIncompleteIndex = sortedExercises.findIndex(
        (we) => !progressData[we.id]?.completed
      );
      if (firstIncompleteIndex > 0) {
        setCurrentExerciseIndex(firstIncompleteIndex);
      }

    } catch (err) {
      console.error('Error fetching workout:', err);
      setError('Failed to load workout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateExerciseProgress = (workoutExerciseId: string, updates: Partial<ExerciseProgress>) => {
    setExerciseProgress(prev => ({
      ...prev,
      [workoutExerciseId]: {
        ...prev[workoutExerciseId],
        ...updates,
        savedAt: new Date().toISOString()
      }
    }));
  };

  const updateSetProgress = (workoutExerciseId: string, setIndex: number, field: 'completed' | 'reps' | 'weight' | 'duration' | 'rpe', value: boolean | number | null) => {
    const currentProgress = exerciseProgress[workoutExerciseId] || {};
    const setProgress = [...(currentProgress.setProgress || [])];

    // Ensure the setProgress array is long enough
    while (setProgress.length <= setIndex) {
      setProgress.push({ reps: null, weight: null, completed: false });
    }

    // Update the specific field
    setProgress[setIndex] = {
      ...setProgress[setIndex],
      [field]: value
    };

    console.log(`Updated set ${setIndex + 1} for workout_exercise ${workoutExerciseId}:`);
    console.log(`  - Set data:`, setProgress[setIndex]);
    console.log(`  - Full setProgress array:`, setProgress);

    updateExerciseProgress(workoutExerciseId, {
      setProgress: setProgress
    });
  };

  const saveProgress = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      if (!workout) return;

      console.log('Saving workout progress...');
      console.log('Exercise progress data:', exerciseProgress);
      console.log('Workout exercises:', workout.workout_exercises);

      // Save progress for each exercise by updating the notes field in workout_exercises
      // Process exercises in their original order_index order to maintain consistency
      const exercisesToProcess = [...workout.workout_exercises].sort((a, b) => 
        (a.order_index ?? 0) - (b.order_index ?? 0)
      );
      
      const savePromises = exercisesToProcess.map(async (we) => {
        // KEY CHANGE: Use we.id (workout_exercise.id) instead of we.exercise_id
        const progress = exerciseProgress[we.id];
        console.log(`Processing exercise ${(we.order_index ?? 0) + 1}. ${we.exercise.name}:`);
        console.log(`  - Exercise ID: ${we.exercise_id}`);
        console.log(`  - Workout Exercise ID (KEY): ${we.id}`);
        console.log(`  - Order Index: ${we.order_index ?? 0}`);
        console.log(`  - Progress data:`, progress);

        if (!progress) {
          console.log(`No progress data for workout_exercise ${we.id}, skipping save`);
          return;
        }

        // Only save if there's actual progress data
        const hasProgressData = progress.completed ||
          progress.actualSets ||
          progress.actualReps ||
          progress.actualWeight ||
          progress.actualDuration ||
          progress.notes ||
          progress.difficulty ||
          (progress.setProgress && progress.setProgress.some(set => set && (set.reps !== null && set.reps !== undefined) || (set.weight !== null && set.weight !== undefined)));

        if (!hasProgressData) {
          console.log(`No meaningful progress data for ${we.exercise.name}, skipping save`);
          return;
        }

        const faultTip = swingFaultTips[we.id];
        const phaseTag = extractPhaseTag(we.notes);
        const progressToSave: Record<string, unknown> = {
          completed: progress.completed || false,
          actualSets: progress.actualSets,
          actualReps: progress.actualReps,
          actualWeight: progress.actualWeight,
          actualDuration: progress.actualDuration,
          notes: progress.notes,
          difficulty: progress.difficulty,
          setProgress: progress.setProgress || [],
          savedAt: new Date().toISOString(),
        };
        if (phaseTag) {
          progressToSave.phaseTag = phaseTag;
        }

        if (faultTip) {
          progressToSave.swing_fault_reason = faultTip.reason;
          progressToSave.swing_date = faultTip.date;
        }

        const progressJson = JSON.stringify(progressToSave);

        const { error } = await supabase
          .from('workout_exercises')
          .update({ notes: progressJson })
          .eq('id', we.id);

        if (error) {
          console.error(`Error saving progress for exercise ${we.id}:`, error);
          throw new Error(`Failed to save progress: ${error.message || 'Unknown error'}`);
        }

        console.log(`Successfully saved progress for exercise ${we.exercise.name}`);
      });
      
      // Wait for all saves to complete
      await Promise.all(savePromises);

      // Check if all exercises are completed
      const allExercisesCompleted = exercisesToProcess.every(we => {
        const progress = exerciseProgress[we.id];
        return progress?.completed || false;
      });

      // If all exercises are completed, mark the workout as completed
      if (allExercisesCompleted && !workout.completed) {
        console.log('All exercises completed, marking workout as complete');
        const { error: workoutError } = await supabase
          .from('workouts')
          .update({ completed: true })
          .eq('id', workoutId);

        if (workoutError) {
          console.error('Error marking workout as completed:', workoutError);
          throw workoutError;
        }

        setWorkout(prev => prev ? { ...prev, completed: true } : null);
        console.log('Workout marked as complete successfully');

        if (user) {
          sendCompletionNotification(user.id, workout.title, workout.scheduled_date);
        }
      }

      console.log('Progress saved successfully');

      // Sync to new workout_logs / exercise_logs tables (non-blocking)
      if (user && workout) {
        syncToWorkoutLog({
          workoutId: workout.id,
          clientId: user.id,
          workoutExercises: workout.workout_exercises.map((we) => ({
            id: we.id,
            exercise_id: we.exercise_id,
            sets: we.sets ?? null,
            reps: we.reps ?? null,
            weight: we.weight ?? null,
            duration: we.duration ?? null,
          })),
          progressMap: exerciseProgress,
          allCompleted: allExercisesCompleted,
        }).catch((err) => console.error('Workout log sync error:', err));
      }

      setSuccess('Progress saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Error saving progress:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('Detailed error:', JSON.stringify(err, null, 2));
      setError(`Failed to save progress: ${errorMessage}. Check browser console for details.`);
    } finally {
      setSaving(false);
    }
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  };

  const pauseTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIsPlaying(false);
  };

  const resetTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimer(0);
    setIsPlaying(false);
  };

  const startRestTimer = (seconds: number = 60) => {
    if (restTimerRef.current) clearInterval(restTimerRef.current);
    setRestTimer(seconds);
    restTimerRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (prev <= 1) {
          if (restTimerRef.current) clearInterval(restTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCompletionPercentage = () => {
    if (!workout) return 0;
    const completedExercises = workout.workout_exercises.filter(we =>
      exerciseProgress[we.id]?.completed
    ).length;
    return Math.round((completedExercises / workout.workout_exercises.length) * 100);
  };

  const getCurrentExercise = () => {
    if (!workout || currentExerciseIndex >= workout.workout_exercises.length) return null;
    return workout.workout_exercises[currentExerciseIndex];
  };

  const nextExercise = () => {
    if (workout && currentExerciseIndex < workout.workout_exercises.length - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setShowLastSession(false);
      resetTimer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const previousExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(currentExerciseIndex - 1);
      setShowLastSession(false);
      resetTimer();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading workout...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <h3 className="text-lg font-medium text-red-800">Error Loading Workout</h3>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={() => {
              void autoSaveOnExit();
              onBack();
            }}
            className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Workout Not Found</h3>
          <p className="text-gray-600 mb-4">The requested workout could not be found.</p>
          <button
            onClick={() => {
              void autoSaveOnExit();
              onBack();
            }}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Workouts
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = getCurrentExercise();
  const currentProgress = currentExercise ? exerciseProgress[currentExercise.id] || {} : {};

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <button
          onClick={() => {
            void autoSaveOnExit();
            onBack();
          }}
          className="flex items-center px-3 py-2.5 min-h-[44px] text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mb-3 sm:mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Workouts
        </button>

        {viewOnly && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
            <Eye className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-900">Preview only</p>
              <p className="text-xs text-amber-800 mt-0.5">
                This workout is scheduled for a future week. You can view the exercises and plan ahead, but you can't log progress or start it until its assigned week.
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-1">{workout.title}</h1>
            <p className="text-sm sm:text-base text-gray-600">
              {new Date(workout.scheduled_date).toLocaleDateString()} • {workout.workout_exercises.length} exercises
            </p>
          </div>
          <div className="flex items-center sm:flex-col sm:text-right gap-2 sm:gap-0">
            <div className="text-xl sm:text-2xl font-bold text-green-600">{getCompletionPercentage()}%</div>
            <div className="text-sm text-gray-600">Complete</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
          <div
            className="bg-green-500 h-3 rounded-full transition-all duration-300"
            style={{ width: `${getCompletionPercentage()}%` }}
          ></div>
        </div>

        {/* Exercise Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Today's Workout</h3>
          {(() => {
            const groups: Array<{ phase: 1 | 2 | 3 | 4 | null; items: Array<{ ex: WorkoutExercise; index: number }> }> = [];
            workout.workout_exercises.forEach((ex, index) => {
              const phase = getPhaseNumber(ex);
              const last = groups[groups.length - 1];
              if (last && last.phase === phase) {
                last.items.push({ ex, index });
              } else {
                groups.push({ phase, items: [{ ex, index }] });
              }
            });

            return (
              <div className="space-y-4">
                {groups.map((group, groupIdx) => {
                  const meta = group.phase ? PHASE_DETAILS[group.phase] : null;
                  return (
                    <div key={groupIdx}>
                      {meta && (
                        <div className="flex items-baseline justify-between mb-2 pb-1.5 border-b border-gray-100">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-teal-600 shrink-0">
                              {meta.label}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 truncate">
                              {meta.name}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 shrink-0 ml-2">{meta.duration}</span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {group.items.map(({ ex, index }) => {
                          const progress = exerciseProgress[ex.id] || {};
                          const isCompleted = progress.completed;
                          const isCurrent = index === currentExerciseIndex;

                          return (
                            <div
                              key={ex.id}
                              onClick={() => setCurrentExerciseIndex(index)}
                              className={`flex items-center justify-between p-2 rounded-lg transition-all cursor-pointer ${
                                isCurrent
                                  ? 'bg-green-50 border-2 border-green-500'
                                  : isCompleted
                                  ? 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                                  : 'border border-gray-200 hover:border-green-300 hover:bg-green-50'
                              }`}
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${
                                  isCompleted
                                    ? 'bg-green-500 text-white'
                                    : isCurrent
                                    ? 'bg-green-500 text-white'
                                    : 'bg-gray-200 text-gray-600'
                                }`}>
                                  {isCompleted ? <CheckCircle className="h-3 w-3" /> : index + 1}
                                </div>
                                <div className="min-w-0">
                                  <p className={`text-sm font-medium ${isCurrent ? 'text-green-900' : 'text-gray-900'} truncate`}>
                                    {ex.exercise.name}
                                  </p>
                                  {swingFaultTips[ex.id] && (
                                    <p className="text-xs text-amber-600 truncate">
                                      {swingFaultTips[ex.id].reason}
                                    </p>
                                  )}
                                </div>
                              </div>
                              {isCurrent && (
                                <div className="text-xs font-medium text-green-600 shrink-0">Current</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
              <p className="text-green-800">{success}</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
              <p className="text-red-800">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Current Exercise */}
        <div className="lg:col-span-2">
          {currentExercise && (
            <div ref={exerciseCardRef} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">{currentExercise.exercise.name}</h2>
                    <button
                      onClick={() => setShowLastSession(!showLastSession)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-lg transition-colors text-xs font-semibold ${showLastSession ? 'bg-green-100 text-green-800 border-green-300' : 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'}`}
                      title="View exercise history and progress"
                    >
                      <History className="h-4 w-4" />
                      History
                    </button>
                  </div>
                  <p className="text-sm sm:text-base text-gray-600 capitalize">{currentExercise.exercise.category}</p>
                </div>
                <div className="flex items-center sm:flex-col sm:text-right gap-2 sm:gap-0">
                  <div className="text-sm sm:text-base font-semibold text-gray-900">
                    Exercise {currentExerciseIndex + 1} of {workout.workout_exercises.length}
                  </div>
                  {currentProgress.completed && (
                    <div className="flex items-center text-green-600">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <span className="text-xs sm:text-sm font-medium">Completed</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Last Session Panel - only shown when History button is toggled */}
              {showLastSession && (
                loadingLastSession ? (
                  <div className="mb-4 sm:mb-6 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 flex items-center gap-2">
                    <Loader className="h-3.5 w-3.5 animate-spin" />
                    Loading previous session...
                  </div>
                ) : lastSession ? (
                  <div className="mb-4 sm:mb-6 px-4 py-3 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-700" />
                        <p className="text-xs sm:text-sm font-semibold text-gray-900">Last Session</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-gray-600">
                          {new Date(lastSession.workout_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </p>
                        <button
                          onClick={() => setShowHistoryModal(true)}
                          className="text-[11px] text-green-700 font-medium hover:underline"
                        >
                          View All
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white rounded p-2 text-center border border-green-100">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Sets</p>
                        <p className="text-base font-bold text-gray-900">{lastSession.sets || '—'}</p>
                      </div>
                      <div className="bg-white rounded p-2 text-center border border-green-100">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Reps</p>
                        <p className="text-base font-bold text-gray-900">{lastSession.reps || '—'}</p>
                      </div>
                      <div className="bg-white rounded p-2 text-center border border-green-100">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide">Weight</p>
                        <p className="text-base font-bold text-gray-900">{lastSession.weight ? `${lastSession.weight} lb` : '—'}</p>
                      </div>
                    </div>
                    {lastSession.notes && (
                      <p className="mt-2 text-[11px] text-gray-600 italic truncate" title={lastSession.notes}>
                        Note: {lastSession.notes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-4 sm:mb-6 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500">
                    No previous sessions logged for this exercise yet.
                  </div>
                )
              )}

              {/* Swing Fault Tip */}
              {swingFaultTips[currentExercise.id] && (
                <div className="mb-4 sm:mb-6 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">
                    <span className="font-semibold">{swingFaultTips[currentExercise.id].reason}</span>
                    {swingFaultTips[currentExercise.id].date && (
                      <span className="text-amber-600"> detected on {swingFaultTips[currentExercise.id].date}</span>
                    )}
                  </p>
                </div>
              )}

              {/* Exercise Description */}
              <div className="mb-4 sm:mb-6">
                <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">{currentExercise.exercise.description}</p>

                {/* Instructions */}
                {currentExercise.exercise.instructions && currentExercise.exercise.instructions.length > 0 && (
                  <div className="mb-3 sm:mb-4">
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900 mb-2">Instructions:</h4>
                    <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm text-gray-700">
                      {currentExercise.exercise.instructions.map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                )}


                {/* Video */}
                {currentExercise.exercise.video_url && (
                  <div className="mb-4">
                    <div className="rounded-lg overflow-hidden shadow-lg">
                      {currentExercise.exercise.video_url.includes('youtube.com') || currentExercise.exercise.video_url.includes('youtu.be') ? (
                        (() => {
                          const url = currentExercise.exercise.video_url;
                          let videoId = '';
                          if (url.includes('youtube.com/watch?v=')) {
                            videoId = url.split('watch?v=')[1]?.split('&')[0] ?? '';
                          } else if (url.includes('youtu.be/')) {
                            videoId = url.split('youtu.be/')[1]?.split('?')[0] ?? '';
                          } else if (url.includes('youtube.com/embed/')) {
                            videoId = url.split('youtube.com/embed/')[1]?.split('?')[0] ?? '';
                          }
                          const handlePlayVideo = () => {
                            openVideo(videoId, currentExercise.exercise.name);
                          };
                          return (
                            <div className="aspect-video bg-black relative">
                              <div
                                className="relative w-full h-full cursor-pointer group"
                                onClick={handlePlayVideo}
                              >
                                <img
                                  src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                  alt="Video thumbnail"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                                  }}
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-30 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                                  <div className="bg-red-600 rounded-full p-4 shadow-lg group-hover:scale-110 transition-transform">
                                    <Play className="h-8 w-8 text-white ml-1" fill="white" />
                                  </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                                  <p className="text-white text-sm font-medium">Tap to play video demo</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="aspect-video bg-black">
                          <video
                            controls
                            className="w-full h-full object-contain"
                            src={currentExercise.exercise.video_url}
                            poster={currentExercise.exercise.video_url + '#t=0.1'}
                          >
                            Your browser does not support the video tag.
                          </video>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Set Tracking */}
              {currentExercise.sets && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 mb-3">Set Progress</h4>
                  <div className="space-y-3">
                    {Array.from({ length: currentExercise.sets || 0 }, (_, index) => {
                      const setData = currentProgress.setProgress?.[index] || { reps: null, weight: null };
                      const isDurationBased = currentExercise.duration && currentExercise.duration > 0;
                      const isRepBased = currentExercise.reps && currentExercise.reps > 0;

                      return (
                        <div
                          key={index}
                          className="p-4 rounded-lg border border-gray-300 bg-white"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h5 className="font-semibold text-gray-900">Set {index + 1}</h5>
                            <div className="text-sm text-gray-600">
                              {isDurationBased ? (
                                <>Target: {currentExercise.duration}s hold</>
                              ) : (
                                <>
                                  Target: {currentExercise.reps || 0} reps
                                  {currentExercise.weight && ` @ ${currentExercise.weight} lbs`}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {isDurationBased ? (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Actual Duration (seconds)</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={setData.reps ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updateSetProgress(currentExercise.id, index, 'reps', null);
                                    } else {
                                      const value = parseInt(e.target.value);
                                      updateSetProgress(currentExercise.id, index, 'reps', isNaN(value) ? null : value);
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                  min="0"
                                  placeholder={`${currentExercise.duration || 0}`}
                                />
                              </div>
                            ) : (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Actual Reps</label>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={setData.reps ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updateSetProgress(currentExercise.id, index, 'reps', null);
                                    } else {
                                      const value = parseInt(e.target.value);
                                      updateSetProgress(currentExercise.id, index, 'reps', isNaN(value) ? null : value);
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                  min="0"
                                  placeholder={`${currentExercise.reps || 0}`}
                                />
                              </div>
                            )}

                            {!isDurationBased && (
                              <div>
                                <label className="block text-xs font-medium text-gray-600 mb-1">Actual Weight (lbs)</label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  value={setData.weight ?? ''}
                                  onChange={(e) => {
                                    if (e.target.value === '') {
                                      updateSetProgress(currentExercise.id, index, 'weight', null);
                                    } else {
                                      const value = parseFloat(e.target.value);
                                      updateSetProgress(currentExercise.id, index, 'weight', isNaN(value) ? null : value);
                                    }
                                  }}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                  min="0"
                                  step="0.5"
                                  placeholder={currentExercise.weight ? `${currentExercise.weight}` : "Weight"}
                                />
                              </div>
                            )}
                            <div>
                              <label className="block text-xs font-medium text-gray-600 mb-1">RPE (1-10)</label>
                              <select
                                value={(setData as any).rpe ?? ''}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? null : parseInt(e.target.value);
                                  updateSetProgress(currentExercise.id, index, 'rpe' as any, v);
                                }}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 bg-white min-h-[36px]"
                              >
                                <option value="">—</option>
                                {[1,2,3,4,5,6,7,8,9,10].map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Timer */}
              <div className="mb-4 sm:mb-6 bg-gray-50 rounded-lg p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm sm:text-base font-semibold text-gray-900">Exercise Timer</h4>
                    <div className="text-xl sm:text-2xl font-mono font-bold text-gray-900">{formatTime(timer)}</div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={isPlaying ? pauseTimer : startTimer}
                      className={`p-3 rounded-lg transition-colors ${
                        isPlaying 
                          ? 'bg-orange-500 text-white hover:bg-orange-600' 
                          : 'bg-green-500 text-white hover:bg-green-600'
                      }`}
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="p-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      <RotateCcw className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Rest Timer */}
                {restTimer > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Rest Time</span>
                      <span className="text-lg font-mono font-bold text-orange-600">{formatTime(restTimer)}</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => startRestTimer(60)}
                    className="flex-1 px-3 py-2.5 min-h-[44px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    1 min rest
                  </button>
                  <button
                    onClick={() => startRestTimer(90)}
                    className="flex-1 px-3 py-2.5 min-h-[44px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    90 sec rest
                  </button>
                  <button
                    onClick={() => startRestTimer(120)}
                    className="flex-1 px-3 py-2.5 min-h-[44px] bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    2 min rest
                  </button>
                </div>
              </div>


              {/* Navigation */}
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={previousExercise}
                  disabled={currentExerciseIndex === 0}
                  className="flex items-center px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Previous
                </button>

                <button
                  onClick={() => {
                    updateExerciseProgress(currentExercise.id, { completed: true });
                    if (currentExerciseIndex < workout.workout_exercises.length - 1) {
                      nextExercise();
                    }
                  }}
                  className="px-5 py-3 min-h-[44px] bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  {currentExerciseIndex === workout.workout_exercises.length - 1 ? 'Finish Exercise' : 'Complete & Next'}
                </button>

                <button
                  onClick={nextExercise}
                  disabled={currentExerciseIndex === workout.workout_exercises.length - 1}
                  className="flex items-center px-4 py-3 min-h-[44px] border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Workout Overview */}
        <div className="space-y-6">
          {/* Workout Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Workout Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Progress</span>
                <span className="font-medium text-gray-900">{getCompletionPercentage()}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Time Elapsed</span>
                <span className="font-medium text-gray-900">{formatTime(timer)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Exercises Done</span>
                <span className="font-medium text-gray-900">
                  {workout.workout_exercises.filter(we => exerciseProgress[we.id]?.completed).length} / {workout.workout_exercises.length}
                </span>
              </div>
            </div>

            {/* Save Progress Button */}
            {!viewOnly && (
            <button
              onClick={async () => {
                await saveProgress();
                onBack();
              }}
              disabled={saving}
              className="w-full mt-6 flex items-center justify-center px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Saving Progress...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Progress
                </>
              )}
            </button>
            )}

            {/* Complete Workout Button */}
            {!viewOnly && getCompletionPercentage() === 100 && (
              <button
                onClick={async () => {
                  setSaving(true);
                  await saveProgress();
                  setSaving(false);
                  setTimeout(() => {
                    onBack();
                  }, 500);
                }}
                disabled={saving}
                className="w-full mt-4 flex items-center justify-center px-6 py-3 min-h-[48px] bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Completing Workout...
                  </>
                ) : (
                  <>
                    <Award className="h-4 w-4 mr-2" />
                    Complete Workout
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Exercise History Modal */}
      {showHistoryModal && currentExercise && workout && (
        <ExerciseHistoryModal
          exerciseId={currentExercise.exercise_id}
          exerciseName={currentExercise.exercise.name}
          clientId={workout.client_id}
          onClose={() => setShowHistoryModal(false)}
        />
      )}
    </div>
  );
};

export default WorkoutExecutionView;