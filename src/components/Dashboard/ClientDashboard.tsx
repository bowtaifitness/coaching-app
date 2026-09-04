import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { useAuth } from '../../contexts/AuthContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { supabase } from '../../lib/supabase';
import ClientIntakeModal from '../Client/ClientIntakeModal';

import TrialExpirationNotification from '../Trial/TrialExpirationNotification';
import SubscriptionRequiredModal from '../Subscription/SubscriptionRequiredModal';
import { useTrialStatus } from '../../hooks/useTrialStatus';
import {
  Calendar,
  TrendingUp,
  Target,
  Clock,
  CheckCircle,
  AlertCircle,
  Dumbbell,
  Mail,
  Play,
  Star,
  Award,
  Activity,
  BarChart3,
  User,
  ChevronRight,
  Plus,
  Users,
  HelpCircle,
  History,
  ClipboardList,
  Shield,
  AlertTriangle,
  ImageIcon,
  Loader,
} from 'lucide-react';

interface ClientDashboardProps {
  onNavigate?: (view: string, workoutId?: string) => void;
  onIntakeComplete?: () => void;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ onNavigate, onIntakeComplete }) => {
  const { user } = useAuth();
  const { hasAccess, isTrialExpired, daysRemaining, trialEndsAt, loading: trialLoading } = useTrialStatus(user);
  const [coachError, setCoachError] = useState<string | null>(null);
  const [stats, setStats] = useState([
    { title: 'Workouts This Week', value: '0/0', icon: CheckCircle, color: 'bg-green-500', description: 'Loading...', trend: null },
    { title: 'Workouts Completed', value: '0', icon: TrendingUp, color: 'bg-blue-500', description: 'Loading...', trend: null },
    { title: 'Performance Trend', value: '0%', icon: Target, color: 'bg-purple-500', description: 'Loading...', trend: null },
    { title: 'Next Workout', value: 'None', icon: Clock, color: 'bg-orange-500', description: 'Loading...', trend: null }
  ]);
  const [thisWeekWorkouts, setThisWeekWorkouts] = useState<any[]>([]);
  const [recentPerformance, setRecentPerformance] = useState<any[]>([]);
  const [coachInfo, setCoachInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showIntakeModal, setShowIntakeModal] = useState(false);
  const [hasCompletedIntake, setHasCompletedIntake] = useState(true);

  const { openTutorial } = useTutorial();

  const checkTutorialFlag = useCallback(async () => {
    if (!user || !hasAccess || trialLoading) return;
    const { value } = await Preferences.get({ key: 'hasSeenOnboardingTutorial' });
    console.log('Tutorial flag status:', value);
    if (value === null || value === 'false') {
      openTutorial();
    }
  }, [user, hasAccess, trialLoading, openTutorial]);

  useEffect(() => {
    if (!user || trialLoading || !hasAccess) return;
    checkTutorialFlag();

    const listener = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        checkTutorialFlag();
      }
    });

    return () => {
      listener.then(handle => handle.remove());
    };
  }, [user, hasAccess, trialLoading, checkTutorialFlag]);

  const handleSubscribeClick = () => {
    onNavigate?.('profile');
  };

  useEffect(() => {
    if (user) {
      console.log('ClientDashboard: User loaded, fetching dashboard data for client:', user.id);
      checkIntakeFormStatus();
      fetchDashboardData();
    }
  }, [user]);

  const checkIntakeFormStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('client_intake_forms')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setHasCompletedIntake(false);
        setShowIntakeModal(true);
      } else {
        const hasNewFields =
          data.gender &&
          data.height &&
          data.weight &&
          data.fitness_experience != null &&
          data.primary_fitness_goal &&
          data.biggest_strength &&
          data.biggest_weakness &&
          data.years_strength_training != null &&
          data.training_goal &&
          data.workout_frequency;

        const hasBasicFields = data.age != null;

        if (!hasBasicFields || !hasNewFields) {
          setHasCompletedIntake(false);
          setShowIntakeModal(true);
        } else {
          setHasCompletedIntake(true);
        }
      }
    } catch (error) {
      console.error('Error checking intake form status:', error);
    }
  };

  const handleIntakeComplete = () => {
    setShowIntakeModal(false);
    setHasCompletedIntake(true);
    onIntakeComplete?.();
  };

  const handleIntakeClose = () => {
    setShowIntakeModal(false);
  };

  const fetchDashboardData = async () => {
    console.log('ClientDashboard: Starting fetchDashboardData for user:', user?.id);
    try {
      setLoading(true);
      
      // Fetch workouts this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      console.log('ClientDashboard: Fetching workouts for client:', user?.id, 'since:', weekAgo.toISOString().split('T')[0]);
      
      const { data: weeklyWorkouts, error: workoutsError } = await supabase
        .from('workouts')
        .select('id, completed, title, scheduled_date')
        .eq('client_id', user?.id)
        .or('archived.is.null,archived.eq.false')
        .gte('scheduled_date', weekAgo.toISOString().split('T')[0]);
      
      if (workoutsError) throw workoutsError;
      
      console.log('ClientDashboard: Weekly workouts result:', weeklyWorkouts);
      
      const completedWorkouts = weeklyWorkouts?.filter(w => w.completed).length || 0;
      const totalWorkouts = weeklyWorkouts?.length || 0;
      
      // Fetch recent performance metrics
      const { data: performanceMetrics, error: performanceError } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (performanceError) throw performanceError;
      
      // Calculate total workouts completed
      const totalCompleted = performanceMetrics?.length || 0;
      
      // Performance trend placeholder
      const performanceTrend = 0;
      
      // Fetch next workout
      const today = new Date().toISOString().split('T')[0];
      const { data: nextWorkout, error: nextWorkoutError } = await supabase
        .from('workouts')
        .select('scheduled_date, title')
        .eq('client_id', user?.id)
        .or('archived.is.null,archived.eq.false')
        .gte('scheduled_date', today)
        .eq('completed', false)
        .order('scheduled_date', { ascending: true })
        .limit(1);
      
      if (nextWorkoutError) throw nextWorkoutError;
      
      // Update stats
      setStats([
        {
          title: 'Workouts This Week',
          value: `${completedWorkouts}/${totalWorkouts}`,
          icon: CheckCircle,
          color: 'bg-green-500',
          description: totalWorkouts > completedWorkouts ? `${totalWorkouts - completedWorkouts} remaining` : 'All completed!',
          trend: totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0
        },
        {
          title: 'Workouts Completed',
          value: totalCompleted > 0 ? `${totalCompleted}` : 'No data',
          icon: TrendingUp,
          color: 'bg-blue-500',
          description: totalCompleted > 0 ? `${totalCompleted} total entries` : 'Start tracking',
          trend: totalCompleted > 0 ? totalCompleted : null
        },
        {
          title: 'Performance Trend',
          value: performanceTrend !== 0 ? `${performanceTrend > 0 ? '+' : ''}${performanceTrend.toFixed(1)}%` : 'No trend',
          icon: Target,
          color: 'bg-purple-500',
          description: performanceTrend > 0 ? 'Improving!' : performanceTrend < 0 ? 'Keep working' : 'Track more data',
          trend: performanceTrend
        },
        {
          title: 'Next Workout',
          value: nextWorkout && nextWorkout.length > 0 
            ? new Date(nextWorkout[0].scheduled_date).toLocaleDateString()
            : 'None scheduled',
          icon: Clock,
          color: 'bg-orange-500',
          description: nextWorkout && nextWorkout.length > 0 
            ? nextWorkout[0].title || 'Workout session'
            : 'Contact your coach',
          trend: null
        }
      ]);
      
      // Fetch this week's workouts
      await fetchThisWeekWorkouts();
      
      // Fetch recent performance data
      await fetchRecentPerformance();
      
      // Fetch coach info
      await fetchCoachInfo();

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchThisWeekWorkouts = async () => {
    try {
      console.log('ClientDashboard: Fetching workouts for client:', user?.id);

      // Fetch all workouts for the client
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          title,
          description,
          notes,
          completed,
          scheduled_date,
          workout_exercises(id, notes)
        `)
        .eq('client_id', user?.id)
        .or('archived.is.null,archived.eq.false')
        .order('scheduled_date', { ascending: true });

      if (error) throw error;

      console.log('ClientDashboard: All workouts result:', workouts);

      if (!workouts || workouts.length === 0) {
        setThisWeekWorkouts([]);
        return;
      }

      // Group workouts by program week (from description)
      const weekMap = new Map<number, any[]>();

      workouts.forEach(workout => {
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

      // Find the current program week (first incomplete week, or first week with workouts)
      let currentWeekNum = 1;
      for (const [weekNum, weekWorkouts] of Array.from(weekMap.entries()).sort(([a], [b]) => a - b)) {
        const hasIncomplete = weekWorkouts.some(w => !w.completed);
        if (hasIncomplete) {
          currentWeekNum = weekNum;
          break;
        }
      }

      // Get workouts for the current program week
      const currentWeekWorkouts = weekMap.get(currentWeekNum) || [];

      const formattedWorkouts = currentWeekWorkouts.map(workout => {
        let isStarted = false;
        for (const we of workout.workout_exercises || []) {
          if (we.notes) {
            try {
              const parsed = typeof we.notes === 'string' ? JSON.parse(we.notes) : we.notes;
              if (parsed.completed || parsed.setProgress?.some((s: any) => s.completed || s.reps || s.weight || s.duration)) {
                isStarted = true;
                break;
              }
            } catch { /* not valid JSON */ }
          }
        }
        return {
          id: workout.id,
          title: workout.title || 'Workout Session',
          date: workout.scheduled_date,
          exercises: workout.workout_exercises?.length || 0,
          completed: workout.completed,
          description: workout.description,
          isStarted,
        };
      });

      setThisWeekWorkouts(formattedWorkouts);
      console.log('ClientDashboard: Showing workouts for program week:', currentWeekNum, 'Total:', formattedWorkouts.length);

    } catch (error) {
      console.error('ClientDashboard: Error fetching this week\'s workouts:', error);
    }
  };


  const fetchRecentPerformance = async () => {
    try {
      const { data: performanceMetrics, error } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('client_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) throw error;
      
      if (performanceMetrics && performanceMetrics.length > 0) {
        const formattedPerformance = [];
        
        // Get the most recent entries for each metric
        const metrics = [
          { key: 'max_pushups', label: 'Push-ups', unit: 'reps' },
          { key: 'max_squat', label: 'Squat Max', unit: 'lbs' },
          { key: 'max_bench', label: 'Bench Max', unit: 'lbs' },
          { key: 'max_deadlift', label: 'Deadlift Max', unit: 'lbs' }
        ];
        
        metrics.forEach(metric => {
          const latest = performanceMetrics.find(m => m[metric.key]);
          if (latest) {
            const previous = performanceMetrics.slice(1).find(m => m[metric.key]);
            const change = previous ? ((latest[metric.key] - previous[metric.key]) / previous[metric.key]) * 100 : 0;
            
            formattedPerformance.push({
              metric: metric.label,
              value: `${latest[metric.key]} ${metric.unit}`,
              change: change !== 0 ? `${change > 0 ? '+' : ''}${change.toFixed(1)}%` : 'No change',
              trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral',
              date: latest.created_at
            });
          }
        });
        
        setRecentPerformance(formattedPerformance);
      }
      
    } catch (error) {
      console.error('Error fetching recent performance:', error);
    }
  };


  const fetchCoachInfo = async () => {
    try {
      console.log('ClientDashboard: Fetching coach info for client:', user?.id);
      setCoachError(null);
      
      // Get coach from coach_client_assignments
      const { data: assignment, error } = await supabase
        .from('coach_client_assignments')
        .select(`
          coach_id,
          active,
          coach:profiles!coach_id(first_name, last_name, avatar_url, email)
        `)
        .eq('client_id', user?.id)
        .eq('active', true)
        .maybeSingle();
      
      console.log('ClientDashboard: Coach assignment query result:', { assignment, error });
      
      if (error) {
        console.error('ClientDashboard: Error fetching coach assignment:', error);
        throw error;
      }
      
      console.log('ClientDashboard: Assignment data details:', assignment);
      
      if (assignment?.coach) {
        console.log('ClientDashboard: Coach found:', assignment.coach);
        setCoachInfo(assignment.coach);
      } else if (assignment) {
        console.log('ClientDashboard: Assignment exists but no coach data:', assignment);
        // Assignment exists but coach data might be missing, try to fetch coach separately
        const { data: coachProfile, error: coachError } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url, email')
          .eq('id', assignment.coach_id)
          .maybeSingle();
        
        console.log('ClientDashboard: Direct coach profile query result:', { coachProfile, error: coachError });
        
        if (!coachError && coachProfile) {
          console.log('ClientDashboard: Coach found via direct query:', coachProfile);
          setCoachInfo(coachProfile);
        } else {
          console.log('ClientDashboard: No coach found via direct query, trying fallback');
          const fallbackCoach = await tryFallbackCoachQuery();
          if (!fallbackCoach) {
            setCoachError('Coach profile not found in system');
          }
        }
      } else {
        console.log('ClientDashboard: No active coach assignment found');
        const fallbackCoach = await tryFallbackCoachQuery();
        if (!fallbackCoach) {
          setCoachError('No coach assigned');
        }
      }
      
    } catch (error) {
      console.error('Error fetching coach info:', error);
      setCoachError('Error loading coach information');
    }
  };
  
  const tryFallbackCoachQuery = async (): Promise<boolean> => {
    // Fallback: try to get coach from recent workouts
    const { data: recentWorkout, error: workoutError } = await supabase
      .from('workouts')
      .select(`
        coach_id,
        coach:profiles!coach_id(first_name, last_name, avatar_url, email)
      `)
      .eq('client_id', user?.id)
      .not('coach_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    console.log('ClientDashboard: Fallback workout coach query result:', { recentWorkout, error: workoutError });
    
    if (!workoutError && recentWorkout?.coach) {
      console.log('ClientDashboard: Coach found via workout fallback:', recentWorkout.coach);
      setCoachInfo(recentWorkout.coach);
      return true;
    } else {
      console.log('ClientDashboard: No coach found via any method');
      
      // Check if there are any coach_client_assignments at all for debugging
      const { data: allAssignments, error: allAssignmentsError } = await supabase
        .from('coach_client_assignments')
        .select('*')
        .eq('client_id', user?.id);
      
      console.log('ClientDashboard: All assignments for debugging:', { allAssignments, error: allAssignmentsError });
      
      // Check if the coach profile exists in the profiles table
      if (allAssignments && allAssignments.length > 0) {
        const coachId = allAssignments[0].coach_id;
        const { data: coachExists, error: coachExistsError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .eq('id', coachId)
          .maybeSingle();
        
        console.log('ClientDashboard: Coach profile exists check:', { coachExists, error: coachExistsError, coachId });
        
        if (!coachExists) {
          const errorMessage = `Coach assignment points to non-existent coach profile: ${coachId}`;
          console.warn('ClientDashboard:', errorMessage);
          setCoachError(errorMessage);
        }
      }
      return false;
    }
  };

  const handleStatClick = (statTitle: string) => {
    if (!onNavigate) return;

    switch (statTitle) {
      case 'Workouts This Week':
      case 'Next Workout':
        onNavigate('workouts');
        break;
      case 'Workouts Completed':
      case 'Performance Trend':
        onNavigate('performance');
        break;
      default:
        break;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return 'text-green-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  return (
    <div className="p-4 sm:p-6 md:p-8">
      {showIntakeModal && user && (
        <ClientIntakeModal
          userId={user.id}
          onComplete={handleIntakeComplete}
          onClose={handleIntakeClose}
        />
      )}

      {/* Trial expiration notification (7 days or 1 day remaining) */}
      {!trialLoading && !isTrialExpired && (
        <TrialExpirationNotification onSubscribeClick={handleSubscribeClick} />
      )}

      {/* Trial expired modal (blocks access) */}
      {!trialLoading && isTrialExpired && !hasAccess && (
        <SubscriptionRequiredModal
          daysRemaining={daysRemaining}
          trialEndsAt={trialEndsAt}
          onSubscribe={handleSubscribeClick}
        />
      )}

      <div className="mb-4 sm:mb-8">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
          <button
            onClick={openTutorial}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 hover:text-green-800 hover:bg-green-50 rounded-lg px-3 py-2 transition-colors touch-manipulation"
          >
            <HelpCircle className="h-4 w-4" />
            How it Works
          </button>
        </div>
        <p className="text-sm sm:text-base text-gray-600">Track your progress and stay on top of your training goals.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
        {/* Current Program Week Workouts */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Current Week's Workouts</h3>
              <button
                onClick={() => onNavigate?.('workouts')}
                className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center px-2"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-3">
              {thisWeekWorkouts.length > 0 ? [...thisWeekWorkouts].map((w, i) => ({ ...w, _originalIndex: i })).sort((a, b) => Number(a.completed) - Number(b.completed)).map((workout) => {
                // Extract day number from title or description
                let dayNum = workout._originalIndex + 1;
                const titleMatch = workout.title?.match(/Day\s+(\d+)/i);
                const descMatch = workout.description?.match(/Day\s+(\d+)/i);
                if (titleMatch) {
                  dayNum = parseInt(titleMatch[1], 10);
                } else if (descMatch) {
                  dayNum = parseInt(descMatch[1], 10);
                }

                return (
                  <div
                    key={workout.id}
                    onClick={() => onNavigate?.('workouts', workout.id)}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all hover:shadow-md touch-manipulation cursor-pointer ${
                      workout.completed
                        ? 'border-green-200 bg-green-50 hover:bg-green-100'
                        : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex-1 w-full">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">Day {dayNum}</span>
                          {workout.completed && (
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                          )}
                        </div>
                        <h4 className="font-medium text-gray-900 text-sm sm:text-base mb-1">{workout.title}</h4>
                        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            {new Date(workout.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </div>
                          <div className="flex items-center">
                            <Dumbbell className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                            {workout.exercises} exercises
                          </div>
                        </div>
                      </div>
                      {!workout.completed && (
                        <div className="w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-lg flex items-center justify-center text-sm pointer-events-none">
                          <Play className="h-4 w-4 mr-1" />
                          {workout.isStarted ? 'Resume' : 'Start'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }) : (
                <div className="text-center py-12">
                  <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 text-lg font-medium mb-1">No workouts this week</p>
                  <p className="text-sm text-gray-400">Your coach will schedule workouts for you</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Section */}
        <div className="space-y-6">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleStatClick(stat.title)}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
                </div>
                <div className={`${stat.color} rounded-lg p-3`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Overview */}
      <div className="mt-4 sm:mt-6 lg:mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6">
        {/* Recent Performance */}
        <div className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Performance</h3>
              <button
                onClick={() => onNavigate?.('performance')}
                className="text-green-600 hover:text-green-700 text-xs sm:text-sm font-medium touch-manipulation"
              >
                View All
              </button>
            </div>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              {recentPerformance.length > 0 ? recentPerformance.map((metric, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg touch-manipulation">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 text-sm sm:text-base truncate">{metric.metric}</p>
                    <p className="text-xs sm:text-sm text-gray-600">{metric.value}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(metric.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`flex items-center space-x-1 px-2 py-1 rounded text-xs font-medium ${
                    metric.trend === 'up' ? 'bg-green-100 text-green-700' : 
                    metric.trend === 'down' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                  }`}>
                    <span>{getTrendIcon(metric.trend)}</span>
                    <span>{metric.change}</span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6">
                  <TrendingUp className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">No performance data yet</p>
                  <p className="text-sm text-gray-400">Start tracking your metrics to see progress</p>
                  <button 
                    onClick={() => onNavigate?.('performance')}
                    className="mt-3 inline-flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm touch-manipulation"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClientDashboard;