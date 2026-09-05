import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  X,
  Copy,
  Users,
  Calendar,
  Loader,
  CheckCircle,
  AlertCircle,
  Search,
} from 'lucide-react';

interface CopyWorkoutModalProps {
  workoutId: string;
  workoutTitle: string;
  /** Pass multiple workout IDs to copy a week / batch */
  workoutIds?: string[];
  onClose: () => void;
  onCopyComplete: (count: number) => void;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

const CopyWorkoutModal: React.FC<CopyWorkoutModalProps> = ({
  workoutId,
  workoutTitle,
  workoutIds,
  onClose,
  onCopyComplete,
}) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);

      // Get clients assigned to this coach
      const { data: assignments, error: err } = await supabase
        .from('coach_client_assignments')
        .select(`
          client_id,
          client:profiles!coach_client_assignments_client_id_fkey(id, first_name, last_name, email)
        `)
        .eq('coach_id', user?.id)
        .eq('active', true);

      if (err) throw err;

      const clientProfiles = assignments
        ?.map((a: any) => a.client)
        .filter(Boolean) || [];

      setClients(clientProfiles);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleClient = (id: string) => {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedClients.length === filteredClients.length) {
      setSelectedClients([]);
    } else {
      setSelectedClients(filteredClients.map(c => c.id));
    }
  };

  const handleCopy = async () => {
    if (selectedClients.length === 0) {
      setError('Please select at least one client');
      return;
    }

    try {
      setCopying(true);
      setError('');

      const ids = workoutIds && workoutIds.length > 0 ? workoutIds : [workoutId];
      let totalCopied = 0;

      for (const wid of ids) {
        // Fetch source workout (try scheduled_workouts first, then workouts)
        let source: any = null;
        let sourceExercises: any[] = [];

        const { data: scheduled } = await supabase
          .from('scheduled_workouts')
          .select(`
            *,
            exercises:scheduled_workout_exercises(
              exercise_id, sets, reps, weight, duration, notes, order_index, superset_group
            )
          `)
          .eq('id', wid)
          .maybeSingle();

        if (scheduled) {
          source = scheduled;
          sourceExercises = scheduled.exercises || [];
        } else {
          // Try the legacy workouts table
          const { data: legacyWorkout } = await supabase
            .from('workouts')
            .select(`
              *,
              workout_exercises(
                exercise_id, sets, reps, weight, duration, notes, order_index
              )
            `)
            .eq('id', wid)
            .maybeSingle();

          if (legacyWorkout) {
            source = legacyWorkout;
            sourceExercises = legacyWorkout.workout_exercises || [];
          }
        }

        if (!source) continue;

        // Copy to each client
        for (const clientId of selectedClients) {
          const { data: newWorkout, error: insertError } = await supabase
            .from('scheduled_workouts')
            .insert([{
              workout_template_id: source.workout_template_id || source.template_id || null,
              client_id: clientId,
              coach_id: user?.id,
              scheduled_date: targetDate,
              title: source.title,
              notes: source.notes || source.description || null,
              status: 'scheduled',
              copied_from_id: scheduled ? wid : null,
            }])
            .select()
            .single();

          if (insertError) {
            console.error('Error copying workout:', insertError);
            continue;
          }

          if (sourceExercises.length > 0) {
            const exerciseRows = sourceExercises.map((ex: any) => ({
              scheduled_workout_id: newWorkout.id,
              exercise_id: ex.exercise_id,
              sets: ex.sets ?? null,
              reps: ex.reps ?? null,
              weight: ex.weight ?? null,
              duration: ex.duration ?? null,
              notes: ex.notes ?? null,
              order_index: ex.order_index ?? 0,
              superset_group: ex.superset_group ?? null,
            }));

            await supabase.from('scheduled_workout_exercises').insert(exerciseRows);
          }

          totalCopied++;
        }
      }

      onCopyComplete(totalCopied);
    } catch (err: any) {
      console.error('Error copying workouts:', err);
      setError(err.message || 'Failed to copy workout');
    } finally {
      setCopying(false);
    }
  };

  const filteredClients = clients.filter(c =>
    `${c.first_name} ${c.last_name} ${c.email || ''}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-lg sm:mx-4 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-500" />
              Copy Workout to Clients
            </h3>
            <p className="text-sm text-gray-600 mt-1 truncate">{workoutTitle}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Target Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="h-4 w-4 inline mr-1" />
              Target Date
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Client Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">
                <Users className="h-4 w-4 inline mr-1" />
                Select Clients ({selectedClients.length} selected)
              </label>
              {filteredClients.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {selectedClients.length === filteredClients.length ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            {/* Search */}
            <div className="relative mb-2">
              <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Loader className="h-6 w-6 text-blue-500 animate-spin mx-auto mb-2" />
                <p className="text-sm text-gray-600">Loading clients...</p>
              </div>
            ) : filteredClients.length > 0 ? (
              <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredClients.map(client => (
                  <label
                    key={client.id}
                    className="flex items-center p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClients.includes(client.id)}
                      onChange={() => handleToggleClient(client.id)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex items-center space-x-3">
                      <div className="h-8 w-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-semibold text-sm">
                          {client.first_name[0]}{client.last_name[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{client.first_name} {client.last_name}</p>
                        {client.email && <p className="text-xs text-gray-500">{client.email}</p>}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-gray-200 rounded-lg">
                <Users className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {searchTerm ? 'No clients match your search' : 'No clients available'}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3 pt-2 border-t border-gray-100">
            <button
              onClick={handleCopy}
              disabled={copying || selectedClients.length === 0}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white py-2.5 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {copying ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Copy to {selectedClients.length} Client{selectedClients.length !== 1 ? 's' : ''}
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={copying}
              className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CopyWorkoutModal;
