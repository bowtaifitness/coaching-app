import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import WorkoutTemplateCard from './WorkoutTemplateCard';
import EditTemplateModal from './EditTemplateModal';
import AssignTemplateModal from './AssignTemplateModal';
import ProgramDetailView from './ProgramDetailView';
import WeekCustomizationModal from './WeekCustomizationModal';
import { Dumbbell, Plus, Search, Filter, Calendar, Users, BookOpen, Target, Clock, CheckCircle, CreditCard as Edit3, Trash2, Copy, UserPlus, MoreVertical, X, Save, Loader, AlertCircle, ChevronDown, ChevronUp, Settings, Play, Pause, RotateCcw, ArrowRight, Grid3x3 as Grid3X3, List, Eye, Award, TrendingUp, BarChart3, Activity, Archive, ArchiveRestore } from 'lucide-react';

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
  }>;
}

interface WorkoutProgram {
  id: string;
  title: string;
  description?: string;
  category?: string;
  duration_weeks: number;
  days_per_week: number;
  program_type: 'standard' | 'custom';
  warmup_template_id?: string;
  archived?: boolean;
  created_by: string;
  created_at: string;
  program_days?: Array<{
    id: string;
    day_name: string;
    day_order: number;
  }>;
}

const WorkoutBuilder: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'templates' | 'custom-programs' | 'standard-programs'>('templates');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [compareMode, setCompareMode] = useState(false);
  const [showingComparison, setShowingComparison] = useState(false);
  const [selectedTemplatesForCompare, setSelectedTemplatesForCompare] = useState<Set<string>>(new Set());
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [programs, setPrograms] = useState<WorkoutProgram[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'created' | 'name' | 'category'>('created');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showProgramModal, setShowProgramModal] = useState(false);
  const [showWeekCustomization, setShowWeekCustomization] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [assigningTemplate, setAssigningTemplate] = useState<WorkoutTemplate | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<WorkoutProgram | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
 const [editingProgram, setEditingProgram] = useState<WorkoutProgram | null>(null);
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [availableExercises, setAvailableExercises] = useState<any[]>([]);
 const [showTemplateSelector, setShowTemplateSelector] = useState<{
   programId: string;
   dayId: string;
   weekNumber: number;
   dayName: string;
 } | null>(null);
  const templateFormRef = useRef<HTMLFormElement>(null);
  const programFormRef = useRef<HTMLFormElement>(null);

  // Define fetch functions before they're used
  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('workout_templates')
        .select(`
          *,
          template_exercises(
            id,
            exercise_id,
            sets,
            reps,
            weight,
            duration,
            order_index,
            superset_group,
            exercise:exercises(id, name, category)
          )
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchPrograms = async () => {
    try {
      const { data, error} = await supabase
        .from('workout_programs')
        .select(`
          *,
          warmup_template:workout_templates!warmup_template_id(id, title),
          program_days(
            id,
            day_name,
            day_order,
            program_weeks(
              id,
              week_number,
              template_id,
              notes,
              workout_template:workout_templates(
                id,
                title,
                template_exercises(
                  id,
                  exercise:exercises(name, category)
                )
              )
            )
          )
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('coach_client_assignments')
        .select(`
          client_id,
          client:profiles!client_id(id, first_name, last_name, email)
        `)
        .eq('coach_id', user?.id)
        .eq('active', true);

      if (error) throw error;
      setClients(data?.map(a => a.client).filter(Boolean) || []);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const fetchAvailableExercises = async () => {
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, category')
        .order('name', { ascending: true});

      if (error) throw error;
      setAvailableExercises(data || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchPrograms();
    fetchClients();
    fetchAvailableExercises();
  }, []);

  // If comparison view is active, show comparison view
  if (showingComparison && selectedTemplatesForCompare.size >= 2) {
    const templatesToCompare = templates.filter(t => selectedTemplatesForCompare.has(t.id));
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1800px] mx-auto">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Compare Templates</h1>
              <p className="text-sm text-gray-600">Viewing {templatesToCompare.length} templates side-by-side</p>
            </div>
            <button
              onClick={() => {
                setShowingComparison(false);
                setCompareMode(false);
                setSelectedTemplatesForCompare(new Set());
              }}
              className="flex items-center px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              <X className="h-5 w-5 mr-2" />
              Exit Compare Mode
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {templatesToCompare.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-lg border-2 border-green-200 flex flex-col">
              <div className="p-3 bg-green-50 border-b border-green-200">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-gray-900 truncate pr-2">{template.title}</h3>
                  <button
                    onClick={() => {
                      const newSet = new Set(selectedTemplatesForCompare);
                      newSet.delete(template.id);
                      setSelectedTemplatesForCompare(newSet);
                      if (newSet.size === 0) {
                        setCompareMode(false);
                      }
                    }}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-red-600 rounded"
                    title="Remove from comparison"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {template.description && (
                  <p className="text-xs text-gray-600 mt-1 line-clamp-2">{template.description}</p>
                )}
                <div className="mt-1.5 text-xs text-gray-700 font-medium">
                  {template.template_exercises?.length || 0} exercises
                </div>
              </div>
              <div className="p-3 flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100dvh - 320px)' }}>
                <div className="space-y-2">
                  {template.template_exercises
                    ?.sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    .map((ex, index) => (
                      <div key={ex.id} className="bg-gray-50 rounded p-2 border border-gray-200">
                        <div className="flex items-start">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start space-x-1.5 mb-1">
                              <span className="inline-flex items-center justify-center w-5 h-5 bg-green-100 text-green-700 rounded-full text-xs font-bold flex-shrink-0">
                                {index + 1}
                              </span>
                              <span className="font-semibold text-gray-900 text-sm leading-tight">{ex.exercise.name}</span>
                            </div>
                            <div className="ml-6.5 text-xs text-gray-600">
                              <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs mr-1.5 capitalize">
                                {ex.exercise.category}
                              </span>
                              {ex.sets && ex.reps && (
                                <span className="text-gray-700 font-medium">
                                  {ex.sets} sets × {ex.reps} reps
                                </span>
                              )}
                              {ex.duration && (
                                <span className="text-gray-700 font-medium">
                                  {ex.duration} seconds
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <button
                  onClick={() => {
                    setEditingTemplate(template);
                    setShowEditModal(true);
                  }}
                  className="w-full flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  Edit Template
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit Template Modal */}
        {showEditModal && editingTemplate && (
          <EditTemplateModal
            isOpen={showEditModal}
            onClose={() => {
              setShowEditModal(false);
              setEditingTemplate(null);
            }}
            template={editingTemplate}
            onEditComplete={async () => {
              await fetchTemplates();
              setShowEditModal(false);
              setEditingTemplate(null);
            }}
          />
        )}
      </div>
    );
  }

  // If a program is selected for detailed editing, show the program detail view
  if (selectedProgramId) {
    return (
      <ProgramDetailView
        programId={selectedProgramId}
        onBack={() => setSelectedProgramId(null)}
      />
    );
  }

  const assignProgramToClient = async (programId: string, clientId: string, startDate: string) => {
    try {
      console.log('Starting program assignment:', { programId, clientId, startDate });
      
      // Get the full program with all its data
      const { data: program, error: programError } = await supabase
        .from('workout_programs')
        .select(`
          *,
          program_days(
            id,
            day_name,
            day_order,
            program_weeks(
              id,
              week_number,
              template_id,
              workout_template:workout_templates(
                id,
                title,
                description,
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
            )
          )
        `)
        .eq('id', programId)
        .single();

      if (programError) throw programError;
      
      console.log('Program data fetched:', program);

      // Create individual workouts for each day/week combination
      const workoutsToCreate = [];
      const start = new Date(startDate);

      for (const programDay of program.program_days || []) {
        console.log('Processing program day:', programDay);
        
        for (const programWeek of programDay.program_weeks || []) {
          console.log('Processing program week:', programWeek);
          
          if (!programWeek.workout_template) {
            console.warn('No template found for week:', programWeek.week_number, 'day:', programDay.day_name);
            continue;
          }

          // Calculate the date for this workout
          const weekOffset = (programWeek.week_number - 1) * 7;
          const dayOffset = programDay.day_order - 1;
          const workoutDate = new Date(start);
          workoutDate.setDate(start.getDate() + weekOffset + dayOffset);

          const workout = {
            title: `${programWeek.workout_template.title} - Week ${programWeek.week_number}`,
            description: programWeek.workout_template.description || `Week ${programWeek.week_number} - ${programDay.day_name}`,
            coach_id: user?.id,
            client_id: clientId,
            scheduled_date: workoutDate.toISOString().split('T')[0],
            template_id: programWeek.template_id,
            notes: programWeek.notes || null,
            completed: false
          };

          workoutsToCreate.push({
            workout,
            exercises: programWeek.workout_template.template_exercises || []
          });
        }
      }

      console.log('Workouts to create:', workoutsToCreate.length);

      // Create all workouts and their exercises
      for (const { workout, exercises } of workoutsToCreate) {
        console.log('Creating workout:', workout.title, 'with', exercises.length, 'exercises');
        
        // Create the workout
        const { data: createdWorkout, error: workoutError } = await supabase
          .from('workouts')
          .insert([workout])
          .select()
          .single();

        if (workoutError) {
          console.error('Error creating workout:', workoutError);
          throw workoutError;
        }

        console.log('Workout created:', createdWorkout);

        // Create workout exercises if there are any
        if (exercises.length > 0) {
          const workoutExercises = exercises.map((templateEx, index) => ({
            workout_id: createdWorkout.id,
            exercise_id: templateEx.exercise_id,
            sets: templateEx.sets,
            reps: templateEx.reps,
            weight: templateEx.weight,
            duration: templateEx.duration,
            notes: templateEx.notes,
            order_index: templateEx.order_index || index
          }));

          console.log('Creating workout exercises:', workoutExercises);

          const { error: exercisesError } = await supabase
            .from('workout_exercises')
            .insert(workoutExercises);

          if (exercisesError) {
            console.error('Error creating workout exercises:', exercisesError);
            throw exercisesError;
          }

          console.log('Workout exercises created successfully for workout:', createdWorkout.id);
        } else {
          console.warn('No exercises to create for workout:', createdWorkout.id);
        }
      }

      console.log('Program assignment completed successfully');
      return { success: true };

    } catch (error) {
      console.error('Error assigning program to client:', error);
      throw error;
    }
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateFormRef.current) return;

    const formData = new FormData(templateFormRef.current);

    try {
      setSubmitting(true);
      
      const templateData = {
        title: formData.get('title') as string,
        description: formData.get('description') as string || null,
        category: formData.get('category') as string || null,
        created_by: user?.id
      };

      const { error } = await supabase
        .from('workout_templates')
        .insert([templateData]);

      if (error) throw error;

      if (templateFormRef.current) templateFormRef.current.reset();
      setShowAddModal(false);
      fetchTemplates();
    } catch (error) {
      console.error('Error creating template:', error);
      alert('Error creating template. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

 const handleEditProgram = (program: WorkoutProgram) => {
   setEditingProgram(program);
   setShowProgramModal(true);
 };

 const handleDeleteProgram = async (programId: string) => {
   const confirmed = window.confirm('Are you sure you want to delete this training program? This action cannot be undone.');
   if (!confirmed) return;

   try {
     const { error } = await supabase
       .from('workout_programs')
       .delete()
       .eq('id', programId);

     if (error) throw error;
     fetchPrograms();
   } catch (error) {
     console.error('Error deleting program:', error);
     alert('Error deleting program. Please try again.');
   }
 };

 const handleArchiveProgram = async (programId: string, archived: boolean) => {
   const action = archived ? 'unarchive' : 'archive';
   const confirmed = window.confirm(`Are you sure you want to ${action} this program?`);
   if (!confirmed) return;

   try {
     const { error } = await supabase
       .from('workout_programs')
       .update({ archived: !archived })
       .eq('id', programId);

     if (error) throw error;
     fetchPrograms();
   } catch (error) {
     console.error(`Error ${action}ing program:`, error);
     alert(`Error ${action}ing program. Please try again.`);
   }
 };

 const handleDuplicateProgram = async (programId: string) => {
   try {
     // Fetch the complete program with all its data
     const { data: program, error: programError } = await supabase
       .from('workout_programs')
       .select(`
         *,
         program_days(
           id,
           day_name,
           day_order,
           program_weeks(
             week_number,
             template_id
           )
         )
       `)
       .eq('id', programId)
       .single();

     if (programError) throw programError;

     // Create the new program with "(Copy)" appended to the title
     const { data: newProgram, error: newProgramError } = await supabase
       .from('workout_programs')
       .insert([{
         title: `${program.title} (Copy)`,
         description: program.description,
         category: program.category,
         duration_weeks: program.duration_weeks,
         days_per_week: program.days_per_week,
         program_type: program.program_type,
         created_by: user?.id
       }])
       .select()
       .single();

     if (newProgramError) throw newProgramError;

     // Create the program days for the new program
     if (program.program_days && program.program_days.length > 0) {
       const newProgramDays = await Promise.all(
         program.program_days.map(async (day) => {
           const { data: newDay, error: dayError } = await supabase
             .from('program_days')
             .insert([{
               program_id: newProgram.id,
               day_name: day.day_name,
               day_order: day.day_order
             }])
             .select()
             .single();

           if (dayError) throw dayError;

           // Copy program weeks for this day
           if (day.program_weeks && day.program_weeks.length > 0) {
             const programWeeks = day.program_weeks.map(pw => ({
               program_id: newProgram.id,
               program_day_id: newDay.id,
               week_number: pw.week_number,
               template_id: pw.template_id
             }));

             const { error: weeksError } = await supabase
               .from('program_weeks')
               .insert(programWeeks);

             if (weeksError) throw weeksError;
           }

           return newDay;
         })
       );
     }

     alert('Program duplicated successfully! You can now edit it to make changes.');
     fetchPrograms();
   } catch (error) {
     console.error('Error duplicating program:', error);
     alert('Error duplicating program. Please try again.');
   }
 };

  const handleProgramSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programFormRef.current) return;

    const formData = new FormData(programFormRef.current);

    try {
      setSubmitting(true);
      
      const warmupTemplateId = formData.get('warmup_template_id') as string;
      const programData = {
        title: formData.get('title') as string,
        description: formData.get('description') as string || null,
        category: formData.get('category') as string || null,
        duration_weeks: parseInt(formData.get('duration_weeks') as string),
        days_per_week: parseInt(formData.get('days_per_week') as string),
        program_type: (formData.get('program_type') as 'standard' | 'custom') || 'custom',
        warmup_template_id: warmupTemplateId || null,
      };

     if (editingProgram) {
       // Update existing program
       const { error: programError } = await supabase
         .from('workout_programs')
         .update(programData)
         .eq('id', editingProgram.id);

       if (programError) throw programError;

       // If days per week changed, we need to update program days
       if (programData.days_per_week !== editingProgram.days_per_week) {
         const dayNames = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];

         if (programData.days_per_week > editingProgram.days_per_week) {
           // Adding days - only add the new ones
           const programDays = [];
           for (let i = editingProgram.days_per_week; i < programData.days_per_week; i++) {
             programDays.push({
               program_id: editingProgram.id,
               day_name: dayNames[i],
               day_order: i + 1
             });
           }

           const { error: daysError } = await supabase
             .from('program_days')
             .insert(programDays);

           if (daysError) throw daysError;
         } else {
           // Removing days - only delete the excess days
           const { data: existingDays, error: fetchError } = await supabase
             .from('program_days')
             .select('id, day_order')
             .eq('program_id', editingProgram.id)
             .order('day_order', { ascending: true });

           if (fetchError) throw fetchError;

           // Delete days beyond the new days_per_week count
           const daysToDelete = existingDays
             ?.filter(day => day.day_order > programData.days_per_week)
             .map(day => day.id);

           if (daysToDelete && daysToDelete.length > 0) {
             const { error: deleteError } = await supabase
               .from('program_days')
               .delete()
               .in('id', daysToDelete);

             if (deleteError) throw deleteError;
           }
         }
       }
     } else {
       // Create new program
       const newProgramData = { ...programData, created_by: user?.id };
       const { data: program, error: programError } = await supabase
         .from('workout_programs')
         .insert([newProgramData])
         .select()
         .single();

       if (programError) throw programError;

       // Create program days
       const daysPerWeek = programData.days_per_week;
       const dayNames = ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
       
       const programDays = [];
       for (let i = 0; i < daysPerWeek; i++) {
         programDays.push({
           program_id: program.id,
           day_name: dayNames[i],
           day_order: i + 1
         });
       }

       const { error: daysError } = await supabase
         .from('program_days')
         .insert(programDays);

       if (daysError) throw daysError;
     }

      if (programFormRef.current) programFormRef.current.reset();
      setShowProgramModal(false);
     setEditingProgram(null);
      fetchPrograms();
    } catch (error) {
      console.error('Error creating program:', error);
      alert('Error creating program. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditTemplate = (template: WorkoutTemplate) => {
    setEditingTemplate(template);
    setShowEditModal(true);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this template?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('workout_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Error deleting template. Please try again.');
    }
  };

  const handleAssignTemplate = (template: WorkoutTemplate) => {
    setAssigningTemplate(template);
    setShowAssignModal(true);
  };

  const handleDuplicateTemplate = async (template: WorkoutTemplate) => {
    try {
      const { data: newTemplate, error: templateError } = await supabase
        .from('workout_templates')
        .insert([{
          title: `${template.title} (Copy)`,
          description: template.description,
          created_by: user?.id
        }])
        .select()
        .single();

      if (templateError) throw templateError;

      if (template.template_exercises && template.template_exercises.length > 0) {
        const exercisesToCopy = template.template_exercises.map(ex => ({
          template_id: newTemplate.id,
          exercise_id: ex.exercise_id,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          duration: ex.duration,
          order_index: ex.order_index
        }));

        const { error: exercisesError } = await supabase
          .from('template_exercises')
          .insert(exercisesToCopy);

        if (exercisesError) throw exercisesError;
      }

      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      alert('Error duplicating template. Please try again.');
    }
  };

  const handleProgramExpand = (programId: string) => {
    const newExpanded = new Set(expandedPrograms);
    if (newExpanded.has(programId)) {
      newExpanded.delete(programId);
    } else {
      newExpanded.add(programId);
    }
    setExpandedPrograms(newExpanded);
  };

  const assignTemplateToDay = async (programId: string, dayId: string, weekNumber: number, templateId: string) => {
    try {
      const { error } = await supabase
        .from('program_weeks')
        .upsert([{
          program_id: programId,
          program_day_id: dayId,
          week_number: weekNumber,
          template_id: templateId
        }], {
          onConflict: 'program_id,program_day_id,week_number'
        });

      if (error) throw error;
      fetchPrograms();
    } catch (error) {
      console.error('Error assigning template:', error);
      alert('Error assigning template. Please try again.');
    }
  };

  const handleAssignProgramToClient = async (programId: string, clientId: string, startDate: string) => {
    try {
      console.log('Assigning program to client:', { programId, clientId, startDate });
      await assignProgramToClient(programId, clientId, startDate);
      alert('Program assigned successfully!');
    } catch (error) {
      console.error('Error assigning program:', error);
      alert('Error assigning program. Please try again.');
    }
  };

  const filteredTemplates = templates
    .filter(template => {
      const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (template.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      if (selectedCategory === 'all') return matchesSearch;

      const matchesCategory = template.category === selectedCategory;

      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'category') {
        const catA = a.category || '';
        const catB = b.category || '';
        return catA.localeCompare(catB) || a.title.localeCompare(b.title);
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const categories = [
    { id: 'all', label: 'All Categories' },
    { id: 'bodyweight', label: 'Bodyweight' },
    { id: 'bands', label: 'Bands' },
    { id: 'dumbbells', label: 'Dumbbells' },
    { id: 'full-gym', label: 'Full Gym' }
  ];

  const TemplateModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Create New Template</h3>
          <button
            onClick={() => setShowAddModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form ref={templateFormRef} onSubmit={handleTemplateSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
            <input
              name="title"
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., Upper Body Strength"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Describe the purpose and focus of this template..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select a category (optional)</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="bands">Bands</option>
              <option value="dumbbells">Dumbbells</option>
              <option value="full-gym">Full Gym</option>
            </select>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Next Step:</strong> After creating the template, you can add exercises using the edit function.
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                  Creating...
                </>
              ) : (
                'Create Template'
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const ProgramModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
        <div className="flex items-center justify-between mb-4">
         <h3 className="text-lg font-semibold text-gray-900">
           {editingProgram ? 'Edit Training Program' : 'Create Training Program'}
         </h3>
          <button
           onClick={() => {
             setShowProgramModal(false);
             setEditingProgram(null);
           }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form ref={programFormRef} onSubmit={handleProgramSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Name</label>
            <input
              name="title"
              type="text"
             defaultValue={editingProgram?.title || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="e.g., 12-Week Strength Program"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              name="description"
             defaultValue={editingProgram?.description || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
              placeholder="Describe the program goals and structure..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              name="category"
              defaultValue={editingProgram?.category || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Select a category (optional)</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="bands">Bands</option>
              <option value="dumbbells">Dumbbells</option>
              <option value="full-gym">Full Gym</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Program Type</label>
            <select
              name="program_type"
              defaultValue={editingProgram?.program_type || 'custom'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              required
            >
              <option value="custom">Custom Program</option>
              <option value="standard">Standard Program</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Standard programs are reusable templates. Custom programs are client-specific.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (weeks)</label>
              <select
                name="duration_weeks"
               defaultValue={editingProgram?.duration_weeks || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Select duration</option>
                {[4, 6, 8, 10, 12, 16, 20, 24].map(weeks => (
                  <option key={weeks} value={weeks}>{weeks} weeks</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Days per week</label>
              <select
                name="days_per_week"
               defaultValue={editingProgram?.days_per_week || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">Select days</option>
                {[2, 3, 4, 5, 6, 7].map(days => (
                  <option key={days} value={days}>{days} days</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Warm-up Template (Optional)</label>
            <select
              name="warmup_template_id"
              defaultValue={editingProgram?.warmup_template_id || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">No warm-up</option>
              {templates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              If selected, this warm-up will be available in every week of the program
            </p>
          </div>

         {!editingProgram && (
           <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
             <p className="text-sm text-blue-800">
               <strong>Next Step:</strong> After creating the program, you can assign workout templates to specific days and weeks.
             </p>
           </div>
         )}

         {editingProgram && (
           <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
             <p className="text-sm text-yellow-800">
               <strong>Note:</strong> Changing the number of days per week will reset the program structure and remove existing template assignments.
             </p>
           </div>
         )}

          <div className="flex space-x-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                 {editingProgram ? 'Updating...' : 'Creating...'}
                </>
              ) : (
               editingProgram ? 'Update Program' : 'Create Program'
              )}
            </button>
            <button
              type="button"
             onClick={() => {
               setShowProgramModal(false);
               setEditingProgram(null);
             }}
              className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const ProgramAssignModal = ({ program }: { program: WorkoutProgram }) => {
    const [selectedClient, setSelectedClient] = useState('');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [assigning, setAssigning] = useState(false);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
        <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full max-w-lg max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Program: {program.title}
            </h3>
            <button
              onClick={() => setSelectedProgram(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">{program.title}</h4>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <span>{program.duration_weeks} weeks</span>
                <span>{program.days_per_week} days/week</span>
                <span>{program.duration_weeks * program.days_per_week} total workouts</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Client
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="">-- Select a client --</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.first_name} {client.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> This will create {program.duration_weeks * program.days_per_week} individual workouts 
                for the client based on the program schedule.
              </p>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  if (selectedClient && startDate) {
                    setAssigning(true);
                    handleAssignProgramToClient(program.id, selectedClient, startDate)
                      .finally(() => {
                        setAssigning(false);
                        setSelectedProgram(null);
                      });
                  }
                }}
                disabled={assigning || !selectedClient || !startDate}
                className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {assigning ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                    Assigning Program...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2 inline" />
                    Assign Program
                  </>
                )}
              </button>
              <button
                onClick={() => setSelectedProgram(null)}
                disabled={assigning}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
 const TemplateSelectorModal = () => {
   if (!showTemplateSelector) return null;

   return (
     <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 modal-overlay">
       <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl p-4 sm:p-6 w-full max-w-2xl max-h-[90dvh] sm:max-h-[90vh] overflow-y-auto keyboard-aware-container">
         <div className="flex items-center justify-between mb-6">
           <h3 className="text-lg font-semibold text-gray-900">
             Assign Template to {showTemplateSelector.dayName} - Week {showTemplateSelector.weekNumber}
           </h3>
           <button
             onClick={() => setShowTemplateSelector(null)}
             className="text-gray-400 hover:text-gray-600"
           >
             <X className="h-6 w-6" />
           </button>
         </div>

         <div className="space-y-4">
           <p className="text-gray-600">
             Select a workout template to assign to this day and week in the program.
           </p>

           <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-h-96 overflow-y-auto">
             {templates.map((template) => (
               <button
                 key={template.id}
                 onClick={() => {
                   assignTemplateToDay(
                     showTemplateSelector.programId,
                     showTemplateSelector.dayId,
                     showTemplateSelector.weekNumber,
                     template.id
                   );
                   setShowTemplateSelector(null);
                 }}
                 className="text-left p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
               >
                 <h4 className="font-medium text-gray-900 mb-2">{template.title}</h4>
                 {template.description && (
                   <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                 )}
                 <div className="flex items-center space-x-3 text-xs text-gray-500">
                   <span>{template.template_exercises?.length || 0} exercises</span>
                   <span>
                     {[...new Set(template.template_exercises?.map(ex => ex.exercise.category) || [])].length} categories
                   </span>
                 </div>
               </button>
             ))}
           </div>

           {templates.length === 0 && (
             <div className="text-center py-8">
               <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
               <p className="text-gray-500">No templates available</p>
               <p className="text-sm text-gray-400">Create workout templates first</p>
             </div>
           )}
         </div>
       </div>
     </div>
   );
 };

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
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1 sm:mb-2">Workout Builder</h1>
        <p className="text-sm sm:text-base text-gray-600">Create workout templates and structured training programs for your clients.</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 sm:mb-8">
        <div className="border-b border-gray-100 overflow-x-auto">
          <nav className="flex space-x-4 sm:space-x-8 px-4 sm:px-6 min-w-min">
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center py-3 sm:py-4 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap touch-manipulation ${
                activeTab === 'templates'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Workout Templates ({templates.length})</span>
              <span className="sm:hidden">Templates ({templates.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('custom-programs')}
              className={`flex items-center py-3 sm:py-4 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap touch-manipulation ${
                activeTab === 'custom-programs'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Custom Programs ({programs.filter(p => p.program_type === 'custom' && !p.archived).length})</span>
              <span className="sm:hidden">Custom ({programs.filter(p => p.program_type === 'custom' && !p.archived).length})</span>
            </button>
            <button
              onClick={() => setActiveTab('standard-programs')}
              className={`flex items-center py-3 sm:py-4 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors whitespace-nowrap touch-manipulation ${
                activeTab === 'standard-programs'
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Standard Programs ({programs.filter(p => p.program_type === 'standard' && !p.archived).length})</span>
              <span className="sm:hidden">Standard ({programs.filter(p => p.program_type === 'standard' && !p.archived).length})</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div>
          {/* Search and Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-3 sm:space-y-4 lg:space-y-0">
              <div className="relative flex-1 max-w-md">
                <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:space-x-4">
                <div className="flex items-center space-x-2 flex-1 sm:flex-initial">
                  <Filter className="h-5 w-5 text-gray-400" />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2 flex-1 sm:flex-initial">
                  <BarChart3 className="h-5 w-5 text-gray-400" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'created' | 'name' | 'category')}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  >
                    <option value="created">Sort by: Date Created</option>
                    <option value="name">Sort by: Name</option>
                    <option value="category">Sort by: Category</option>
                  </select>
                </div>
                {compareMode ? (
                  <button
                    onClick={() => {
                      if (selectedTemplatesForCompare.size >= 2) {
                        setShowingComparison(true);
                      } else {
                        alert('Please select at least 2 templates to compare');
                      }
                    }}
                    disabled={selectedTemplatesForCompare.size < 2}
                    className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors touch-manipulation active:scale-95 whitespace-nowrap ${
                      selectedTemplatesForCompare.size >= 2
                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Eye className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="text-sm sm:text-base">View {selectedTemplatesForCompare.size} Selected</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setCompareMode(true);
                      setSelectedTemplatesForCompare(new Set());
                    }}
                    className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
                  >
                    <Grid3X3 className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    <span className="text-sm sm:text-base">Compare Templates</span>
                  </button>
                )}
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  <span className="text-sm sm:text-base">New Template</span>
                </button>
              </div>
            </div>

            {/* Compare Mode Banner */}
            {compareMode && (
              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg">
                      <Grid3X3 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-blue-900">Compare Mode Active</h4>
                      <p className="text-sm text-blue-700">
                        Select 2-6 templates to compare side-by-side. Currently selected: {selectedTemplatesForCompare.size}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCompareMode(false);
                      setShowingComparison(false);
                      setSelectedTemplatesForCompare(new Set());
                    }}
                    className="flex items-center px-3 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-100 transition-colors border border-gray-300"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Templates Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredTemplates.map((template) => (
              <WorkoutTemplateCard
                key={template.id}
                template={template}
                onEdit={handleEditTemplate}
                onDelete={handleDeleteTemplate}
                onAssign={handleAssignTemplate}
                onDuplicate={handleDuplicateTemplate}
                compareMode={compareMode}
                isSelected={selectedTemplatesForCompare.has(template.id)}
                onToggleSelect={(id) => {
                  const newSet = new Set(selectedTemplatesForCompare);
                  if (newSet.has(id)) {
                    newSet.delete(id);
                  } else {
                    if (newSet.size >= 6) {
                      alert('You can compare up to 6 templates at once');
                      return;
                    }
                    newSet.add(id);
                  }
                  setSelectedTemplatesForCompare(newSet);
                }}
              />
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm || selectedCategory !== 'all' ? 'No templates found' : 'No templates yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Create your first workout template to get started.'
                }
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* Custom Programs Tab */}
      {activeTab === 'custom-programs' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Custom Programs</h2>
              <p className="text-sm sm:text-base text-gray-600">Client-specific training programs tailored to individual needs.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showArchived
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Archive className="h-4 w-4 mr-1.5" />
                {showArchived ? 'Showing Archived' : 'Archived'}
              </button>
              <button
                onClick={() => setShowProgramModal(true)}
                className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm sm:text-base">New Custom Program</span>
              </button>
            </div>
          </div>

          {/* Programs List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.filter(p => p.program_type === 'custom' && (showArchived ? p.archived : !p.archived)).map((program) => {
              const totalWorkouts = program.duration_weeks * program.days_per_week;
              const assignedWorkouts = program.program_days?.reduce((acc, day) => {
                const assigned = day.program_weeks?.filter(pw => pw.workout_template).length || 0;
                return acc + assigned;
              }, 0) || 0;
              const completionPercent = totalWorkouts > 0 ? Math.round((assignedWorkouts / totalWorkouts) * 100) : 0;

              return (
                <div key={program.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{program.title}</h3>
                          {program.category && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium capitalize">
                              {program.category.replace('-', ' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                            <Clock className="h-3 w-3 mr-1" />
                            {program.duration_weeks} weeks
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                            <Calendar className="h-3 w-3 mr-1" />
                            {program.days_per_week} days/week
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">
                            <Target className="h-3 w-3 mr-1" />
                            {totalWorkouts} workouts
                          </span>
                        </div>
                        {program.description && (
                          <p className="text-gray-600 text-sm line-clamp-2">{program.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">Workouts Assigned</span>
                        <span className={`font-semibold ${completionPercent === 100 ? 'text-green-600' : 'text-gray-900'}`}>
                          {assignedWorkouts}/{totalWorkouts} ({completionPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedProgramId(program.id)}
                        className="flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        <Edit3 className="h-4 w-4 mr-1.5" />
                        Edit Workouts
                      </button>
                      <button
                        onClick={() => setSelectedProgram(program)}
                        className="flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        <UserPlus className="h-4 w-4 mr-1.5" />
                        Assign
                      </button>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleProgramExpand(program.id)}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center"
                      >
                        {expandedPrograms.has(program.id) ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide Preview
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Show Preview
                          </>
                        )}
                      </button>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDuplicateProgram(program.id)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Duplicate Program"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditProgram(program)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Details"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleArchiveProgram(program.id, !!program.archived)}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title={program.archived ? "Unarchive Program" : "Archive Program"}
                        >
                          {program.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteProgram(program.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Program"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Program Structure Preview */}
                  {expandedPrograms.has(program.id) && (
                    <div className="border-t border-gray-100 bg-gray-50 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Quick Preview - First 4 Weeks</h4>
                        <button
                          onClick={() => setSelectedProgramId(program.id)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
                        >
                          Open Full Editor
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </button>
                      </div>

                      {/* Compact Grid View */}
                      <div className="overflow-x-auto">
                        <div className="min-w-full">
                          <div className="grid gap-3">
                            {program.program_days?.slice(0, program.days_per_week).map((day) => (
                              <div key={day.id} className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="font-semibold text-gray-900 text-sm mb-2">{day.day_name}</div>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {Array.from({ length: Math.min(4, program.duration_weeks) }, (_, weekIndex) => {
                                    const weekNumber = weekIndex + 1;
                                    const programWeek = day.program_weeks?.find(pw => pw.week_number === weekNumber);

                                    return (
                                      <div key={weekIndex} className="flex-shrink-0 w-32">
                                        {programWeek?.workout_template ? (
                                          <div className="bg-green-50 border border-green-200 rounded-md p-2">
                                            <div className="text-xs font-medium text-green-800 truncate">
                                              {programWeek.workout_template.title}
                                            </div>
                                            <div className="text-xs text-green-600 mt-1">
                                              {programWeek.workout_template.template_exercises?.length || 0} ex
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="border-2 border-dashed border-gray-200 rounded-md p-2 text-center">
                                            <div className="text-xs text-gray-400">W{weekNumber}</div>
                                            <div className="text-xs text-gray-400">Not assigned</div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {program.duration_weeks > 4 && (
                                    <div className="flex-shrink-0 w-16 flex items-center justify-center">
                                      <div className="text-xs text-gray-400">+{program.duration_weeks - 4} more</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {programs.filter(p => p.program_type === 'custom' && (showArchived ? p.archived : !p.archived)).length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No custom programs yet</h3>
              <p className="text-gray-600 mb-4">
                Create client-specific training programs tailored to individual needs.
              </p>
              <button
                onClick={() => setShowProgramModal(true)}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Custom Program
              </button>
            </div>
          )}
        </div>
      )}

      {/* Standard Programs Tab */}
      {activeTab === 'standard-programs' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-6 sm:mb-8">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Standard Programs</h2>
              <p className="text-sm sm:text-base text-gray-600">Reusable training program templates that can be assigned to multiple clients.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  showArchived
                    ? 'bg-amber-100 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                <Archive className="h-4 w-4 mr-1.5" />
                {showArchived ? 'Showing Archived' : 'Archived'}
              </button>
              <button
                onClick={() => setShowProgramModal(true)}
                className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors touch-manipulation active:scale-95 whitespace-nowrap"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                <span className="text-sm sm:text-base">New Standard Program</span>
              </button>
            </div>
          </div>

          {/* Programs List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {programs.filter(p => p.program_type === 'standard' && (showArchived ? p.archived : !p.archived)).map((program) => {
              const totalWorkouts = program.duration_weeks * program.days_per_week;
              const assignedWorkouts = program.program_days?.reduce((acc, day) => {
                const assigned = day.program_weeks?.filter(pw => pw.workout_template).length || 0;
                return acc + assigned;
              }, 0) || 0;
              const completionPercent = totalWorkouts > 0 ? Math.round((assignedWorkouts / totalWorkouts) * 100) : 0;

              return (
                <div key={program.id} className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{program.title}</h3>
                          <span className="inline-flex items-center px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                            Standard
                          </span>
                          {program.category && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium capitalize">
                              {program.category.replace('-', ' ')}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md text-xs font-medium">
                            <Clock className="h-3 w-3 mr-1" />
                            {program.duration_weeks} weeks
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 bg-green-50 text-green-700 rounded-md text-xs font-medium">
                            <Calendar className="h-3 w-3 mr-1" />
                            {program.days_per_week} days/week
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 rounded-md text-xs font-medium">
                            <Target className="h-3 w-3 mr-1" />
                            {totalWorkouts} workouts
                          </span>
                        </div>
                        {program.description && (
                          <p className="text-gray-600 text-sm line-clamp-2">{program.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600 font-medium">Workouts Assigned</span>
                        <span className={`font-semibold ${completionPercent === 100 ? 'text-green-600' : 'text-gray-900'}`}>
                          {assignedWorkouts}/{totalWorkouts} ({completionPercent}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            completionPercent === 100 ? 'bg-green-500' : 'bg-blue-500'
                          }`}
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedProgramId(program.id)}
                        className="flex items-center justify-center px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                      >
                        <Edit3 className="h-4 w-4 mr-1.5" />
                        Edit Workouts
                      </button>
                      <button
                        onClick={() => setSelectedProgram(program)}
                        className="flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                      >
                        <UserPlus className="h-4 w-4 mr-1.5" />
                        Assign
                      </button>
                    </div>

                    {/* Secondary Actions */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                      <button
                        onClick={() => handleProgramExpand(program.id)}
                        className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center"
                      >
                        {expandedPrograms.has(program.id) ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Hide Preview
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Show Preview
                          </>
                        )}
                      </button>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleDuplicateProgram(program.id)}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Duplicate Program"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditProgram(program)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Details"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleArchiveProgram(program.id, !!program.archived)}
                          className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title={program.archived ? "Unarchive Program" : "Archive Program"}
                        >
                          {program.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => handleDeleteProgram(program.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Program"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Program Structure Preview */}
                  {expandedPrograms.has(program.id) && (
                    <div className="border-t border-gray-100 bg-gray-50 p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-gray-900">Quick Preview - First 4 Weeks</h4>
                        <button
                          onClick={() => setSelectedProgramId(program.id)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium flex items-center"
                        >
                          Open Full Editor
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </button>
                      </div>

                      {/* Compact Grid View */}
                      <div className="overflow-x-auto">
                        <div className="min-w-full">
                          <div className="grid gap-3">
                            {program.program_days?.slice(0, program.days_per_week).map((day) => (
                              <div key={day.id} className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="font-semibold text-gray-900 text-sm mb-2">{day.day_name}</div>
                                <div className="flex gap-2 overflow-x-auto pb-1">
                                  {Array.from({ length: Math.min(4, program.duration_weeks) }, (_, weekIndex) => {
                                    const weekNumber = weekIndex + 1;
                                    const programWeek = day.program_weeks?.find(pw => pw.week_number === weekNumber);

                                    return (
                                      <div key={weekIndex} className="flex-shrink-0 w-32">
                                        {programWeek?.workout_template ? (
                                          <div className="bg-green-50 border border-green-200 rounded-md p-2">
                                            <div className="text-xs font-medium text-green-800 truncate">
                                              {programWeek.workout_template.title}
                                            </div>
                                            <div className="text-xs text-green-600 mt-1">
                                              {programWeek.workout_template.template_exercises?.length || 0} ex
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="border-2 border-dashed border-gray-200 rounded-md p-2 text-center">
                                            <div className="text-xs text-gray-400">W{weekNumber}</div>
                                            <div className="text-xs text-gray-400">Not assigned</div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  {program.duration_weeks > 4 && (
                                    <div className="flex-shrink-0 w-16 flex items-center justify-center">
                                      <div className="text-xs text-gray-400">+{program.duration_weeks - 4} more</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {programs.filter(p => p.program_type === 'standard' && (showArchived ? p.archived : !p.archived)).length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No standard programs yet</h3>
              <p className="text-gray-600 mb-4">
                Create reusable program templates that can be assigned to multiple clients.
              </p>
              <button
                onClick={() => setShowProgramModal(true)}
                className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Standard Program
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && <TemplateModal />}
      {showProgramModal && <ProgramModal />}
      {selectedProgram && <ProgramAssignModal program={selectedProgram} />}
      
      {showEditModal && editingTemplate && (
        <EditTemplateModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
          }}
          template={editingTemplate}
          onEditComplete={() => {
            setShowEditModal(false);
            setEditingTemplate(null);
            fetchTemplates();
           fetchPrograms(); // Also refresh programs to show updated template info
          }}
        />
      )}

     {showTemplateSelector && <TemplateSelectorModal />}

      {showAssignModal && assigningTemplate && (
        <AssignTemplateModal
          isOpen={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setAssigningTemplate(null);
          }}
          template={assigningTemplate}
          onAssignComplete={() => {
            setShowAssignModal(false);
            setAssigningTemplate(null);
          }}
        />
      )}

      {showWeekCustomization && (
        <WeekCustomizationModal
          isOpen={showWeekCustomization}
          onClose={() => setShowWeekCustomization(false)}
          programId=""
          dayId=""
          weekNumber={1}
          templateId=""
          onCustomizationComplete={() => {
            setShowWeekCustomization(false);
            fetchPrograms();
          }}
        />
      )}
    </div>
  );
};

export default WorkoutBuilder;