import React, { useState, useRef } from 'react';
import { useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { X, Save, Loader, CheckCircle, AlertCircle, CreditCard as Edit3, Dumbbell, Plus, Trash2, GripVertical, Link, Unlink, ArrowUp, ArrowDown, Search, ChevronDown } from 'lucide-react';

interface WorkoutTemplate {
  id: string;
  title: string;
  description?: string;
  category?: string;
  created_by: string;
  created_at: string;
  template_exercises?: Array<{
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
    order_index?: number;
    superset_group?: number | null;
  }>;
}

interface EditTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: WorkoutTemplate;
  onEditComplete: () => void | Promise<void>;
}

const EditTemplateModal: React.FC<EditTemplateModalProps> = ({
  isOpen,
  onClose,
  template,
  onEditComplete
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description || '');
  const [category, setCategory] = useState(template.category || '');
  const [exercises, setExercises] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
  const [selectedExercises, setSelectedExercises] = useState<Set<number>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [exerciseSearchTerms, setExerciseSearchTerms] = useState<{ [key: number]: string }>({});
  const [showDropdowns, setShowDropdowns] = useState<{ [key: number]: boolean }>({});
  const [filteredExerciseOptions, setFilteredExerciseOptions] = useState<{ [key: number]: any[] }>({});
  const modalContentRef = useRef<HTMLDivElement>(null);

  // Initialize exercises when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('EditTemplateModal opened with template:', template);
      console.log('Template exercises:', template.template_exercises);
      // Scroll to top when modal opens
      if (modalContentRef.current) {
        modalContentRef.current.scrollTop = 0;
      }
      
      if (template.template_exercises && template.template_exercises.length > 0) {
        // Map the template exercises to the format expected by the form
        const mappedExercises = template.template_exercises.map(te => ({
          id: te.id,
          exercise_id: te.exercise_id || te.exercise?.id,
          exercise: te.exercise,
          sets: te.sets,
          reps: te.reps,
          weight: te.weight,
          duration: te.duration,
          order_index: te.order_index,
          superset_group: te.superset_group || null
        }));

        console.log('Mapped exercises for editing:', mappedExercises);
        setExercises(mappedExercises);
      } else {
        console.log('No template exercises found, starting with empty array');
        setExercises([]);
      }
      
      // Reset other form fields
      setTitle(template.title);
      setDescription(template.description || '');
      setSelectedExercises(new Set());
      setError('');
    }
  }, [isOpen, template]);

  useEffect(() => {
    if (isOpen) {
      fetchAvailableExercises();
    }
  }, [isOpen]);

  const fetchAvailableExercises = async () => {
    try {
      setLoading(true);
      
      const { data: exerciseData, error } = await supabase
        .from('exercises')
        .select('id, name, category')
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableExercises(exerciseData || []);
    } catch (err) {
      console.error('Error fetching exercises:', err);
      setError('Failed to load exercises');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExercise = () => {
    const newExercise = {
      id: `temp-${Date.now()}`,
      exercise_id: '',
      exercise: { id: '', name: '', category: '' },
      sets: 3,
      reps: 10,
      weight: undefined,
      duration: undefined,
      order_index: exercises.length,
      superset_group: null
    };
    setExercises([...exercises, newExercise]);
  };

  const handleRemoveExercise = (index: number) => {
    // Remove from selection if selected
    const newSelection = new Set(selectedExercises);
    newSelection.delete(index);
    setSelectedExercises(newSelection);
    
    // Update indices for remaining selected exercises
    const updatedSelection = new Set<number>();
    newSelection.forEach(selectedIndex => {
      if (selectedIndex > index) {
        updatedSelection.add(selectedIndex - 1);
      } else if (selectedIndex < index) {
        updatedSelection.add(selectedIndex);
      }
    });
    setSelectedExercises(updatedSelection);
    
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleExerciseChange = (index: number, field: string, value: any) => {
    setExercises(prev => {
      const newExercises = [...prev];
      if (field === 'exercise_id') {
        const selectedExercise = availableExercises.find(e => e.id === value);
        newExercises[index] = {
          ...newExercises[index],
          exercise_id: value,
          exercise: selectedExercise || newExercises[index].exercise || { id: '', name: '', category: '' }
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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newExercises = [...exercises];
    const draggedExercise = newExercises[draggedIndex];
    
    // Remove dragged exercise
    newExercises.splice(draggedIndex, 1);
    
    // Insert at new position
    const insertIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;
    newExercises.splice(insertIndex, 0, draggedExercise);
    
    // Update order indices
    newExercises.forEach((exercise, index) => {
      exercise.order_index = index;
    });
    
    setExercises(newExercises);
    setDraggedIndex(null);
    
    // Update selected exercises indices
    const newSelection = new Set<number>();
    selectedExercises.forEach(selectedIndex => {
      if (selectedIndex === draggedIndex) {
        newSelection.add(insertIndex);
      } else if (selectedIndex > draggedIndex && selectedIndex <= dropIndex) {
        newSelection.add(selectedIndex - 1);
      } else if (selectedIndex < draggedIndex && selectedIndex >= dropIndex) {
        newSelection.add(selectedIndex + 1);
      } else {
        newSelection.add(selectedIndex);
      }
    });
    setSelectedExercises(newSelection);
  };

  const handleExerciseSelect = (index: number) => {
    const newSelection = new Set(selectedExercises);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedExercises(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedExercises.size === exercises.length) {
      setSelectedExercises(new Set());
    } else {
      setSelectedExercises(new Set(exercises.map((_, index) => index)));
    }
  };

  const handleClearSelection = () => {
    setSelectedExercises(new Set());
  };

  const createSuperset = () => {
    if (selectedExercises.size < 2) return;
    
    const selectedIndices = Array.from(selectedExercises).sort((a, b) => a - b);
    const newExercises = [...exercises];
    
    // Find the next superset group number
    const existingGroups = new Set(newExercises.map(ex => ex.superset_group).filter(Boolean));
    const nextGroupNumber = existingGroups.size > 0 ? Math.max(...Array.from(existingGroups)) + 1 : 1;
    
    // Assign superset group to selected exercises
    selectedIndices.forEach(index => {
      newExercises[index].superset_group = nextGroupNumber;
    });
    
    setExercises(newExercises);
    setSelectedExercises(new Set());
  };

  const removeFromSuperset = (index: number) => {
    const newExercises = [...exercises];
    const supersetGroup = newExercises[index].superset_group;
    
    // Remove this exercise from superset
    newExercises[index].superset_group = null;
    
    // Check if this was the last exercise in the superset group
    const remainingInGroup = newExercises.filter(ex => ex.superset_group === supersetGroup);
    
    // If only one exercise remains in the group, remove it from superset too
    if (remainingInGroup.length === 1) {
      const lastExerciseIndex = newExercises.findIndex(ex => ex.superset_group === supersetGroup);
      if (lastExerciseIndex !== -1) {
        newExercises[lastExerciseIndex].superset_group = null;
      }
    }
    
    setExercises(newExercises);
  };

  const getSupersetColor = (groupNumber: number) => {
    const colors = [
      'border-l-blue-500 bg-blue-50',
      'border-l-purple-500 bg-purple-50', 
      'border-l-blue-500 bg-blue-50',
      'border-l-orange-500 bg-orange-50',
      'border-l-red-500 bg-red-50',
      'border-l-indigo-500 bg-indigo-50'
    ];
    return colors[(groupNumber - 1) % colors.length];
  };

  const getSupersetLetter = (groupNumber: number, exerciseIndex: number) => {
    const exercisesInGroup = exercises
      .map((ex, idx) => ({ ex, idx }))
      .filter(({ ex }) => ex.superset_group === groupNumber)
      .sort((a, b) => a.idx - b.idx);
    
    const positionInGroup = exercisesInGroup.findIndex(({ idx }) => idx === exerciseIndex);
    return String.fromCharCode(65 + positionInGroup); // A, B, C, etc.
  };

  const handleSave = async () => {
    console.log('handleSave called - Starting save process');
    console.log('Title:', title);
    console.log('Exercises count:', exercises.length);
    console.log('Exercises:', exercises);

    if (!title.trim()) {
      setError('Please enter a template title');
      return;
    }

    try {
      setSaving(true);
      setError('');

      console.log('Updating template basic info...');
      // Update template basic info
      const { error: templateError } = await supabase
        .from('workout_templates')
        .update({
          title: title.trim(),
          description: description.trim() || null,
          category: category || null
        })
        .eq('id', template.id);

      if (templateError) {
        console.error('Template update error:', templateError);
        throw templateError;
      }
      console.log('Template basic info updated successfully');

      console.log('Deleting existing template exercises...');
      // Delete existing template exercises
      const { error: deleteError } = await supabase
        .from('template_exercises')
        .delete()
        .eq('template_id', template.id);

      if (deleteError) {
        console.error('Delete exercises error:', deleteError);
        throw deleteError;
      }
      console.log('Existing exercises deleted successfully');

      // Insert updated exercises
      if (exercises.length > 0) {
        console.log('Preparing to insert exercises...');
        const validExercises = exercises
          .filter(ex => ex.exercise_id && ex.exercise_id !== '')
          .map((ex, index) => ({
            template_id: template.id,
            exercise_id: ex.exercise_id,
            sets: ex.sets || null,
            reps: ex.reps || null,
            weight: ex.weight || null,
            duration: ex.duration || null,
            order_index: index,
            superset_group: ex.superset_group || null
          }));

        console.log('Valid exercises to insert:', validExercises.length, validExercises);

        if (validExercises.length > 0) {
          const { error: insertError } = await supabase
            .from('template_exercises')
            .insert(validExercises);

          if (insertError) {
            console.error('Insert exercises error:', insertError);
            throw insertError;
          }
          console.log('Exercises inserted successfully');
        }
      } else {
        console.log('No exercises to insert');
      }

      console.log('Calling onEditComplete...');
      await onEditComplete();
      console.log('onEditComplete finished, calling onClose...');
      onClose();
      console.log('Modal closed successfully');
    } catch (err) {
      console.error('Error updating template:', err);
      setError('Failed to update template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl w-full max-w-4xl sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Edit Template</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div ref={modalContentRef} className="flex-1 overflow-y-auto p-6">
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
              <Loader className="h-8 w-8 text-blue-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Loading template data...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Upper Body Strength"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="Describe the purpose and focus of this workout template..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select a category (optional)</option>
                    <option value="bodyweight">Bodyweight</option>
                    <option value="bands">Bands</option>
                    <option value="dumbbells">Dumbbells</option>
                    <option value="full-gym">Full Gym</option>
                  </select>
                </div>
              </div>

              {/* Exercises */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900">Exercises</h4>
                  <div className="flex items-center space-x-2">
                    {selectedExercises.size > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {selectedExercises.size} selected
                        </span>
                        {selectedExercises.size >= 2 && (
                          <button
                            onClick={createSuperset}
                            className="flex items-center px-3 py-1 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm"
                          >
                            <Link className="h-4 w-4 mr-1" />
                            Create Superset
                          </button>
                        )}
                        <button
                          onClick={handleClearSelection}
                          className="px-3 py-1 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    <button
                      onClick={handleAddExercise}
                      className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Exercise
                    </button>
                  </div>
                </div>

                {exercises.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center space-x-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedExercises.size === exercises.length && exercises.length > 0}
                          onChange={handleSelectAll}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                        />
                        <span className="text-sm text-gray-700">Select All</span>
                      </label>
                    </div>
                  </div>
                )}

                {selectedExercises.size >= 2 && (
                  <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Superset Info:</strong> Exercises in a superset are performed back-to-back with minimal rest between them. 
                      Rest occurs after completing all exercises in the superset.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {exercises.map((exercise, index) => {
                    const isSelected = selectedExercises.has(index);
                    const isInSuperset = exercise.superset_group;
                    const supersetColor = isInSuperset ? getSupersetColor(exercise.superset_group) : '';
                    const supersetLetter = isInSuperset ? getSupersetLetter(exercise.superset_group, index) : '';
                    
                    return (
                      <div 
                        key={exercise.id} 
                        className={`rounded-lg p-4 border-l-4 transition-all ${
                          isInSuperset 
                            ? supersetColor
                            : isSelected 
                            ? 'bg-blue-50 border-l-blue-500 ring-2 ring-blue-200' 
                            : 'bg-gray-50 border-l-gray-200'
                        }`}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDrop={(e) => handleDrop(e, index)}
                        style={{
                          opacity: draggedIndex === index ? 0.5 : 1,
                          transform: draggedIndex === index ? 'scale(1.02)' : 'scale(1)',
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleExerciseSelect(index)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div 
                              className="cursor-move p-2 text-gray-400 hover:text-gray-600"
                              title="Drag to reorder"
                            >
                              <GripVertical className="h-4 w-4" />
                            </div>
                            <div>
                              <h5 className="font-medium text-gray-900">
                                #{index + 1} 
                                {isInSuperset && (
                                  <span className="ml-2 text-sm font-bold text-purple-600">
                                    Superset {exercise.superset_group}{supersetLetter}
                                  </span>
                                )}
                              </h5>
                              {isInSuperset && (
                                <p className="text-xs text-purple-600 mt-1">
                                  Perform back-to-back with other superset exercises
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isInSuperset && (
                              <button
                                onClick={() => removeFromSuperset(index)}
                                className="text-purple-500 hover:text-purple-700 p-2"
                                title="Remove from superset"
                              >
                                <Unlink className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveExercise(index)}
                              className="text-red-500 hover:text-red-700 p-2"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Exercise
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                value={exerciseSearchTerms[index] || ''}
                                onChange={(e) => {
                                  const searchTerm = e.target.value;
                                  setExerciseSearchTerms(prev => ({ ...prev, [index]: searchTerm }));
                                  
                                  // Filter exercises based on search term
                                  const filtered = availableExercises.filter(ex =>
                                    ex.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    ex.category.toLowerCase().includes(searchTerm.toLowerCase())
                                  );
                                  setFilteredExerciseOptions(prev => ({ ...prev, [index]: filtered }));
                                  
                                  // Show dropdown if there's a search term
                                  setShowDropdowns(prev => ({ ...prev, [index]: searchTerm.length > 0 }));
                                  
                                  // Clear selection if search term changes
                                  if (exercise.exercise_id) {
                                    handleExerciseChange(index, 'exercise_id', '');
                                    handleExerciseChange(index, 'exercise', { id: '', name: '', category: '' });
                                  }
                                }}
                                onFocus={() => {
                                  // Only show dropdown if there's a search term
                                  if (exerciseSearchTerms[index] && exerciseSearchTerms[index].length > 0) {
                                    setShowDropdowns(prev => ({ ...prev, [index]: true }));
                                  }
                                }}
                                onBlur={() => {
                                  // Delay hiding to allow for clicks
                                  setTimeout(() => {
                                    setShowDropdowns(prev => ({ ...prev, [index]: false }));
                                  }, 200);
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Start typing exercise name..."
                                required={!exercise.exercise_id}
                              />
                              
                              {/* Selected exercise display */}
                              {exercise.exercise_id && exercise.exercise.name && (
                                <div className="absolute inset-0 flex items-center px-3 py-2 bg-blue-50 border border-blue-300 rounded-lg">
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center space-x-2">
                                      <CheckCircle className="h-4 w-4 text-blue-600" />
                                      <span className="text-gray-900 font-medium">{exercise.exercise.name}</span>
                                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full capitalize">
                                        {exercise.exercise.category}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleExerciseChange(index, 'exercise_id', '');
                                        handleExerciseChange(index, 'exercise', { id: '', name: '', category: '' });
                                        setExerciseSearchTerms(prev => ({ ...prev, [index]: '' }));
                                      }}
                                      className="text-gray-400 hover:text-gray-600 p-2"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              )}
                              
                              {/* Dropdown */}
                              {showDropdowns[index] && (filteredExerciseOptions[index]?.length > 0) && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                  {filteredExerciseOptions[index].slice(0, 10).map((ex) => (
                                    <button
                                      key={ex.id}
                                      type="button"
                                      onClick={() => {
                                        handleExerciseChange(index, 'exercise_id', ex.id);
                                        handleExerciseChange(index, 'exercise', ex);
                                        setExerciseSearchTerms(prev => ({ ...prev, [index]: ex.name }));
                                        setShowDropdowns(prev => ({ ...prev, [index]: false }));
                                      }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors border-b border-gray-100 last:border-b-0"
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-gray-900">{ex.name}</span>
                                        <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                                          ex.category === 'strength' ? 'bg-blue-100 text-blue-700' :
                                          ex.category === 'mobility' ? 'bg-blue-100 text-blue-700' :
                                          ex.category === 'power' ? 'bg-red-100 text-red-700' :
                                          ex.category === 'stability' ? 'bg-purple-100 text-purple-700' :
                                          'bg-orange-100 text-orange-700'
                                        }`}>
                                          {ex.category}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                  {filteredExerciseOptions[index].length > 10 && (
                                    <div className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100">
                                      +{filteredExerciseOptions[index].length - 10} more exercises...
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              {/* No results message */}
                              {showDropdowns[index] && exerciseSearchTerms[index] && exerciseSearchTerms[index].length > 0 && 
                               (!filteredExerciseOptions[index] || filteredExerciseOptions[index].length === 0) && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3">
                                  <p className="text-sm text-gray-500">No exercises found matching "{exerciseSearchTerms[index]}"</p>
                                </div>
                              )}
                            </div>
                          </div>

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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={exercise.duration || ''}
                              onChange={(e) => {
                                const value = e.target.value ? parseInt(e.target.value) : null;
                                handleExerciseChange(index, 'duration', value);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              min="1"
                              placeholder="Optional"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {exercises.length === 0 && (
                    <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                      <Dumbbell className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500">No exercises added yet</p>
                      <button
                        onClick={handleAddExercise}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        Add your first exercise
                      </button>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                {exercises.length > 0 && (
                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h5 className="font-medium text-blue-900 mb-2">How to use:</h5>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• <strong>Reorder:</strong> Drag exercises by the grip handle (⋮⋮) to change order</li>
                      <li>• <strong>Select multiple:</strong> Use checkboxes to select exercises</li>
                      <li>• <strong>Create supersets:</strong> Select 2+ exercises and click "Create Superset"</li>
                      <li>• <strong>Remove from superset:</strong> Click the unlink icon (🔗) on superset exercises</li>
                    </ul>
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {!loading && (
          <div className="flex space-x-3 p-6 pt-4 border-t border-gray-100 bg-white rounded-b-xl shrink-0">
            <button
              onClick={() => {
                handleSave();
              }}
              disabled={saving || !title.trim()}
              className="flex-1 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                  Saving Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2 inline" />
                  Save Changes
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
        )}
      </div>
    </div>
  );
};

export default EditTemplateModal;