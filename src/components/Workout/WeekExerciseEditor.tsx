import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Save,
  Loader,
  CheckCircle,
  AlertCircle,
  Plus,
  Trash2,
  GripVertical,
  Search,
  X,
  Dumbbell
} from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  category: string;
  description?: string;
}

interface WeekExercise {
  id: string;
  exercise_id: string;
  exercise: Exercise;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  rest_seconds?: number;
  notes?: string;
  order_index: number;
}

interface WeekExerciseEditorProps {
  programId: string;
  dayId: string;
  dayName: string;
  weekNumber: number;
  programWeekId?: string;
  onBack: () => void;
  onSave: () => void;
}

const WeekExerciseEditor: React.FC<WeekExerciseEditorProps> = ({
  programId,
  dayId,
  dayName,
  weekNumber,
  programWeekId: initialProgramWeekId,
  onBack,
  onSave
}) => {
  const [exercises, setExercises] = useState<WeekExercise[]>([]);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const [programWeekId, setProgramWeekId] = useState<string | undefined>(initialProgramWeekId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const weekId = await ensureProgramWeek();
      await loadAvailableExercises();

      const { data: existingExercises, error } = await supabase
        .from('program_week_exercises')
        .select('id')
        .eq('program_week_id', weekId);

      if (error) throw error;

      if (!existingExercises || existingExercises.length === 0) {
        await copyTemplateExercisesIfNeeded();
      } else {
        await loadExercises();
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const ensureProgramWeek = async (): Promise<string> => {
    if (programWeekId) return programWeekId;

    const { data: existingWeek, error: checkError } = await supabase
      .from('program_weeks')
      .select('id')
      .eq('program_id', programId)
      .eq('program_day_id', dayId)
      .eq('week_number', weekNumber)
      .maybeSingle();

    if (checkError) throw checkError;

    if (existingWeek) {
      setProgramWeekId(existingWeek.id);
      return existingWeek.id;
    } else {
      const { data: newWeek, error: insertError } = await supabase
        .from('program_weeks')
        .insert({
          program_id: programId,
          program_day_id: dayId,
          week_number: weekNumber,
          notes: 'Custom exercises'
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      setProgramWeekId(newWeek.id);
      return newWeek.id;
    }
  };

  const loadExercises = async () => {
    if (!programWeekId) return [];

    const { data, error } = await supabase
      .from('program_week_exercises')
      .select(`
        id,
        exercise_id,
        sets,
        reps,
        weight,
        duration,
        rest_seconds,
        notes,
        order_index,
        exercise:exercises(id, name, category, description)
      `)
      .eq('program_week_id', programWeekId)
      .order('order_index');

    if (error) throw error;
    const exerciseData = data || [];
    setExercises(exerciseData);
    return exerciseData;
  };

  const loadAvailableExercises = async () => {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, category, description')
      .order('name');

    if (error) throw error;
    setAvailableExercises(data || []);
  };

  const copyTemplateExercisesIfNeeded = async () => {
    if (!programWeekId) return;

    // Double-check for existing exercises to prevent duplicates
    const { data: existingCheck, error: existingCheckError } = await supabase
      .from('program_week_exercises')
      .select('id')
      .eq('program_week_id', programWeekId);

    if (existingCheckError) throw existingCheckError;

    // If any exercises exist, just load them instead of copying
    if (existingCheck && existingCheck.length > 0) {
      await loadExercises();
      return;
    }

    const { data: programWeek, error: weekError } = await supabase
      .from('program_weeks')
      .select('template_id')
      .eq('id', programWeekId)
      .single();

    if (weekError || !programWeek?.template_id) {
      // No template assigned, just load exercises (might be empty)
      await loadExercises();
      return;
    }

    const { data: templateExercises, error: templateError } = await supabase
      .from('template_exercises')
      .select(`
        exercise_id,
        sets,
        reps,
        weight,
        duration,
        notes,
        order_index,
        exercise:exercises(id, name, category, description)
      `)
      .eq('template_id', programWeek.template_id)
      .order('order_index');

    if (templateError || !templateExercises || templateExercises.length === 0) {
      await loadExercises();
      return;
    }

    // Final check right before insert to prevent race conditions
    const { data: finalCheck } = await supabase
      .from('program_week_exercises')
      .select('id')
      .eq('program_week_id', programWeekId)
      .limit(1);

    if (finalCheck && finalCheck.length > 0) {
      await loadExercises();
      return;
    }

    const exercisesToInsert = templateExercises.map(te => ({
      program_week_id: programWeekId,
      exercise_id: te.exercise_id,
      sets: te.sets,
      reps: te.reps,
      weight: te.weight,
      duration: te.duration,
      rest_seconds: 60,
      notes: te.notes,
      order_index: te.order_index
    }));

    const { data: insertedExercises, error: insertError } = await supabase
      .from('program_week_exercises')
      .insert(exercisesToInsert)
      .select(`
        id,
        exercise_id,
        sets,
        reps,
        weight,
        duration,
        rest_seconds,
        notes,
        order_index,
        exercise:exercises(id, name, category, description)
      `)
      .order('order_index');

    if (insertError) {
      // If we get a unique constraint violation, it means exercises were already inserted
      // Just load them instead of failing
      if (insertError.code === '23505') {
        await loadExercises();
        return;
      }
      throw insertError;
    }
    setExercises(insertedExercises || []);
  };

  const handleAddExercise = async (exerciseId: string) => {
    try {
      if (!programWeekId) {
        await ensureProgramWeek();
      }

      const maxOrder = exercises.length > 0
        ? Math.max(...exercises.map(e => e.order_index))
        : -1;

      const { data, error } = await supabase
        .from('program_week_exercises')
        .insert({
          program_week_id: programWeekId,
          exercise_id: exerciseId,
          order_index: maxOrder + 1,
          sets: 3,
          reps: 10,
          is_customized: true // Manually added exercises are customized
        })
        .select(`
          id,
          exercise_id,
          sets,
          reps,
          weight,
          duration,
          rest_seconds,
          notes,
          order_index,
          exercise:exercises(id, name, category, description)
        `)
        .single();

      if (error) throw error;

      setExercises([...exercises, data]);
      setShowAddExercise(false);
      setSearchTerm('');
      setSuccess('Exercise added successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error adding exercise:', err);
      setError('Failed to add exercise');
    }
  };

  const handleUpdateExercise = async (exerciseId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from('program_week_exercises')
        .update({
          [field]: value,
          is_customized: true // Mark as customized so it won't be overwritten by template updates
        })
        .eq('id', exerciseId);

      if (error) throw error;

      setExercises(exercises.map(ex =>
        ex.id === exerciseId ? { ...ex, [field]: value } : ex
      ));
    } catch (err) {
      console.error('Error updating exercise:', err);
      setError('Failed to update exercise');
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!confirm('Are you sure you want to remove this exercise?')) return;

    try {
      const { error } = await supabase
        .from('program_week_exercises')
        .delete()
        .eq('id', exerciseId);

      if (error) throw error;

      setExercises(exercises.filter(ex => ex.id !== exerciseId));
      setSuccess('Exercise removed successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      console.error('Error deleting exercise:', err);
      setError('Failed to delete exercise');
    }
  };

  const handleSave = () => {
    setSuccess('Changes saved successfully!');
    setTimeout(() => {
      onSave();
    }, 1500);
  };

  const filteredAvailableExercises = availableExercises.filter(ex =>
    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ex.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading exercises...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={onBack}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Customize {dayName} - Week {weekNumber}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Add and configure exercises specific to this week
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Save className="h-4 w-4 mr-2" />
            Save & Return
          </button>
        </div>
      </div>

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <p className="text-green-800">{success}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Exercises ({exercises.length})
          </h2>
          <button
            onClick={() => setShowAddExercise(true)}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Exercise
          </button>
        </div>

        {exercises.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Exercises Yet</h3>
            <p className="text-gray-600 mb-4">Add exercises to customize this workout for Week {weekNumber}</p>
            <button
              onClick={() => setShowAddExercise(true)}
              className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Exercise
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {exercises.map((exercise, index) => (
              <div key={exercise.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="flex items-center space-x-2 text-gray-400">
                    <GripVertical className="h-5 w-5" />
                    <span className="text-sm font-medium">{index + 1}</span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900">{exercise.exercise.name}</h3>
                        <p className="text-sm text-gray-600 capitalize">{exercise.exercise.category}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteExercise(exercise.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Sets</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.sets || ''}
                          onChange={(e) => handleUpdateExercise(exercise.id, 'sets', parseInt(e.target.value) || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="3"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Reps</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.reps || ''}
                          onChange={(e) => handleUpdateExercise(exercise.id, 'reps', parseInt(e.target.value) || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="10"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Weight (lbs)</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          step="0.5"
                          value={exercise.weight || ''}
                          onChange={(e) => handleUpdateExercise(exercise.id, 'weight', parseFloat(e.target.value) || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="135"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Duration (sec)</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.duration || ''}
                          onChange={(e) => handleUpdateExercise(exercise.id, 'duration', parseInt(e.target.value) || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="60"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Rest (sec)</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.rest_seconds || ''}
                          onChange={(e) => handleUpdateExercise(exercise.id, 'rest_seconds', parseInt(e.target.value) || null)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                          placeholder="60"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <textarea
                        value={exercise.notes || ''}
                        onChange={(e) => handleUpdateExercise(exercise.id, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        rows={2}
                        placeholder="Add notes or instructions..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddExercise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
          <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-2xl w-full max-h-[90dvh] sm:max-h-[80vh] overflow-y-auto keyboard-aware-container">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Add Exercise</h3>
              <button
                onClick={() => {
                  setShowAddExercise(false);
                  setSearchTerm('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search exercises..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredAvailableExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    onClick={() => handleAddExercise(exercise.id)}
                    disabled={exercises.some(e => e.exercise_id === exercise.id)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-gray-200 disabled:hover:bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900">{exercise.name}</p>
                        <p className="text-sm text-gray-600 capitalize">{exercise.category}</p>
                      </div>
                      {exercises.some(e => e.exercise_id === exercise.id) && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Already added
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeekExerciseEditor;
