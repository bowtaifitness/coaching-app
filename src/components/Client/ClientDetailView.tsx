import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import TrainerCalendarView from './TrainerCalendarView';
import EditAssignedWorkoutModal from '../Workout/EditAssignedWorkoutModal';
import ClientStreaksPanel from './ClientStreaksPanel';
import { ArrowLeft, ChevronRight, ChevronLeft, User, Mail, Phone, Calendar, MapPin, CreditCard as Edit3, MessageCircle, BarChart3, Dumbbell, Video, Clock, CheckCircle, AlertCircle, TrendingUp, Target, Award, Users, BookOpen, Eye, Play, Upload, ClipboardList, Trash2, CreditCard as Edit, Flame, ClipboardCheck } from 'lucide-react';
import CoachClientLogView from '../Workout/CoachClientLogView';

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
  initialTab?: string;
  userType?: 'clients' | 'trainers';
  onNavigate?: (view: string) => void;
}

const ClientDetailView: React.FC<ClientDetailProps> = ({ 
  clientId, 
  onBack, 
  initialTab = 'overview',
  userType = 'clients',
  onNavigate
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [clientData, setClientData] = useState<any>(null);
  const [workoutData, setWorkoutData] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [messagesData, setMessagesData] = useState<any[]>([]);
  const [videoData, setVideoData] = useState<any[]>([]);
  const [intakeFormData, setIntakeFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>('');
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const tabsContainerRef = useRef<HTMLDivElement>(null);

  const checkTabsScroll = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    checkTabsScroll();
    el.addEventListener('scroll', checkTabsScroll);
    window.addEventListener('resize', checkTabsScroll);
    return () => {
      el.removeEventListener('scroll', checkTabsScroll);
      window.removeEventListener('resize', checkTabsScroll);
    };
  }, [checkTabsScroll, loading]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsContainerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction === 'right' ? 150 : -150, behavior: 'smooth' });
  };

  useEffect(() => {
    fetchClientDetails();
    fetchCurrentUserRole();
  }, [clientId]);

  const fetchCurrentUserRole = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setCurrentUserRole(data.role);
      }
    } catch (err) {
      console.error('Error fetching user role:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'workouts') {
      fetchWorkoutData();
    } else if (activeTab === 'performance') {
      fetchPerformanceData();
    } else if (activeTab === 'messages') {
      fetchMessagesData();
    } else if (activeTab === 'videos') {
      fetchVideoData();
    }
  }, [activeTab, clientId]);

  const fetchClientDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', clientId)
        .single();

      if (profileError) throw profileError;

      // Get additional stats
      const { count: totalWorkouts } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq(userType === 'trainers' ? 'coach_id' : 'client_id', clientId);

      const { count: completedWorkouts } = await supabase
        .from('workouts')
        .select('*', { count: 'exact', head: true })
        .eq(userType === 'trainers' ? 'coach_id' : 'client_id', clientId)
        .eq('completed', true);

      // Get assigned clients count for trainers
      let assignedClientsCount = 0;
      if (userType === 'trainers') {
        const { count } = await supabase
          .from('coach_client_assignments')
          .select('*', { count: 'exact', head: true })
          .eq('coach_id', clientId)
          .eq('active', true);
        assignedClientsCount = count || 0;
      }

      // Get intake form if client
      let intakeForm = null;
      if (userType === 'clients') {
        const { data: intakeData } = await supabase
          .from('client_intake_forms')
          .select('*')
          .eq('user_id', clientId)
          .maybeSingle();
        intakeForm = intakeData;
        setIntakeFormData(intakeData);
      }

      setClientData({
        ...profile,
        totalWorkouts: totalWorkouts || 0,
        completedWorkouts: completedWorkouts || 0,
        assignedClientsCount
      });

    } catch (err) {
      console.error('Error fetching client details:', err);
      setError('Failed to load client details');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkoutData = async () => {
    try {
      let query;

      if (userType === 'trainers') {
        // For trainers, show workout templates they created
        query = supabase
          .from('workout_templates')
          .select(`
            id,
            title,
            description,
            created_at,
            template_exercises(
              id,
              exercise:exercises(name, category)
            )
          `)
          .eq('created_by', clientId);
      } else {
        // For clients, show their assigned workouts
        query = supabase
          .from('workouts')
          .select(`
            id,
            title,
            description,
            scheduled_date,
            completed,
            created_at,
            workout_exercises(
              id,
              exercise:exercises(name, category)
            )
          `)
          .eq('client_id', clientId);
      }

      const { data, error: workoutError } = await query.order('created_at', { ascending: false });

      if (workoutError) throw workoutError;
      setWorkoutData(data || []);

    } catch (err) {
      console.error('Error fetching workout data:', err);
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .eq('id', workoutId);

      if (error) throw error;

      setWorkoutData(prev => prev.filter(w => w.id !== workoutId));

      fetchClientDetails();
    } catch (err) {
      console.error('Error deleting workout:', err);
      alert('Failed to delete workout. Please try again.');
    }
  };

  const fetchPerformanceData = async () => {
    try {
      const { data, error: performanceError } = await supabase
        .from('performance_metrics')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (performanceError) throw performanceError;
      setPerformanceData(data || []);

    } catch (err) {
      console.error('Error fetching performance data:', err);
    }
  };

  const fetchMessagesData = async () => {
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          read,
          sender:profiles!sender_id(first_name, last_name),
          receiver:profiles!receiver_id(first_name, last_name)
        `)
        .or(`sender_id.eq.${clientId},receiver_id.eq.${clientId}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (messagesError) throw messagesError;
      setMessagesData(messagesData || []);

    } catch (err) {
      console.error('Error fetching messages data:', err);
    }
  };

  const handleDeleteClient = async () => {
    if (deleteConfirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    try {
      setDeleting(true);

      console.log('Attempting to delete client:', clientId);

      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', clientId);

      console.log('Delete result:', { error });

      if (error) {
        console.error('Delete error:', error);
        throw new Error(error.message || 'Failed to delete client');
      }

      alert('Client deleted successfully');
      setShowDeleteModal(false);
      setDeleteConfirmText('');
      onBack();
    } catch (err: any) {
      console.error('Error deleting client:', err);
      alert(err.message || 'Failed to delete client. Please try again.');
      setDeleting(false);
    }
  };

  const fetchVideoData = async () => {
    try {
      let query;
      
      if (userType === 'trainers') {
        // For trainers, show video analyses where they are the coach
        query = supabase
          .from('swing_analyses')
          .select(`
            id,
            video_url,
            analysis,
            feedback,
            created_at,
            client:profiles!client_id(first_name, last_name)
          `)
          .eq('coach_id', clientId);
      } else {
        // For clients, show their own video analyses
        query = supabase
          .from('swing_analyses')
          .select(`
            id,
            video_url,
            analysis,
            feedback,
            created_at,
            coach:profiles!coach_id(first_name, last_name)
          `)
          .eq('client_id', clientId);
      }

      const { data, error: videoError } = await query.order('created_at', { ascending: false });

      if (videoError) throw videoError;
      setVideoData(data || []);

    } catch (err) {
      console.error('Error fetching video data:', err);
    }
  };

  const getTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {userType === 'trainers' ? 'Trainer Information' : 'Client Information'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Full Name</p>
                      <p className="font-medium text-gray-900">
                        {clientData?.first_name} {clientData?.last_name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-gray-900">
                        {clientData?.email || 'No email'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <p className="font-medium text-gray-900">
                        {clientData?.phone || 'No phone'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Member Since</p>
                      <p className="font-medium text-gray-900">
                        {clientData?.created_at ? new Date(clientData.created_at).toLocaleDateString() : 'Unknown'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Role</p>
                      <p className="font-medium text-gray-900 capitalize">
                        {clientData?.role === 'admin' ? 'Administrator' : clientData?.role}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {userType === 'trainers' ? 'Coaching Stats' : 'Training Stats'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="bg-blue-100 rounded-full p-3 w-12 h-12 mx-auto mb-2">
                    <Dumbbell className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {userType === 'trainers' ? clientData?.assignedClientsCount || 0 : clientData?.totalWorkouts || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userType === 'trainers' ? 'Total Clients' : 'Total Workouts'}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-green-100 rounded-full p-3 w-12 h-12 mx-auto mb-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {userType === 'trainers' ? clientData?.assignedClientsCount || 0 : clientData?.completedWorkouts || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userType === 'trainers' ? 'Active Clients' : 'Completed'}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="bg-purple-100 rounded-full p-3 w-12 h-12 mx-auto mb-2">
                    <BookOpen className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">
                    {workoutData?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    {userType === 'trainers' ? 'Templates' : 'Programs'}
                  </p>
                </div>
              </div>
            </div>

            {/* Intake Form Information (Clients only) */}
            {userType === 'clients' && intakeFormData && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Client Intake Summary</h3>
                  <button
                    onClick={() => setActiveTab('intake')}
                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                  >
                    View Full Form
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Age / Gender</p>
                      <p className="font-medium text-gray-900">{intakeFormData.age} years, {intakeFormData.gender || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fitness Level</p>
                      <p className="font-medium text-gray-900">{intakeFormData.fitness_level || intakeFormData.fitness_level || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Fitness Experience</p>
                      <p className="font-medium text-gray-900">{intakeFormData.fitness_experience || intakeFormData.years_playing || 'Not specified'} years</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Primary Fitness Goal</p>
                      <p className="font-medium text-gray-900">{intakeFormData.primary_fitness_goal || intakeFormData.primary_goal || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Biggest Weakness</p>
                      <p className="font-medium text-gray-900">{intakeFormData.biggest_weakness || intakeFormData.biggest_challenge || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Play Frequency</p>
                      <p className="font-medium text-gray-900">{intakeFormData.play_frequency || intakeFormData.practice_frequency || 'Not specified'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Training Experience</p>
                      <p className="font-medium text-gray-900">{intakeFormData.years_strength_training || 'Not specified'} years</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Training Goal</p>
                      <p className="font-medium text-gray-900">{intakeFormData.training_goal || 'Not specified'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Equipment Access</p>
                      <p className="font-medium text-gray-900">
                        {intakeFormData.equipment_access && intakeFormData.equipment_access.trim().length > 0
                          ? intakeFormData.equipment_access
                          : 'Not specified'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No Intake Form Message (Clients only) */}
            {userType === 'clients' && !intakeFormData && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">No Intake Form Completed</p>
                    <p className="text-sm text-blue-700 mt-1">
                      This client hasn't completed their intake form yet. The form will appear when they first log in.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'workouts':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  {userType === 'trainers' ? 'Workout Templates' : 'Assigned Workouts'}
                </h3>
              </div>
              <div className="p-6">
                {workoutData.length > 0 ? (
                  <div className="space-y-4">
                    {workoutData.map((workout) => (
                      <div key={workout.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="bg-purple-500 rounded-lg p-2">
                            {userType === 'trainers' ? (
                              <BookOpen className="h-5 w-5 text-white" />
                            ) : (
                              <Dumbbell className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{workout.title}</h4>
                            <p className="text-sm text-gray-600">{workout.description}</p>
                            <p className="text-xs text-gray-500">
                              Created {new Date(workout.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <p className="font-medium text-gray-900">
                              {userType === 'trainers'
                                ? `${workout.template_exercises?.length || 0} exercises`
                                : workout.completed ? 'Completed' : 'Pending'
                              }
                            </p>
                            {userType === 'clients' && workout.scheduled_date && (
                              <p className="text-sm text-gray-600">
                                {new Date(workout.scheduled_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                          {userType === 'clients' && (user?.role === 'coach' || user?.role === 'admin') && (
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setEditingWorkoutId(workout.id)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit workout"
                              >
                                <Edit className="h-5 w-5" />
                              </button>
                              <button
                                onClick={() => handleDeleteWorkout(workout.id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete workout"
                              >
                                <Trash2 className="h-5 w-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">
                      {userType === 'trainers' ? 'No workout templates created' : 'No workouts assigned'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'workout-logs':
        return (
          <CoachClientLogView
            clientId={clientId}
            clientName={`${clientData?.first_name ?? ''} ${clientData?.last_name ?? ''}`}
            onBack={() => setActiveTab('overview')}
          />
        );

      case 'performance':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Performance Metrics</h3>
              </div>
              <div className="p-6">
                {performanceData.length > 0 ? (
                  <div className="space-y-4">
                    {performanceData.map((metric) => (
                      <div key={metric.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="bg-green-500 rounded-lg p-2">
                            <BarChart3 className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {new Date(metric.date).toLocaleDateString()}
                            </p>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              {metric.swing_speed && (
                                <span>Swing: {metric.swing_speed} mph</span>
                              )}
                              {metric.carry_distance && (
                                <span>Carry: {metric.carry_distance} yards</span>
                              )}
                              {metric.ball_speed && (
                                <span>Ball: {metric.ball_speed} mph</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">
                            {new Date(metric.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No performance data recorded</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'messages':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">Recent Messages</h3>
              </div>
              <div className="p-6">
                {messagesData.length > 0 ? (
                  <div className="space-y-4">
                    {messagesData.map((message) => (
                      <div key={message.id} className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                        <div className="bg-blue-500 rounded-lg p-2">
                          <MessageCircle className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <p className="font-medium text-gray-900">
                              {message.sender?.first_name} {message.sender?.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(message.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <p className="text-gray-700">{message.content}</p>
                          {!message.read && (
                            <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                              Unread
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No messages found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'videos':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">
                  {userType === 'trainers' ? 'Video Analyses' : 'My Video Analyses'}
                </h3>
              </div>
              <div className="p-6">
                {videoData.length > 0 ? (
                  <div className="space-y-4">
                    {videoData.map((video) => (
                      <div key={video.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="bg-red-500 rounded-lg p-2">
                            <Video className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {video.analysis || 'Swing Analysis'}
                            </h4>
                            {userType === 'trainers' && video.client && (
                              <p className="text-sm text-gray-600">
                                Client: {video.client.first_name} {video.client.last_name}
                              </p>
                            )}
                            {userType === 'clients' && video.coach && (
                              <p className="text-sm text-gray-600">
                                Coach: {video.coach.first_name} {video.coach.last_name}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              Uploaded {new Date(video.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            video.feedback 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'
                          }`}>
                            {video.feedback ? 'Analyzed' : 'Pending'}
                          </span>
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Video
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Video className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">
                      {userType === 'trainers' 
                        ? 'No video analyses assigned to this trainer' 
                        : 'No video analyses uploaded'
                      }
                    </p>
                    <p className="text-sm text-gray-400">
                      {userType === 'trainers'
                        ? 'Video analyses from clients will appear here when submitted'
                        : 'Upload swing videos to get coach feedback'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'intake':
        return (
          <div className="space-y-6">
            {intakeFormData ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Client Intake Form</h3>
                  <span className="text-sm text-gray-500">
                    Completed {new Date(intakeFormData.completed_at).toLocaleDateString()}
                  </span>
                </div>

                <div className="space-y-8">
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b">Basic Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Age</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.age} years old</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Gender</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.gender || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Height</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.height || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Weight</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.weight || 'Not specified'}</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b">Fitness Background</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Fitness Experience</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.fitness_experience || intakeFormData.years_playing || 'Not specified'} years</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Fitness Level</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.fitness_level || intakeFormData.fitness_level || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Primary Fitness Goal</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.primary_fitness_goal || intakeFormData.primary_goal || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Play Frequency</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.play_frequency || intakeFormData.practice_frequency || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Biggest Strength</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.biggest_strength || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Biggest Weakness</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.biggest_weakness || intakeFormData.biggest_challenge || 'Not specified'}</p>
                      </div>
                      {intakeFormData.fitness_notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600 mb-1">Additional Notes</p>
                          <p className="text-lg font-medium text-gray-900">{intakeFormData.fitness_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-4 pb-2 border-b">Training Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Years Strength Training Experience</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.years_strength_training || 'Not specified'} years</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Primary Training Goal</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.training_goal || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Workout Frequency</p>
                        <p className="text-lg font-medium text-gray-900">{intakeFormData.workout_frequency || 'Not specified'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Equipment Access</p>
                        <p className="text-lg font-medium text-gray-900">
                          {intakeFormData.equipment_access && intakeFormData.equipment_access.trim().length > 0
                            ? intakeFormData.equipment_access
                            : 'Not specified'}
                        </p>
                      </div>
                      {intakeFormData.injury_history && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600 mb-1">Injury History / Physical Limitations</p>
                          <p className="text-lg font-medium text-gray-900">{intakeFormData.injury_history}</p>
                        </div>
                      )}
                      {intakeFormData.training_notes && (
                        <div className="md:col-span-2">
                          <p className="text-sm text-gray-600 mb-1">Additional Training Notes</p>
                          <p className="text-lg font-medium text-gray-900">{intakeFormData.training_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
                <ClipboardList className="h-12 w-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-blue-900 mb-2">No Intake Form Completed</h3>
                <p className="text-sm text-blue-700">
                  This client hasn't completed their intake form yet. The form will appear automatically when they first log in.
                </p>
              </div>
            )}
          </div>
        );

      case 'calendar':
        return (
          <TrainerCalendarView clientId={clientId} userType={userType} onNavigate={onNavigate} />
        );

      case 'streaks':
        return (
          <ClientStreaksPanel
            clientId={clientId}
            clientFirstName={clientData?.first_name}
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
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
            <h3 className="text-lg font-medium text-red-800">Error</h3>
          </div>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={onBack}
            className="mt-4 flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!clientData) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {userType === 'trainers' ? 'Trainer' : 'Client'} Not Found
          </h3>
          <p className="text-gray-600 mb-4">
            The requested {userType === 'trainers' ? 'trainer' : 'client'} could not be found.
          </p>
          <button
            onClick={onBack}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    ...(userType === 'clients' ? [{ id: 'intake', label: 'Intake Form', icon: ClipboardList }] : []),
    { id: 'workouts', label: userType === 'trainers' ? 'Templates' : 'Workouts', icon: Dumbbell },
    ...(userType === 'clients' ? [{ id: 'workout-logs', label: 'Workout Logs', icon: ClipboardCheck }] : []),
    ...(userType === 'clients' ? [{ id: 'streaks', label: 'Streaks', icon: Flame }] : []),
    { id: 'performance', label: 'Performance', icon: BarChart3 },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'messages', label: 'Messages', icon: MessageCircle }
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-6">
          <button
            onClick={onBack}
            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to {userType === 'trainers' ? 'Trainers' : 'Clients'}
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4 sm:space-x-6">
            <div className="h-16 w-16 sm:h-20 sm:w-20 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xl sm:text-2xl">
                {clientData.first_name?.[0]}{clientData.last_name?.[0]}
              </span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {clientData.first_name} {clientData.last_name}
              </h1>
              <p className="text-gray-600 capitalize">
                {clientData.role === 'admin' ? 'Administrator' : clientData.role}
              </p>
              <p className="text-sm text-gray-500">
                Member since {new Date(clientData.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          {currentUserRole === 'admin' && userType === 'clients' && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors self-start sm:self-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Client
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-8 overflow-hidden">
        <div className="border-b border-gray-100 relative">
          {canScrollLeft && (
            <button
              onClick={() => scrollTabs('left')}
              className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-1 pr-2 bg-gradient-to-r from-white via-white to-transparent"
              aria-label="Scroll tabs left"
            >
              <ChevronLeft className="h-5 w-5 text-gray-400" />
            </button>
          )}
          <div
            ref={tabsContainerRef}
            className="overflow-x-auto scrollbar-hide"
          >
            <nav className="flex px-4 min-w-max">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 py-3 px-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-green-500 text-green-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
          {canScrollRight && (
            <button
              onClick={() => scrollTabs('right')}
              className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-1 pl-2 bg-gradient-to-l from-white via-white to-transparent"
              aria-label="Scroll tabs right"
            >
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {getTabContent()}

      {/* Edit Workout Modal */}
      {editingWorkoutId && (
        <EditAssignedWorkoutModal
          workoutId={editingWorkoutId}
          onClose={() => setEditingWorkoutId(null)}
          onSave={() => {
            setEditingWorkoutId(null);
            fetchWorkoutData();
            fetchClientDetails();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Delete Client</h2>
                <p className="text-sm text-gray-600">This action cannot be undone</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800 font-medium mb-2">Warning: This will permanently delete:</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>Client profile and account</li>
                  <li>All workout history and progress</li>
                  <li>All performance data</li>
                  <li>All messages and communications</li>
                  <li>All video analyses</li>
                  <li>Intake form data</li>
                  <li>Trainer assignments</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-900">
                  Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">DELETE</span> to confirm:
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  placeholder="Type DELETE"
                  disabled={deleting}
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteClient}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetailView;