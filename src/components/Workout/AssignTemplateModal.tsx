import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Users,
  Calendar,
  Loader,
  CheckCircle,
  AlertCircle,
  User,
  Clock,
  Target,
  Dumbbell
} from 'lucide-react';

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

interface WorkoutTemplate {
  id: string;
  title: string;
  description?: string;
  template_exercises?: Array<{
    exercise: {
      name: string;
      category: string;
    };
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number;
  }>;
}

interface AssignTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: WorkoutTemplate;
  onAssignComplete: () => void;
}

const AssignTemplateModal: React.FC<AssignTemplateModalProps> = ({
  isOpen,
  onClose,
  template,
  onAssignComplete
}) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState('');
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchClients();
      // Scroll to top when modal opens
      if (modalContentRef.current) {
        modalContentRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError('');

      // Get clients assigned to this coach
      const { data: assignments, error: assignmentsError } = await supabase
        .from('coach_client_assignments')
        .select(`
          client_id,
          client:profiles!client_id(id, first_name, last_name, email)
        `)
        .eq('coach_id', user?.id)
        .eq('active', true);

      if (assignmentsError) throw assignmentsError;

      const clientProfiles = assignments?.map(a => a.client).filter(Boolean) || [];
      setClients(clientProfiles);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleClientToggle = (clientId: string) => {
    setSelectedClients(prev => 
      prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleAssign = async () => {
    if (selectedClients.length === 0) {
      setError('Please select at least one client');
      return;
    }

    try {
      setAssigning(true);
      setError('');

      // Create workouts for each selected client
      const workoutPromises = selectedClients.map(async (clientId) => {
        // Create the workout
        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert([{
            title: template.title,
            description: template.description,
            coach_id: user?.id,
            client_id: clientId,
            scheduled_date: scheduledDate,
            template_id: template.id,
            notes: notes || null,
            completed: false
          }])
          .select()
          .single();

        if (workoutError) throw workoutError;

        // Add exercises from template to the workout
        if (template.template_exercises && template.template_exercises.length > 0) {
          const workoutExercises = template.template_exercises.map((templateEx, index) => ({
            workout_id: workout.id,
            exercise_id: templateEx.exercise_id,
            sets: templateEx.sets,
            reps: templateEx.reps,
            weight: templateEx.weight,
            duration: templateEx.duration,
            order_index: index
          }));

          const { error: exercisesError } = await supabase
            .from('workout_exercises')
            .insert(workoutExercises);

          if (exercisesError) throw exercisesError;
        }

        return workout;
      });

      await Promise.all(workoutPromises);

      onAssignComplete();
      onClose();
    } catch (err) {
      console.error('Error assigning template:', err);
      setError('Failed to assign template. Please try again.');
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div ref={modalContentRef} className="modal-panel bg-white rounded-t-2xl sm:rounded-xl w-full max-w-2xl sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Template: {template.title}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading clients...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Template Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">{template.title}</h4>
                {template.description && (
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                )}
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <div className="flex items-center">
                    <Dumbbell className="h-4 w-4 mr-1" />
                    {template.template_exercises?.length || 0} exercises
                  </div>
                  <div className="flex items-center">
                    <Target className="h-4 w-4 mr-1" />
                    {[...new Set(template.template_exercises?.map(ex => ex.exercise.category) || [])].length} categories
                  </div>
                </div>
              </div>

              {/* Schedule Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scheduled Date
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes for Clients (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  rows={3}
                  placeholder="Any specific instructions or modifications for this workout..."
                />
              </div>

              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Clients ({selectedClients.length} selected)
                </label>
                
                {clients.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {clients.map((client) => (
                      <label
                        key={client.id}
                        className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClients.includes(client.id)}
                          onChange={() => handleClientToggle(client.id)}
                          className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                        />
                        <div className="ml-3 flex items-center space-x-3">
                          <div className="h-8 w-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {client.first_name[0]}{client.last_name[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {client.first_name} {client.last_name}
                            </p>
                            {client.email && (
                              <p className="text-sm text-gray-600">{client.email}</p>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 border border-gray-200 rounded-lg">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No clients available</p>
                    <p className="text-sm text-gray-400">Add clients to assign workouts</p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={handleAssign}
                  disabled={assigning || selectedClients.length === 0}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                      Assigning to {selectedClients.length} client{selectedClients.length !== 1 ? 's' : ''}...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 inline" />
                      Assign to {selectedClients.length} Client{selectedClients.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={assigning}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssignTemplateModal;