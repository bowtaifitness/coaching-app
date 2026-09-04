import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ClientDetailView from './ClientDetailView';
import TrainerAssignmentModal from './TrainerAssignmentModal';
import { Users, Search, Mail, Phone, Calendar, TrendingUp, MessageCircle, MoreVertical, CreditCard as Edit, Trash2, Loader, X, Save, Eye, UserPlus, Clock, Square, CheckSquare } from 'lucide-react';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  created_at: string;
  email?: string;
  totalWorkouts: number;
  completedWorkouts: number;
  lastWorkout?: string | null;
  lastWorkoutTitle?: string | null;
  avgPerformance?: number | null;
  assignedTrainer?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  trial_ends_at?: string | null;
  trial_extended_until?: string | null;
  has_active_subscription?: boolean;
  role?: string;
}

interface ClientManagementProps {
  onNavigate?: (view: string) => void;
  userType?: 'clients' | 'trainers';
  initialClientId?: string;
}

const ClientManagement: React.FC<ClientManagementProps> = ({ onNavigate, userType = 'clients', initialClientId }) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [editingClient, setEditingClient] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: ''
  });
  const [updating, setUpdating] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedClientTab, setSelectedClientTab] = useState('overview');
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assignmentClientId, setAssignmentClientId] = useState<string | null>(null);
  const [assignmentClientName, setAssignmentClientName] = useState('');
  const [currentTrainerId, setCurrentTrainerId] = useState<string | null>(null);
  const [viewFormat, setViewFormat] = useState<'cards' | 'list'>('cards');
  const [showExtendTrialModal, setShowExtendTrialModal] = useState(false);
  const [extendTrialClientId, setExtendTrialClientId] = useState<string | null>(null);
  const [extendTrialClientName, setExtendTrialClientName] = useState('');
  const [extendTrialDays, setExtendTrialDays] = useState(14);
  const [extending, setExtending] = useState(false);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'message' | 'extend' | 'delete' | null>(null);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkExtendDays, setBulkExtendDays] = useState(14);
  const [performingBulkAction, setPerformingBulkAction] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  // Add effect to refetch when userType changes
  useEffect(() => {
    fetchClients();
  }, [userType]);

  // Set initial client if provided
  useEffect(() => {
    if (initialClientId) {
      setSelectedClientId(initialClientId);
    }
  }, [initialClientId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);
  const fetchClients = async () => {
    console.log('Fetching clients...');
    console.log('UserType prop:', userType);
    console.log('Current user role:', user?.role);
    console.log('Current user email:', user?.email);
    try {
      setLoading(true);
      
      let profiles;
      
      if (user?.email === 'brian@bowtaifitness.com') {
        // Admin can see all users (coaches and clients)
        console.log('Admin user - fetching all profiles');
        setIsAdmin(true);
        
        let query = supabase.from('profiles').select('*');
        
        if (userType === 'trainers') {
          console.log('Fetching trainers/coaches...');
          query = query.in('role', ['coach', 'admin']);
        } else if (userType === 'clients') {
          console.log('Fetching clients...');
          query = query.eq('role', 'client');
        } else {
          console.log('Fetching all users...');
          query = query.in('role', ['coach', 'client']);
        }
        
        const { data: allProfiles, error: allProfilesError } = await query
          .order('created_at', { ascending: false });

        if (allProfilesError) throw allProfilesError;
        profiles = allProfiles || [];
        
        console.log('Fetched profiles:', profiles);
        console.log('Profile count:', profiles.length);
        console.log('Profile roles:', profiles.map(p => p.role));
        
      } else {
        // Regular coach - get clients assigned through coach_client_assignments
        setIsAdmin(false);
        const { data: assignments, error: assignmentsError } = await supabase
          .from('coach_client_assignments')
          .select(`
            client_id,
            active,
            assigned_at,
            client:profiles!client_id(
              id,
              first_name,
              last_name,
              email,
              phone,
              created_at,
              role
            )
          `)
          .eq('coach_id', user?.id)
          .eq('active', true)
          .order('assigned_at', { ascending: false });

        console.log('Coach-client assignments query result:', { assignments, error: assignmentsError });
        
        if (assignmentsError) throw assignmentsError;
        
        // Extract client profiles from assignments
        profiles = assignments?.map(assignment => assignment.client).filter(Boolean) || [];
      }
      
      console.log('Extracted client profiles:', profiles);
      
      // Get workout data for each client
      const clientsWithWorkoutData = await Promise.all(
        (profiles || []).map(async (profile) => {
          // For clients, get their assigned trainer
          let assignedTrainer = null;
          if (profile.role === 'client') {
            const { data: assignment, error: assignmentError } = await supabase
              .from('coach_client_assignments')
              .select(`
                coach_id,
                coach:profiles!coach_id(id, first_name, last_name)
              `)
              .eq('client_id', profile.id)
              .eq('active', true)
              .maybeSingle();

            if (!assignmentError && assignment?.coach) {
              assignedTrainer = assignment.coach;
            }
          }

          // Get workout count - for clients use client_id, for coaches use coach_id
          const workoutField = profile.role === 'client' ? 'client_id' : 'coach_id';
          const { count: workoutCount, error: countError } = await supabase
            .from('workouts')
            .select('*', { count: 'exact', head: true })
            .eq(workoutField, profile.id);

          if (countError) {
            console.error('Error fetching workout count for client:', profile.id, countError);
          }

          // Get last workout
          const { data: lastWorkout, error: lastWorkoutError } = await supabase
            .from('workouts')
            .select('scheduled_date, title, completed')
            .eq(workoutField, profile.id)
            .order('scheduled_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastWorkoutError) {
            console.error('Error fetching last workout for profile:', profile.id, lastWorkoutError);
          }

          // Get completed workout count
          const { count: completedCount, error: completedError } = await supabase
            .from('workouts')
            .select('*', { count: 'exact', head: true })
            .eq(workoutField, profile.id)
            .eq('completed', true);

          if (completedError) {
            console.error('Error fetching completed workout count for profile:', profile.id, completedError);
          }

          // Debug: Let's also fetch the actual completed workouts to see what's happening
          const { data: completedWorkouts, error: completedWorkoutsError } = await supabase
            .from('workouts')
            .select('id, title, completed, scheduled_date')
            .eq(workoutField, profile.id)
            .eq('completed', true);

          if (completedWorkoutsError) {
            console.error('Error fetching completed workouts for profile:', profile.id, completedWorkoutsError);
          }

          // Debug: Let's also fetch ALL workouts to see their completion status
          const { data: allWorkouts, error: allWorkoutsError } = await supabase
            .from('workouts')
            .select('id, title, completed, scheduled_date')
            .eq(workoutField, profile.id);

          if (allWorkoutsError) {
            console.error('Error fetching all workouts for profile:', profile.id, allWorkoutsError);
          }
          console.log(`Client ${profile.first_name} ${profile.last_name}:`, {
            totalWorkouts: workoutCount,
            completedWorkouts: completedCount,
            lastWorkout: lastWorkout,
            completedWorkoutsData: completedWorkouts,
            allWorkoutsData: allWorkouts
          });

          // Debug: Let's see the actual workout data in detail
          console.log(`Detailed workout data for ${profile.first_name} ${profile.last_name}:`, 
            allWorkouts?.map(w => ({
              id: w.id,
              title: w.title,
              completed: w.completed,
              completedType: typeof w.completed,
              scheduled_date: w.scheduled_date
            }))
          );

          // Debug: Show each workout's completion status individually
          allWorkouts?.forEach((workout, index) => {
            console.log(`Workout ${index + 1} for ${profile.first_name}:`, {
              title: workout.title,
              completed: workout.completed,
              completedType: typeof workout.completed,
              completedValue: JSON.stringify(workout.completed),
              id: workout.id
            });
          });
          return {
            ...profile,
            email: profile.email || 'Email not available',
            totalWorkouts: workoutCount || 0,
            completedWorkouts: completedCount || 0,
            lastWorkout: lastWorkout?.scheduled_date || null,
            lastWorkoutTitle: lastWorkout?.title || null,
            avgPerformance: null, // Could be calculated from performance_metrics if needed
            assignedTrainer
          };
        })
      );
      
      console.log('Final clients data:', clientsWithWorkoutData);
      
      setClients(clientsWithWorkoutData);
      
      // Debug: Log the final state
      console.log('Setting clients state to:', clientsWithWorkoutData);
      console.log('Is admin?', user?.role === 'admin');
      console.log('User role:', user?.role);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDropdownToggle = (clientId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropdown(activeDropdown === clientId ? null : clientId);
  };

  const handleViewClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedClientTab('overview');
    setActiveDropdown(null);
  };

  const handleMessageClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedClientTab('messages');
    setActiveDropdown(null);
  };
  const handleEditClient = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      setEditForm({
        first_name: client.first_name,
        last_name: client.last_name
      });
      setEditingClient(clientId);
    }
    setActiveDropdown(null);
  };

  const handleSaveEdit = async (clientId: string) => {
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      alert('Please fill in both first name and last name');
      return;
    }

    try {
      setUpdating(true);
      
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editForm.first_name.trim(),
          last_name: editForm.last_name.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', clientId);

      if (error) throw error;

      // Update local state
      setClients(prev => prev.map(client => 
        client.id === clientId 
          ? { ...client, first_name: editForm.first_name.trim(), last_name: editForm.last_name.trim() }
          : client
      ));

      setEditingClient(null);
      setEditForm({ first_name: '', last_name: '' });
      
    } catch (error) {
      console.error('Error updating client:', error);
      alert('Failed to update client. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingClient(null);
    setEditForm({ first_name: '', last_name: '' });
  };

  const handleDeleteClient = async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;

    setActiveDropdown(null);
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${client.first_name} ${client.last_name}?\n\n` +
      `This will delete:\n` +
      `• Their profile and account\n` +
      `• All workouts (${client.totalWorkouts})\n` +
      `• Performance data and metrics\n` +
      `• Messages and communications\n` +
      `• Trainer assignments\n` +
      `• Intake form data\n\n` +
      `This action CANNOT be undone!`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      // First, delete from profiles table (this will CASCADE to all related data)
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', clientId);

      if (profileError) {
        console.error('Error deleting profile:', profileError);
        throw profileError;
      }

      // Then delete from auth.users using the admin API
      // This requires the service role key, so we'll use an edge function
      const { error: authError } = await supabase.functions.invoke('delete-user', {
        body: { userId: clientId }
      });

      if (authError) {
        console.error('Warning: Could not delete auth user:', authError);
        // Don't throw here - the profile is already deleted
        // The auth user can be cleaned up manually if needed
      }

      // Update local state
      setClients(prev => prev.filter(c => c.id !== clientId));

      alert(`${client.first_name} ${client.last_name} has been permanently deleted.`);

    } catch (error: any) {
      console.error('Error deleting client:', error);
      alert(`Failed to delete client: ${error.message || 'Unknown error'}. Please try again.`);
      // Refresh the client list in case partial deletion occurred
      fetchClients();
    } finally {
      setLoading(false);
    }
  };

  const handleAssignTrainer = (clientId: string, clientName: string, currentTrainerId?: string) => {
    setAssignmentClientId(clientId);
    setAssignmentClientName(clientName);
    setCurrentTrainerId(currentTrainerId || null);
    setShowAssignmentModal(true);
    setActiveDropdown(null);
  };

  const handleAssignmentComplete = () => {
    setShowAssignmentModal(false);
    setAssignmentClientId(null);
    setAssignmentClientName('');
    setCurrentTrainerId(null);
    fetchClients(); // Refresh the client list
  };

  const handleExtendTrial = (clientId: string, clientName: string) => {
    setExtendTrialClientId(clientId);
    setExtendTrialClientName(clientName);
    setExtendTrialDays(14);
    setShowExtendTrialModal(true);
    setActiveDropdown(null);
  };

  const handleExtendTrialSubmit = async () => {
    if (!extendTrialClientId) return;

    try {
      setExtending(true);
      const { data, error } = await supabase.rpc('admin_extend_trial', {
        target_user_id: extendTrialClientId,
        days_to_add: extendTrialDays
      });

      if (error) throw error;

      if (data && !data.success) {
        alert(data.error || 'Failed to extend trial');
        return;
      }

      alert(`Trial extended by ${extendTrialDays} days successfully!`);
      setShowExtendTrialModal(false);
      setExtendTrialClientId(null);
      setExtendTrialClientName('');
      fetchClients();
    } catch (error: any) {
      console.error('Error extending trial:', error);
      alert(error.message || 'Failed to extend trial');
    } finally {
      setExtending(false);
    }
  };

  const handleSelectClient = (clientId: string) => {
    const newSelected = new Set(selectedClients);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClients(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClients.size === filteredClients.length) {
      setSelectedClients(new Set());
    } else {
      setSelectedClients(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleBulkAction = (action: 'message' | 'extend' | 'delete') => {
    if (selectedClients.size === 0) return;
    setBulkAction(action);
    setShowBulkActionsModal(true);
  };

  const handleBulkActionSubmit = async () => {
    if (!bulkAction || selectedClients.size === 0) return;

    try {
      setPerformingBulkAction(true);

      switch (bulkAction) {
        case 'message':
          if (!bulkMessage.trim()) {
            alert('Please enter a message');
            return;
          }

          for (const clientId of Array.from(selectedClients)) {
            const { error } = await supabase
              .from('messages')
              .insert({
                sender_id: user?.id,
                receiver_id: clientId,
                content: bulkMessage,
                is_read: false
              });

            if (error) {
              console.error('Error sending message to client:', clientId, error);
            }
          }

          alert(`Message sent to ${selectedClients.size} client(s)`);
          break;

        case 'extend':
          let successCount = 0;
          let failCount = 0;

          for (const clientId of Array.from(selectedClients)) {
            const { data, error } = await supabase.rpc('admin_extend_trial', {
              target_user_id: clientId,
              days_to_add: bulkExtendDays
            });

            if (error || (data && !data.success)) {
              failCount++;
            } else {
              successCount++;
            }
          }

          alert(`Trial extended for ${successCount} client(s). ${failCount > 0 ? `Failed for ${failCount} client(s).` : ''}`);
          fetchClients();
          break;

        case 'delete':
          if (!confirm(`Are you sure you want to permanently delete ${selectedClients.size} client(s)? This action cannot be undone.`)) {
            return;
          }

          let deletedCount = 0;
          let deleteFailCount = 0;

          for (const clientId of Array.from(selectedClients)) {
            try {
              const { error } = await supabase.rpc('admin_delete_client', {
                target_user_id: clientId
              });

              if (error) {
                deleteFailCount++;
              } else {
                deletedCount++;
              }
            } catch (error) {
              deleteFailCount++;
            }
          }

          alert(`Deleted ${deletedCount} client(s). ${deleteFailCount > 0 ? `Failed to delete ${deleteFailCount} client(s).` : ''}`);
          fetchClients();
          break;
      }

      setShowBulkActionsModal(false);
      setBulkAction(null);
      setBulkMessage('');
      setBulkExtendDays(14);
      setSelectedClients(new Set());

    } catch (error: any) {
      console.error('Error performing bulk action:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setPerformingBulkAction(false);
    }
  };

  // If a client is selected, show the detail view
  if (selectedClientId) {
    return (
      <ClientDetailView 
        clientId={selectedClientId} 
        onBack={() => setSelectedClientId(null)}
        initialTab={selectedClientTab}
        userType={userType}
        onNavigate={onNavigate}
      />
    );
  }

  const filteredClients = clients.filter(client =>
    `${client.first_name} ${client.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
            {isAdmin ? 
              (userType === 'trainers' ? 'Trainer Management' : 'Client Management') 
              : 'Client Management'
            }
          </h1>
          <p className="text-gray-600">
            {isAdmin 
              ? (userType === 'trainers' 
                  ? 'View and manage all trainers/coaches in the system.'
                  : 'View and manage all clients in the system.'
                )
              : 'View and manage your existing fitness coaching clients.'
            }
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewFormat('cards')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewFormat === 'cards'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="grid grid-cols-2 gap-0.5 h-4 w-4 mr-2">
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
                <div className="bg-current rounded-sm"></div>
              </div>
              Cards
            </button>
            <button
              onClick={() => setViewFormat('list')}
              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewFormat === 'list'
                  ? 'bg-white text-green-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex flex-col space-y-0.5 h-4 w-4 mr-2">
                <div className="bg-current h-0.5 rounded-sm"></div>
                <div className="bg-current h-0.5 rounded-sm"></div>
                <div className="bg-current h-0.5 rounded-sm"></div>
                <div className="bg-current h-0.5 rounded-sm"></div>
              </div>
              List
            </button>
          </div>
          {!isAdmin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md">
            <h4 className="text-sm font-medium text-blue-800 mb-1">Adding New Clients</h4>
            <p className="text-xs text-blue-700">
              Have clients sign up directly using the registration form. They will appear here automatically.
            </p>
          </div>
          )}
        </div>
      </div>

      {/* Search and Stats */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{clients.length}</p>
              <p className="text-gray-600">
                {isAdmin ? 
                  (userType === 'trainers' ? 'Total Trainers' : 'Total Clients') 
                  : 'Total Clients'
                }
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">
                {isAdmin && userType === 'trainers'
                  ? clients.filter(c => c.totalWorkouts > 0).length
                  : isAdmin && userType === 'clients'
                  ? clients.filter(c => c.totalWorkouts > 0).length
                  : clients.filter(c => c.totalWorkouts > 0).length
                }
              </p>
              <p className="text-gray-600">With Workouts</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-blue-600">
                {isAdmin && userType === 'trainers'
                  ? clients.length > 0 
                    ? Math.round(
                        clients.reduce((sum, c) => sum + c.totalWorkouts, 0) / clients.length
                      )
                    : 0
                  : clients.length > 0 
                    ? Math.round(
                        clients.reduce((sum, c) => sum + c.totalWorkouts, 0) / clients.length
                      )
                    : 0
                }
              </p>
              <p className="text-gray-600">Avg. Workouts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedClients.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {selectedClients.size === filteredClients.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-sm text-gray-700">
              {selectedClients.size} client{selectedClients.size !== 1 ? 's' : ''} selected
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => handleBulkAction('message')}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Send Message</span>
            </button>
            <button
              onClick={() => handleBulkAction('extend')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Clock className="h-4 w-4" />
              <span>Extend Trial</span>
            </button>
            <button
              onClick={() => handleBulkAction('delete')}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}

      {/* Client Views */}
      {viewFormat === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client) => (
            <div key={client.id} className={`bg-white rounded-xl shadow-sm border-2 overflow-hidden hover:shadow-md transition-all ${selectedClients.has(client.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-100'}`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectClient(client.id);
                      }}
                      className="flex-shrink-0"
                    >
                      {selectedClients.has(client.id) ? (
                        <CheckSquare className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                      )}
                    </button>
                    <div className="h-12 w-12 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {client.first_name[0]}{client.last_name[0]}
                      </span>
                    </div>
                    <div>
                      {editingClient === client.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editForm.first_name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, first_name: e.target.value }))}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="First name"
                            disabled={updating}
                          />
                          <input
                            type="text"
                            value={editForm.last_name}
                            onChange={(e) => setEditForm(prev => ({ ...prev, last_name: e.target.value }))}
                            className="w-full px-3 py-2 text-base border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Last name"
                            disabled={updating}
                          />
                        </div>
                      ) : (
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {client.first_name} {client.last_name}
                          </h3>
                          {isAdmin && (
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                              client.role === 'coach' || (client.role === 'admin' && userType === 'trainers')
                                ? 'bg-blue-100 text-blue-700'
                                : client.role === 'admin'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              {client.role === 'coach' 
                                ? 'Trainer' 
                                : client.role === 'admin' && userType === 'trainers'
                                ? 'Admin/Trainer'
                                : client.role === 'admin'
                                ? 'Administrator'
                                : 'Client'
                              }
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-sm text-gray-500">{client.email}</p>
                      <p className="text-sm text-gray-600">
                        Member since {new Date(client.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {editingClient === client.id ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSaveEdit(client.id)}
                        disabled={updating}
                        className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                      >
                        {updating ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={updating}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <button 
                        onClick={(e) => handleDropdownToggle(client.id, e)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                      <MoreVertical className="h-5 w-5" />
                    </button>
                      
                      {activeDropdown === client.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                          <button
                            onClick={() => handleViewClient(client.id)}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </button>
                          {isAdmin && client.role === 'client' && (
                            <>
                              <button
                                onClick={() => handleAssignTrainer(
                                  client.id,
                                  `${client.first_name} ${client.last_name}`,
                                  client.assignedTrainer?.id
                                )}
                                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <UserPlus className="h-4 w-4 mr-2" />
                                {client.assignedTrainer ? 'Reassign Trainer' : 'Assign Trainer'}
                              </button>
                              <button
                                onClick={() => handleExtendTrial(
                                  client.id,
                                  `${client.first_name} ${client.last_name}`
                                )}
                                className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                Extend Trial
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleEditClient(client.id)}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClient(client.id)}
                            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-4">
                  {client.role === 'client' ? (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Last Workout</span>
                        <span className="font-medium text-gray-900">
                          {client.lastWorkout 
                            ? new Date(client.lastWorkout).toLocaleDateString()
                            : 'None assigned'
                          }
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Total Workouts</span>
                        <span className="font-medium text-gray-900">{client.totalWorkouts}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Completed</span>
                        <span className="font-medium text-gray-900">
                          {client.completedWorkouts}/{client.totalWorkouts}
                          {client.totalWorkouts > 0 && (
                            <span className="text-xs text-gray-500 ml-1">
                              ({Math.round((client.completedWorkouts / client.totalWorkouts) * 100)}%)
                            </span>
                          )}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Assigned Trainer</span>
                          <span className="font-medium text-gray-900">
                            {client.assignedTrainer 
                              ? `${client.assignedTrainer.first_name} ${client.assignedTrainer.last_name}`
                              : 'None'
                            }
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-2">
                      <p className="text-sm font-medium text-blue-600">
                        {client.role === 'admin' ? 'Admin/Trainer Account' : 'Trainer Account'}
                      </p>
                      <p className="text-xs text-gray-500">
                        Can create workouts and manage clients
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Workouts Created</span>
                          <span className="font-medium text-gray-900">{client.totalWorkouts}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Member Since</span>
                          <span className="font-medium text-gray-900">
                            {new Date(client.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {editingClient !== client.id && (
                  <div className="flex space-x-2">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleViewClient(client.id);
                      }}
                      className="flex-1 flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </button>
                    {isAdmin && client.role === 'client' ? (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAssignTrainer(
                            client.id, 
                            `${client.first_name} ${client.last_name}`,
                            client.assignedTrainer?.id
                          );
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        {client.assignedTrainer ? 'Reassign' : 'Assign'}
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleMessageClient(client.id);
                        }}
                        className="flex-1 flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        <MessageCircle className="h-4 w-4 mr-1" />
                        Message
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {viewFormat === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    <button
                      onClick={handleSelectAll}
                      className="flex items-center"
                    >
                      {selectedClients.size === filteredClients.length && filteredClients.length > 0 ? (
                        <CheckSquare className="h-5 w-5 text-blue-600" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {userType === 'trainers' ? 'Trainer' : 'Client'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  {userType === 'clients' && (
                    <>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workouts
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Progress
                      </th>
                      {isAdmin && (
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Trainer
                        </th>
                      )}
                    </>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member Since
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredClients.map((client) => (
                  <tr key={client.id} className={`hover:bg-gray-50 ${selectedClients.has(client.id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectClient(client.id);
                        }}
                        className="flex items-center"
                      >
                        {selectedClients.has(client.id) ? (
                          <CheckSquare className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-10 w-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {client.first_name[0]}{client.last_name[0]}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {client.first_name} {client.last_name}
                          </div>
                          {isAdmin && (
                            <div className="text-sm text-gray-500">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                client.role === 'coach' || (client.role === 'admin' && userType === 'trainers')
                                  ? 'bg-blue-100 text-blue-700'
                                  : client.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {client.role === 'coach' 
                                  ? 'Trainer' 
                                  : client.role === 'admin' && userType === 'trainers'
                                  ? 'Admin/Trainer'
                                  : client.role === 'admin'
                                  ? 'Administrator'
                                  : 'Client'
                                }
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{client.email}</div>
                    </td>
                    {userType === 'clients' && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{client.totalWorkouts}</div>
                          <div className="text-sm text-gray-500">
                            Last: {client.lastWorkout 
                              ? new Date(client.lastWorkout).toLocaleDateString()
                              : 'None'
                            }
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="text-sm text-gray-900">
                              {client.completedWorkouts}/{client.totalWorkouts}
                            </div>
                            {client.totalWorkouts > 0 && (
                              <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-green-500 h-2 rounded-full"
                                  style={{ 
                                    width: `${(client.completedWorkouts / client.totalWorkouts) * 100}%` 
                                  }}
                                ></div>
                              </div>
                            )}
                          </div>
                          {client.totalWorkouts > 0 && (
                            <div className="text-xs text-gray-500">
                              {Math.round((client.completedWorkouts / client.totalWorkouts) * 100)}% complete
                            </div>
                          )}
                        </td>
                        {isAdmin && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {client.assignedTrainer 
                                ? `${client.assignedTrainer.first_name} ${client.assignedTrainer.last_name}`
                                : 'None'
                              }
                            </div>
                          </td>
                        )}
                      </>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(client.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewClient(client.id)}
                          className="text-green-600 hover:text-green-900 p-2 rounded hover:bg-green-50 transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {isAdmin && client.role === 'client' ? (
                          <button
                            onClick={() => handleAssignTrainer(
                              client.id, 
                              `${client.first_name} ${client.last_name}`,
                              client.assignedTrainer?.id
                            )}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50 transition-colors"
                            title={client.assignedTrainer ? 'Reassign Trainer' : 'Assign Trainer'}
                          >
                            <UserPlus className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMessageClient(client.id)}
                            className="text-blue-600 hover:text-blue-900 p-2 rounded hover:bg-blue-50 transition-colors"
                            title="Send Message"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleEditClient(client.id)}
                          className="text-gray-600 hover:text-gray-900 p-2 rounded hover:bg-gray-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteClient(client.id)}
                          className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50 transition-colors"
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filteredClients.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 
              `No ${userType === 'trainers' ? 'trainers' : 'clients'} found` : 
              isAdmin ? 
                `No ${userType === 'trainers' ? 'trainers' : 'clients'} yet` : 
                'No clients yet'
            }
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm 
              ? 'Try adjusting your search criteria.' 
              : isAdmin 
                ? `No ${userType === 'trainers' ? 'trainers' : 'clients'} have signed up yet.`
                : 'You don\'t have any assigned clients yet.'
            }
          </p>
          {!isAdmin && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-sm text-blue-800 mb-2">To get clients:</p>
              <ol className="text-sm text-blue-700 text-left space-y-1">
                <li>1. Have clients sign up with "Client" role</li>
                <li>2. Create coach-client assignments in the database</li>
                <li>3. Assigned clients will appear here</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* Trainer Assignment Modal */}
      {showAssignmentModal && assignmentClientId && (
        <TrainerAssignmentModal
          isOpen={showAssignmentModal}
          onClose={() => setShowAssignmentModal(false)}
          clientId={assignmentClientId}
          clientName={assignmentClientName}
          currentTrainerId={currentTrainerId}
          onAssignmentComplete={handleAssignmentComplete}
        />
      )}

      {/* Extend Trial Modal */}
      {showExtendTrialModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-6 w-6 text-green-600" />
                <h2 className="text-xl font-bold text-gray-900">Extend Trial Period</h2>
              </div>
              <button
                onClick={() => setShowExtendTrialModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={extending}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Extend trial period for <span className="font-semibold text-gray-900">{extendTrialClientName}</span>
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Days to Add
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={extendTrialDays}
                    onChange={(e) => setExtendTrialDays(parseInt(e.target.value) || 14)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={extending}
                  />
                  <span className="text-sm text-gray-600">days</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[7, 14, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      onClick={() => setExtendTrialDays(days)}
                      className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                        extendTrialDays === days
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      disabled={extending}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowExtendTrialModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={extending}
              >
                Cancel
              </button>
              <button
                onClick={handleExtendTrialSubmit}
                disabled={extending || extendTrialDays < 1}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {extending ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Extending...
                  </>
                ) : (
                  <>
                    <Clock className="h-4 w-4 mr-2" />
                    Extend Trial
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Actions Modal */}
      {showBulkActionsModal && bulkAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                {bulkAction === 'message' && <MessageCircle className="h-6 w-6 text-green-600" />}
                {bulkAction === 'extend' && <Clock className="h-6 w-6 text-blue-600" />}
                {bulkAction === 'delete' && <Trash2 className="h-6 w-6 text-red-600" />}
                <h2 className="text-xl font-bold text-gray-900">
                  {bulkAction === 'message' && 'Send Bulk Message'}
                  {bulkAction === 'extend' && 'Extend Trials'}
                  {bulkAction === 'delete' && 'Delete Clients'}
                </h2>
              </div>
              <button
                onClick={() => {
                  setShowBulkActionsModal(false);
                  setBulkAction(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                disabled={performingBulkAction}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                This will affect <span className="font-semibold text-gray-900">{selectedClients.size}</span> client{selectedClients.size !== 1 ? 's' : ''}.
              </p>

              {bulkAction === 'message' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={bulkMessage}
                    onChange={(e) => setBulkMessage(e.target.value)}
                    placeholder="Enter your message..."
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    disabled={performingBulkAction}
                  />
                </div>
              )}

              {bulkAction === 'extend' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Days to Add
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={bulkExtendDays}
                      onChange={(e) => setBulkExtendDays(parseInt(e.target.value) || 14)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={performingBulkAction}
                    />
                    <span className="text-sm text-gray-600">days</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[7, 14, 30, 60, 90].map((days) => (
                      <button
                        key={days}
                        onClick={() => setBulkExtendDays(days)}
                        className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                          bulkExtendDays === days
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        disabled={performingBulkAction}
                      >
                        {days} days
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {bulkAction === 'delete' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 text-sm font-medium">
                    Warning: This action cannot be undone. All client data, workouts, and associated records will be permanently deleted.
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowBulkActionsModal(false);
                  setBulkAction(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={performingBulkAction}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkActionSubmit}
                disabled={
                  performingBulkAction ||
                  (bulkAction === 'message' && !bulkMessage.trim()) ||
                  (bulkAction === 'extend' && bulkExtendDays < 1)
                }
                className={`flex-1 flex items-center justify-center px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  bulkAction === 'message' ? 'bg-green-600 hover:bg-green-700' :
                  bulkAction === 'extend' ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-red-600 hover:bg-red-700'
                }`}
              >
                {performingBulkAction ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {bulkAction === 'message' && <><MessageCircle className="h-4 w-4 mr-2" />Send Message</>}
                    {bulkAction === 'extend' && <><Clock className="h-4 w-4 mr-2" />Extend Trials</>}
                    {bulkAction === 'delete' && <><Trash2 className="h-4 w-4 mr-2" />Delete Clients</>}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ClientManagement;