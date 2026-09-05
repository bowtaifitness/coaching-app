import React, { useState, useEffect } from 'react';
import { X, TrendingUp, Calendar, Dumbbell, Loader } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { supabase } from '../../lib/supabase';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ExerciseHistory {
  workout_date: string;
  workout_title: string;
  sets: number;
  reps: number;
  weight: number;
  notes?: string;
}

interface ExerciseHistoryModalProps {
  exerciseId: string;
  exerciseName: string;
  clientId: string;
  onClose: () => void;
}

const ExerciseHistoryModal: React.FC<ExerciseHistoryModalProps> = ({
  exerciseId,
  exerciseName,
  clientId,
  onClose
}) => {
  const [history, setHistory] = useState<ExerciseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'chart'>('chart');

  useEffect(() => {
    fetchExerciseHistory();
  }, [exerciseId, clientId]);

  const fetchExerciseHistory = async () => {
    try {
      setLoading(true);

      console.log('ExerciseHistoryModal: Fetching history for exercise ID:', exerciseId, 'client ID:', clientId);

      // First, get the exercise name to query by name across all workouts
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('exercises')
        .select('name')
        .eq('id', exerciseId)
        .maybeSingle();

      if (exerciseError) {
        console.error('ExerciseHistoryModal: Error fetching exercise name:', exerciseError);
        throw exerciseError;
      }

      if (!exerciseData) {
        console.error('ExerciseHistoryModal: Exercise not found for ID:', exerciseId);
        setLoading(false);
        return;
      }

      const exerciseName = exerciseData.name;
      console.log('ExerciseHistoryModal: Exercise name:', exerciseName);

      // Query all workout_exercises with this exercise name for this client
      const { data, error } = await supabase
        .from('workout_exercises')
        .select(`
          sets,
          reps,
          weight,
          notes,
          exercises!inner(
            name
          ),
          workouts!inner(
            scheduled_date,
            title,
            completed,
            client_id
          )
        `)
        .eq('exercises.name', exerciseName)
        .eq('workouts.client_id', clientId)
        .eq('workouts.completed', true);

      if (error) {
        console.error('ExerciseHistoryModal: Error fetching workout exercises:', error);
        throw error;
      }

      console.log('ExerciseHistoryModal: Raw data from query:', data);

      // Sort the data after fetching since we can't order by joined table columns directly
      const sortedData = data?.sort((a: any, b: any) => {
        const dateA = new Date(a.workouts.scheduled_date).getTime();
        const dateB = new Date(b.workouts.scheduled_date).getTime();
        return dateB - dateA;
      }) || [];

      const formattedHistory = sortedData.map((item: any) => {
        let actualSets = item.sets;
        let actualReps = item.reps;
        let actualWeight = item.weight;
        let plainNotes = '';

        if (item.notes) {
          try {
            const parsedNotes = JSON.parse(item.notes);
            if (parsedNotes && typeof parsedNotes === 'object') {
              if (parsedNotes.setProgress && Array.isArray(parsedNotes.setProgress)) {
                const completedSets = parsedNotes.setProgress.filter((set: any) =>
                  set && (set.reps > 0 || set.weight > 0)
                );

                if (completedSets.length > 0) {
                  actualSets = completedSets.length;
                  const avgReps = completedSets.reduce((sum: number, set: any) => sum + (set.reps || 0), 0) / completedSets.length;
                  const maxWeight = Math.max(...completedSets.map((set: any) => set.weight || 0));

                  actualReps = Math.round(avgReps);
                  actualWeight = maxWeight;
                }
              }

              if (parsedNotes.actualSets !== undefined) actualSets = parsedNotes.actualSets;
              if (parsedNotes.actualReps !== undefined) actualReps = parsedNotes.actualReps;
              if (parsedNotes.actualWeight !== undefined) actualWeight = parsedNotes.actualWeight;
              if (parsedNotes.notes) plainNotes = parsedNotes.notes;
            }
          } catch (e) {
            plainNotes = item.notes;
          }
        }

        return {
          workout_date: item.workouts.scheduled_date,
          workout_title: item.workouts.title,
          sets: actualSets || 0,
          reps: actualReps || 0,
          weight: actualWeight || 0,
          notes: plainNotes
        };
      }).filter((entry: ExerciseHistory) =>
        entry.sets > 0 || entry.reps > 0 || entry.weight > 0
      ) || [];

      console.log('ExerciseHistoryModal: Formatted history entries:', formattedHistory);
      console.log('ExerciseHistoryModal: Total history entries:', formattedHistory.length);

      setHistory(formattedHistory);
    } catch (error) {
      console.error('ExerciseHistoryModal: Error fetching exercise history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getWeightChartData = () => {
    const sortedHistory = [...history].reverse().slice(-10);

    return {
      labels: sortedHistory.map(h =>
        new Date(h.workout_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [
        {
          label: 'Weight (lbs)',
          data: sortedHistory.map(h => h.weight || 0),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  };

  const getVolumeChartData = () => {
    const sortedHistory = [...history].reverse().slice(-10);

    return {
      labels: sortedHistory.map(h =>
        new Date(h.workout_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      ),
      datasets: [
        {
          label: 'Total Volume (Weight × Reps)',
          data: sortedHistory.map(h => (h.weight || 0) * (h.reps || 0)),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }
      ]
    };
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
      title: {
        display: false
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          font: {
            size: 11
          }
        }
      },
      x: {
        ticks: {
          font: {
            size: 11
          },
          maxRotation: 45,
          minRotation: 45
        }
      }
    }
  };

  const getStats = () => {
    if (history.length === 0) return null;

    const weights = history.map(h => h.weight || 0).filter(w => w > 0);
    const volumes = history.map(h => (h.weight || 0) * (h.reps || 0)).filter(v => v > 0);

    return {
      maxWeight: Math.max(...weights),
      avgWeight: weights.length > 0 ? Math.round(weights.reduce((a, b) => a + b, 0) / weights.length) : 0,
      maxVolume: Math.max(...volumes),
      totalWorkouts: history.length
    };
  };

  const stats = getStats();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-4xl w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-500 p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">Exercise History</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-blue-50 font-medium">{exerciseName}</p>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading history...</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-12">
            <div className="text-center">
              <Dumbbell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">No history yet</p>
              <p className="text-gray-500 text-sm mt-2">
                Complete workouts with this exercise to see your progress
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Stats Summary */}
            {stats && (
              <div className="p-6 bg-gray-50 border-b border-gray-200">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.maxWeight}</p>
                    <p className="text-sm text-gray-600">Max Weight (lbs)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{stats.avgWeight}</p>
                    <p className="text-sm text-gray-600">Avg Weight (lbs)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">{stats.maxVolume}</p>
                    <p className="text-sm text-gray-600">Max Volume</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-900">{stats.totalWorkouts}</p>
                    <p className="text-sm text-gray-600">Total Sessions</p>
                  </div>
                </div>
              </div>
            )}

            {/* View Toggle */}
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center space-x-2 bg-gray-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setViewMode('chart')}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'chart'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Progress Chart
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Session History
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {viewMode === 'chart' ? (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Weight Progress</h4>
                    <div className="h-56 sm:h-64">
                      <Line data={getWeightChartData()} options={chartOptions} />
                    </div>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Volume Progress</h4>
                    <div className="h-56 sm:h-64">
                      <Line data={getVolumeChartData()} options={chartOptions} />
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 text-center">
                    Showing last 10 completed workouts
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((entry, index) => (
                    <div
                      key={index}
                      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-blue-500 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-semibold text-gray-900">{entry.workout_title}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(entry.workout_date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <span className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded">
                          #{history.length - index}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-3">
                        <div className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-600 mb-1">Sets</p>
                          <p className="text-lg font-bold text-gray-900">{entry.sets || 0}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-600 mb-1">Reps</p>
                          <p className="text-lg font-bold text-gray-900">{entry.reps || 0}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2 text-center">
                          <p className="text-xs text-gray-600 mb-1">Weight</p>
                          <p className="text-lg font-bold text-gray-900">{entry.weight || 0}</p>
                        </div>
                      </div>
                      {entry.notes && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-600">{entry.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ExerciseHistoryModal;
