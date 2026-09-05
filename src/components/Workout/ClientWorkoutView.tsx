import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkoutStore } from '../../contexts/WorkoutContext';
import { calculateCurrentBlock, PROGRAM_TOTAL_BLOCKS, BLOCK_LENGTH_WEEKS } from '../../utils/programProgress';
import { supabase } from '../../lib/supabase';
import WorkoutExecutionView from './WorkoutExecutionView';
import ProgramDetailView from './ProgramDetailView';
import { Dumbbell, Calendar, Clock, CheckCircle, Play, User, Target, BarChart3, Loader, Eye, ChevronLeft, ChevronRight, CalendarDays, List, Grid3x3 as Grid3X3, Filter, Award, TrendingUp, Archive, Trash2, Sparkles } from 'lucide-react';

interface Workout {
  id: string;
  title: string;
  description?: string;
  scheduled_date: string;
  completed: boolean;
  notes?: string;
  coach_id: string;
  template_id?: string;
  archived?: boolean;
  workout_exercises: any[];
  coach?: {
    first_name: string;
    last_name: string;
  };
}

interface WeeklyWorkouts {
  weekNumber: number;
  startDate: string;
  endDate: string;
  workouts: Workout[];
  completedCount: number;
  totalCount: number;
}

interface ClientWorkoutViewProps {
  initialWorkoutId?: string;
}

const ClientWorkoutView: React.FC<ClientWorkoutViewProps> = ({ initialWorkoutId }) => {
  const { user } = useAuth();
  const { program: macroProgram } = useWorkoutStore();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(initialWorkoutId || null);
  const [selectedWorkoutViewOnly, setSelectedWorkoutViewOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'weekly' | 'calendar' | 'list' | 'programs'>('programs');
  const [swingPlanExpanded, setSwingPlanExpanded] = useState(false);
  const [viewingBlockNumber, setViewingBlockNumber] = useState<number | null>(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [actualCurrentWeekIndex, setActualCurrentWeekIndex] = useState(0);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'completed'>('all');
  const [weeklyWorkouts, setWeeklyWorkouts] = useState<WeeklyWorkouts[]>([]);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [subscriptionTier, setSubscriptionTier] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [activePrograms, setActivePrograms] = useState<any[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (user) {
      console.log('ClientWorkoutView: User loaded, fetching workouts for client:', user.id);
      fetchUserSubscription();
      fetchWorkouts();
      fetchActivePrograms();
    }
  }, [user, showArchived]);

  useEffect(() => {
    if (initialWorkoutId === undefined) {
      setSelectedWorkoutId(null);
      setSelectedProgramId(null);
    }
  }, [initialWorkoutId]);

  useEffect(() => {
    if (!selectedWorkoutId && user) {
      console.log('ClientWorkoutView: Returned from workout execution, refreshing data');
      fetchWorkouts();
    }
  }, [selectedWorkoutId, user]);

  useEffect(() => {
    organizeWorkoutsByWeek();
  }, [workouts, activePrograms]);

  const fetchUserSubscription = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription tier:', error);
        return;
      }

      const tier = data?.subscription_tier || null;
      setSubscriptionTier(tier);
      setIsPremium(tier === 'premium');

      // All users can see both tabs now
    } catch (error) {
      console.error('Exception fetching subscription tier:', error);
    }
  };

  const fetchWorkouts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('ClientWorkoutView: Fetching all workouts for client:', user.id);

      let query = supabase
        .from('workouts')
        .select(`
          id,
          title,
          description,
          scheduled_date,
          completed,
          notes,
          coach_id,
          template_id,
          archived,
          created_at,
          workout_exercises(
            id,
            sets,
            reps,
            weight,
            duration,
            notes,
            order_index,
            exercise:exercises(name, category)
          ),
          coach:profiles!coach_id(first_name, last_name)
        `)
        .eq('client_id', user.id)
        .order('scheduled_date', { ascending: true });

      if (!showArchived) {
        query = query.eq('archived', false);
      }

      const { data: workouts, error } = await query;

      if (error) throw error;

      console.log('ClientWorkoutView: Workouts fetched:', workouts);
      setWorkouts(workouts || []);

    } catch (error) {
      console.error('ClientWorkoutView: Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivePrograms = async () => {
    if (!user) return;

    try {
      console.log('ClientWorkoutView: Fetching active programs...');
      const { data, error } = await supabase
        .from('client_program_assignments')
        .select(`
          id,
          start_date,
          status,
          program:workout_programs(
            id,
            title,
            description,
            duration_weeks,
            created_by,
            program_weeks(
              id,
              week_number,
              template_id,
              program_day:program_days(
                id,
                day_name,
                day_order
              )
            )
          )
        `)
        .eq('client_id', user.id)
        .eq('status', 'active')
        .order('start_date', { ascending: false });

      if (error) {
        console.error('ClientWorkoutView: Error fetching active programs:', error);
        throw error;
      }

      console.log('ClientWorkoutView: Active programs fetched:', data?.length || 0, 'assignments');
      setActivePrograms(data || []);
    } catch (error) {
      console.error('ClientWorkoutView: Exception fetching active programs:', error);
    }
  };

  const organizeWorkoutsByWeek = () => {
    // If there are no workouts and no active programs, clear the weekly workouts
    if (workouts.length === 0 && activePrograms.length === 0) {
      setWeeklyWorkouts([]);
      return;
    }

    // Group workouts by program week (from description: "Week 1 - Day 1", etc.)
    const sortedWorkouts = [...workouts].sort((a, b) =>
      new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
    );

    const weeks: WeeklyWorkouts[] = [];
    const weekMap = new Map<number, Workout[]>();

    // Extract week number from the structured `week:N` tag in notes (most
    // reliable for swing-plan workouts), then fall back to the title and
    // description ("Week 4") before defaulting to week 1.
    sortedWorkouts.forEach(workout => {
      let weekNum = 1;
      const notesMatch = workout.notes?.match(/week:(\d+)/i);
      const titleMatch = !notesMatch ? workout.title?.match(/Week\s+(\d+)/i) : null;
      const descMatch =
        !notesMatch && !titleMatch ? workout.description?.match(/Week\s+(\d+)/i) : null;
      const match = notesMatch ?? titleMatch ?? descMatch;
      if (match) {
        weekNum = parseInt(match[1], 10);
      }

      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, []);
      }
      weekMap.get(weekNum)!.push(workout);
    });

    // Add program weeks from active programs that don't have workouts yet
    console.log('ClientWorkoutView: Active programs for placeholder generation:', activePrograms.length);
    console.log('ClientWorkoutView: Existing workouts:', workouts.map(w => ({ title: w.title, desc: w.description })));

    activePrograms.forEach(assignment => {
      const program = assignment.program;
      console.log('ClientWorkoutView: Processing program:', program?.title, 'Weeks:', program?.program_weeks?.length);
      if (!program || !program.program_weeks) return;

      const startDate = new Date(assignment.start_date);
      const programDurationWeeks = program.duration_weeks || 1;

      // Calculate which week we're currently in
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentProgramWeek = Math.floor(daysSinceStart / 7) + 1;

      // Only show weeks up to current week + 1 (show next week too)
      const weeksToShow = Math.min(Math.max(currentProgramWeek + 1, 1), programDurationWeeks);
      console.log('ClientWorkoutView: Will show weeks 1 to', weeksToShow);

      // Group program_weeks by week_number
      const weeksByNumber = new Map<number, any[]>();
      program.program_weeks.forEach(pw => {
        if (!weeksByNumber.has(pw.week_number)) {
          weeksByNumber.set(pw.week_number, []);
        }
        weeksByNumber.get(pw.week_number)!.push(pw);
      });

      for (let weekNum = 1; weekNum <= weeksToShow; weekNum++) {
        const programWeeksForThisWeek = weeksByNumber.get(weekNum) || [];

        // Calculate the start of this week
        const weekStartDate = new Date(startDate);
        weekStartDate.setDate(weekStartDate.getDate() + ((weekNum - 1) * 7));

        programWeeksForThisWeek.forEach(programWeek => {
          if (!programWeek.program_day) return;

          const day = programWeek.program_day;

          // Check if a workout already exists for this program day and week
          // Match by checking both title and description for the week and day name
          const existingWorkout = workouts.find(w => {
            const titleMatch = w.title?.includes(`Week ${weekNum}`) && w.title?.includes(day.day_name);
            const descMatch = w.description?.includes(`Week ${weekNum}`) && w.description?.includes(day.day_name);
            return titleMatch || descMatch;
          });

          if (existingWorkout) {
            console.log(`ClientWorkoutView: Found existing workout for Week ${weekNum} - ${day.day_name}:`, existingWorkout.title);
          } else {
            console.log(`ClientWorkoutView: No existing workout for Week ${weekNum} - ${day.day_name}, will create placeholder`);
          }

          if (!existingWorkout) {
            // Calculate scheduled date based on day order
            const scheduledDate = new Date(weekStartDate);
            scheduledDate.setDate(scheduledDate.getDate() + (day.day_order - 1));

            // Create a placeholder workout
            const placeholderWorkout: Workout = {
              id: `placeholder-${program.id}-${weekNum}-${programWeek.id}`,
              title: `${program.title} - Week ${weekNum} - ${day.day_name}`,
              description: `Week ${weekNum} - ${day.day_name}`,
              scheduled_date: scheduledDate.toISOString().split('T')[0],
              completed: false,
              coach_id: assignment.program.created_by || '',
              template_id: programWeek.template_id,
              workout_exercises: [],
              notes: 'Click to start this workout'
            };

            if (!weekMap.has(weekNum)) {
              weekMap.set(weekNum, []);
            }
            weekMap.get(weekNum)!.push(placeholderWorkout);
            console.log('ClientWorkoutView: Added placeholder:', placeholderWorkout.title);
          }
        });
      }
    });

    // Convert map to array and calculate date ranges
    Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .forEach(([weekNum, weekWorkouts]) => {
        const workoutDates = weekWorkouts.map(w => new Date(w.scheduled_date));
        const startDate = new Date(Math.min(...workoutDates.map(d => d.getTime())));
        const endDate = new Date(Math.max(...workoutDates.map(d => d.getTime())));

        // Extend to full week (Monday to Sunday)
        const startDayOfWeek = startDate.getDay();
        const daysToSubtract = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
        startDate.setDate(startDate.getDate() - daysToSubtract);

        const endDayOfWeek = endDate.getDay();
        const daysToAdd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
        endDate.setDate(endDate.getDate() + daysToAdd);

        weeks.push({
          weekNumber: weekNum,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          workouts: weekWorkouts.sort((a, b) =>
            new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime()
          ),
          completedCount: weekWorkouts.filter(w => w.completed).length,
          totalCount: weekWorkouts.length
        });
      });

    setWeeklyWorkouts(weeks);

    // Find the week that contains today's date or the first upcoming week
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentWeekIndex = weeks.findIndex(week => {
      const weekStart = new Date(week.startDate);
      weekStart.setHours(0, 0, 0, 0);

      const weekEnd = new Date(week.endDate);
      weekEnd.setHours(23, 59, 59, 999);

      return today >= weekStart && today <= weekEnd;
    });

    // Track the actual real-world current week (containing today) for nav capping.
    let realCurrentWeekIndex = currentWeekIndex;
    if (realCurrentWeekIndex < 0) {
      // Today is before all weeks -> cap at 0. Today after all weeks -> last.
      const firstStart = new Date(weeks[0].startDate).getTime();
      if (today.getTime() < firstStart) {
        realCurrentWeekIndex = 0;
      } else {
        realCurrentWeekIndex = weeks.length - 1;
      }
    }
    setActualCurrentWeekIndex(realCurrentWeekIndex);

    // If today is not in any week, find the first upcoming week
    if (currentWeekIndex < 0) {
      currentWeekIndex = weeks.findIndex(week => {
        const weekStart = new Date(week.startDate);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart > today;
      });
    }

    // If still not found, default to first week
    if (currentWeekIndex >= 0) {
      setCurrentWeek(currentWeekIndex);
    } else {
      // If today is after all weeks, find the closest week to today
      const todayTime = today.getTime();
      let closestWeekIndex = 0;
      let smallestDiff = Math.abs(new Date(weeks[0].startDate).getTime() - todayTime);

      weeks.forEach((week, index) => {
        const weekStart = new Date(week.startDate).getTime();
        const weekEnd = new Date(week.endDate).getTime();

        // Calculate the distance from today to this week
        let diff;
        if (todayTime < weekStart) {
          diff = weekStart - todayTime; // Today is before this week
        } else if (todayTime > weekEnd) {
          diff = todayTime - weekEnd; // Today is after this week
        } else {
          diff = 0; // Today is within this week (shouldn't happen, but just in case)
        }

        if (diff < smallestDiff) {
          smallestDiff = diff;
          closestWeekIndex = index;
        }
      });

      // If today is after the last week's end date, show the last week
      const lastWeek = weeks[weeks.length - 1];
      const lastWeekEnd = new Date(lastWeek.endDate);
      lastWeekEnd.setHours(23, 59, 59, 999);

      if (todayTime > lastWeekEnd.getTime()) {
        setCurrentWeek(weeks.length - 1);
      } else {
        // Otherwise show the closest week (likely the next upcoming incomplete week)
        const firstIncompleteWeek = weeks.findIndex(week => week.completedCount < week.totalCount);
        setCurrentWeek(firstIncompleteWeek >= 0 ? firstIncompleteWeek : closestWeekIndex);
      }
    }
  };

  const archiveWorkout = async (workoutId: string) => {
    if (workoutId.startsWith('placeholder-')) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ archived: true })
        .eq('id', workoutId);
      if (error) throw error;
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    } catch (error) {
      console.error('Error archiving workout:', error);
      alert('Could not archive workout. Please try again.');
    }
  };

  const unarchiveWorkout = async (workoutId: string) => {
    if (workoutId.startsWith('placeholder-')) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .update({ archived: false })
        .eq('id', workoutId);
      if (error) throw error;
      setWorkouts((prev) =>
        prev.map((w) => (w.id === workoutId ? { ...w, archived: false } : w))
      );
    } catch (error) {
      console.error('Error restoring workout:', error);
    }
  };

  const deleteWorkout = async (workoutId: string) => {
    if (workoutId.startsWith('placeholder-')) return;
    if (!confirm('Permanently delete this workout? This cannot be undone.')) return;
    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId);
      if (error) throw error;
      setWorkouts((prev) => prev.filter((w) => w.id !== workoutId));
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Could not delete workout. Please try again.');
    }
  };

  const archiveProgramAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('client_program_assignments')
        .update({ status: 'archived' })
        .eq('id', assignmentId);
      if (error) throw error;
      setActivePrograms((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (error) {
      console.error('Error archiving program assignment:', error);
      alert('Could not archive this program. Please try again.');
    }
  };

  const deleteProgramAssignment = async (assignmentId: string) => {
    if (
      !confirm(
        'Permanently remove this program from your workouts? This will not delete completed workout history.'
      )
    )
      return;
    try {
      const { error } = await supabase
        .from('client_program_assignments')
        .delete()
        .eq('id', assignmentId);
      if (error) throw error;
      setActivePrograms((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (error) {
      console.error('Error deleting program assignment:', error);
      alert('Could not remove this program. Please try again.');
    }
  };

  const archiveAllSwingPlanWorkouts = async () => {
    if (!confirm('Archive the entire Training Program program? All workouts will be moved to your archive.')) return;
    try {
      const swingWorkoutIds = workouts
        .filter((w) => w.notes?.includes('[swing-plan]'))
        .map((w) => w.id);
      if (swingWorkoutIds.length === 0) return;

      const { error } = await supabase
        .from('workouts')
        .update({ archived: true })
        .in('id', swingWorkoutIds);
      if (error) throw error;
      setSwingPlanExpanded(false);
      setViewingBlockNumber(null);
      fetchWorkouts();
    } catch (error) {
      console.error('Error archiving swing plan:', error);
      alert('Could not archive program. Please try again.');
    }
  };

  const deleteAllSwingPlanWorkouts = async () => {
    if (!confirm('Permanently delete the entire Training Program program and all its workouts? This cannot be undone.')) return;
    try {
      const swingWorkoutIds = workouts
        .filter((w) => w.notes?.includes('[swing-plan]'))
        .map((w) => w.id);
      if (swingWorkoutIds.length === 0) return;

      const { error } = await supabase
        .from('workouts')
        .delete()
        .in('id', swingWorkoutIds);
      if (error) throw error;
      setSwingPlanExpanded(false);
      setViewingBlockNumber(null);
      fetchWorkouts();
    } catch (error) {
      console.error('Error deleting swing plan:', error);
      alert('Could not delete program. Please try again.');
    }
  };

  const getWorkoutProgress = (workout: Workout): { completedCount: number; totalCount: number; percentage: number; isStarted: boolean } => {
    const exercises = workout.workout_exercises || [];
    if (exercises.length === 0) return { completedCount: 0, totalCount: 0, percentage: 0, isStarted: false };

    let completedCount = 0;
    let isStarted = false;

    for (const we of exercises) {
      if (we.notes) {
        try {
          const parsed = typeof we.notes === 'string' ? JSON.parse(we.notes) : we.notes;
          if (parsed.completed) {
            completedCount++;
            isStarted = true;
          } else if (parsed.setProgress?.some((s: any) => s.completed || s.reps || s.weight || s.duration)) {
            isStarted = true;
          }
        } catch {
          // not valid JSON, skip
        }
      }
    }

    return {
      completedCount,
      totalCount: exercises.length,
      percentage: Math.round((completedCount / exercises.length) * 100),
      isStarted: isStarted || completedCount > 0,
    };
  };

  const activeBlockNumber = macroProgram
    ? calculateCurrentBlock(macroProgram.currentWeek)
    : null;

  const allSwingPlanWorkouts = workouts.filter(
    (w) => !w.archived && (w.notes?.includes('[swing-plan]') ?? false)
  );

  const displayedBlockNumber = viewingBlockNumber ?? activeBlockNumber;

  // Only show the workouts for the block the user is currently viewing. Each
  // saved workout note carries `block:N`; if no active program is loaded we
  // fall back to showing every swing-plan workout so legacy data is reachable.
  const swingPlanWorkouts = displayedBlockNumber
    ? allSwingPlanWorkouts.filter((w) =>
        (w.notes ?? '').includes(`block:${displayedBlockNumber}`)
      )
    : allSwingPlanWorkouts;

  const swingPlanWeeks = displayedBlockNumber
    ? [
        (displayedBlockNumber - 1) * 3 + 1,
        (displayedBlockNumber - 1) * 3 + 2,
        (displayedBlockNumber - 1) * 3 + 3,
      ]
    : null;

  const currentProgramWeek = macroProgram?.currentWeek ?? null;

  const getWorkoutWeekNumber = (workout: Workout): number | null => {
    const notesMatch = workout.notes?.match(/week:(\d+)/i);
    if (notesMatch) return parseInt(notesMatch[1], 10);
    const titleMatch = workout.title?.match(/Week\s+(\d+)/i);
    if (titleMatch) return parseInt(titleMatch[1], 10);
    const descMatch = workout.description?.match(/Week\s+(\d+)/i);
    if (descMatch) return parseInt(descMatch[1], 10);
    return null;
  };

  const isSwingWorkoutLocked = (workout: Workout): boolean => {
    if (workout.completed) return false;
    if (currentProgramWeek == null) return false;
    const weekNum = getWorkoutWeekNumber(workout);
    if (weekNum == null) return false;
    return weekNum > currentProgramWeek;
  };

  const availableBlocks = Array.from(
    new Set(
      allSwingPlanWorkouts
        .map((w) => {
          const match = w.notes?.match(/block:(\d+)/i);
          return match ? parseInt(match[1], 10) : null;
        })
        .filter((n): n is number => n !== null)
    )
  ).sort((a, b) => a - b);

  const markWorkoutComplete = async (workoutId: string) => {
    try {
      console.log('Marking workout as complete:', workoutId);
      
      const { error } = await supabase
        .from('workouts')
        .update({ completed: true })
        .eq('id', workoutId);

      if (error) {
        console.error('Error updating workout completion:', error);
        throw error;
      }
      
      console.log('Workout marked as complete successfully');

      // Update local state
      setWorkouts(prev => 
        prev.map(workout => 
          workout.id === workoutId 
            ? { ...workout, completed: true }
            : workout
        )
      );
      
    } catch (error) {
      console.error('Error marking workout complete:', error);
      
      if (error.message?.includes('permission') || error.message?.includes('policy')) {
        console.error('Permission error - checking RLS policies');
        alert('Permission error: Unable to update workout completion. Please contact your coach.');
      } else {
        alert(`Error updating workout: ${error.message}. Please try again.`);
      }
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getWorkoutsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return workouts.filter(workout => workout.scheduled_date === dateStr);
  };

  const navigateCalendarMonth = (direction: 'prev' | 'next') => {
    setCurrentCalendarDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getWorkoutStats = () => {
    const total = workouts.length;
    const completed = workouts.filter(w => w.completed).length;
    const upcoming = workouts.filter(w => {
      const today = new Date().toISOString().split('T')[0];
      return w.scheduled_date >= today && !w.completed;
    }).length;
    
    return { total, completed, upcoming };
  };

  const getCurrentWeekWorkouts = () => {
    if (weeklyWorkouts.length === 0 || currentWeek >= weeklyWorkouts.length) return [];
    return weeklyWorkouts[currentWeek];
  };

  const getFilteredWorkouts = () => {
    switch (filter) {
      case 'upcoming':
        const today = new Date().toISOString().split('T')[0];
        return workouts.filter(w => w.scheduled_date >= today && !w.completed);
      case 'completed':
        return workouts.filter(w => w.completed);
      default:
        return workouts;
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentWeek > 0) {
      setCurrentWeek(currentWeek - 1);
    } else if (direction === 'next' && currentWeek < Math.min(actualCurrentWeekIndex, weeklyWorkouts.length - 1)) {
      setCurrentWeek(currentWeek + 1);
    }
  };

  const stats = getWorkoutStats();

  const handleWorkoutClick = async (workout: Workout) => {
    // If it's a placeholder workout, create the actual workout first
    if (workout.id.startsWith('placeholder-') && workout.template_id) {
      try {
        console.log('Creating workout from placeholder:', workout.title);

        // Fetch template exercises
        const { data: templateExercises, error: templateError } = await supabase
          .from('template_exercises')
          .select(`
            exercise_id,
            sets,
            reps,
            duration,
            notes,
            order_index,
            superset_group,
            exercises(id, name, category, description, instructions, video_url)
          `)
          .eq('template_id', workout.template_id)
          .order('order_index');

        if (templateError) {
          console.error('Error fetching template exercises:', templateError);
          alert('Failed to load workout exercises. Please try again.');
          return;
        }

        // Create the workout
        const { data: newWorkout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            client_id: user?.id,
            title: workout.title,
            description: workout.description,
            scheduled_date: workout.scheduled_date,
            coach_id: workout.coach_id,
            template_id: workout.template_id,
            completed: false
          })
          .select()
          .single();

        if (workoutError || !newWorkout) {
          console.error('Error creating workout:', workoutError);
          alert('Failed to create workout. Please try again.');
          return;
        }

        // Create workout exercises from template
        if (templateExercises && templateExercises.length > 0) {
          const workoutExercises = templateExercises.map(te => ({
            workout_id: newWorkout.id,
            exercise_id: te.exercise_id,
            sets: te.sets,
            reps: te.reps,
            duration: te.duration,
            notes: te.notes,
            order_index: te.order_index,
            weight: null
          }));

          const { error: exercisesError } = await supabase
            .from('workout_exercises')
            .insert(workoutExercises);

          if (exercisesError) {
            console.error('Error creating workout exercises:', exercisesError);
          }
        }

        // Refresh workouts and navigate to the new workout
        await fetchWorkouts();
        setSelectedWorkoutId(newWorkout.id);
        return;
      } catch (error) {
        console.error('Exception creating workout from placeholder:', error);
        alert('An error occurred. Please try again.');
        return;
      }
    }

    // Otherwise, execute the workout normally
    setSelectedWorkoutId(workout.id);
  };

  // If a workout is selected for execution, show the execution view
  if (selectedWorkoutId) {
    return (
      <WorkoutExecutionView
        workoutId={selectedWorkoutId}
        viewOnly={selectedWorkoutViewOnly}
        onBack={() => {
          setSelectedWorkoutId(null);
          setSelectedWorkoutViewOnly(false);
        }}
      />
    );
  }

  // If a program is selected for viewing, show the program detail view
  if (selectedProgramId) {
    return (
      <ProgramDetailView
        programId={selectedProgramId}
        onBack={() => setSelectedProgramId(null)}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading your workouts...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Workouts</h1>
        <p className="text-gray-600">View your assigned training program.</p>
      </div>

      {/* My Workouts Section */}
      {(
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-blue-500 rounded-full p-1.5 sm:p-3 mb-1.5 sm:mb-3">
              <Dumbbell className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
            </div>
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Total</p>
            <p className="text-base sm:text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-blue-500 rounded-full p-1.5 sm:p-3 mb-1.5 sm:mb-3">
              <CheckCircle className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
            </div>
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Done</p>
            <p className="text-base sm:text-3xl font-bold text-gray-900">{stats.completed}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-orange-500 rounded-full p-1.5 sm:p-3 mb-1.5 sm:mb-3">
              <Calendar className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
            </div>
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Week</p>
            <p className="text-base sm:text-3xl font-bold text-gray-900">
              {weeklyWorkouts.length > 0 ? currentWeek + 1 : 0}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3 sm:p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="bg-blue-500 rounded-full p-1.5 sm:p-3 mb-1.5 sm:mb-3">
              <Clock className="h-3.5 w-3.5 sm:h-6 sm:w-6 text-white" />
            </div>
            <p className="text-[10px] sm:text-sm font-medium text-gray-600 mb-0.5 sm:mb-1">Next</p>
            <p className="text-base sm:text-3xl font-bold text-gray-900">{stats.upcoming}</p>
          </div>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1 overflow-x-auto">
              {isPremium && (
                <>
                  <button
                    onClick={() => setViewMode('weekly')}
                    className={`flex items-center px-3 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                      viewMode === 'weekly'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <CalendarDays className="h-4 w-4 mr-1.5" />
                    Weekly View
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`flex items-center px-3 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                      viewMode === 'calendar'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    Calendar View
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex items-center px-3 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                      viewMode === 'list'
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <List className="h-4 w-4 mr-1.5" />
                    List View
                  </button>
                </>
              )}
              <button
                onClick={() => setViewMode('programs')}
                className={`flex items-center px-3 py-2.5 min-h-[44px] rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap touch-manipulation ${
                  viewMode === 'programs'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Award className="h-4 w-4 mr-1.5" />
                Programs
              </button>
            </div>
          </div>

          {viewMode === 'list' && isPremium && (
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
                {[
                  { id: 'all', label: 'All', count: stats.total },
                  { id: 'upcoming', label: 'Upcoming', count: stats.upcoming },
                  { id: 'completed', label: 'Completed', count: stats.completed }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    className={`px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors touch-manipulation ${
                      filter === tab.id
                        ? 'bg-white text-blue-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Training Program Section */}
      {allSwingPlanWorkouts.length > 0 && !swingPlanExpanded && viewMode === 'programs' && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bowtai Fitness Program</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => {
                setViewingBlockNumber(activeBlockNumber);
                setSwingPlanExpanded(true);
              }}
              className="text-left bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer transition-all hover:shadow-md hover:border-blue-500"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 mb-1 truncate">Training Program</h4>
                  <p className="text-sm text-gray-600">
                    {activeBlockNumber
                      ? `Currently on Block ${activeBlockNumber}`
                      : 'Personalized training program'}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Blocks</span>
                  <span className="font-medium text-gray-900">
                    {availableBlocks.length || PROGRAM_TOTAL_BLOCKS}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Workouts</span>
                  <span className="font-medium text-gray-900">
                    {allSwingPlanWorkouts.length} day{allSwingPlanWorkouts.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Completed</span>
                  <span className="font-medium text-gray-900">
                    {allSwingPlanWorkouts.filter((w) => w.completed).length}/{allSwingPlanWorkouts.length}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                  View blocks &amp; weeks
                  <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                </span>
              </div>
            </button>
          </div>
        </div>
      )}

      {allSwingPlanWorkouts.length > 0 && (swingPlanExpanded || viewMode !== 'programs') && (
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {viewMode === 'programs' && (
                <button
                  type="button"
                  onClick={() => {
                    setSwingPlanExpanded(false);
                    setViewingBlockNumber(null);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to programs"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Training Program
                {displayedBlockNumber && swingPlanWeeks
                  ? ` - Block ${displayedBlockNumber} (Wks ${swingPlanWeeks[0]}-${swingPlanWeeks[2]})`
                  : ''}
              </h3>
              <span className="text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                {swingPlanWorkouts.length} day{swingPlanWorkouts.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => archiveAllSwingPlanWorkouts()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                title="Archive entire program"
              >
                <Archive className="h-5 w-5" />
              </button>
              <button
                onClick={() => deleteAllSwingPlanWorkouts()}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete entire program"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {(availableBlocks.length > 1 || PROGRAM_TOTAL_BLOCKS > 1) && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="text-xs font-medium text-gray-500 mr-1">Block:</span>
              {Array.from({ length: PROGRAM_TOTAL_BLOCKS }, (_, i) => i + 1).map((blockNum) => {
                const weeks = [
                  (blockNum - 1) * BLOCK_LENGTH_WEEKS + 1,
                  (blockNum - 1) * BLOCK_LENGTH_WEEKS + 2,
                  (blockNum - 1) * BLOCK_LENGTH_WEEKS + 3,
                ];
                const hasWorkouts = availableBlocks.includes(blockNum);
                const isSelected = displayedBlockNumber === blockNum;
                const isActive = activeBlockNumber === blockNum;
                return (
                  <button
                    key={blockNum}
                    type="button"
                    onClick={() => setViewingBlockNumber(blockNum)}
                    disabled={!hasWorkouts}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : hasWorkouts
                        ? 'bg-white text-gray-700 border-gray-200 hover:bg-blue-50 hover:border-blue-300'
                        : 'bg-gray-50 text-gray-400 border-gray-100 cursor-not-allowed'
                    }`}
                    title={!hasWorkouts ? 'No workouts generated for this block yet' : undefined}
                  >
                    Block {blockNum}
                    <span className="ml-1 opacity-75">
                      (Wks {weeks[0]}-{weeks[2]})
                    </span>
                    {isActive && !isSelected && (
                      <span className="ml-1 text-blue-600">•</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...swingPlanWorkouts].sort((a, b) => Number(a.completed) - Number(b.completed)).map((workout) => {
              const locked = isSwingWorkoutLocked(workout);
              return (
              <div
                key={workout.id}
                className={`rounded-xl border-2 transition-all hover:shadow-md ${
                  workout.completed
                    ? 'border-blue-200 bg-blue-50'
                    : 'border-blue-200 bg-white hover:border-blue-300'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                        Training Program
                      </p>
                      <h4 className="text-sm font-semibold text-gray-900 mt-0.5 truncate">
                        {workout.title.replace(/^(Training Program|Power-Play|Swing Plan) - /, '')}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(workout.scheduled_date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                    {workout.completed && (
                      <CheckCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-1" />
                    )}
                  </div>
                  <div className="flex items-center text-xs text-gray-600 mb-3">
                    <Dumbbell className="h-3.5 w-3.5 mr-1.5" />
                    {workout.workout_exercises?.length || 0} exercises
                  </div>
                  <div className="flex items-center gap-2">
                    {locked ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (workout.id.startsWith('placeholder-')) {
                            alert('This preview will be available once the workout is generated.');
                            return;
                          }
                          setSelectedWorkoutViewOnly(true);
                          setSelectedWorkoutId(workout.id);
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs font-medium"
                        title={`Preview only — available on its scheduled week (Week ${getWorkoutWeekNumber(workout) ?? '—'})`}
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </button>
                    ) : (
                      <button
                        onClick={() => handleWorkoutClick(workout)}
                        className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        {workout.completed ? 'Review' : 'Start'}
                      </button>
                    )}
                    <button
                      onClick={() => archiveWorkout(workout.id)}
                      className="p-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      title="Archive"
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteWorkout(workout.id)}
                      className="p-2 border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Archive toggle */}
      <div className="mb-4 flex items-center justify-end">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <Archive className="h-3.5 w-3.5" />
          Show archived workouts
        </label>
      </div>

      {/* Active Programs Section */}
      {activePrograms.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Programs</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activePrograms.map((assignment) => (
              <div
                key={assignment.id}
                onClick={() => setSelectedProgramId(assignment.program.id)}
                className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 cursor-pointer transition-all hover:shadow-md hover:border-blue-500"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">{assignment.program.title}</h4>
                    <p className="text-sm text-gray-600">{assignment.program.duration_weeks} weeks</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500">
                    <Award className="h-4 w-4 text-white" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Workouts</span>
                    <span className="font-medium text-gray-900">
                      {(() => {
                        const uniqueDays = new Set();
                        assignment.program.program_weeks?.forEach(pw => {
                          if (pw.program_day?.day_name) uniqueDays.add(pw.program_day.day_name);
                        });
                        return uniqueDays.size;
                      })()} days/week
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Started</span>
                    <span className="font-medium text-gray-900">{new Date(assignment.start_date).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                      View program
                      <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          archiveProgramAssignment(assignment.id);
                        }}
                        className="p-1.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Archive program"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProgramAssignment(assignment.id);
                        }}
                        className="p-1.5 border border-gray-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Remove program"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly View */}
      {(viewMode === 'weekly' || (viewMode === 'programs' && !swingPlanExpanded)) && weeklyWorkouts.length > 0 && (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100">
          {/* Week Navigation */}
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateWeek('prev')}
                  disabled={currentWeek === 0}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                <div className="text-center">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                    Week {getCurrentWeekWorkouts()?.weekNumber || 1}
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    {getCurrentWeekWorkouts()?.startDate && new Date(getCurrentWeekWorkouts().startDate).toLocaleDateString()} - {' '}
                    {getCurrentWeekWorkouts()?.endDate && new Date(getCurrentWeekWorkouts().endDate).toLocaleDateString()}
                  </p>
                </div>
                
                <button
                  onClick={() => navigateWeek('next')}
                  disabled={currentWeek >= Math.min(actualCurrentWeekIndex, weeklyWorkouts.length - 1)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Progress</p>
                  <div className="flex items-center space-x-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ 
                          width: `${getCurrentWeekWorkouts()?.totalCount > 0 
                            ? (getCurrentWeekWorkouts().completedCount / getCurrentWeekWorkouts().totalCount) * 100 
                            : 0}%` 
                        }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {getCurrentWeekWorkouts()?.completedCount || 0}/{getCurrentWeekWorkouts()?.totalCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Week Workouts */}
          <div className="p-4 sm:p-6">
            {getCurrentWeekWorkouts()?.workouts.length > 0 ? (
              <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
                {[...getCurrentWeekWorkouts().workouts].sort((a, b) => Number(a.completed) - Number(b.completed)).map((workout, index) => {
                  let dayLabel = `Day ${index + 1}`;
                  const titleLower = workout.title?.toLowerCase() || '';
                  if (titleLower.includes('warm up') || titleLower.includes('warm-up')) {
                    dayLabel = 'Warm Up';
                  } else if (workout.title) {
                    const dayMatch = workout.title.match(/Day\s+(\d+)/i);
                    if (dayMatch) {
                      dayLabel = `Day ${dayMatch[1]}`;
                    }
                  }

                  const progress = getWorkoutProgress(workout);

                  return (
                  <div key={workout.id} className={`rounded-xl border-2 transition-all hover:shadow-md touch-manipulation ${
                    workout.completed
                      ? 'border-blue-200 bg-blue-50'
                      : progress.isStarted
                        ? 'border-blue-300 bg-white hover:border-blue-400'
                        : 'border-gray-200 bg-white hover:border-blue-200'
                  }`}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {dayLabel}
                          </span>
                          {workout.completed && (
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          )}
                          {!workout.completed && progress.isStarted && (
                            <span className="text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                              In Progress
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(workout.scheduled_date).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>

                      <h3 className="text-sm font-semibold text-gray-900 mb-2">{workout.title}</h3>

                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <Dumbbell className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                        <span>{workout.workout_exercises?.length || 0} exercises</span>
                      </div>

                      {!workout.completed && progress.isStarted && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-blue-700">
                              {progress.completedCount}/{progress.totalCount} exercises done
                            </span>
                            <span className="text-xs font-semibold text-blue-700">{progress.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {workout.notes && !workout.id.startsWith('placeholder-') && !workout.notes.trim().startsWith('[swing-plan]') && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 mb-3">
                          <p className="text-xs text-blue-800 line-clamp-2">
                            <strong>Note:</strong> {workout.notes}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        {!workout.completed ? (
                          <button
                            onClick={() => handleWorkoutClick(workout)}
                            className={`flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg transition-colors text-sm font-medium touch-manipulation ${
                              progress.isStarted
                                ? 'bg-blue-600 text-white hover:bg-blue-700'
                                : 'bg-blue-500 text-white hover:bg-blue-600'
                            }`}
                          >
                            <Play className="h-4 w-4 mr-1.5" />
                            {workout.id.startsWith('placeholder-') ? 'View Program' : progress.isStarted ? 'Resume Workout' : 'Start Workout'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleWorkoutClick(workout)}
                            className="flex-1 flex items-center justify-center px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium touch-manipulation"
                          >
                            <Eye className="h-4 w-4 mr-1.5" />
                            Review Workout
                          </button>
                        )}
                        {!workout.completed && !workout.id.startsWith('placeholder-') && (
                          <button
                            onClick={() => markWorkoutComplete(workout.id)}
                            className="px-3 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors touch-manipulation"
                            title="Mark as complete"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No workouts this week</h3>
                <p className="text-gray-600">Check other weeks or contact your coach.</p>
              </div>
            )}
          </div>

          {/* Week Progress Summary */}
          {getCurrentWeekWorkouts() && (
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Award className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-gray-900">
                      Week {getCurrentWeekWorkouts().weekNumber} Progress
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {getCurrentWeekWorkouts().completedCount} of {getCurrentWeekWorkouts().totalCount} workouts completed
                  </div>
                </div>
                
                {getCurrentWeekWorkouts().completedCount === getCurrentWeekWorkouts().totalCount && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Week Complete!</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Workout Calendar</h3>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigateCalendarMonth('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h4 className="text-sm sm:text-lg font-semibold text-gray-900 min-w-[150px] sm:min-w-[200px] text-center">
                {currentCalendarDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h4>
              <button
                onClick={() => navigateCalendarMonth('next')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors touch-manipulation"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Calendar Header */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 sm:p-3 text-center text-xs sm:text-sm font-medium text-gray-600 border-b border-gray-200">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {getDaysInMonth(currentCalendarDate).map((day, index) => {
              const dayWorkouts = getWorkoutsForDate(day);
              const isToday = day && day.toDateString() === new Date().toDateString();
              const isPastDate = day && day < new Date(new Date().toDateString());
              
              return (
                <div
                  key={index}
                  className={`min-h-[64px] sm:min-h-[80px] p-1 sm:p-2 border border-gray-100 rounded-lg transition-colors ${
                    day ? 'hover:bg-gray-50 cursor-pointer' : ''
                  } ${isToday ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : ''} ${
                    isPastDate ? 'bg-gray-25' : ''
                  }`}
                >
                  {day && (
                    <>
                      <div className={`text-xs sm:text-sm font-medium mb-1 sm:mb-2 ${
                        isToday ? 'text-blue-600' : isPastDate ? 'text-gray-400' : 'text-gray-900'
                      }`}>
                        {day.getDate()}
                      </div>
                      
                      <div className="space-y-1">
                        {dayWorkouts.slice(0, 3).map((workout) => (
                          <div
                            key={workout.id}
                            onClick={() => handleWorkoutClick(workout)}
                            className={`text-xs p-1 sm:p-2 rounded cursor-pointer transition-all hover:scale-105 touch-manipulation ${
                              workout.completed 
                                ? 'bg-blue-500 text-white shadow-sm' 
                                : isToday
                                ? 'bg-blue-600 text-white shadow-sm'
                                : isPastDate
                                ? 'bg-red-400 text-white'
                                : 'bg-blue-500 text-white shadow-sm hover:bg-blue-600'
                            }`}
                            title={`${workout.title} - ${workout.completed ? 'Completed' : 'Click to start'}`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate font-medium text-xs">
                                {workout.title.length > 12 ? workout.title.substring(0, 12) + '...' : workout.title}
                              </span>
                              {workout.completed ? (
                                <CheckCircle className="h-3 w-3 flex-shrink-0" />
                              ) : (
                                <Play className="h-3 w-3 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center mt-1 text-xs opacity-90 hidden sm:flex">
                              <Dumbbell className="h-2 w-2 mr-1" />
                              <span>{workout.workout_exercises?.length || 0} exercises</span>
                            </div>
                          </div>
                        ))}
                        
                        {dayWorkouts.length > 3 && (
                          <div className="text-xs text-gray-500 text-center py-1">
                            +{dayWorkouts.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Calendar Legend */}
          <div className="mt-6 flex items-center justify-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Completed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-500 rounded"></div>
              <span className="text-gray-600">Scheduled</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-red-400 rounded"></div>
              <span className="text-gray-600">Overdue</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 bg-blue-50 border-2 border-blue-200 rounded"></div>
              <span className="text-gray-600">Today</span>
            </div>
          </div>
          
          {/* Calendar Stats */}
          <div className="mt-4 sm:mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-xl sm:text-2xl font-bold text-gray-900">
                {workouts.filter(w => {
                  const workoutDate = new Date(w.scheduled_date);
                  return workoutDate.getMonth() === currentCalendarDate.getMonth() && 
                         workoutDate.getFullYear() === currentCalendarDate.getFullYear();
                }).length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">This Month</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">
                {workouts.filter(w => {
                  const workoutDate = new Date(w.scheduled_date);
                  return workoutDate.getMonth() === currentCalendarDate.getMonth() && 
                         workoutDate.getFullYear() === currentCalendarDate.getFullYear() &&
                         w.completed;
                }).length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Completed</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">
                {workouts.filter(w => {
                  const today = new Date().toISOString().split('T')[0];
                  const workoutDate = new Date(w.scheduled_date);
                  return workoutDate.getMonth() === currentCalendarDate.getMonth() && 
                         workoutDate.getFullYear() === currentCalendarDate.getFullYear() &&
                         w.scheduled_date >= today && !w.completed;
                }).length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Upcoming</p>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <p className="text-xl sm:text-2xl font-bold text-red-600">
                {workouts.filter(w => {
                  const today = new Date().toISOString().split('T')[0];
                  const workoutDate = new Date(w.scheduled_date);
                  return workoutDate.getMonth() === currentCalendarDate.getMonth() && 
                         workoutDate.getFullYear() === currentCalendarDate.getFullYear() &&
                         w.scheduled_date < today && !w.completed;
                }).length}
              </p>
              <p className="text-xs sm:text-sm text-gray-600">Overdue</p>
            </div>
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="space-y-4 sm:space-y-6">
          {getFilteredWorkouts().length > 0 ? (
            [...getFilteredWorkouts()].sort((a, b) => Number(a.completed) - Number(b.completed)).map((workout) => {
              const progress = getWorkoutProgress(workout);
              return (
              <div key={workout.id} className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 sm:p-6">
                  {/* Header Section */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{workout.title}</h3>
                        {workout.completed && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Completed
                          </span>
                        )}
                        {!workout.completed && progress.isStarted && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                            In Progress
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm text-gray-600 mb-3">
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(workout.scheduled_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center">
                          <Dumbbell className="h-4 w-4 mr-1" />
                          {workout.workout_exercises?.length || 0} exercises
                        </div>
                        {workout.coach && (
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            Coach {workout.coach.first_name} {workout.coach.last_name}
                          </div>
                        )}
                      </div>

                      {!workout.completed && progress.isStarted && (
                        <div className="max-w-xs mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-blue-700">
                              {progress.completedCount}/{progress.totalCount} exercises done
                            </span>
                            <span className="text-xs font-semibold text-blue-700">{progress.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="hidden sm:flex flex-col space-y-2 ml-2">
                      {!workout.completed && (
                        <button
                          onClick={() => handleWorkoutClick(workout)}
                          className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium touch-manipulation whitespace-nowrap"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          {workout.id.startsWith('placeholder-') ? 'View Program' : progress.isStarted ? 'Resume Workout' : 'Start Workout'}
                        </button>
                      )}
                      <button
                        onClick={() => handleWorkoutClick(workout)}
                        className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm touch-manipulation whitespace-nowrap"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </button>
                      {!workout.completed && !workout.id.startsWith('placeholder-') && (
                        <button
                          onClick={() => markWorkoutComplete(workout.id)}
                          className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm touch-manipulation whitespace-nowrap"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Exercise List - Shown first on mobile */}
                  {workout.workout_exercises && workout.workout_exercises.length > 0 && (
                    <div className="mb-4 sm:order-last sm:border-t sm:border-gray-100 sm:pt-4">
                      <h4 className="font-medium text-gray-900 mb-3 text-sm sm:text-base">Exercises</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {workout.workout_exercises.map((workoutEx, index) => {
                          let savedProgress = null;
                          try {
                            if (workoutEx.notes) {
                              savedProgress = JSON.parse(workoutEx.notes);
                            }
                          } catch (e) {
                            // Notes might be plain text, not JSON
                          }
                          
                          return (
                            <div key={workoutEx.id} className="bg-gray-50 rounded-lg p-3 sm:p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900 text-sm">
                                    {workoutEx.exercise?.name || 'Exercise'}
                                  </h5>
                                  <p className="text-xs sm:text-sm text-gray-600 capitalize mb-2">
                                    {workoutEx.exercise?.category}
                                  </p>
                                  <div className="space-y-1 text-xs sm:text-sm text-gray-600">
                                    {workoutEx.sets && (
                                      <span>
                                        {savedProgress?.actualSets || workoutEx.sets} sets
                                        {savedProgress?.actualSets && savedProgress.actualSets !== workoutEx.sets && (
                                          <span className="text-blue-600 ml-1">(modified)</span>
                                        )}
                                      </span>
                                    )}
                                    {workoutEx.reps && (
                                      <span>
                                        {savedProgress?.actualReps || workoutEx.reps} reps
                                        {savedProgress?.actualReps && savedProgress.actualReps !== workoutEx.reps && (
                                          <span className="text-blue-600 ml-1">(modified)</span>
                                        )}
                                      </span>
                                    )}
                                    {workoutEx.weight && (
                                      <span>
                                        {savedProgress?.actualWeight || workoutEx.weight} lbs
                                        {savedProgress?.actualWeight && savedProgress.actualWeight !== workoutEx.weight && (
                                          <span className="text-blue-600 ml-1">(modified)</span>
                                        )}
                                      </span>
                                    )}
                                    {savedProgress?.notes && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        <strong>Notes:</strong> {savedProgress.notes}
                                      </p>
                                    )}
                                    
                                    {savedProgress?.difficulty && (
                                      <div className="mt-2">
                                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                          savedProgress.difficulty === 'easy' ? 'bg-blue-100 text-blue-700' :
                                          savedProgress.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                          'bg-red-100 text-red-700'
                                        }`}>
                                          Felt {savedProgress.difficulty}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end space-y-2">
                                  {savedProgress?.completed && (
                                    <div className="flex items-center text-blue-600">
                                      <CheckCircle className="h-4 w-4 mr-1" />
                                      <span className="text-xs font-medium">Completed</span>
                                    </div>
                                  )}
                                  {savedProgress?.savedAt && (
                                    <span className="text-xs text-gray-500">
                                      Saved {new Date(savedProgress.savedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Description and Notes - Shown after exercises on mobile */}
                  <div className="space-y-3 mb-4 sm:mb-0">
                    {workout.description && (
                      <p className="text-gray-600 text-sm sm:text-base">{workout.description}</p>
                    )}

                    {workout.notes && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Coach Notes:</strong> {workout.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Mobile Action Buttons */}
                  <div className="flex sm:hidden flex-col space-y-2">
                    {!workout.completed && (
                      <button
                        onClick={() => handleWorkoutClick(workout)}
                        className="flex items-center justify-center px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium touch-manipulation"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        {workout.id.startsWith('placeholder-') ? 'View Program' : progress.isStarted ? 'Resume Workout' : 'Start Workout'}
                      </button>
                    )}
                    <button
                      onClick={() => handleWorkoutClick(workout)}
                      className="flex items-center justify-center px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm touch-manipulation"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </button>
                    {!workout.completed && !workout.id.startsWith('placeholder-') && (
                      <button
                        onClick={() => markWorkoutComplete(workout.id)}
                        className="flex items-center justify-center px-4 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm touch-manipulation"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Mark Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
              );
            })
          ) : (
            <div className="text-center py-12">
              <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No workouts this week</h3>
              <p className="text-gray-600">Navigate to other weeks to see your scheduled workouts.</p>
            </div>
          )}
        </div>
      )}


          {/* Empty State for No Workouts in My Workouts */}
          {workouts.length === 0 && !loading && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
              <div className="text-center">
                <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No training program assigned</h3>
                <p className="text-gray-600 mb-4">
                  Your training program will be automatically assigned based on your intake form responses.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
                  <p className="text-sm text-blue-800">
                    <strong>What's Next?</strong> Once assigned, you'll see:
                  </p>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• Weekly workout organization</li>
                    <li>• Sequential day-by-day structure</li>
                    <li>• Progress tracking across weeks</li>
                    <li>• Calendar view of your schedule</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};

export default ClientWorkoutView;