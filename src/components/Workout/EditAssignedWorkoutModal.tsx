import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, GripVertical, Users } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Exercise {
  id: string;
  name: string;
  description?: string;
  video_url?: string;
}

interface WorkoutExercise {
  id: string;
  exercise_id: string;
  sets: number;
  reps: number;
  weight?: number;
  duration?: number;
  order_index: number;
  superset_group?: number;
  exercise?: Exercise;
}

interface Workout {
  id: string;
  title: string;
  scheduled_date: string;
  notes?: string;
  client_id: string;
}

interface EditAssignedWorkoutModalProps {
  workoutId: string;
  onClose: () => void;
  onSave: () => void;
}

export default function EditAssignedWorkoutModal({ workoutId, onClose, onSave }: EditAssignedWorkoutModalProps) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    loadWorkout();
    loadAvailableExercises();
  }, [workoutId]);

  const loadWorkout = async () => {
    try {
      const { data: workoutData, error: workoutError } = await supabase
        .from('workouts')
        .select('*')
        .eq('id', workoutId)
        .single();

      if (workoutError) throw workoutError;

      setWorkout(workoutData);
      setTitle(workoutData.title);
      setScheduledDate(workoutData.scheduled_date);
      setNotes(workoutData.notes || '');

      const { data: exercisesData, error: exercisesError } = await supabase
        .from('workout_exercises')
        .select(`
          *,
          exercise:exercises(*)
        `)
        .eq('workout_id', workoutId)
        .order('order_index');

      if (exercisesError) throw exercisesError;

      setExercises(exercisesData || []);
    } catch (error) {
      console.error('Error loading workout:', error);
      alert('Failed to load workout');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name');

      if (error) throw error;
      setAvailableExercises(data || []);
    } catch (error) {
      console.error('Error loading exercises:', error);
    }
  };

  const handleAddExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = {
      id: `temp-${Date.now()}`,
      exercise_id: exercise.id,
      sets: 3,
      reps: 10,
      weight: undefined,
      duration: undefined,
      order_index: exercises.length,
      exercise: exercise
    };

    setExercises([...exercises, newExercise]);
    setShowExercisePicker(false);
    setSearchTerm('');
  };

  const handleRemoveExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleUpdateExercise = (index: number, field: string, value: any) => {
    const updated = [...exercises];
    updated[index] = { ...updated[index], [field]: value };
    setExercises(updated);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const reordered = [...exercises];
    const draggedItem = reordered[draggedIndex];
    reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedItem);

    setExercises(reordered);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleGroupSuperset = (index: number) => {
    if (index === 0) return;

    const updated = [...exercises];
    const prevExercise = updated[index - 1];

    if (prevExercise.superset_group) {
      updated[index].superset_group = prevExercise.superset_group;
    } else {
      const maxGroup = Math.max(0, ...updated.map(e => e.superset_group || 0));
      const newGroup = maxGroup + 1;
      updated[index - 1].superset_group = newGroup;
      updated[index].superset_group = newGroup;
    }

    setExercises(updated);
  };

  const handleUngroupSuperset = (index: number) => {
    const updated = [...exercises];
    updated[index].superset_group = undefined;
    setExercises(updated);
  };

  const handleSave = async () => {
    if (!title.trim() || !scheduledDate) {
      alert('Please fill in all required fields');
      return;
    }

    setSaving(true);

    try {
      const { error: workoutError } = await supabase
        .from('workouts')
        .update({
          title: title.trim(),
          scheduled_date: scheduledDate,
          notes: notes.trim() || null
        })
        .eq('id', workoutId);

      if (workoutError) throw workoutError;

      const existingExerciseIds = exercises
        .filter(e => !e.id.startsWith('temp-'))
        .map(e => e.id);

      const { error: deleteError } = await supabase
        .from('workout_exercises')
        .delete()
        .eq('workout_id', workoutId)
        .not('id', 'in', `(${existingExerciseIds.length > 0 ? existingExerciseIds.join(',') : "''"})`)
        ;

      if (deleteError) throw deleteError;

      for (let i = 0; i < exercises.length; i++) {
        const exercise = exercises[i];
        const exerciseData = {
          workout_id: workoutId,
          exercise_id: exercise.exercise_id,
          sets: exercise.sets,
          reps: exercise.reps,
          weight: exercise.weight || null,
          duration: exercise.duration || null,
          order_index: i,
          superset_group: exercise.superset_group || null
        };

        if (exercise.id.startsWith('temp-')) {
          const { error: insertError } = await supabase
            .from('workout_exercises')
            .insert(exerciseData);

          if (insertError) throw insertError;
        } else {
          const { error: updateError } = await supabase
            .from('workout_exercises')
            .update(exerciseData)
            .eq('id', exercise.id);

          if (updateError) throw updateError;
        }
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Error saving workout:', error);
      alert('Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  const filteredExercises = availableExercises.filter(exercise =>
    exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (exercise.description && exercise.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading workout...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-lg max-w-4xl w-full max-h-[95dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Edit Assigned Workout</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Workout Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Upper Body Strength"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Scheduled Date *
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Add any notes for this workout..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-4">
              <label className="block text-sm font-medium text-gray-700">
                Exercises
              </label>
              <button
                onClick={() => setShowExercisePicker(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Plus className="h-4 w-4" />
                <span>Add Exercise</span>
              </button>
            </div>

            {exercises.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <p className="text-gray-500">No exercises added yet</p>
                <button
                  onClick={() => setShowExercisePicker(true)}
                  className="mt-4 text-blue-500 hover:text-blue-600 font-medium"
                >
                  Add your first exercise
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {exercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`bg-gray-50 rounded-lg p-4 ${
                      exercise.superset_group
                        ? 'border-l-4 border-orange-400 ml-4'
                        : 'border-l-4 border-transparent'
                    }`}
                  >
                    <div className="flex items-start space-x-4">
                      <button className="mt-2 text-gray-400 hover:text-gray-600 cursor-move">
                        <GripVertical className="h-5 w-5" />
                      </button>

                      <div className="flex-1 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900">
                              {exercise.exercise?.name || 'Unknown Exercise'}
                            </h4>
                            {exercise.superset_group && (
                              <span className="text-xs text-orange-600 font-medium">
                                Superset
                              </span>
                            )}
                          </div>
                          <div className="flex space-x-2">
                            {index > 0 && !exercise.superset_group && (
                              <button
                                onClick={() => handleGroupSuperset(index)}
                                className="p-2 text-orange-500 hover:text-orange-600"
                                title="Group as superset with previous exercise"
                              >
                                <Users className="h-4 w-4" />
                              </button>
                            )}
                            {exercise.superset_group && (
                              <button
                                onClick={() => handleUngroupSuperset(index)}
                                className="p-2 text-gray-500 hover:text-gray-600"
                                title="Remove from superset"
                              >
                                <Users className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveExercise(index)}
                              className="p-2 text-red-500 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Sets</label>
                            <input
                              type="number"
                              min="1"
                              value={exercise.sets}
                              onChange={(e) => handleUpdateExercise(index, 'sets', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Reps</label>
                            <input
                              type="number"
                              min="1"
                              value={exercise.reps}
                              onChange={(e) => handleUpdateExercise(index, 'reps', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Weight (lbs)</label>
                            <input
                              type="number"
                              min="0"
                              value={exercise.weight || ''}
                              onChange={(e) => handleUpdateExercise(index, 'weight', e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Optional"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Duration (sec)</label>
                            <input
                              type="number"
                              min="0"
                              value={exercise.duration || ''}
                              onChange={(e) => handleUpdateExercise(index, 'duration', e.target.value ? parseInt(e.target.value) : undefined)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim() || !scheduledDate}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {showExercisePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-gray-900">Select Exercise</h3>
                <button
                  onClick={() => {
                    setShowExercisePicker(false);
                    setSearchTerm('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search exercises..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-2">
                {filteredExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => handleAddExercise(exercise)}
                    className="w-full text-left p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <h4 className="font-medium text-gray-900">{exercise.name}</h4>
                    {exercise.description && (
                      <p className="text-sm text-gray-600 mt-1">{exercise.description}</p>
                    )}
                  </button>
                ))}

                {filteredExercises.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No exercises found matching "{searchTerm}"
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
