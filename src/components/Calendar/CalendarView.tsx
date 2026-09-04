import React, { useState } from 'react';
import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Calendar as CalendarIcon, Calendar, ChevronLeft, ChevronRight, Plus, Clock, User, MapPin, Video, Dumbbell, CheckCircle, X, Users, CreditCard as Edit3, Eye, Save, Loader } from 'lucide-react';

interface CalendarViewProps {
  clientId?: string;
  clientName?: string;
}

const CalendarView: React.FC<CalendarViewProps> = ({ clientId, clientName }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showAddWorkout, setShowAddWorkout] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>(clientId || '');
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkout, setSelectedWorkout] = useState<any>(null);
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(false);
  const [workoutExercises, setWorkoutExercises] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [updating, setUpdating] = useState(false);
  const [selectedWorkouts, setSelectedWorkouts] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<'edit' | 'delete' | null>(null);

  useEffect(() => {
    if (user && !clientId) {
      fetchClients();
    }
  }, [user]);

  useEffect(() => {
    if (clientId) {
      setSelectedClient(clientId);
    }
  }, [clientId]);

  useEffect(() => {
    if (selectedClient) {
      fetchWorkouts();
    }
  }, [selectedClient, currentDate]);

  useEffect(() => {
    if (showWorkoutModal) {
      fetchAvailableExercises();
    }
  }, [showWorkoutModal]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .eq('role', 'client')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
      
      // Auto-select first client if available
      if (data && data.length > 0 && !clientId) {
        setSelectedClient(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkouts = async () => {
    if (!selectedClient) return;
    
    try {
      setLoading(true);
      
      // Get the first and last day of the current month
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
      const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];
      
      console.log('Fetching workouts for client:', selectedClient, 'between:', firstDay, 'and', lastDay);
      
      const { data: workouts, error } = await supabase
        .from('workouts')
        .select(`
          id,
          title,
          description,
          scheduled_date,
          completed,
          notes,
          coach_id,
          client_id,
          workout_exercises(id)
        `)
        .eq('client_id', selectedClient)
        .gte('scheduled_date', firstDay)
        .lte('scheduled_date', lastDay)
        .order('scheduled_date', { ascending: true });
      
      if (error) throw error;
      
      console.log('Calendar workouts result:', workouts);
      
      // Format workouts for display
      const formattedWorkouts = workouts?.map(workout => ({
        id: workout.id,
        title: workout.title || 'Workout Session',
        date: workout.scheduled_date,
        completed: workout.completed,
        exerciseCount: workout.workout_exercises?.length || 0,
        notes: workout.notes || workout.description || ''
      })) || [];
      
      setWorkouts(formattedWorkouts);
      
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, category')
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableExercises(data || []);
    } catch (error) {
      console.error('Error fetching available exercises:', error);
    }
  };

  const fetchWorkoutExercises = async (workoutId: string) => {
    try {
      const { data, error } = await supabase
        .from('workout_exercises')
        .select(`
          id,
          exercise_id,
          sets,
          reps,
          weight,
          duration,
          notes,
          order_index,
          exercise:exercises(id, name, category)
        `)
        .eq('workout_id', workoutId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setWorkoutExercises(data || []);
    } catch (error) {
      console.error('Error fetching workout exercises:', error);
    }
  };

  const handleWorkoutClick = async (workout: any) => {
    setSelectedWorkout(workout);
    setShowWorkoutModal(true);
    setEditingWorkout(false);
    await fetchWorkoutExercises(workout.id);
  };

  const handleEditWorkout = () => {
    setEditingWorkout(true);
  };

  const handleSaveWorkout = async () => {
    if (!selectedWorkout) return;

    try {
      setUpdating(true);

      // Update workout basic info
      const { error: workoutError } = await supabase
        .from('workouts')
        .update({
          title: selectedWorkout.title,
          description: selectedWorkout.description,
          notes: selectedWorkout.notes,
          scheduled_date: selectedWorkout.scheduled_date
        })
        .eq('id', selectedWorkout.id);

      if (workoutError) throw workoutError;

      // Update workout exercises
      for (const exercise of workoutExercises) {
        if (exercise.id.startsWith('new-')) {
          // Insert new exercise
          const { error: insertError } = await supabase
            .from('workout_exercises')
            .insert([{
              workout_id: selectedWorkout.id,
              exercise_id: exercise.exercise_id,
              sets: exercise.sets,
              reps: exercise.reps,
              weight: exercise.weight,
              duration: exercise.duration,
              notes: exercise.notes,
              order_index: exercise.order_index
            }]);

          if (insertError) throw insertError;
        } else {
          // Update existing exercise
          const { error: updateError } = await supabase
            .from('workout_exercises')
            .update({
              exercise_id: exercise.exercise_id,
              sets: exercise.sets,
              reps: exercise.reps,
              weight: exercise.weight,
              duration: exercise.duration,
              notes: exercise.notes,
              order_index: exercise.order_index
            })
            .eq('id', exercise.id);

          if (updateError) throw updateError;
        }
      }

      setEditingWorkout(false);
      setShowWorkoutModal(false);
      fetchWorkouts(); // Refresh the calendar
    } catch (error) {
      console.error('Error updating workout:', error);
      alert('Failed to update workout. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  const handleAddExercise = () => {
    const newExercise = {
      id: `new-${Date.now()}`,
      exercise_id: '',
      exercise: { id: '', name: '', category: '' },
      sets: 3,
      reps: 10,
      weight: null,
      duration: null,
      notes: '',
      order_index: workoutExercises.length
    };
    setWorkoutExercises([...workoutExercises, newExercise]);
  };

  const handleRemoveExercise = async (exerciseIndex: number) => {
    const exercise = workoutExercises[exerciseIndex];
    
    if (!exercise.id.startsWith('new-')) {
      // Delete from database if it's an existing exercise
      try {
        const { error } = await supabase
          .from('workout_exercises')
          .delete()
          .eq('id', exercise.id);

        if (error) throw error;
      } catch (error) {
        console.error('Error deleting exercise:', error);
        alert('Failed to delete exercise. Please try again.');
        return;
      }
    }

    // Remove from local state
    setWorkoutExercises(prev => prev.filter((_, index) => index !== exerciseIndex));
  };

  const handleExerciseChange = (index: number, field: string, value: any) => {
    setWorkoutExercises(prev => {
      const newExercises = [...prev];
      if (field === 'exercise_id') {
        const selectedExercise = availableExercises.find(e => e.id === value);
        newExercises[index] = {
          ...newExercises[index],
          exercise_id: value,
          exercise: selectedExercise || newExercises[index].exercise
        };
      } else {
        newExercises[index] = {
          ...newExercises[index],
          [field]: value
        };
      }
      return newExercises;
    });
  };

  const handleWorkoutSelect = (workoutId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newSelected = new Set(selectedWorkouts);
    if (newSelected.has(workoutId)) {
      newSelected.delete(workoutId);
    } else {
      newSelected.add(workoutId);
    }
    setSelectedWorkouts(newSelected);
  };

  const handleSelectAll = () => {
    const allWorkoutIds = workouts.map(w => w.id);
    if (selectedWorkouts.size === allWorkoutIds.length) {
      setSelectedWorkouts(new Set());
    } else {
      setSelectedWorkouts(new Set(allWorkoutIds));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedWorkouts.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedWorkouts.size} selected workouts? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('workouts')
        .delete()
        .in('id', Array.from(selectedWorkouts));

      if (error) throw error;

      setSelectedWorkouts(new Set());
      setShowBulkActions(false);
      fetchWorkouts();
    } catch (error) {
      console.error('Error bulk deleting workouts:', error);
      alert('Error deleting workouts. Please try again.');
    }
  };

  const handleBulkEdit = async (updates: any) => {
    if (selectedWorkouts.size === 0) return;

    try {
      const { error } = await supabase
        .from('workouts')
        .update(updates)
        .in('id', Array.from(selectedWorkouts));

      if (error) throw error;

      setSelectedWorkouts(new Set());
      setShowBulkActions(false);
      fetchWorkouts();
    } catch (error) {
      console.error('Error bulk editing workouts:', error);
      alert('Error updating workouts. Please try again.');
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
    return workouts.filter(workout => workout.date === dateStr);
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

  const handleAddWorkout = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedClient) return;

    const formData = new FormData(e.currentTarget);
    
    try {
      const workoutData = {
        title: formData.get('title') as string,
        description: formData.get('description') as string,
        coach_id: user?.id,
        client_id: selectedClient,
        scheduled_date: formData.get('scheduled_date') as string,
        completed: false,
        notes: formData.get('notes') as string
      };

      const { error } = await supabase
        .from('workouts')
        .insert([workoutData]);

      if (error) throw error;

      setShowAddWorkout(false);
      fetchWorkouts(); // Refresh workouts
      
    } catch (error) {
      console.error('Error creating workout:', error);
      alert('Error creating workout. Please try again.');
    }
  };

  const AddWorkoutModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-6 w-full max-w-lg sm:mx-4 max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Schedule Workout</h3>
          <button
            onClick={() => setShowAddWorkout(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <form onSubmit={handleAddWorkout} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Workout Title</label>
            <input
              name="title"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., Upper Body Strength"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              name="scheduled_date"
              type="date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              defaultValue={selectedDate.toISOString().split('T')[0]}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Workout objectives and focus areas..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              name="notes"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={2}
              placeholder="Additional notes for the client..."
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Note:</strong> After scheduling, you can add specific exercises using the Workout Builder.
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              type="submit"
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              Schedule Workout
            </button>
            <button
              type="button"
              onClick={() => setShowAddWorkout(false)}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const BulkActionsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-6 w-full max-w-md sm:mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Bulk Actions ({selectedWorkouts.size} selected)
          </h3>
          <button
            onClick={() => setShowBulkActions(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mark as Completed
            </label>
            <button
              onClick={() => handleBulkEdit({ completed: true })}
              className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Mark All as Completed
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mark as Incomplete
            </label>
            <button
              onClick={() => handleBulkEdit({ completed: false })}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Mark All as Incomplete
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reschedule All
            </label>
            <input
              type="date"
              id="bulk-date"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-2"
            />
            <button
              onClick={() => {
                const newDate = (document.getElementById('bulk-date') as HTMLInputElement).value;
                if (newDate) {
                  handleBulkEdit({ scheduled_date: newDate });
                }
              }}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
            >
              Reschedule All
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Add Notes to All
            </label>
            <textarea
              id="bulk-notes"
              placeholder="Enter notes to add to all selected workouts"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 mb-2"
              rows={3}
            />
            <button
              onClick={() => {
                const notes = (document.getElementById('bulk-notes') as HTMLTextAreaElement).value;
                if (notes.trim()) {
                  handleBulkEdit({ notes: notes.trim() });
                }
              }}
              className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
            >
              Add Notes to All
            </button>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <button
              onClick={handleBulkDelete}
              className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Delete All Selected
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const WorkoutDetailModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl w-full max-w-4xl sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {editingWorkout ? 'Edit Workout' : 'Workout Details'}
              </h3>
              <p className="text-sm text-gray-600">
                {selectedWorkout?.title} - {new Date(selectedWorkout?.scheduled_date).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              {!editingWorkout && (
                <button
                  onClick={handleEditWorkout}
                  className="flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Workout
                </button>
              )}
              <button
                onClick={() => {
                  setShowWorkoutModal(false);
                  setSelectedWorkout(null);
                  setEditingWorkout(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {editingWorkout ? (
            <div className="space-y-6">
              {/* Basic Workout Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workout Title
                  </label>
                  <input
                    type="text"
                    value={selectedWorkout?.title || ''}
                    onChange={(e) => setSelectedWorkout(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Workout title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={selectedWorkout?.scheduled_date || ''}
                    onChange={(e) => setSelectedWorkout(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={selectedWorkout?.description || ''}
                  onChange={(e) => setSelectedWorkout(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                  placeholder="Workout description..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Coach Notes
                </label>
                <textarea
                  value={selectedWorkout?.notes || ''}
                  onChange={(e) => setSelectedWorkout(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={2}
                  placeholder="Additional notes for the client..."
                />
              </div>

              {/* Exercises */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">Exercises</h4>
                  <button
                    onClick={handleAddExercise}
                    className="flex items-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Exercise
                  </button>
                </div>

                <div className="space-y-4">
                  {workoutExercises.map((exercise, index) => (
                    <div key={exercise.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <h5 className="font-medium text-gray-900">
                          Exercise {index + 1}
                        </h5>
                        <button
                          onClick={() => handleRemoveExercise(index)}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Exercise
                          </label>
                          <select
                            value={exercise.exercise_id}
                            onChange={(e) => handleExerciseChange(index, 'exercise_id', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            required
                          >
                            <option value="">Select an exercise...</option>
                            {availableExercises.map((ex) => (
                              <option key={ex.id} value={ex.id}>
                                {ex.name} ({ex.category})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Sets
                          </label>
                          <input
                            type="number"
                            value={exercise.sets || ''}
                            onChange={(e) => handleExerciseChange(index, 'sets', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            min="1"
                            placeholder="3"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Reps
                          </label>
                          <input
                            type="number"
                            value={exercise.reps || ''}
                            onChange={(e) => handleExerciseChange(index, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            min="1"
                            placeholder="10"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Weight (lbs)
                          </label>
                          <input
                            type="number"
                            value={exercise.weight || ''}
                            onChange={(e) => handleExerciseChange(index, 'weight', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            min="0"
                            step="0.5"
                            placeholder="Optional"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Duration (seconds)
                          </label>
                          <input
                            type="number"
                            value={exercise.duration || ''}
                            onChange={(e) => handleExerciseChange(index, 'duration', e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            min="1"
                            placeholder="Optional"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Exercise Notes
                          </label>
                          <input
                            type="text"
                            value={exercise.notes || ''}
                            onChange={(e) => handleExerciseChange(index, 'notes', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                            placeholder="Specific instructions for this exercise..."
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {workoutExercises.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <Dumbbell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No exercises in this workout</p>
                      <button
                        onClick={handleAddExercise}
                        className="mt-2 text-green-600 hover:text-green-700 text-sm"
                      >
                        Add your first exercise
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Save/Cancel Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleSaveWorkout}
                  disabled={updating}
                  className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updating ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
                <button
                  onClick={() => setEditingWorkout(false)}
                  disabled={updating}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Workout Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{selectedWorkout?.title}</h4>
                {selectedWorkout?.description && (
                  <p className="text-gray-600 mb-2">{selectedWorkout.description}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(selectedWorkout?.scheduled_date).toLocaleDateString()}
                  </div>
                  <div className="flex items-center">
                    <Dumbbell className="h-4 w-4 mr-1" />
                    {workoutExercises.length} exercises
                  </div>
                  <div className="flex items-center">
                    {selectedWorkout?.completed ? (
                      <>
                        <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                        Completed
                      </>
                    ) : (
                      <>
                        <Clock className="h-4 w-4 mr-1 text-orange-500" />
                        Scheduled
                      </>
                    )}
                  </div>
                </div>
                {selectedWorkout?.notes && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Coach Notes:</strong> {selectedWorkout.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Exercise List */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Exercises</h4>
                {workoutExercises.length > 0 ? (
                  <div className="space-y-4">
                    {workoutExercises.map((exercise, index) => (
                      <div key={exercise.id} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h5 className="font-medium text-gray-900 mb-1">
                              {index + 1}. {exercise.exercise?.name || 'Exercise'}
                            </h5>
                            <p className="text-sm text-gray-600 capitalize mb-2">
                              {exercise.exercise?.category}
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {exercise.sets && (
                                <div>
                                  <span className="text-gray-600">Sets:</span>
                                  <span className="font-medium text-gray-900 ml-1">{exercise.sets}</span>
                                </div>
                              )}
                              {exercise.reps && (
                                <div>
                                  <span className="text-gray-600">Reps:</span>
                                  <span className="font-medium text-gray-900 ml-1">{exercise.reps}</span>
                                </div>
                              )}
                              {exercise.weight && (
                                <div>
                                  <span className="text-gray-600">Weight:</span>
                                  <span className="font-medium text-gray-900 ml-1">{exercise.weight} lbs</span>
                                </div>
                              )}
                              {exercise.duration && (
                                <div>
                                  <span className="text-gray-600">Duration:</span>
                                  <span className="font-medium text-gray-900 ml-1">{exercise.duration}s</span>
                                </div>
                              )}
                            </div>
                            {exercise.notes && (
                              <p className="text-sm text-gray-600 mt-2">
                                <strong>Notes:</strong> {exercise.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Dumbbell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No exercises in this workout</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const selectedClientData = clients.find(c => c.id === selectedClient);

  // Client view - show their own workout calendar
  if (user?.role === 'client') {
    return (
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Workout Calendar</h1>
          <p className="text-gray-600">View your scheduled workouts and track your progress.</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Calendar Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                  {day}
                </div>
              ))}
            </div>
            
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const dayWorkouts = getWorkoutsForDate(day);
                const isToday = day && day.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={index}
                    className={`min-h-24 p-2 border border-gray-100 rounded-lg ${
                      day ? 'hover:bg-gray-50' : ''
                    } ${isToday ? 'bg-green-50 border-green-200' : ''}`}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium mb-1 ${
                          isToday ? 'text-green-600' : 'text-gray-900'
                        }`}>
                          {day.getDate()}
                        </div>
                        <div className="space-y-1">
                          {dayWorkouts.slice(0, 2).map((workout) => (
                            <div
                              key={workout.id}
                              className={`text-xs p-1 rounded truncate ${
                                workout.completed 
                                  ? 'bg-green-500 text-white' 
                                  : 'bg-blue-500 text-white'
                              }`}
                              onClick={() => handleWorkoutClick(workout)}
                              style={{ cursor: 'pointer' }}
                            >
                              <div className="flex items-center">
                                <Dumbbell className="h-3 w-3 mr-1" />
                                <span className="truncate">{workout.title}</span>
                              </div>
                            </div>
                          ))}
                          {dayWorkouts.length > 2 && (
                            <div className="text-xs text-gray-500">
                              +{dayWorkouts.length - 2} more
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Coach view - client-specific workout calendar
  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Client Workout Calendar</h1>
          <p className="text-gray-600">Schedule and manage workout programs for your clients.</p>
        </div>
        {selectedClient && (
          <button
            onClick={() => setShowAddWorkout(true)}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Schedule Workout
          </button>
        )}
      </div>

      {/* Client Selector - only show if not viewing specific client */}
      {!clientId && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-blue-500 rounded-lg p-2">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Select Client</h3>
                <p className="text-sm text-gray-600">Choose a client to view their workout calendar</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {selectedClient ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Calendar Header */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateMonth('prev')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-600" />
                </button>
                <h2 className="text-xl font-semibold text-gray-900">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button
                  onClick={() => navigateMonth('next')}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ChevronRight className="h-5 w-5 text-gray-600" />
                </button>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="h-4 w-4" />
                <span>{clientName || `${selectedClientData?.first_name} ${selectedClientData?.last_name}`}</span>
              </div>
            </div>
            
            {/* Bulk Selection Controls */}
            {workouts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedWorkouts.size === workouts.length && workouts.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        Select All ({workouts.length} workouts)
                      </span>
                    </label>
                    {selectedWorkouts.size > 0 && (
                      <span className="text-sm text-gray-600">
                        {selectedWorkouts.size} selected
                      </span>
                    )}
                  </div>
                  
                  {selectedWorkouts.size > 0 && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowBulkActions(true)}
                        className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Bulk Actions
                      </button>
                      <button
                        onClick={() => setSelectedWorkouts(new Set())}
                        className="px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Calendar Grid */}
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading workouts...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 gap-1 mb-4">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                      {day}
                    </div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {days.map((day, index) => {
                    const dayWorkouts = getWorkoutsForDate(day);
                    const isToday = day && day.toDateString() === new Date().toDateString();
                    const isSelected = day && day.toDateString() === selectedDate.toDateString();
                    
                    return (
                      <div
                        key={index}
                        className={`min-h-24 p-2 border border-gray-100 rounded-lg cursor-pointer transition-colors ${
                          day ? 'hover:bg-gray-50' : ''
                        } ${isToday ? 'bg-green-50 border-green-200' : ''} ${
                          isSelected ? 'ring-2 ring-green-500' : ''
                        }`}
                        onClick={() => day && setSelectedDate(day)}
                      >
                        {day && (
                          <>
                            <div className={`text-sm font-medium mb-1 ${
                              isToday ? 'text-green-600' : 'text-gray-900'
                            }`}>
                              {day.getDate()}
                            </div>
                            <div className="space-y-1">
                              {dayWorkouts.slice(0, 2).map((workout) => (
                                <div
                                  key={workout.id}
                                  className={`text-xs p-1 rounded truncate relative ${
                                    workout.completed 
                                      ? 'bg-green-500 text-white' 
                                      : 'bg-blue-500 text-white'
                                  } ${selectedWorkouts.has(workout.id) ? 'ring-2 ring-yellow-400' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                      handleWorkoutSelect(workout.id, e);
                                    } else {
                                      handleWorkoutClick(workout);
                                    }
                                  }}
                                >
                                  {/* Selection checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={selectedWorkouts.has(workout.id)}
                                    onChange={(e) => handleWorkoutSelect(workout.id, e as any)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-0 right-0 h-3 w-3 text-yellow-600 focus:ring-yellow-500 border-gray-300 rounded"
                                    style={{ transform: 'translate(25%, -25%)' }}
                                  />
                                  <div className="flex items-center">
                                    <Dumbbell className="h-3 w-3 mr-1" />
                                    <span className="truncate">{workout.title}</span>
                                  </div>
                                </div>
                              ))}
                              {dayWorkouts.length > 2 && (
                                <div className="text-xs text-gray-500">
                                  +{dayWorkouts.length - 2} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        !clientId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12">
            <div className="text-center">
              <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Client</h3>
              <p className="text-gray-600">Choose a client from the dropdown above to view and manage their workout calendar.</p>
            </div>
          </div>
        )
      )}

      {/* Today's Workouts for Selected Client */}
      {selectedClient && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">
              {clientName ? `${clientName.split(' ')[0]}'s` : `${selectedClientData?.first_name}'s`} Workouts Today
            </h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {workouts
                .filter(workout => workout.date === new Date().toISOString().split('T')[0])
                .length > 0 ? workouts
                .filter(workout => workout.date === new Date().toISOString().split('T')[0])
                .map((workout) => (
                  <div key={workout.id} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                    <div className={`${workout.completed ? 'bg-green-500' : 'bg-blue-500'} rounded-lg p-2`}>
                      <Dumbbell className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{workout.title}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1" />
                          {workout.exerciseCount} exercises
                        </div>
                        <div className="flex items-center">
                          {workout.completed ? (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1 text-green-500" />
                              Completed
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 mr-1 text-orange-500" />
                              Scheduled
                            </>
                          )}
                        </div>
                      </div>
                      {workout.notes && (
                        <p className="text-sm text-gray-500 mt-1">{workout.notes}</p>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No workouts scheduled for today</p>
                    <button
                      onClick={() => setShowAddWorkout(true)}
                      className="text-green-600 hover:text-green-700 text-sm mt-2"
                    >
                      Schedule a workout
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {showAddWorkout && <AddWorkoutModal />}
      {showWorkoutModal && <WorkoutDetailModal />}
      {showBulkActions && <BulkActionsModal />}
    </div>
  );
};

export default CalendarView;