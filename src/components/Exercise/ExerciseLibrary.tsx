import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Dumbbell, Search, Filter, Plus, CreditCard as Edit3, Trash2, Play, MoreVertical, X, Save, Loader, CheckCircle, AlertCircle, ExternalLink, Eye, Users, BarChart3, Calendar, Download, Upload, Target, Grid3x3, List, RefreshCw, Youtube } from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  category: string;
  description: string;
  instructions: string[];
  video_url?: string;
  created_by?: string;
  created_at: string;
  physical_traits: string[];
  body_regions: string[];
  movement_patterns: string[];
  tags: string[];
  equipment: string[];
}

const TAG_OPTIONS = [
  'upper_body', 'lower_body', 'full_body', 'core', 'mobility',
  'power', 'endurance', 'rehabilitation', 'warm_up', 'cool_down',
];

const MOVEMENT_PATTERN_OPTIONS = [
  'hinge', 'squat', 'lunge', 'push', 'pull', 'rotation', 'anti_rotation',
];

const BODY_REGION_OPTIONS = [
  'cervical_spine', 't_spine', 'core', 'pelvis', 'hips',
  'glutes', 'shoulders', 'wrists', 'ankles',
];

const PHYSICAL_TRAIT_OPTIONS = [
  'mobility', 'stability', 'strength', 'power', 'motor_control',
];

const EQUIPMENT_OPTIONS = [
  'bodyweight', 'barbell', 'dumbbell', 'kettlebell', 'cable',
  'bands', 'machine', 'med_ball', 'trx',
];

const EQUIPMENT_BADGE_COLORS: Record<string, string> = {
  barbell: 'bg-slate-100 text-slate-800 border-slate-200',
  dumbbell: 'bg-blue-50 text-blue-700 border-blue-200',
  kettlebell: 'bg-amber-50 text-amber-700 border-amber-200',
  cable: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  bands: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  bodyweight: 'bg-gray-50 text-gray-700 border-gray-200',
  machine: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  med_ball: 'bg-orange-50 text-orange-700 border-orange-200',
  trx: 'bg-teal-50 text-teal-700 border-teal-200',
};

const TAG_COLORS: Record<string, string> = {
  upper_body: 'bg-blue-50 text-blue-700 border-blue-200',
  lower_body: 'bg-green-50 text-green-700 border-green-200',
  full_body: 'bg-purple-50 text-purple-700 border-purple-200',
  core: 'bg-amber-50 text-amber-700 border-amber-200',
  mobility: 'bg-teal-50 text-teal-700 border-teal-200',
  power: 'bg-red-50 text-red-700 border-red-200',
  endurance: 'bg-orange-50 text-orange-700 border-orange-200',
  rehabilitation: 'bg-rose-50 text-rose-700 border-rose-200',
  warm_up: 'bg-sky-50 text-sky-700 border-sky-200',
  cool_down: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\bt\b/i, 'T');
}

const ExerciseLibrary: React.FC = () => {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<Exercise[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [ytSyncing, setYtSyncing] = useState(false);
  const [ytResult, setYtResult] = useState<null | {
    videos_fetched: number;
    exercises_total: number;
    matched: number;
    updated: number;
    unmatched_count: number;
    unmatched_sample: string[];
    error?: string;
  }>(null);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formTags, setFormTags] = useState<string[]>([]);
  const [formMovementPatterns, setFormMovementPatterns] = useState<string[]>([]);
  const [formBodyRegions, setFormBodyRegions] = useState<string[]>([]);
  const [formPhysicalTraits, setFormPhysicalTraits] = useState<string[]>([]);
  const [formEquipment, setFormEquipment] = useState<string[]>([]);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showDuplicateManager, setShowDuplicateManager] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([]);
  const [analyzingDuplicates, setAnalyzingDuplicates] = useState(false);
  const [visibleDuplicateCount, setVisibleDuplicateCount] = useState(1);
  const exerciseFormRef = useRef<HTMLFormElement>(null);

  const categories = [
    { id: 'all', label: 'All Categories', count: 0 },
    { id: 'strength', label: 'Strength', count: 0 },
    { id: 'mobility', label: 'Mobility', count: 0 },
    { id: 'power', label: 'Power', count: 0 },
    { id: 'stability', label: 'Stability', count: 0 },
    { id: 'conditioning', label: 'Conditioning', count: 0 }
  ];

  useEffect(() => {
    fetchExercises();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [exercises, searchTerm, selectedCategory, sortBy]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveDropdown(null);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchExercises = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterExercises = () => {
    let filtered = exercises;

    if (searchTerm) {
      filtered = filtered.filter(exercise =>
        exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exercise.category.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(exercise => exercise.category === selectedCategory);
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        case 'date-newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'date-oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'category-asc':
          return a.category.localeCompare(b.category);
        case 'category-desc':
          return b.category.localeCompare(a.category);
        default:
          return 0;
      }
    });

    setFilteredExercises(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exerciseFormRef.current) return;

    const formData = new FormData(exerciseFormRef.current);

    try {
      setSubmitting(true);
      
      const exerciseData = {
        name: formData.get('name') as string,
        category: formData.get('category') as string,
        description: formData.get('description') as string,
        instructions: (formData.get('instructions') as string).split('\n').filter(i => i.trim()),
        video_url: formData.get('video_url') as string || null,
        created_by: user?.id,
        tags: formTags,
        movement_patterns: formMovementPatterns,
        body_regions: formBodyRegions,
        physical_traits: formPhysicalTraits,
        equipment: formEquipment,
      };

      if (editingExercise) {
        const { error } = await supabase
          .from('exercises')
          .update(exerciseData)
          .eq('id', editingExercise.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('exercises')
          .insert([exerciseData]);

        if (error) throw error;
      }

      if (exerciseFormRef.current) exerciseFormRef.current.reset();
      setShowAddModal(false);
      setEditingExercise(null);
      setFormTags([]);
      setFormMovementPatterns([]);
      setFormBodyRegions([]);
      setFormPhysicalTraits([]);
      setFormEquipment([]);
      fetchExercises();
    } catch (error) {
      console.error('Error saving exercise:', error);
      alert('Error saving exercise. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setFormTags(exercise.tags || []);
    setFormMovementPatterns(exercise.movement_patterns || []);
    setFormBodyRegions(exercise.body_regions || []);
    setFormPhysicalTraits(exercise.physical_traits || []);
    setFormEquipment(exercise.equipment || []);
    setShowAddModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async (exerciseId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this exercise?');
    if (!confirmed) return;

    try {
      const { data, error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId)
        .select();

      if (error) {
        console.error('Delete error details:', error);
        throw error;
      }

      console.log('Delete successful:', data);

      // Update local state immediately by removing the deleted exercise
      setExercises(prevExercises => prevExercises.filter(ex => ex.id !== exerciseId));

      // If duplicate manager is open, update the groups
      if (showDuplicateManager) {
        setDuplicateGroups(prevGroups => {
          // Filter out the deleted exercise from all groups
          const updatedGroups = prevGroups.map(group => ({
            ...group,
            exercises: group.exercises.filter((ex: Exercise) => ex.id !== exerciseId)
          })).filter(group => group.exercises.length > 1); // Remove groups with less than 2 exercises

          return updatedGroups;
        });
      }
    } catch (error) {
      console.error('Error deleting exercise:', error);
      alert(`Error deleting exercise: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    setActiveDropdown(null);
  };

  const handleExerciseSelect = (exerciseId: string) => {
    const newSelected = new Set(selectedExercises);
    if (newSelected.has(exerciseId)) {
      newSelected.delete(exerciseId);
    } else {
      newSelected.add(exerciseId);
    }
    setSelectedExercises(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedExercises.size === filteredExercises.length) {
      setSelectedExercises(new Set());
    } else {
      setSelectedExercises(new Set(filteredExercises.map(ex => ex.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedExercises.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedExercises.size} selected exercises? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .in('id', Array.from(selectedExercises));

      if (error) throw error;

      setSelectedExercises(new Set());
      setShowBulkActions(false);
      fetchExercises();
    } catch (error) {
      console.error('Error bulk deleting exercises:', error);
      alert('Error deleting exercises. Please try again.');
    }
  };

  const handleBulkEdit = async (updates: Partial<Exercise>) => {
    if (selectedExercises.size === 0) return;

    try {
      console.log('Bulk editing exercises:', Array.from(selectedExercises));
      console.log('Updates to apply:', updates);

      const { error } = await supabase
        .from('exercises')
        .update(updates)
        .in('id', Array.from(selectedExercises));

      if (error) {
        console.error('Bulk edit error:', error);
        throw error;
      }

      setSelectedExercises(new Set());
      setShowBulkActions(false);
      fetchExercises();
    } catch (error) {
      console.error('Error bulk editing exercises:', error);
      alert('Error updating exercises. Please try again.');
    }
  };

  const handleDropdownToggle = (exerciseId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDropdown(activeDropdown === exerciseId ? null : exerciseId);
  };


  const handleSyncYouTube = async () => {
    if (!confirm('Fetch videos from your YouTube channel and match them to exercises by name? Matching exercises will have their video URL overwritten.')) return;
    setYtSyncing(true);
    setYtResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-youtube-videos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ dryRun: false, overwrite: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setYtResult({ videos_fetched: 0, exercises_total: 0, matched: 0, updated: 0, unmatched_count: 0, unmatched_sample: [], error: data?.error ?? `HTTP ${res.status}` });
      } else {
        setYtResult(data);
        await fetchExercises();
      }
    } catch (err: any) {
      setYtResult({ videos_fetched: 0, exercises_total: 0, matched: 0, updated: 0, unmatched_count: 0, unmatched_sample: [], error: err?.message ?? 'Unknown error' });
    } finally {
      setYtSyncing(false);
    }
  };

  const findDuplicates = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      console.log('Finding duplicates...', 'Current view should stay as exercises');
      console.log('Setting showDuplicateManager to true');
      setShowDuplicateManager(true);
      setAnalyzingDuplicates(true);

      // Use setTimeout to ensure state updates before processing
      setTimeout(() => {
        try {
          // Group exercises by similarity
          const groups: any[] = [];
          const processed = new Set<string>();

          exercises.forEach((exercise, index) => {
            if (processed.has(exercise.id)) return;

            const duplicates = exercises.filter((other, otherIndex) => {
              if (otherIndex <= index || processed.has(other.id)) return false;

              // Calculate similarity based on title
              const similarity = calculateSimilarity(exercise.name, other.name);
              return similarity > 0.6; // 60% similarity threshold (lowered for better detection)
            });

            if (duplicates.length > 0) {
              const group = [exercise, ...duplicates];
              groups.push({
                id: `group-${groups.length}`,
                exercises: group,
                similarity: Math.max(...duplicates.map(d => calculateSimilarity(exercise.name, d.name)))
              });

              // Mark all exercises in this group as processed
              group.forEach(ex => processed.add(ex.id));
            }
          });

          // Sort groups by similarity score (highest first)
          groups.sort((a, b) => b.similarity - a.similarity);

          console.log(`Found ${groups.length} duplicate groups`);

          // Limit to first 20 groups to prevent rendering issues
          const limitedGroups = groups.slice(0, 20);
          console.log(`Showing ${limitedGroups.length} groups (limited from ${groups.length})`);

          setDuplicateGroups(limitedGroups);
          setAnalyzingDuplicates(false);
        } catch (error) {
          console.error('Error processing duplicates:', error);
          setAnalyzingDuplicates(false);
          alert('Error finding duplicates. Please try again.');
        }
      }, 0);
    } catch (error) {
      console.error('Error in findDuplicates:', error);
      setAnalyzingDuplicates(false);
      alert('Error finding duplicates. Please try again.');
    }
  };
  
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 1;

    // Normalize strings by removing common punctuation and extra spaces
    const normalize = (str: string) => {
      return str
        .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
        .replace(/\s+/g, ' ')      // Replace multiple spaces with single space
        .trim();
    };

    const normalized1 = normalize(s1);
    const normalized2 = normalize(s2);

    // Check if one string contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.85; // High similarity if one contains the other
    }

    // Split into words and compare word overlap
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');

    // Remove very common words for better matching
    const commonWords = ['exercise', 'workout', 'training', 'fitness', 'the', 'a', 'an', 'and', 'or', 'with', 'for', 'w'];
    const filterWords = (words: string[]) => words.filter(word => !commonWords.includes(word) && word.length > 1);

    const filtered1 = filterWords(words1);
    const filtered2 = filterWords(words2);

    // Calculate word overlap
    const allWords = new Set([...filtered1, ...filtered2]);
    const commonWordCount = filtered1.filter(word => filtered2.includes(word)).length;
    const wordOverlapScore = commonWordCount / Math.max(filtered1.length, filtered2.length, 1);

    // Calculate Levenshtein distance on cleaned strings
    const cleanStr1 = filtered1.join(' ');
    const cleanStr2 = filtered2.join(' ');

    if (cleanStr1.length === 0 || cleanStr2.length === 0) {
      return wordOverlapScore;
    }

    const matrix = Array(cleanStr2.length + 1).fill(null).map(() => Array(cleanStr1.length + 1).fill(null));

    for (let i = 0; i <= cleanStr1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= cleanStr2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= cleanStr2.length; j++) {
      for (let i = 1; i <= cleanStr1.length; i++) {
        const indicator = cleanStr1[i - 1] === cleanStr2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }

    const distance = matrix[cleanStr2.length][cleanStr1.length];
    const maxLength = Math.max(cleanStr1.length, cleanStr2.length);
    const levenshteinScore = maxLength === 0 ? 1 : 1 - (distance / maxLength);

    // Combine both scores (weighted average)
    return (wordOverlapScore * 0.6) + (levenshteinScore * 0.4);
  };
  
  const handleBulkDeleteDuplicates = async (exerciseIds: string[]) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${exerciseIds.length} duplicate exercises? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .in('id', exerciseIds);

      if (error) throw error;

      // Refresh exercises and re-analyze duplicates
      await fetchExercises();
      findDuplicates();
    } catch (error) {
      console.error('Error deleting duplicate exercises:', error);
      alert('Error deleting exercises. Please try again.');
    }
  };

  const handleMergeDuplicates = async (primaryExercise: Exercise, duplicatesToDelete: Exercise[]) => {
    const confirmed = window.confirm(
      `Merge ${duplicatesToDelete.length} duplicate exercises into "${primaryExercise.name}"? The duplicates will be deleted.`
    );
    if (!confirmed) return;

    try {
      // Delete the duplicate exercises
      const duplicateIds = duplicatesToDelete.map(ex => ex.id);
      const { error } = await supabase
        .from('exercises')
        .delete()
        .in('id', duplicateIds);

      if (error) throw error;

      // Refresh exercises and re-analyze duplicates
      await fetchExercises();
      findDuplicates();
    } catch (error) {
      console.error('Error merging duplicate exercises:', error);
      alert('Error merging exercises. Please try again.');
    }
  };

  const getCategoryStats = () => {
    return categories.map(cat => ({
      ...cat,
      count: cat.id === 'all' ? exercises.length : exercises.filter(ex => ex.category === cat.id).length
    }));
  };

  const categoryStats = getCategoryStats();

  const VideoThumbnail = ({ videoUrl, exerciseName }: { videoUrl: string; exerciseName: string }) => {
    const [imageError, setImageError] = useState(false);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

    useEffect(() => {
      const videoId = videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
      if (videoId) {
        setThumbnailUrl(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      }
      setImageError(false);
    }, [videoUrl]);

    if (!thumbnailUrl || imageError) {
      return (
        <div className="w-full h-full bg-gray-800 flex items-center justify-center">
          <Play className="h-8 w-8 text-white" />
        </div>
      );
    }

    return (
      <img
        src={thumbnailUrl}
        alt={`${exerciseName} video thumbnail`}
        className="w-full h-full object-cover"
        onError={() => setImageError(true)}
      />
    );
  };

  const DuplicateManagerModal = () => {
    if (!showDuplicateManager) {
      console.log('Modal hidden - showDuplicateManager is false');
      return null;
    }

    console.log('Rendering DuplicateManagerModal with', duplicateGroups.length, 'groups');

    return (
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 modal-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowDuplicateManager(false);
            setVisibleDuplicateCount(1);
          }
        }}
      >
        <div className="modal-panel bg-white rounded-t-2xl sm:rounded-xl w-full max-w-6xl sm:mx-4 max-h-[95dvh] sm:max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Duplicate Exercise Manager</h3>
                <p className="text-gray-600 mt-1">
                  Found {duplicateGroups.length} groups with potential duplicates
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDuplicateManager(false);
                  setVisibleDuplicateCount(1);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

        <div className="p-6">
          {analyzingDuplicates ? (
            <div className="text-center py-8">
              <Loader className="h-8 w-8 text-green-500 animate-spin mx-auto mb-2" />
              <p className="text-gray-600">Analyzing exercises for duplicates...</p>
            </div>
          ) : duplicateGroups.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Duplicates Found</h3>
              <p className="text-gray-600">Your exercise library looks clean! No potential duplicates were detected.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {duplicateGroups
                .slice(0, visibleDuplicateCount)
                .map((group, groupIndex) => (
                <div key={group.id} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        Duplicate Group {groupIndex + 1}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {Math.round(group.similarity * 100)}% similarity detected
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleBulkDeleteDuplicates(group.exercises.slice(1).map((ex: Exercise) => ex.id))}
                        className="flex items-center px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete All Duplicates
                      </button>
                      <button
                        onClick={() => handleMergeDuplicates(group.exercises[0], group.exercises.slice(1))}
                        className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                      >
                        <Target className="h-4 w-4 mr-1" />
                        Merge into First
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.exercises.map((exercise: Exercise, exerciseIndex: number) => (
                      <div 
                        key={exercise.id} 
                        className={`bg-white rounded-lg p-4 border-2 transition-all ${
                          exerciseIndex === 0 
                            ? 'border-green-500 ring-2 ring-green-200' 
                            : 'border-gray-200 hover:border-red-300'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h5 className="font-medium text-gray-900">{exercise.name}</h5>
                              {exerciseIndex === 0 && (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                  Primary
                                </span>
                              )}
                            </div>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${
                              exercise.category === 'strength' ? 'bg-blue-100 text-blue-700' :
                              exercise.category === 'mobility' ? 'bg-green-100 text-green-700' :
                              exercise.category === 'power' ? 'bg-red-100 text-red-700' :
                              exercise.category === 'stability' ? 'bg-purple-100 text-purple-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {exercise.category}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleEdit(exercise)}
                              className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                              title="Edit exercise"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            {exerciseIndex !== 0 && (
                              <button
                                onClick={() => handleDelete(exercise.id)}
                                className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                title="Delete exercise"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Video Thumbnail */}
                        {exercise.video_url && (
                          <div className="mb-3">
                            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                              <VideoThumbnail 
                                videoUrl={exercise.video_url} 
                                exerciseName={exercise.name}
                              />
                            </div>
                          </div>
                        )}

                        <p className="text-gray-600 text-sm mb-3 line-clamp-2">{exercise.description}</p>

                        <div className="space-y-1 text-xs text-gray-500">
                          <div className="flex items-center justify-between">
                            <span>Created:</span>
                            <span>{new Date(exercise.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-800 text-sm">
                      <strong>Primary Exercise:</strong> This exercise will be kept when merging duplicates. 
                      You can edit it before merging to combine the best aspects of all duplicates.
                    </p>
                  </div>
                </div>
              ))}

              {/* Load More Button */}
              {visibleDuplicateCount < duplicateGroups.length && (
                <div className="flex justify-center">
                  <button
                    onClick={() => setVisibleDuplicateCount(prev => Math.min(prev + 1, duplicateGroups.length))}
                    className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                  >
                    Load More ({visibleDuplicateCount} of {duplicateGroups.length} shown)
                  </button>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Duplicate Detection Info:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• <strong>Detection Method:</strong> Uses smart matching that considers word overlap and spelling similarity</li>
                  <li>• <strong>Similarity Threshold:</strong> 60% or higher - groups exercises with similar titles together</li>
                  <li>• <strong>Primary Exercise:</strong> The first exercise in each group (highlighted in green) is kept when merging</li>
                  <li>• <strong>Merge:</strong> Keeps the primary exercise and deletes the duplicates</li>
                  <li>• <strong>Individual Actions:</strong> Edit or delete specific exercises using the action buttons on each card</li>
                  <li>• <strong>Review Carefully:</strong> Some matches may be variations rather than true duplicates - review before deleting</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    );
  };

  const ExerciseModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            {editingExercise ? 'Edit Exercise' : 'Add New Exercise'}
          </h3>
          <button
            onClick={() => {
              setShowAddModal(false);
              setEditingExercise(null);
            }}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form ref={exerciseFormRef} onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exercise Name</label>
              <input
                name="name"
                type="text"
                defaultValue={editingExercise?.name || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="e.g., Push-ups"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                name="category"
                defaultValue={editingExercise?.category || 'strength'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                required
              >
                <option value="strength">Strength</option>
                <option value="mobility">Mobility</option>
                <option value="power">Power</option>
                <option value="stability">Stability</option>
                <option value="conditioning">Conditioning</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                defaultValue={editingExercise?.description || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={3}
                placeholder="Describe the exercise and its benefits..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instructions</label>
              <textarea
                name="instructions"
                defaultValue={editingExercise?.instructions?.join('\n') || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                rows={4}
                placeholder="Step 1: Starting position&#10;Step 2: Movement execution&#10;Step 3: Return to start"
              />
              <p className="text-xs text-gray-500 mt-1">Enter each instruction on a new line</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (optional)</label>
              <input
                name="video_url"
                type="url"
                defaultValue={editingExercise?.video_url || ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div className="border-t border-gray-100 pt-4 mt-2">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Movement Classification</h4>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Physical Traits</label>
                <div className="flex flex-wrap gap-2">
                  {PHYSICAL_TRAIT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormPhysicalTraits((prev) =>
                        prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formPhysicalTraits.includes(opt)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {formatLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Equipment</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormEquipment((prev) =>
                        prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formEquipment.includes(opt)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {formatLabel(opt)}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500">Tag every piece of equipment that can be used (e.g., barbell or dumbbell).</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Body Regions</label>
                <div className="flex flex-wrap gap-2">
                  {BODY_REGION_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormBodyRegions((prev) =>
                        prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formBodyRegions.includes(opt)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {formatLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Movement Patterns</label>
                <div className="flex flex-wrap gap-2">
                  {MOVEMENT_PATTERN_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormMovementPatterns((prev) =>
                        prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formMovementPatterns.includes(opt)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {formatLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                <div className="flex flex-wrap gap-2">
                  {TAG_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setFormTags((prev) =>
                        prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
                      )}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formTags.includes(opt)
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {formatLabel(opt)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex space-x-3 p-6 pt-4 border-t border-gray-100 bg-white rounded-b-xl shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin inline" />
                  {editingExercise ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2 inline" />
                  {editingExercise ? 'Update Exercise' : 'Create Exercise'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingExercise(null);
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

  const BulkActionsModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="p-6 pb-4 border-b border-gray-100 shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">
            Bulk Actions ({selectedExercises.size} selected)
          </h3>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Category</label>
            <select
              id="bulk-category"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Keep current category</option>
              <option value="strength">Strength</option>
              <option value="mobility">Mobility</option>
              <option value="power">Power</option>
              <option value="stability">Stability</option>
              <option value="conditioning">Conditioning</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Description</label>
            <textarea
              id="bulk-description"
              placeholder="Enter new description for all selected exercises (leave blank to keep current)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Instructions</label>
            <textarea
              id="bulk-instructions"
              placeholder="Enter new instructions (one per line) for all selected exercises (leave blank to keep current)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              rows={4}
            />
            <p className="text-xs text-gray-500">Enter each instruction on a new line</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Update Video URL</label>
            <input
              id="bulk-video-url"
              type="url"
              placeholder="https://youtube.com/watch?v=... (leave blank to keep current)"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>How to use:</strong> Fill in any fields you want to update and click "Save Changes" to apply them to all selected exercises. Leave fields blank to keep current values. <strong>Enter a single space (" ") to clear a field and make it empty.</strong>
            </p>
          </div>
        </div>

        <div className="p-6 pt-4 border-t border-gray-200 bg-white rounded-b-xl shrink-0">
          <div className="flex space-x-3">
            <button
              onClick={() => {
                const category = (document.getElementById('bulk-category') as HTMLSelectElement).value;
                const description = (document.getElementById('bulk-description') as HTMLTextAreaElement).value.trim();
                const instructions = (document.getElementById('bulk-instructions') as HTMLTextAreaElement).value.trim();
                const videoUrl = (document.getElementById('bulk-video-url') as HTMLInputElement).value.trim();

                const updates: any = {};
                if (category) updates.category = category;
                if (description) {
                  updates.description = description === ' ' ? null : description;
                }
                if (instructions) {
                  updates.instructions = instructions === ' ' ? [] : instructions.split('\n').filter(i => i.trim());
                }
                if (videoUrl) {
                  updates.video_url = videoUrl === ' ' ? null : videoUrl;
                }

                if (Object.keys(updates).length > 0) {
                  handleBulkEdit(updates);
                } else {
                  alert('Please make at least one change before saving.');
                }
              }}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors"
            >
              <Save className="h-4 w-4 mr-2 inline" />
              Save Changes
            </button>

            <button
              onClick={() => {
                setShowBulkActions(false);
                setSelectedExercises(new Set());
              }}
              className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="mt-3">
            <button
              onClick={handleBulkDelete}
              className="w-full flex items-center justify-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected Exercises
            </button>
          </div>
        </div>
      </div>
    </div>
  );

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
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Exercise Library</h1>
        <p className="text-gray-600">Manage your collection of training exercises and movements.</p>
      </div>

      {ytResult && (
        <div className={`mb-4 p-4 rounded-lg border ${ytResult.error ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
          {ytResult.error ? (
            <div className="text-sm font-medium">YouTube sync failed: {ytResult.error}</div>
          ) : (
            <>
              <div className="text-sm font-medium">
                YouTube sync: fetched {ytResult.videos_fetched} videos, matched {ytResult.matched}, updated {ytResult.updated} exercises
                {ytResult.unmatched_count > 0 ? ` — ${ytResult.unmatched_count} unmatched` : ''}
              </div>
              {ytResult.unmatched_sample.length > 0 && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer font-medium">Unmatched exercises (sample)</summary>
                  <ul className="mt-1 list-disc list-inside space-y-0.5">
                    {ytResult.unmatched_sample.map((n, i) => (<li key={i}>{n}</li>))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}

      <div className="sticky top-0 z-10 bg-gray-50 pb-4 -mx-6 px-6 pt-2">
        <div className="flex items-center justify-end space-x-3">
          {selectedExercises.size > 0 && (
            <button
              onClick={() => setShowBulkActions(true)}
              className="flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
            >
              <Edit3 className="h-5 w-5 mr-2" />
              Bulk Actions ({selectedExercises.size})
            </button>
          )}
          <button
            onClick={findDuplicates}
            disabled={exercises.length === 0}
            className="flex items-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Target className="h-5 w-5 mr-2" />
            Find Duplicates
          </button>
          {(user?.role === 'admin' || user?.email === 'brian@bowtaifitness.com') && (
            <button
              onClick={handleSyncYouTube}
              disabled={ytSyncing}
              className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              title="Fetch videos from your YouTube channel and match to exercises by name"
            >
              {ytSyncing ? <RefreshCw className="h-5 w-5 mr-2 animate-spin" /> : <Youtube className="h-5 w-5 mr-2" />}
              {ytSyncing ? 'Syncing YouTube...' : 'Sync YouTube Videos'}
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Exercise
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="h-5 w-5 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            {selectedExercises.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{selectedExercises.size} selected</span>
                <button
                  onClick={() => setSelectedExercises(new Set())}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Filter className="h-5 w-5 text-gray-400" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                {categoryStats.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label} ({category.count})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="date-newest">Date Added (Newest)</option>
                <option value="date-oldest">Date Added (Oldest)</option>
                <option value="category-asc">Category (A-Z)</option>
                <option value="category-desc">Category (Z-A)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 space-x-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3x3 className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`flex items-center px-3 py-2 rounded-md transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-green-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">List</span>
              </button>
            </div>
          </div>
        </div>

        {/* Multi-select controls */}
        {filteredExercises.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={selectedExercises.size === filteredExercises.length && filteredExercises.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded mr-2"
              />
              <span className="text-sm text-gray-700">
                Select All ({filteredExercises.length} exercises)
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Exercise Grid or List */}
      <div className={viewMode === 'grid'
        ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
        : 'space-y-4'
      }>
        {filteredExercises.map((exercise) => (
          viewMode === 'grid' ? (
            // Grid View
            <div
              key={exercise.id}
              className={`bg-white rounded-xl shadow-sm border transition-all hover:shadow-md ${
                selectedExercises.has(exercise.id)
                  ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                  : 'border-gray-100'
              }`}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedExercises.has(exercise.id)}
                      onChange={() => handleExerciseSelect(exercise.id)}
                      className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded mt-1"
                    />
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-2">{exercise.name}</h3>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${
                        exercise.category === 'strength' ? 'bg-blue-100 text-blue-700' :
                        exercise.category === 'mobility' ? 'bg-green-100 text-green-700' :
                        exercise.category === 'power' ? 'bg-red-100 text-red-700' :
                        exercise.category === 'stability' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {exercise.category}
                      </span>
                    </div>
                  </div>

                  <div className="relative">
                    <button
                      onClick={(e) => handleDropdownToggle(exercise.id, e)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </button>

                    {activeDropdown === exercise.id && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                        <button
                          onClick={() => handleEdit(exercise)}
                          className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                          <Edit3 className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(exercise.id)}
                          className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Video Thumbnail */}
                {exercise.video_url && (
                  <div className="mb-4">
                    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                      <VideoThumbnail
                        videoUrl={exercise.video_url}
                        exerciseName={exercise.name}
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <div className="bg-white bg-opacity-90 rounded-full p-3 hover:bg-opacity-100 transition-all">
                          <Play className="h-6 w-6 text-gray-900" />
                        </div>
                      </div>
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                        Video
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-gray-600 text-sm mb-3 line-clamp-3">{exercise.description}</p>

                {exercise.equipment && exercise.equipment.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {exercise.equipment.map((eq) => (
                      <span
                        key={eq}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide ${
                          EQUIPMENT_BADGE_COLORS[eq] || 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {formatLabel(eq)}
                      </span>
                    ))}
                  </div>
                )}

                {exercise.tags && exercise.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {exercise.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${
                          TAG_COLORS[tag] || 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}
                      >
                        {formatLabel(tag)}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex space-x-2">
                  <button
                    onClick={() => handleEdit(exercise)}
                    className="flex-1 flex items-center justify-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    <Edit3 className="h-4 w-4 mr-1" />
                    Edit
                  </button>
                  {exercise.video_url && (
                    <button
                      onClick={() => window.open(exercise.video_url, '_blank')}
                      className="flex items-center justify-center px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // List View
            <div
              key={exercise.id}
              className={`bg-white rounded-lg shadow-sm border transition-all hover:shadow-md ${
                selectedExercises.has(exercise.id)
                  ? 'border-green-500 ring-2 ring-green-200 bg-green-50'
                  : 'border-gray-100'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedExercises.has(exercise.id)}
                    onChange={() => handleExerciseSelect(exercise.id)}
                    className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                  />

                  {/* Video Thumbnail - Small */}
                  {exercise.video_url && (
                    <div className="flex-shrink-0 w-24 h-16 bg-gray-900 rounded-lg overflow-hidden relative">
                      <VideoThumbnail
                        videoUrl={exercise.video_url}
                        exerciseName={exercise.name}
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                        <Play className="h-6 w-6 text-white" />
                      </div>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-1">
                      <h3 className="font-semibold text-gray-900 truncate">{exercise.name}</h3>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize flex-shrink-0 ${
                        exercise.category === 'strength' ? 'bg-blue-100 text-blue-700' :
                        exercise.category === 'mobility' ? 'bg-green-100 text-green-700' :
                        exercise.category === 'power' ? 'bg-red-100 text-red-700' :
                        exercise.category === 'stability' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {exercise.category}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm line-clamp-1">{exercise.description}</p>
                    {exercise.equipment && exercise.equipment.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {exercise.equipment.map((eq) => (
                          <span
                            key={eq}
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold uppercase tracking-wide ${
                              EQUIPMENT_BADGE_COLORS[eq] || 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {formatLabel(eq)}
                          </span>
                        ))}
                      </div>
                    )}
                    {exercise.tags && exercise.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {exercise.tags.map((tag) => (
                          <span
                            key={tag}
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-medium capitalize ${
                              TAG_COLORS[tag] || 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {formatLabel(tag)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <button
                      onClick={() => handleEdit(exercise)}
                      className="flex items-center px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                      <Edit3 className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    {exercise.video_url && (
                      <button
                        onClick={() => window.open(exercise.video_url, '_blank')}
                        className="flex items-center justify-center p-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                    <div className="relative">
                      <button
                        onClick={(e) => handleDropdownToggle(exercise.id, e)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>

                      {activeDropdown === exercise.id && (
                        <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                          <button
                            onClick={() => handleEdit(exercise)}
                            className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            <Edit3 className="h-4 w-4 mr-2" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(exercise.id)}
                            className="w-full flex items-center px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        ))}
      </div>

      {/* Empty State */}
      {filteredExercises.length === 0 && !loading && (
        <div className="text-center py-12">
          <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm || selectedCategory !== 'all' ? 'No exercises found' : 'No exercises yet'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first exercise to the library.'
            }
          </p>
          {(!searchTerm && selectedCategory === 'all') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Exercise
            </button>
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && <ExerciseModal />}
      {showBulkActions && <BulkActionsModal />}
      {showDuplicateManager && <DuplicateManagerModal />}
    </div>
  );
};

export default ExerciseLibrary;