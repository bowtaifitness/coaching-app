import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import WeekExerciseEditor from './WeekExerciseEditor';
import { ArrowLeft, Save, Loader, CheckCircle, AlertCircle, Dumbbell, Plus, Search, Eye, Target, Clock, Users, Calendar, BookOpen, Copy, CreditCard as Edit3 } from 'lucide-react';

interface WorkoutTemplate {
  id: string;
  title: string;
  description?: string;
  category?: string;
  created_by: string;
  created_at: string;
  template_exercises: Array<{
    id: string;
    exercise: {
      name: string;
      category: string;
    };
    sets?: number;
    reps?: number;
    weight?: number;
    duration?: number;
    order_index?: number;
  }>;
}

interface WorkoutDayEditorProps {
  programId: string;
  dayId: string;
  dayName: string;
  weekNumber: number;
  templateId?: string;
  onBack: () => void;
  onSave: () => void;
}

const WorkoutDayEditor: React.FC<WorkoutDayEditorProps> = ({
  programId,
  dayId,
  dayName,
  weekNumber,
  templateId,
  onBack,
  onSave
}) => {
  const { user } = useAuth();
  const [availableTemplates, setAvailableTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templateId || '');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkoutTemplate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [programWeeks, setProgramWeeks] = useState<number>(0);
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]);
  const [showCustomizeExercises, setShowCustomizeExercises] = useState(false);
  const [currentProgramWeekId, setCurrentProgramWeekId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchAvailableTemplates();
    fetchProgramDetails();
  }, []);

  useEffect(() => {
    if (selectedTemplateId) {
      const template = availableTemplates.find(t => t.id === selectedTemplateId);
      setSelectedTemplate(template || null);
    } else {
      setSelectedTemplate(null);
    }
  }, [selectedTemplateId, availableTemplates]);

  const fetchAvailableTemplates = async () => {
    try {
      setLoading(true);
      setError('');

      const { data: templates, error } = await supabase
        .from('workout_templates')
        .select(`
          id,
          title,
          description,
          category,
          created_by,
          created_at,
          template_exercises(
            id,
            exercise_id,
            sets,
            reps,
            weight,
            duration,
            order_index,
            exercise:exercises(name, category)
          )
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setAvailableTemplates(templates || []);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load workout templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAssignment = async () => {
    if (!selectedTemplateId) {
      setError('Please select a workout template');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Check if a program_weeks entry already exists for this day/week
      const { data: existingWeek, error: checkError } = await supabase
        .from('program_weeks')
        .select('id')
        .eq('program_id', programId)
        .eq('program_day_id', dayId)
        .eq('week_number', weekNumber)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingWeek) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('program_weeks')
          .update({
            template_id: selectedTemplateId,
            notes: `Updated on ${new Date().toLocaleDateString()}`
          })
          .eq('id', existingWeek.id);

        if (updateError) throw updateError;
      } else {
        // Create new entry
        const { error: insertError } = await supabase
          .from('program_weeks')
          .insert([{
            program_id: programId,
            program_day_id: dayId,
            week_number: weekNumber,
            template_id: selectedTemplateId,
            notes: `Assigned on ${new Date().toLocaleDateString()}`
          }]);

        if (insertError) throw insertError;
      }

      setSuccess('Workout template assigned successfully!');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onSave();
      }, 2000);

    } catch (err) {
      console.error('Error saving template assignment:', err);
      setError('Failed to assign workout template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const fetchProgramDetails = async () => {
    try {
      const { data: program, error } = await supabase
        .from('workout_programs')
        .select('duration_weeks')
        .eq('id', programId)
        .single();

      if (error) throw error;

      if (program) {
        setProgramWeeks(program.duration_weeks);
      }

      const { data: programWeek, error: weekError } = await supabase
        .from('program_weeks')
        .select('id')
        .eq('program_id', programId)
        .eq('program_day_id', dayId)
        .eq('week_number', weekNumber)
        .maybeSingle();

      if (!weekError && programWeek) {
        setCurrentProgramWeekId(programWeek.id);
      }
    } catch (err) {
      console.error('Error fetching program details:', err);
    }
  };

  const handleCopyToWeeks = () => {
    if (!selectedTemplateId) {
      setError('Please select a template first');
      return;
    }
    setShowCopyModal(true);
  };

  const handleWeekToggle = (week: number) => {
    if (week === weekNumber) return;

    setSelectedWeeks(prev =>
      prev.includes(week)
        ? prev.filter(w => w !== week)
        : [...prev, week]
    );
  };

  const handleCopyConfirm = async () => {
    if (selectedWeeks.length === 0) {
      setError('Please select at least one week');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const insertPromises = selectedWeeks.map(week =>
        supabase
          .from('program_weeks')
          .upsert([{
            program_id: programId,
            program_day_id: dayId,
            week_number: week,
            template_id: selectedTemplateId,
            notes: `Copied from Week ${weekNumber} on ${new Date().toLocaleDateString()}`
          }], {
            onConflict: 'program_id,program_day_id,week_number'
          })
      );

      const results = await Promise.all(insertPromises);

      const hasErrors = results.some(result => result.error);
      if (hasErrors) {
        throw new Error('Some templates failed to copy');
      }

      setSuccess(`Template copied to ${selectedWeeks.length} week(s) successfully!`);
      setShowCopyModal(false);
      setSelectedWeeks([]);

      setTimeout(() => {
        setSuccess('');
      }, 3000);

    } catch (err) {
      console.error('Error copying template:', err);
      setError('Failed to copy template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAssignment = async () => {
    if (!templateId) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove the workout template from ${dayName} in Week ${weekNumber}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError('');

      const { error } = await supabase
        .from('program_weeks')
        .delete()
        .eq('program_id', programId)
        .eq('program_day_id', dayId)
        .eq('week_number', weekNumber);

      if (error) throw error;

      setSuccess('Workout template removed successfully!');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        onSave();
      }, 2000);

    } catch (err) {
      console.error('Error removing template assignment:', err);
      setError('Failed to remove workout template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const filteredTemplates = availableTemplates.filter(template =>
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (template.description && template.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'strength': return 'bg-blue-100 text-blue-700';
      case 'mobility': return 'bg-blue-100 text-blue-700';
      case 'power': return 'bg-red-100 text-red-700';
      case 'stability': return 'bg-purple-100 text-purple-700';
      case 'conditioning': return 'bg-orange-100 text-orange-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (showCustomizeExercises) {
    return (
      <WeekExerciseEditor
        programId={programId}
        dayId={dayId}
        dayName={dayName}
        weekNumber={weekNumber}
        programWeekId={currentProgramWeekId}
        onBack={() => {
          setShowCustomizeExercises(false);
          fetchProgramDetails();
        }}
        onSave={() => {
          setShowCustomizeExercises(false);
          onSave();
        }}
      />
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Loading workout templates...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={onBack}
            className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Program
          </button>
          <div className="h-6 w-px bg-gray-300"></div>
          <h1 className="text-3xl font-bold text-gray-900">
            Edit {dayName} - Week {weekNumber}
          </h1>
        </div>
        <p className="text-gray-600">
          Select a workout template to assign to this day, or customize the exercises for this specific week.
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
            <p className="text-blue-800">{success}</p>
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

      {/* Current Assignment */}
      {templateId && selectedTemplate && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Currently Assigned</h3>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-blue-800 font-medium">{selectedTemplate.title}</p>
                {selectedTemplate.category && (
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold capitalize">
                    {selectedTemplate.category.replace('-', ' ')}
                  </span>
                )}
              </div>
              <p className="text-blue-700 text-sm">{selectedTemplate.description}</p>
              <div className="flex items-center space-x-4 mt-2 text-sm text-blue-700">
                <div className="flex items-center">
                  <Dumbbell className="h-4 w-4 mr-1" />
                  {selectedTemplate.template_exercises?.length || 0} exercises
                </div>
                <div className="flex items-center">
                  <Target className="h-4 w-4 mr-1" />
                  {[...new Set(selectedTemplate.template_exercises?.map(ex => ex.exercise.category) || [])].length} categories
                </div>
              </div>
            </div>
            <button
              onClick={handleRemoveAssignment}
              disabled={saving}
              className="px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Remove Assignment
            </button>
          </div>
        </div>
      )}

      {/* Template Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Select Workout Template</h3>
            <div className="relative">
              <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="p-6">
          {filteredTemplates.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTemplates.map((template) => {
                const isSelected = selectedTemplateId === template.id;
                const categories = [...new Set(template.template_exercises?.map(ex => ex.exercise.category) || [])];

                return (
                  <div
                    key={template.id}
                    onClick={() => setSelectedTemplateId(template.id)}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all hover:shadow-md ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 bg-white hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm truncate">{template.title}</h4>
                          {isSelected && (
                            <div className="flex-shrink-0 bg-blue-500 rounded-full p-0.5">
                              <CheckCircle className="h-3 w-3 text-white" />
                            </div>
                          )}
                        </div>
                        {template.category && (
                          <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-semibold capitalize">
                            {template.category.replace('-', ' ')}
                          </span>
                        )}
                        {template.description && (
                          <p className="text-xs text-gray-600 mt-1.5 line-clamp-2">{template.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 text-xs text-gray-600">
                        <div className="flex items-center">
                          <Dumbbell className="h-3 w-3 mr-1" />
                          {template.template_exercises?.length || 0}
                        </div>
                        <div className="flex items-center">
                          <Target className="h-3 w-3 mr-1" />
                          {categories.length}
                        </div>
                      </div>

                      {/* Exercise Categories */}
                      {categories.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {categories.slice(0, 3).map((category) => (
                            <span
                              key={category}
                              className={`px-1.5 py-0.5 rounded text-xs font-medium capitalize ${getCategoryColor(category)}`}
                            >
                              {category}
                            </span>
                          ))}
                          {categories.length > 3 && (
                            <span className="px-1.5 py-0.5 rounded text-xs text-gray-500">
                              +{categories.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Exercise Preview */}
                      {template.template_exercises && template.template_exercises.length > 0 && (
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-xs font-medium text-gray-700 mb-1">Exercises:</p>
                          <div className="space-y-0.5">
                            {template.template_exercises.slice(0, 2).map((ex, index) => (
                              <div key={ex.id} className="text-xs text-gray-600 truncate">
                                {index + 1}. {ex.exercise.name}
                              </div>
                            ))}
                            {template.template_exercises.length > 2 && (
                              <p className="text-xs text-gray-500">
                                +{template.template_exercises.length - 2} more
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 pt-1">
                        {new Date(template.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? 'No templates found' : 'No workout templates available'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm 
                  ? 'Try adjusting your search criteria.'
                  : 'Create workout templates first to assign them to program days.'
                }
              </p>
              {!searchTerm && (
                <button
                  onClick={() => {
                    // Navigate to workout builder to create templates
                    window.location.hash = '#workouts';
                    onBack();
                  }}
                  className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create Workout Template
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Selected Template Details */}
      {selectedTemplate && (
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Selected Template Details</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Template Information</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Title</span>
                    <span className="font-medium text-gray-900">{selectedTemplate.title}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Total Exercises</span>
                    <span className="font-medium text-gray-900">{selectedTemplate.template_exercises?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Categories</span>
                    <span className="font-medium text-gray-900">
                      {[...new Set(selectedTemplate.template_exercises?.map(ex => ex.exercise.category) || [])].length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Created</span>
                    <span className="font-medium text-gray-900">
                      {new Date(selectedTemplate.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-gray-900 mb-4">Exercise List</h4>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {selectedTemplate.template_exercises?.map((ex, index) => (
                    <div key={ex.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">
                          {index + 1}. {ex.exercise.name}
                        </p>
                        <p className="text-xs text-gray-600 capitalize">{ex.exercise.category}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        {ex.sets && `${ex.sets} sets`}
                        {ex.reps && ` × ${ex.reps} reps`}
                        {ex.weight && ` @ ${ex.weight}lbs`}
                        {ex.duration && ` ${ex.duration}s`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-8 flex space-x-4">
        <button
          onClick={handleSaveAssignment}
          disabled={saving || !selectedTemplateId}
          className="flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <Loader className="h-4 w-4 mr-2 animate-spin" />
              Assigning Template...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Assign Template to {dayName}
            </>
          )}
        </button>

        <button
          onClick={handleCopyToWeeks}
          disabled={saving || !selectedTemplateId}
          className="flex items-center px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Copy className="h-4 w-4 mr-2" />
          Copy to Other Weeks
        </button>

        <button
          onClick={() => setShowCustomizeExercises(true)}
          className="flex items-center px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
        >
          <Edit3 className="h-4 w-4 mr-2" />
          Customize Exercises
        </button>

        {templateId && (
          <button
            onClick={handleRemoveAssignment}
            disabled={saving}
            className="flex items-center px-6 py-3 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Remove Current Assignment
          </button>
        )}

        <button
          onClick={onBack}
          disabled={saving}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Copy to Weeks Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
          <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl shadow-xl max-w-2xl w-full max-h-[90dvh] sm:max-h-[80vh] overflow-y-auto keyboard-aware-container">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <h3 className="text-xl font-bold text-gray-900">Copy Template to Other Weeks</h3>
              <p className="text-sm text-gray-600 mt-1">
                Select the weeks where you want to copy this template for {dayName}
              </p>
            </div>

            <div className="p-6">
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900 font-medium">Current Selection:</p>
                <p className="text-sm text-blue-700 mt-1">
                  Week {weekNumber} - {dayName} - {selectedTemplate?.title}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select weeks to copy to:
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
                  {Array.from({ length: programWeeks }, (_, i) => i + 1).map((week) => (
                    <button
                      key={week}
                      onClick={() => handleWeekToggle(week)}
                      disabled={week === weekNumber}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                        week === weekNumber
                          ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                          : selectedWeeks.includes(week)
                          ? 'bg-blue-500 border-blue-600 text-white hover:bg-blue-600'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-blue-500 hover:bg-blue-50'
                      }`}
                    >
                      {week === weekNumber ? (
                        <div className="flex flex-col items-center">
                          <span>W{week}</span>
                          <span className="text-xs">(Current)</span>
                        </div>
                      ) : (
                        `W${week}`
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedWeeks.length > 0 && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Selected: {selectedWeeks.length} week{selectedWeeks.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Weeks: {selectedWeeks.sort((a, b) => a - b).join(', ')}
                  </p>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 border-t flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCopyModal(false);
                  setSelectedWeeks([]);
                  setError('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCopyConfirm}
                disabled={saving || selectedWeeks.length === 0}
                className="flex items-center px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    Copying...
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to {selectedWeeks.length} Week{selectedWeeks.length > 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 mb-3">How to Use:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <div className="bg-blue-500 rounded p-1">
                <BookOpen className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Select Template</p>
                <p className="text-blue-700 text-xs">Click on a workout template to select it for this day</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-blue-500 rounded p-1">
                <Save className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Assign Template</p>
                <p className="text-blue-700 text-xs">Click "Assign Template" to save your selection</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-start space-x-3">
              <div className="bg-purple-500 rounded p-1">
                <Target className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Week-Specific</p>
                <p className="text-blue-700 text-xs">This assignment only affects Week {weekNumber}</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-orange-500 rounded p-1">
                <Eye className="h-3 w-3 text-white" />
              </div>
              <div>
                <p className="font-medium text-blue-900 text-sm">Preview</p>
                <p className="text-blue-700 text-xs">View exercise details before assigning</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkoutDayEditor;