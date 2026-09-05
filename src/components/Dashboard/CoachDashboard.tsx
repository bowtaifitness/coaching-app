import React from 'react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Users, Calendar, TrendingUp, Video, Dumbbell, ClipboardList, CheckCircle2, AlertCircle, BarChart3 } from 'lucide-react';
import BusinessDashboard from './BusinessDashboard';

interface CoachDashboardProps {
  onNavigate?: (view: string) => void;
}

const CoachDashboard: React.FC<CoachDashboardProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [showBusinessDashboard, setShowBusinessDashboard] = useState(false);

  console.log('CoachDashboard - User:', user);
  console.log('CoachDashboard - User Role:', user?.role);
  console.log('CoachDashboard - Is Admin:', user?.role === 'admin');
  console.log('Connected to Supabase:', import.meta.env.VITE_SUPABASE_URL);

  const [stats, setStats] = useState([
    { title: user?.role === 'admin' ? 'Total Users' : 'Active Clients', value: '0', icon: Users, color: 'bg-blue-500', change: 'Loading...' },
    { title: 'Workouts This Week', value: '0', icon: Dumbbell, color: 'bg-blue-500', change: 'Loading...' },
    { title: 'Avg. Performance Gain', value: '0%', icon: TrendingUp, color: 'bg-purple-500', change: 'Loading...' }
  ]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
  const [clientsWithIntake, setClientsWithIntake] = useState<any[]>([]);
  const [clientsWithoutIntake, setClientsWithoutIntake] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      let clients;
      if (user?.role === 'admin') {
        // Admin sees all users
        const { data: allUsers, error: usersError } = await supabase
          .from('profiles')
          .select('id, role')
          .in('role', ['coach', 'client']);
        
        if (usersError) throw usersError;
        clients = allUsers;
      } else {
        // Regular coach sees only clients
        const { data: clientProfiles, error: clientsError } = await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'client');
        
        if (clientsError) throw clientsError;
        clients = clientProfiles;
      }
      
      // Fetch workouts this week
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      let workoutsQuery = supabase
        .from('workouts')
        .select('id')
        .gte('created_at', weekAgo.toISOString());

      // If not admin, filter by coach_id
      if (user?.role !== 'admin') {
        workoutsQuery = workoutsQuery.eq('coach_id', user?.id);
      }

      const { data: workouts, error: workoutsError } = await workoutsQuery;
      
      if (workoutsError) throw workoutsError;
      
      // Performance gain placeholder
      const avgGain = 0;
      
      // Update stats
      setStats([
        {
          title: user?.role === 'admin' ? 'Total Users' : 'Active Clients',
          value: clients?.length.toString() || '0',
          icon: Users,
          color: 'bg-blue-500',
          change: user?.role === 'admin' 
            ? `${clients?.filter(c => c.role === 'coach').length || 0} coaches, ${clients?.filter(c => c.role === 'client').length || 0} clients`
            : `${clients?.length || 0} total clients`
        },
        {
          title: 'Workouts This Week',
          value: workouts?.length.toString() || '0',
          icon: Dumbbell,
          color: 'bg-blue-500',
          change: 'Assigned this week'
        },
        {
          title: 'Avg. Performance Gain',
          value: avgGain > 0 ? `+${avgGain.toFixed(1)}%` : '0%',
          icon: TrendingUp,
          color: 'bg-purple-500',
          change: 'Client progress'
        }
      ]);
      
      // Fetch recent activities
      await fetchRecentActivities();

      // Fetch intake form status
      await fetchIntakeFormStatus();

      // Fetch upcoming sessions
      await fetchUpcomingSessions();
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchRecentActivities = async () => {
    try {
      // Fetch recent workouts
      const { data: recentWorkouts, error: workoutsError } = await supabase
        .from('workouts')
        .select(`
          id,
          completed,
          created_at,
          client:profiles!client_id(first_name, last_name)
        `)
        .eq('coach_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (workoutsError) throw workoutsError;
      
      // Fetch recent performance metrics
      const { data: recentPerformance, error: performanceError } = await supabase
        .from('performance_metrics')
        .select(`
          id,
          created_at,
          client:profiles!client_id(first_name, last_name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (performanceError) throw performanceError;

      // Fetch recent intake forms
      const { data: recentIntakeForms, error: intakeError } = await supabase
        .from('client_intake_forms')
        .select(`
          id,
          completed_at,
          user:profiles!user_id(first_name, last_name)
        `)
        .order('completed_at', { ascending: false })
        .limit(5);

      if (intakeError) throw intakeError;
      
      // Combine and format activities
      const activities = [];
      
      // Add workout activities
      recentWorkouts?.forEach(workout => {
        if (workout.client) {
          activities.push({
            client: `${workout.client.first_name} ${workout.client.last_name}`,
            action: workout.completed ? 'Completed workout' : 'Started new workout',
            time: formatTimeAgo(workout.created_at),
            type: 'workout'
          });
        }
      });
      
      // Add performance activities
      recentPerformance?.forEach(performance => {
        if (performance.client) {
          activities.push({
            client: `${performance.client.first_name} ${performance.client.last_name}`,
            action: 'Logged performance metrics',
            time: formatTimeAgo(performance.created_at),
            type: 'performance'
          });
        }
      });

      // Add intake form activities
      recentIntakeForms?.forEach(intakeForm => {
        if (intakeForm.user) {
          activities.push({
            client: `${intakeForm.user.first_name} ${intakeForm.user.last_name}`,
            action: 'Completed intake form',
            time: formatTimeAgo(intakeForm.completed_at),
            type: 'intake',
            timestamp: intakeForm.completed_at
          });
        }
      });

      // Sort by time and take the most recent
      activities.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setRecentActivities(activities.slice(0, 5));
      
    } catch (error) {
      console.error('Error fetching recent activities:', error);
    }
  };

  const fetchIntakeFormStatus = async () => {
    try {
      // Get all clients
      const { data: allClients, error: clientsError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, created_at')
        .eq('role', 'client')
        .order('created_at', { ascending: false });

      if (clientsError) throw clientsError;

      if (!allClients || allClients.length === 0) {
        setClientsWithIntake([]);
        setClientsWithoutIntake([]);
        return;
      }

      // Get all intake forms
      const { data: intakeForms, error: intakeError } = await supabase
        .from('client_intake_forms')
        .select('user_id, completed_at');

      if (intakeError) throw intakeError;

      // Create a map of user_id to intake form
      const intakeMap = new Map();
      intakeForms?.forEach(form => {
        intakeMap.set(form.user_id, form);
      });

      // Separate clients into those with and without intake forms
      const withIntake: any[] = [];
      const withoutIntake: any[] = [];

      allClients.forEach(client => {
        const clientData = {
          id: client.id,
          name: `${client.first_name} ${client.last_name}`,
          createdAt: client.created_at,
          intakeCompletedAt: intakeMap.get(client.id)?.completed_at
        };

        if (intakeMap.has(client.id)) {
          withIntake.push(clientData);
        } else {
          withoutIntake.push(clientData);
        }
      });

      setClientsWithIntake(withIntake.slice(0, 5));
      setClientsWithoutIntake(withoutIntake.slice(0, 5));

    } catch (error) {
      console.error('Error fetching intake form status:', error);
    }
  };

  const fetchUpcomingSessions = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data: sessions, error } = await supabase
        .from('workouts')
        .select(`
          id,
          title,
          scheduled_date,
          client:profiles!client_id(first_name, last_name)
        `)
        .eq('coach_id', user?.id)
        .gte('scheduled_date', today)
        .eq('completed', false)
        .order('scheduled_date', { ascending: true })
        .limit(5);
      
      if (error) throw error;
      
      const formattedSessions = sessions?.map(session => ({
        client: session.client ? `${session.client.first_name} ${session.client.last_name}` : 'Unknown Client',
        time: new Date(session.scheduled_date).toLocaleDateString(),
        type: session.title || 'Workout Session'
      })) || [];
      
      setUpcomingSessions(formattedSessions);
      
    } catch (error) {
      console.error('Error fetching upcoming sessions:', error);
    }
  };
  
  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  const handleStatClick = (statTitle: string) => {
    if (!onNavigate) return;
    
    switch (statTitle) {
      case 'Active Clients':
      case 'Total Users':
      case 'Total Trainers':
      case 'Total Clients':
        onNavigate('clients');
        break;
      case 'Workouts This Week':
        onNavigate('workouts');
        break;
      case 'Avg. Performance Gain':
        onNavigate('performance');
        break;
      default:
        break;
    }
  };

  if (showBusinessDashboard && user?.role === 'admin') {
    return (
      <div className="p-6">
        <div className="mb-4">
          <button
            onClick={() => setShowBusinessDashboard(false)}
            className="flex items-center text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            <span className="mr-2">←</span> Back to Coach Dashboard
          </button>
        </div>
        <BusinessDashboard />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">
              {user?.role === 'admin' ? 'Admin Dashboard' : 'Coach Dashboard'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600">Welcome back! Here's what's happening with your clients today.</p>
          </div>
          {user?.role === 'admin' && (
            <button
              onClick={() => {
                console.log('Business Dashboard button clicked');
                setShowBusinessDashboard(true);
              }}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
            >
              <BarChart3 className="w-5 h-5" />
              <span className="font-medium">View Business Metrics</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {stats.map((stat, index) => (
          <button
            key={index}
            onClick={() => handleStatClick(stat.title)}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-200 text-left group cursor-pointer active:scale-95 touch-manipulation"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0 pr-3">
                <p className="text-xs sm:text-sm font-medium text-gray-600 mb-1 truncate">{stat.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-blue-600 mt-1 group-hover:text-blue-700 truncate">{stat.change}</p>
              </div>
              <div className={`${stat.color} rounded-lg p-2 sm:p-3 flex-shrink-0`}>
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Recent Activity</h3>
            {loading && <p className="text-xs sm:text-sm text-gray-500">Loading activities...</p>}
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              {recentActivities.length > 0 ? recentActivities.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'workout' ? 'bg-blue-500' :
                    activity.type === 'video' ? 'bg-blue-500' :
                    activity.type === 'performance' ? 'bg-purple-500' :
                    activity.type === 'intake' ? 'bg-yellow-500' : 'bg-orange-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      <span className="font-medium">{activity.client}</span> {activity.action}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No recent activity</p>
                  <p className="text-sm text-gray-400">Client activities will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Today's Schedule */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 sm:p-6 border-b border-gray-100">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Today's Schedule</h3>
            {loading && <p className="text-xs sm:text-sm text-gray-500">Loading sessions...</p>}
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              {upcomingSessions.length > 0 ? upcomingSessions.map((session, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{session.client}</p>
                    <p className="text-sm text-gray-600">{session.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-blue-600">{session.time}</p>
                    <Calendar className="h-4 w-4 text-blue-500 ml-auto mt-1" />
                  </div>
                </div>
              )) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No upcoming sessions</p>
                  <p className="text-sm text-gray-400">Scheduled workouts will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Client Intake Forms Status */}
      {(clientsWithIntake.length > 0 || clientsWithoutIntake.length > 0) && (
        <div className="mt-6 sm:mt-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Client Intake Forms</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            {/* Clients with completed intake forms */}
            {clientsWithIntake.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Recently Completed</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Clients who have filled out their intake forms</p>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="space-y-3">
                    {clientsWithIntake.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <ClipboardList className="h-5 w-5 text-blue-600" />
                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            <p className="text-xs text-gray-500">
                              Completed {formatTimeAgo(client.intakeCompletedAt)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => onNavigate?.('clients', client.id)}
                          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Clients without intake forms */}
            {clientsWithoutIntake.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 sm:p-6 border-b border-gray-100">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Pending Intake Forms</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Clients who haven't completed their intake forms</p>
                </div>
                <div className="p-4 sm:p-6">
                  <div className="space-y-3">
                    {clientsWithoutIntake.map((client) => (
                      <div key={client.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors">
                        <div className="flex items-center space-x-3">
                          <ClipboardList className="h-5 w-5 text-orange-600" />
                          <div>
                            <p className="font-medium text-gray-900">{client.name}</p>
                            <p className="text-xs text-gray-500">
                              Joined {formatTimeAgo(client.createdAt)}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs text-orange-600 font-medium px-2 py-1 bg-orange-100 rounded">
                          Pending
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachDashboard;