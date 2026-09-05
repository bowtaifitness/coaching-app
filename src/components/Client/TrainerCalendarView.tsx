import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Video, 
  MessageCircle, 
  Dumbbell,
  AlertTriangle,
  CheckCircle,
  User,
  Target,
  TrendingUp,
  Award,
  Eye,
  Play,
  Send,
  Loader
} from 'lucide-react';

interface CalendarEvent {
  id: string;
  type: 'program_ending' | 'video_pending' | 'message_pending' | 'workout_overdue';
  title: string;
  description: string;
  date: string;
  priority: 'high' | 'medium' | 'low';
  clientId: string;
  clientName: string;
  daysUntil: number;
  actionRequired: string;
  relatedId?: string;
}

interface TrainerCalendarViewProps {
  clientId?: string;
  userType?: 'clients' | 'trainers';
  onNavigate?: (view: string) => void;
}

const TrainerCalendarView: React.FC<TrainerCalendarViewProps> = ({ clientId, userType, onNavigate }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'agenda'>('month');

  useEffect(() => {
    fetchCalendarEvents();
  }, [currentDate, clientId]);

  const fetchCalendarEvents = async () => {
    try {
      setLoading(true);
      const events: CalendarEvent[] = [];
      
      // Get date range for current month
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      const today = new Date();

      // If viewing specific client, filter by that client
      const clientFilter = clientId ? [clientId] : null;

      // 1. Check for workout programs ending soon
      let programQuery = supabase
        .from('workouts')
        .select(`
          id,
          title,
          scheduled_date,
          client_id,
          completed,
          client:profiles!client_id(first_name, last_name)
        `)
        .eq('coach_id', user?.id)
        .gte('scheduled_date', startOfMonth.toISOString().split('T')[0])
        .lte('scheduled_date', endOfMonth.toISOString().split('T')[0]);

      if (clientFilter) {
        programQuery = programQuery.in('client_id', clientFilter);
      }

      const { data: workouts, error: workoutsError } = await programQuery;

      if (!workoutsError && workouts) {
        // Group workouts by client to find program endings
        const clientWorkouts = workouts.reduce((acc, workout) => {
          if (!acc[workout.client_id]) acc[workout.client_id] = [];
          acc[workout.client_id].push(workout);
          return acc;
        }, {} as Record<string, any[]>);

        Object.entries(clientWorkouts).forEach(([clientId, clientWorkouts]) => {
          const sortedWorkouts = clientWorkouts.sort((a, b) => 
            new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
          );
          
          const lastWorkout = sortedWorkouts[0];
          const lastWorkoutDate = new Date(lastWorkout.scheduled_date);
          const daysUntil = Math.ceil((lastWorkoutDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          // If program ends within 7 days, add event
          if (daysUntil <= 7 && daysUntil >= 0) {
            events.push({
              id: `program-${clientId}`,
              type: 'program_ending',
              title: 'Program Ending',
              description: `${lastWorkout.client?.first_name} ${lastWorkout.client?.last_name}'s program ends`,
              date: lastWorkout.scheduled_date,
              priority: daysUntil <= 3 ? 'high' : 'medium',
              clientId: clientId,
              clientName: `${lastWorkout.client?.first_name} ${lastWorkout.client?.last_name}`,
              daysUntil: daysUntil,
              actionRequired: 'Plan next program phase',
              relatedId: lastWorkout.id
            });
          }
        });
      }

      // 2. Check for pending video analyses (older than 2 days)
      let videoQuery = supabase
        .from('swing_analyses')
        .select(`
          id,
          analysis,
          feedback,
          created_at,
          client_id,
          client:profiles!client_id(first_name, last_name)
        `)
        .eq('coach_id', user?.id)
        .is('feedback', null)
        .gte('created_at', new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

      if (clientFilter) {
        videoQuery = videoQuery.in('client_id', clientFilter);
      }

      const { data: pendingVideos, error: videosError } = await videoQuery;

      if (!videosError && pendingVideos) {
        pendingVideos.forEach(video => {
          const uploadDate = new Date(video.created_at);
          const daysOld = Math.floor((today.getTime() - uploadDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysOld >= 2) {
            // Add event for today (needs immediate attention)
            events.push({
              id: `video-${video.id}`,
              type: 'video_pending',
              title: 'Video Analysis Overdue',
              description: `${video.client?.first_name} ${video.client?.last_name}'s video needs analysis`,
              date: today.toISOString().split('T')[0],
              priority: daysOld >= 5 ? 'high' : 'medium',
              clientId: video.client_id,
              clientName: `${video.client?.first_name} ${video.client?.last_name}`,
              daysUntil: 0,
              actionRequired: `Analyze video (${daysOld} days old)`,
              relatedId: video.id
            });
          }
        });
      }

      // 3. Check for unread messages older than 1 day
      let messageQuery = supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          sender:profiles!sender_id(first_name, last_name)
        `)
        .eq('receiver_id', user?.id)
        .eq('read', false)
        .gte('created_at', new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Last 7 days

      if (clientFilter) {
        messageQuery = messageQuery.in('sender_id', clientFilter);
      }

      const { data: unreadMessages, error: messagesError } = await messageQuery;

      if (!messagesError && unreadMessages) {
        unreadMessages.forEach(message => {
          const messageDate = new Date(message.created_at);
          const daysOld = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysOld >= 1) {
            events.push({
              id: `message-${message.id}`,
              type: 'message_pending',
              title: 'Unread Message',
              description: `Message from ${message.sender?.first_name} ${message.sender?.last_name}`,
              date: today.toISOString().split('T')[0],
              priority: daysOld >= 3 ? 'high' : 'medium',
              clientId: message.sender_id,
              clientName: `${message.sender?.first_name} ${message.sender?.last_name}`,
              daysUntil: 0,
              actionRequired: `Respond to message (${daysOld} days old)`,
              relatedId: message.id
            });
          }
        });
      }

      // 4. Check for overdue workouts (clients haven't completed scheduled workouts)
      let overdueQuery = supabase
        .from('workouts')
        .select(`
          id,
          title,
          scheduled_date,
          client_id,
          client:profiles!client_id(first_name, last_name)
        `)
        .eq('coach_id', user?.id)
        .eq('completed', false)
        .lt('scheduled_date', today.toISOString().split('T')[0]);

      if (clientFilter) {
        overdueQuery = overdueQuery.in('client_id', clientFilter);
      }

      const { data: overdueWorkouts, error: overdueError } = await overdueQuery;

      if (!overdueError && overdueWorkouts) {
        overdueWorkouts.forEach(workout => {
          const scheduledDate = new Date(workout.scheduled_date);
          const daysOverdue = Math.floor((today.getTime() - scheduledDate.getTime()) / (1000 * 60 * 60 * 24));
          
          events.push({
            id: `overdue-${workout.id}`,
            type: 'workout_overdue',
            title: 'Overdue Workout',
            description: `${workout.client?.first_name} ${workout.client?.last_name} missed: ${workout.title}`,
            date: today.toISOString().split('T')[0],
            priority: daysOverdue >= 3 ? 'high' : 'medium',
            clientId: workout.client_id,
            clientName: `${workout.client?.first_name} ${workout.client?.last_name}`,
            daysUntil: 0,
            actionRequired: `Follow up on missed workout (${daysOverdue} days overdue)`,
            relatedId: workout.id
          });
        });
      }

      setEvents(events);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
    } finally {
      setLoading(false);
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

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'program_ending': return Calendar;
      case 'video_pending': return Video;
      case 'message_pending': return MessageCircle;
      case 'workout_overdue': return Dumbbell;
      default: return Clock;
    }
  };

  const getEventColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-orange-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getPriorityEvents = () => {
    const today = new Date().toISOString().split('T')[0];
    const next7Days = new Date();
    next7Days.setDate(next7Days.getDate() + 7);
    
    return events
      .filter(event => event.date <= next7Days.toISOString().split('T')[0])
      .sort((a, b) => {
        // Sort by priority first, then by days until
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return a.daysUntil - b.daysUntil;
      });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading calendar events...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">
            {clientId ? 'Client Calendar' : 'Trainer Calendar'}
          </h3>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'month'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('agenda')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'agenda'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Agenda
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h4 className="text-lg font-semibold text-gray-900 min-w-[200px] text-center">
                {currentDate.toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h4>
              <button
                onClick={() => navigateMonth('next')}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Priority Events Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-600 mb-1">High Priority</p>
                <p className="text-2xl font-bold text-red-900">
                  {events.filter(e => e.priority === 'high').length}
                </p>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 mb-1">Medium Priority</p>
                <p className="text-2xl font-bold text-orange-900">
                  {events.filter(e => e.priority === 'medium').length}
                </p>
              </div>
              <Clock className="h-6 w-6 text-orange-500" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 mb-1">Videos Pending</p>
                <p className="text-2xl font-bold text-blue-900">
                  {events.filter(e => e.type === 'video_pending').length}
                </p>
              </div>
              <Video className="h-6 w-6 text-blue-500" />
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 mb-1">Programs Ending</p>
                <p className="text-2xl font-bold text-purple-900">
                  {events.filter(e => e.type === 'program_ending').length}
                </p>
              </div>
              <Target className="h-6 w-6 text-purple-500" />
            </div>
          </div>
        </div>

        {viewMode === 'month' ? (
          <>
            {/* Calendar Header */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 border-b border-gray-200">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {getDaysInMonth(currentDate).map((day, index) => {
                const dayEvents = getEventsForDate(day);
                const isToday = day && day.toDateString() === new Date().toDateString();
                const isSelected = selectedDate && day && day.toDateString() === selectedDate.toDateString();
                
                return (
                  <div
                    key={index}
                    onClick={() => day && setSelectedDate(day)}
                    className={`min-h-[120px] p-2 border border-gray-100 rounded-lg transition-colors cursor-pointer ${
                      day ? 'hover:bg-gray-50' : ''
                    } ${isToday ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : ''} ${
                      isSelected ? 'bg-blue-50 border-blue-200 ring-2 ring-blue-100' : ''
                    }`}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium mb-2 ${
                          isToday ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {day.getDate()}
                        </div>
                        
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => {
                            const EventIcon = getEventIcon(event.type);
                            return (
                              <div
                                key={event.id}
                                className={`text-xs p-1 rounded cursor-pointer transition-all hover:scale-105 ${getEventColor(event.priority)}`}
                                title={`${event.title} - ${event.description}`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="truncate font-medium">
                                    {event.title.length > 12 ? event.title.substring(0, 12) + '...' : event.title}
                                  </span>
                                  <EventIcon className="h-3 w-3 flex-shrink-0" />
                                </div>
                                <div className="text-xs opacity-90 truncate">
                                  {event.clientName}
                                </div>
                              </div>
                            );
                          })}
                          
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-gray-500 text-center py-1">
                              +{dayEvents.length - 3} more
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
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-gray-600">High Priority</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span className="text-gray-600">Medium Priority</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="text-gray-600">Low Priority</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-blue-50 border-2 border-blue-200 rounded"></div>
                <span className="text-gray-600">Today</span>
              </div>
            </div>
          </>
        ) : (
          /* Agenda View */
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Upcoming Actions Required</h4>
            {getPriorityEvents().length > 0 ? (
              <div className="space-y-3">
                {getPriorityEvents().map((event) => {
                  const EventIcon = getEventIcon(event.type);
                  return (
                    <div
                      key={event.id}
                      className={`p-4 rounded-lg border-l-4 ${
                        event.priority === 'high' ? 'border-red-500 bg-red-50' :
                        event.priority === 'medium' ? 'border-orange-500 bg-orange-50' :
                        'border-blue-500 bg-blue-50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`p-2 rounded-lg ${getEventColor(event.priority)}`}>
                            <EventIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <h5 className="font-medium text-gray-900">{event.title}</h5>
                            <p className="text-sm text-gray-600">{event.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Client: {event.clientName}
                            </p>
                            <p className="text-xs font-medium text-gray-700 mt-1">
                              Action: {event.actionRequired}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            event.priority === 'high' ? 'bg-red-100 text-red-700' :
                            event.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {event.priority} priority
                          </span>
                          {event.daysUntil === 0 ? (
                            <span className="text-xs text-red-600 font-medium">Today</span>
                          ) : (
                            <span className="text-xs text-gray-600">
                              {event.daysUntil} days
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-gray-500">All caught up!</p>
                <p className="text-sm text-gray-400">No urgent actions required</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Date Details */}
      {selectedDate && viewMode === 'month' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">
            {selectedDate.toLocaleDateString('en-US', { 
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h4>
          
          {getEventsForDate(selectedDate).length > 0 ? (
            <div className="space-y-3">
              {getEventsForDate(selectedDate).map((event) => {
                const EventIcon = getEventIcon(event.type);
                return (
                  <div key={event.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <div className={`p-2 rounded-lg ${getEventColor(event.priority)}`}>
                      <EventIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">{event.title}</h5>
                      <p className="text-sm text-gray-600">{event.description}</p>
                      <p className="text-xs text-gray-500">Action: {event.actionRequired}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      event.priority === 'high' ? 'bg-red-100 text-red-700' :
                      event.priority === 'medium' ? 'bg-orange-100 text-orange-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {event.priority}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">No events on this date</p>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h4 className="font-semibold text-gray-900 mb-4">Quick Actions</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button className="flex items-center p-3 bg-red-50 rounded-lg hover:bg-red-100 transition-colors text-left">
            <Video className="h-5 w-5 text-red-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Review Videos</p>
              <p className="text-sm text-gray-600">
                {events.filter(e => e.type === 'video_pending').length} pending
              </p>
            </div>
          </button>
          
          <button className="flex items-center p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-left">
            <MessageCircle className="h-5 w-5 text-blue-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Reply to Messages</p>
              <p className="text-sm text-gray-600">
                {events.filter(e => e.type === 'message_pending').length} unread
              </p>
            </div>
          </button>
          
          <button className="flex items-center p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-left">
            <Calendar className="h-5 w-5 text-purple-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Plan Programs</p>
              <p className="text-sm text-gray-600">
                {events.filter(e => e.type === 'program_ending').length} ending soon
              </p>
            </div>
          </button>
          
          <button className="flex items-center p-3 bg-orange-50 rounded-lg hover:bg-orange-100 transition-colors text-left">
            <Dumbbell className="h-5 w-5 text-orange-600 mr-3" />
            <div>
              <p className="font-medium text-gray-900">Follow Up</p>
              <p className="text-sm text-gray-600">
                {events.filter(e => e.type === 'workout_overdue').length} overdue workouts
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainerCalendarView;