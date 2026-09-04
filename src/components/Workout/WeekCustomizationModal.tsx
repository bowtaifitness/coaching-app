import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { X, Save, Loader, CheckCircle, AlertCircle, Dumbbell, RotateCcw, CreditCard as Edit3, Target, Clock } from 'lucide-react';

interface Exercise {
  id: string;
  exercise_id: string;
  exercise: {
    id: string;
    name: string;
    category: string;
  };
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  notes?: string;
  order_index?: number;
}

interface WeekCustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  programId: string;
  dayId: string;
  weekNumber: number;
  templateId: string;
  onCustomizationComplete: () => void;
}

const WeekCustomizationModal: React.FC<WeekCustomizationModalProps> = ({
  isOpen,
  onClose,
  programId,
  dayId,
  weekNumber,
  templateId,
  onCustomizationComplete
}) => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [originalExercises, setOriginalExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchWeekData();
      // Scroll to top when modal opens
      if (modalContentRef.current) {
        modalContentRef.current.scrollTop = 0;
      }
    }
  }, [isOpen, programId, dayId, weekNumber, templateId]);

  const fetchWeekData = async () => {
    try {
      setLoading(true);
      setError('');

      // Check if this week already has customizations
      const { data: existingWeek, error: weekError } = await supabase
        .from('program_weeks')
        .select(`
          id,
          notes,
          template_id,
          workout_template:workout_templates(
            id,
            title,
            template_exercises(
              id,
              exercise_id,
              sets,
              reps,
              weight,
              duration,
              notes,
              order_index,
              exercise:exercises(id, name, category)
            )
          )
        `)
        .eq('program_id', programId)
        .eq('program_day_id', dayId)
        .eq('week_number', weekNumber)
        .maybeSingle();

      if (weekError) throw weekError;

      if (existingWeek && existingWeek.workout_template) {
        // Week has customizations, load them
        const templateExercises = existingWeek.workout_template.template_exercises || [];
        const formattedExercises = templateExercises.map(te => ({
          id: te.id,
          exercise_id: te.exercise_id,
          exercise: te.exercise,
          sets: te.sets,
          reps: te.reps,
          weight: te.weight,
          duration: te.duration,
          notes: te.notes,
          order_index: te.order_index
        }));
        
        setExercises(formattedExercises);
        setOriginalExercises(formattedExercises);
      } else {
        // No customizations yet, load base template
        const { data: baseTemplate, error: templateError } = await supabase
          .from('workout_templates')
          .select(`
            id,
            title,
            template_exercises(
              id,
              exercise_id,
              sets,
              reps,
              weight,
              duration,
              notes,
              order_index,
              exercise:exercises(id, name, category)
            )
          `)
          .eq('id', templateId)
          .single();

        if (templateError) throw templateError;

        const templateExercises = baseTemplate.template_exercises || [];
        const formattedExercises = templateExercises.map(te => ({
          id: `temp-${te.id}`, // Temporary ID for new customizations
          exercise_id: te.exercise_id,
          exercise: te.exercise,
          sets: te.sets,
          reps: te.reps,
          weight: te.weight,
          duration: te.duration,
          notes: te.notes,
          order_index: te.order_index
        }));
        
        setExercises(formattedExercises);
        setOriginalExercises(formattedExercises);
      }

    } catch (err) {
      console.error('Error fetching week data:', err);
      setError('Failed to load week data');
    } finally {
      setLoading(false);
    }
  };

  const handleExerciseChange = (index: number, field: string, value: any) => {
    setExercises(prev => {
      const newExercises = [...prev];
      newExercises[index] = {
        ...newExercises[index],
        [field]: value
      };
      return newExercises;
    });
    setHasChanges(true);
  };

  const resetToTemplate = () => {
    setExercises([...originalExercises]);
    setHasChanges(false);
  };

  const saveCustomizations = async () => {
    try {
      setSaving(true);
      setError('');

      // Create a custom template for this specific week
      const customTemplateName = `Week ${weekNumber} Custom - ${new Date().toLocaleDateString()}`;
      
      const { data: customTemplate, error: templateError } = await supabase
        .from('workout_templates')
        .insert([{
          title: customTemplateName,
          description: `Customized version for Week ${weekNumber}`,
          created_by: user?.id
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      // Add exercises to the custom template
      const templateExercises = exercises.map((exercise, index) => ({
        template_id: customTemplate.id,
        exercise_id: exercise.exercise_id,
        sets: exercise.sets,
        reps: exercise.reps,
        weight: exercise.weight,
        duration: exercise.duration,
        notes: exercise.notes,
        order_index: index
      }));

      const { error: exercisesError } = await supabase
        .from('template_exercises')
        .insert(templateExercises);

      if (exercisesError) throw exercisesError;

      // Update or create the program_weeks entry to point to the custom template
      const { error: weekError } = await supabase
        .from('program_weeks')
        .upsert([{
          program_id: programId,
          program_day_id: dayId,
          week_number: weekNumber,
          template_id: customTemplate.id,
          notes: `Customized from base template`
        }], {
          onConflict: 'program_id,program_day_id,week_number'
        });

      if (weekError) throw weekError;

      onCustomizationComplete();
      
    } catch (err) {
      console.error('Error saving customizations:', err);
      setError('Failed to save customizations. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div ref={modalContentRef} className="modal-panel bg-white rounded-t-2xl sm:rounded-xl w-full max-w-4xl sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Customize Week {weekNumber}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <p className="text-gray-600 mt-1">
            Make specific adjustments to this week's workout while keeping the base template for other weeks.
          </p>
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
              <p className="text-gray-600">Loading week data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h4 className="text-lg font-semibold text-gray-900">Exercise Customizations</h4>
                  {hasChanges && (
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                      Unsaved Changes
                    </span>
                  )}
                </div>
                <button
                  onClick={resetToTemplate}
                  disabled={!hasChanges}
                  className="flex items-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Template
                </button>
              </div>

              {/* Exercises List */}
              <div className="space-y-4">
                {exercises.map((exercise, index) => (
                  <div key={exercise.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h5 className="font-medium text-gray-900">
                          {index + 1}. {exercise.exercise?.name || 'Exercise'}
                        </h5>
                        <p className="text-sm text-gray-600 capitalize">
                          {exercise.exercise?.category}
                        </p>
                      </div>
                      <div className="bg-blue-500 rounded-lg p-2">
                        <Dumbbell className="h-4 w-4 text-white" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Sets
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.sets || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : null;
                            handleExerciseChange(index, 'sets', value);
                          }}
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
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.reps || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : null;
                            handleExerciseChange(index, 'reps', value);
                          }}
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
                          inputMode="decimal"
                          value={exercise.weight || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : null;
                            handleExerciseChange(index, 'weight', value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          min="0"
                          step="0.5"
                          placeholder="Optional"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Duration (sec)
                        </label>
                        <input
                          type="number"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={exercise.duration || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : null;
                            handleExerciseChange(index, 'duration', value);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          min="1"
                          placeholder="Optional"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Week-specific Notes
                      </label>
                      <input
                        type="text"
                        value={exercise.notes || ''}
                        onChange={(e) => handleExerciseChange(index, 'notes', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        placeholder="Any specific modifications for this week..."
                      />
                    </div>
                  </div>
                ))}

                {exercises.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                    <Dumbbell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500">No exercises found</p>
                    <p className="text-sm text-gray-400">Unable to load template exercises</p>
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h5 className="font-medium text-blue-900 mb-2">How Customizations Work:</h5>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Base Template:</strong> Other weeks will continue using the original template</li>
                  <li>• <strong>Custom Week:</strong> This week will use your customized version</li>
                  <li>• <strong>Independent:</strong> Changes here won't affect the base template or other weeks</li>
                  <li>• <strong>Reset:</strong> Use "Reset to Template" to undo all customizations</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4 border-t border-gray-100">
                <button
                  onClick={saveCustomizations}
                  disabled={saving || !hasChanges}
                  className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                      Saving Customizations...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2 inline" />
                      Save Week {weekNumber} Customizations
                    </>
                  )}
                </button>
                <button
                  onClick={onClose}
                  disabled={saving}
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

export default WeekCustomizationModal;