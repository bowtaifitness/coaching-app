import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import WorkoutDayEditor from './WorkoutDayEditor';
import WorkoutExecutionView from './WorkoutExecutionView';
import { ArrowLeft, Calendar, Users, Dumbbell, CreditCard as Edit3, Eye, CheckCircle, Clock, Target, BarChart3, Loader, Plus, Settings, User, ChevronRight, Award, TrendingUp, Play } from 'lucide-react';

interface WorkoutProgram {
  id: string;
  title: string;
  description?: string;
  duration_weeks: number;
  days_per_week: number;
  warmup_template_id?: string;
  created_by: string;
  created_at: string;
  program_days: Array<{
    id: string;
    day_name: string;
    day_order: number;
  }>;
  warmup_template?: {
    id: string;
    title: string;
  };
}

interface ProgramWeek {
  weekNumber: number;
  days: Array<{
    dayId: string;
    dayName: string;
    dayOrder: number;
    templateId?: string;
    templateTitle?: string;
    exerciseCount: number;
    isCustomized: boolean;
    workoutId?: string;
    isCompleted?: boolean;
    completionPercentage?: number;
  }>;
}

interface ProgramDetailViewProps {
  programId: string;
  onBack: () => void;
}

const ProgramDetailView: React.FC<ProgramDetailViewProps> = ({ programId, onBack }) => {
  const { user } = useAuth();
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [programWeeks, setProgramWeeks] = useState<ProgramWeek[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDay, setSelectedDay] = useState<{
    dayId: string;
    dayName: string;
    weekNumber: number;
    templateId?: string;
  } | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState<{
    dayId: string;
    dayName: string;
    weekNumber: number;
    templateId: string;
    templateTitle: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [executingWorkoutId, setExecutingWorkoutId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [workoutCompletionData, setWorkoutCompletionData] = useState<Record<string, { completed: boolean; percentage: number; workoutId: string }>>({});

  useEffect(() => {
    if (user) {
      setIsClient(user.role === 'client');
    }
    fetchProgramDetails();
  }, [programId, user]);

  const fetchProgramDetails = async () => {
    try {
      setLoading(true);
      setError('');

      // Check Supabase connection first
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing. Please check your environment variables.');
      }

      // Test connection with a simple query first
      const { data: connectionTest, error: connectionError } = await supabase
        .from('workout_programs')
        .select('id')
        .limit(1);

      if (connectionError) {
        console.error('Supabase connection test failed:', connectionError);
        throw new Error(`Database connection failed: ${connectionError.message}`);
      }

      // Fetch program basic info and days
      const { data: programData, error: programError } = await supabase
        .from('workout_programs')
        .select(`
          id,
          title,
          description,
          duration_weeks,
          days_per_week,
          warmup_template_id,
          created_by,
          created_at,
          warmup_template:workout_templates!warmup_template_id(id, title),
          program_days(
            id,
            day_name,
            day_order
          )
        `)
        .eq('id', programId)
        .single();

      if (programError) {
        console.error('Program fetch error:', programError);
        throw new Error(`Failed to fetch program: ${programError.message}`);
      }
      
      if (!programData) {
        throw new Error('Program not found');
      }
      
      setProgram(programData);

      // Fetch all program weeks data
      const { data: weeksData, error: weeksError } = await supabase
        .from('program_weeks')
        .select('week_number, program_day_id, template_id')
        .eq('program_id', programId)
        .order('week_number', { ascending: true });

      if (weeksError) {
        console.error('Weeks data fetch error:', weeksError);
        throw new Error(`Failed to fetch weeks data: ${weeksError.message}`);
      }

      console.log('Weeks data fetched:', weeksData);

      // Fetch template data and exercise counts separately
      const templateIds = weeksData?.map(w => w.template_id).filter(Boolean) || [];
      const uniqueTemplateIds = [...new Set(templateIds)];

      const templateData: Record<string, { title: string; exerciseCount: number }> = {};

      if (uniqueTemplateIds.length > 0) {
        // Fetch template info
        const { data: templates } = await supabase
          .from('workout_templates')
          .select('id, title')
          .in('id', uniqueTemplateIds);

        console.log('Templates fetched:', templates);

        // Fetch exercise counts
        const { data: exerciseCounts } = await supabase
          .from('template_exercises')
          .select('template_id')
          .in('template_id', uniqueTemplateIds);

        console.log('Exercise counts fetched:', exerciseCounts);

        // Build template data map
        templates?.forEach(template => {
          const count = exerciseCounts?.filter(ex => ex.template_id === template.id).length || 0;
          templateData[template.id] = {
            title: template.title,
            exerciseCount: count
          };
        });
      }

      console.log('Template data map:', templateData);
      console.log('Program days:', programData.program_days);

      // Organize weeks data
      const weeks: ProgramWeek[] = [];

      for (let weekNum = 1; weekNum <= programData.duration_weeks; weekNum++) {
        const weekDays = programData.program_days.map(day => {
          const weekData = weeksData?.find(w =>
            w.week_number === weekNum && w.program_day_id === day.id
          );

          console.log(`Week ${weekNum}, Day ${day.day_name} (${day.id}):`, {
            weekData,
            templateId: weekData?.template_id,
            template: weekData?.template_id ? templateData[weekData.template_id] : null
          });

          const templateId = weekData?.template_id;
          const template = templateId ? templateData[templateId] : null;

          return {
            dayId: day.id,
            dayName: day.day_name,
            dayOrder: day.day_order,
            templateId: templateId,
            templateTitle: template?.title,
            exerciseCount: template?.exerciseCount || 0,
            isCustomized: !!weekData?.template_id
          };
        });

        weeks.push({
          weekNumber: weekNum,
          days: weekDays.sort((a, b) => a.dayOrder - b.dayOrder)
        });
      }

      console.log('Organized weeks:', weeks);
      setProgramWeeks(weeks);

      // Fetch workout completion data for clients
      if (user?.role === 'client') {
        await fetchWorkoutCompletionData(programData, weeks, user.id);
      }

    } catch (err) {
      console.error('Error fetching program details:', err);
      setError(err instanceof Error ? err.message : 'Failed to load program details');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkoutCompletionData = async (programData: WorkoutProgram, weeks: ProgramWeek[], clientId: string) => {
    try {
      // Get all workout titles for this program
      const workoutTitles = weeks.flatMap(week =>
        week.days.map(day => `${programData.title} - Week ${week.weekNumber} - ${day.dayName}`)
      );

      console.log('ProgramDetailView: Fetching completion data for titles:', workoutTitles);

      // Fetch all workouts for this client that match these titles
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select('id, title, completed, workout_exercises(id, notes)')
        .eq('client_id', clientId)
        .in('title', workoutTitles);

      console.log('ProgramDetailView: Workouts fetched:', workouts);

      if (error) {
        console.error('Error fetching workout completion data:', error);
        return;
      }

      // Build completion data map
      const completionMap: Record<string, { completed: boolean; percentage: number; workoutId: string }> = {};

      workouts?.forEach(workout => {
        const totalExercises = workout.workout_exercises?.length || 0;
        let completedExercises = 0;

        // Parse notes field to check if exercises are completed
        workout.workout_exercises?.forEach((ex: any) => {
          if (ex.notes) {
            try {
              const progress = JSON.parse(ex.notes);
              if (progress.completed || (progress.setProgress && progress.setProgress.some((set: any) => set?.reps || set?.weight))) {
                completedExercises++;
              }
            } catch (e) {
              // Notes is not JSON, skip
            }
          }
        });

        const percentage = totalExercises > 0
          ? Math.round((completedExercises / totalExercises) * 100)
          : 0;

        completionMap[workout.title] = {
          completed: workout.completed,
          percentage,
          workoutId: workout.id
        };
      });

      console.log('ProgramDetailView: Completion map built:', completionMap);
      setWorkoutCompletionData(completionMap);
    } catch (error) {
      console.error('Exception fetching workout completion data:', error);
    }
  };

  const createWorkoutFromTemplate = async (dayId: string, dayName: string, weekNumber: number, templateId?: string) => {
    if (!user) return null;

    try {
      let programWeekData = null;
      let effectiveTemplateId = templateId;

      // Handle warmup specially - it doesn't have a program_day_id
      if (dayId !== 'warmup') {
        // First, fetch the exercises for this program week
        const { data, error: weekError } = await supabase
          .from('program_weeks')
          .select('id, template_id')
          .eq('program_day_id', dayId)
          .eq('week_number', weekNumber)
          .maybeSingle();

        if (weekError) {
          console.error('Error fetching program week:', weekError);
          return null;
        }

        programWeekData = data;
        effectiveTemplateId = data?.template_id || templateId;
      }

      const workoutTitle = `${program?.title} - Week ${weekNumber} - ${dayName}`;
      const scheduledDate = new Date().toISOString().split('T')[0];

      // Check if workout already exists for this program/week/day/client
      // Get the most recent one if multiple exist
      const { data: existingWorkouts, error: searchError } = await supabase
        .from('workouts')
        .select('id, created_at')
        .eq('client_id', user.id)
        .eq('title', workoutTitle)
        .eq('scheduled_date', scheduledDate)
        .order('created_at', { ascending: false })
        .limit(1);

      if (searchError) {
        console.error('Error searching for existing workout:', searchError);
      }

      // If workout already exists, return its ID
      if (existingWorkouts && existingWorkouts.length > 0) {
        console.log('Found existing workout, reusing:', existingWorkouts[0].id);
        return existingWorkouts[0].id;
      }

      // Create new workout instance only if it doesn't exist
      console.log('Creating new workout for:', workoutTitle);
      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({
          title: workoutTitle,
          description: `Week ${weekNumber} workout from ${program?.title}`,
          client_id: user.id,
          coach_id: program?.created_by,
          scheduled_date: scheduledDate,
          completed: false,
          template_id: effectiveTemplateId
        })
        .select()
        .single();

      if (workoutError) {
        console.error('Error creating workout:', workoutError);
        alert('Failed to create workout. Please try again.');
        return null;
      }

      // Copy exercises from template or program week
      if (effectiveTemplateId) {
        const { data: templateExercises, error: exercisesError } = await supabase
          .from('template_exercises')
          .select('*')
          .eq('template_id', effectiveTemplateId)
          .order('order_index');

        if (!exercisesError && templateExercises && templateExercises.length > 0) {
          const workoutExercises = templateExercises.map(ex => ({
            workout_id: workout.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            notes: ex.notes,
            order_index: ex.order_index
          }));

          await supabase
            .from('workout_exercises')
            .insert(workoutExercises);
        }
      } else if (programWeekData?.id) {
        // Copy from program week exercises
        const { data: weekExercises, error: exercisesError } = await supabase
          .from('program_week_exercises')
          .select('*')
          .eq('program_week_id', programWeekData.id)
          .order('order_index');

        if (!exercisesError && weekExercises && weekExercises.length > 0) {
          const workoutExercises = weekExercises.map(ex => ({
            workout_id: workout.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            duration: ex.duration,
            notes: ex.notes,
            order_index: ex.order_index
          }));

          await supabase
            .from('workout_exercises')
            .insert(workoutExercises);
        }
      }

      return workout.id;
    } catch (error) {
      console.error('Exception creating workout:', error);
      return null;
    }
  };

  const handleDayClick = async (dayId: string, dayName: string, weekNumber: number, templateId?: string) => {
    if (isClient) {
      // For clients, check if workout already exists
      const workoutTitle = `${program?.title} - Week ${weekNumber} - ${dayName}`;
      const existingWorkoutData = workoutCompletionData[workoutTitle];

      if (existingWorkoutData?.workoutId) {
        // Use existing workout
        setExecutingWorkoutId(existingWorkoutData.workoutId);
      } else {
        // Create a new workout instance and execute it
        const workoutId = await createWorkoutFromTemplate(dayId, dayName, weekNumber, templateId);
        if (workoutId) {
          setExecutingWorkoutId(workoutId);
        }
      }
    } else {
      // For coaches, open editor
      setSelectedDay({
        dayId,
        dayName,
        weekNumber,
        templateId
      });
    }
  };

  const handleDayEditComplete = () => {
    setSelectedDay(null);
    fetchProgramDetails(); // Refresh the program data
  };

  const getProgramStats = () => {
    const totalDays = programWeeks.reduce((sum, week) => sum + week.days.length, 0);
    const customizedDays = programWeeks.reduce((sum, week) => 
      sum + week.days.filter(day => day.isCustomized).length, 0
    );
    const totalExercises = programWeeks.reduce((sum, week) => 
      sum + week.days.reduce((daySum, day) => daySum + day.exerciseCount, 0), 0
    );

    return { totalDays, customizedDays, totalExercises };
  };

  // If executing a workout (for clients)
  if (executingWorkoutId) {
    return (
      <WorkoutExecutionView
        workoutId={executingWorkoutId}
        onBack={() => {
          setExecutingWorkoutId(null);
          fetchProgramDetails(); // Refresh to show updated stats
        }}
      />
    );
  }

  // If editing a workout day (for coaches)
  if (selectedDay) {
    return (
      <WorkoutDayEditor
        programId={programId}
        dayId={selectedDay.dayId}
        dayName={selectedDay.dayName}
        weekNumber={selectedDay.weekNumber}
        templateId={selectedDay.templateId}
        onBack={handleDayEditComplete}
        onSave={handleDayEditComplete}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading program details...</p>
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
            <h3 className="text-lg font-medium text-red-800">Error Loading Program</h3>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programs
          </button>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Program Not Found</h3>
          <p className="text-gray-600 mb-4">The requested program could not be found.</p>
          <button
            onClick={onBack}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Programs
          </button>
        </div>
      </div>
    );
  }

  const stats = getProgramStats();

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Programs
        </button>

        <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-2">{program.title}</h1>

        {program.description && (
          <p className="text-sm text-gray-600 mb-4">{program.description}</p>
        )}

        {/* Program Overview Stats */}
        <div className="flex flex-wrap gap-2 sm:gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6 flex-1 basis-[calc(50%-0.25rem)] min-w-0">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-blue-500 rounded-lg p-1.5 sm:p-3 mb-1.5 sm:mb-2">
                <Calendar className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Duration</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">{program.duration_weeks}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6 flex-1 basis-[calc(50%-0.25rem)] min-w-0">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-green-500 rounded-lg p-1.5 sm:p-3 mb-1.5 sm:mb-2">
                <Target className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Days/Wk</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">{program.days_per_week}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6 flex-1 basis-[calc(50%-0.25rem)] min-w-0">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-purple-500 rounded-lg p-1.5 sm:p-3 mb-1.5 sm:mb-2">
                <Dumbbell className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Exercises</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">{stats.totalExercises}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6 flex-1 basis-[calc(50%-0.25rem)] min-w-0">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="bg-orange-500 rounded-lg p-1.5 sm:p-3 mb-1.5 sm:mb-2">
                <Edit3 className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-gray-600 mb-0.5 sm:mb-1">Custom</p>
              <p className="text-base sm:text-2xl font-bold text-gray-900">{stats.customizedDays}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Week Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Program Structure</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Week:</span>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {Array.from({ length: program.duration_weeks }, (_, i) => i + 1).map(week => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Week Progress Indicator */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Program Progress</span>
            <span className="text-sm text-gray-600">
              Week {selectedWeek} of {program.duration_weeks}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(selectedWeek / program.duration_weeks) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Days Grid for Selected Week */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {/* Warm-up Template Card (if assigned) */}
          {program?.warmup_template && (
            <div
              onClick={() => handleDayClick('warmup', 'Warm-up', selectedWeek, program.warmup_template_id)}
              className="p-6 rounded-xl border-2 border-orange-500 bg-orange-50 cursor-pointer transition-all hover:shadow-md hover:border-orange-600"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Warm-up</h4>
                  <p className="text-sm text-gray-600">Every Day</p>
                </div>
                <div className="p-2 rounded-lg bg-orange-500">
                  <Target className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Template</span>
                  <span className="font-medium text-gray-900 truncate max-w-24" title={program.warmup_template.title}>
                    {program.warmup_template.title}
                  </span>
                </div>
                {!isClient && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className="font-medium text-orange-600">
                      Available all weeks
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-orange-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {isClient ? 'Click to start workout' : 'Click to view warmup'}
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
          )}

          {programWeeks.find(w => w.weekNumber === selectedWeek)?.days.map((day) => {
            const workoutTitle = `${program?.title} - Week ${selectedWeek} - ${day.dayName}`;
            const completionData = workoutCompletionData[workoutTitle];

            return (
            <div
              key={day.dayId}
              onClick={() => handleDayClick(day.dayId, day.dayName, selectedWeek, day.templateId)}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${
                day.isCustomized
                  ? 'border-green-500 bg-green-50 hover:border-green-600'
                  : day.exerciseCount > 0
                  ? 'border-blue-500 bg-blue-50 hover:border-blue-600'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{day.dayName}</h4>
                  <p className="text-sm text-gray-600">Day {day.dayOrder}</p>
                </div>
                <div className={`p-2 rounded-lg ${
                  isClient
                    ? (day.exerciseCount > 0 ? 'bg-green-500' : 'bg-gray-300')
                    : day.isCustomized
                    ? 'bg-green-500'
                    : day.exerciseCount > 0
                    ? 'bg-blue-500'
                    : 'bg-gray-400'
                }`}>
                  {isClient ? (
                    day.exerciseCount > 0 ? (
                      <Play className="h-4 w-4 text-white" />
                    ) : (
                      <Calendar className="h-4 w-4 text-white" />
                    )
                  ) : (
                    day.isCustomized ? (
                      <Edit3 className="h-4 w-4 text-white" />
                    ) : day.exerciseCount > 0 ? (
                      <Dumbbell className="h-4 w-4 text-white" />
                    ) : (
                      <Plus className="h-4 w-4 text-white" />
                    )
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Exercises</span>
                  <span className="font-medium text-gray-900">{day.exerciseCount}</span>
                </div>

                {day.templateTitle && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Template</span>
                    <span className="font-medium text-gray-900 truncate max-w-24" title={day.templateTitle}>
                      {day.templateTitle}
                    </span>
                  </div>
                )}

                {isClient && completionData ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className={`font-medium ${
                        completionData.completed
                          ? 'text-green-600'
                          : completionData.percentage > 0
                          ? 'text-blue-600'
                          : 'text-gray-500'
                      }`}>
                        {completionData.percentage}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          completionData.completed ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${completionData.percentage}%` }}
                      ></div>
                    </div>
                    {completionData.completed && (
                      <div className="flex items-center text-xs text-green-600 font-medium">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Completed
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Status</span>
                    <span className={`font-medium ${
                      day.isCustomized
                        ? 'text-green-600'
                        : day.exerciseCount > 0
                        ? 'text-blue-600'
                        : 'text-gray-500'
                    }`}>
                      {day.isCustomized
                        ? 'Customized'
                        : day.exerciseCount > 0
                        ? 'Template'
                        : 'Empty'
                      }
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {isClient
                      ? completionData?.completed
                        ? 'Click to review workout'
                        : 'Click to start workout'
                      : `Click to ${day.exerciseCount > 0 ? 'edit' : 'add'} workout`
                    }
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Program Statistics - Only show for coaches/admins */}
      {!isClient && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Week Overview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Week Overview</h3>

            <div className="space-y-4">
              {programWeeks.map((week) => {
                const weekStats = {
                  totalDays: week.days.length,
                  customizedDays: week.days.filter(d => d.isCustomized).length,
                  totalExercises: week.days.reduce((sum, d) => sum + d.exerciseCount, 0)
                };

                return (
                  <div
                    key={week.weekNumber}
                    onClick={() => setSelectedWeek(week.weekNumber)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedWeek === week.weekNumber
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900">Week {week.weekNumber}</h4>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <span>{weekStats.totalExercises} exercises</span>
                          <span>{weekStats.customizedDays} customized</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {weekStats.customizedDays > 0 && (
                          <div className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                            {weekStats.customizedDays} custom
                          </div>
                        )}
                        <div className="w-12 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${weekStats.totalDays > 0 ? (weekStats.customizedDays / weekStats.totalDays) * 100 : 0}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Program Info */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Information</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Created</span>
                <span className="font-medium text-gray-900">
                  {new Date(program.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Total Workouts</span>
                <span className="font-medium text-gray-900">
                  {program.duration_weeks * program.days_per_week}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Customization Rate</span>
                <span className="font-medium text-gray-900">
                  {stats.totalDays > 0 ? Math.round((stats.customizedDays / stats.totalDays) * 100) : 0}%
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Average Exercises/Day</span>
                <span className="font-medium text-gray-900">
                  {stats.totalDays > 0 ? Math.round(stats.totalExercises / stats.totalDays) : 0}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <h4 className="font-medium text-gray-900 mb-3">Quick Actions</h4>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const currentWeekData = programWeeks
                      .find(w => w.weekNumber === selectedWeek)?.days

                    if (!currentWeekData || currentWeekData.length === 0) {
                      alert('No days found for this week. Please check the program configuration.');
                      return;
                    }

                    const firstEmptyDay = currentWeekData.find(d => d.exerciseCount === 0);

                    if (firstEmptyDay) {
                      handleDayClick(firstEmptyDay.dayId, firstEmptyDay.dayName, selectedWeek);
                    } else {
                      // If no empty days, just pick the first day
                      const firstDay = currentWeekData[0];
                      handleDayClick(firstDay.dayId, firstDay.dayName, selectedWeek, firstDay.templateId);
                    }
                  }}
                  className="w-full flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Workout to Empty Day
                </button>

                <button
                  onClick={() => {
                    const currentWeekData = programWeeks
                      .find(w => w.weekNumber === selectedWeek)?.days

                    if (!currentWeekData || currentWeekData.length === 0) {
                      alert('No days found for this week. Please check the program configuration.');
                      return;
                    }

                    // Just pick the first day to edit/customize
                    const firstDay = currentWeekData[0];
                    handleDayClick(firstDay.dayId, firstDay.dayName, selectedWeek, firstDay.templateId);
                  }}
                  className="w-full flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Any Day
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      {!isClient && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="font-semibold text-blue-900 mb-3">How to Edit Workouts:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-500 rounded p-1">
                <Dumbbell className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Template Days</p>
                <p className="text-blue-700 text-xs">Click to customize sets, reps, and weights for specific weeks</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-green-500 rounded p-1">
                <Edit3 className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Customized Days</p>
                <p className="text-blue-700 text-xs">Already customized - click to edit further</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <div className="bg-gray-400 rounded p-1">
                <Plus className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Empty Days</p>
                <p className="text-blue-700 text-xs">Click to add a new workout from templates</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-purple-500 rounded p-1">
                <Target className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Week-Specific</p>
                <p className="text-blue-700 text-xs">Customizations only affect the selected week</p>
              </div>
            </div>
          </div>
        </div>
        </div>
      )}
    </div>
  );
};

export default ProgramDetailView;