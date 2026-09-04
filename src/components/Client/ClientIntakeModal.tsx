import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ClientIntakeModalProps {
  userId: string;
  onComplete: () => void;
  onClose?: () => void;
  embedded?: boolean;
}

const ClientIntakeModal: React.FC<ClientIntakeModalProps> = ({ userId, onComplete, onClose, embedded }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingFormId, setExistingFormId] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    age: '',
    gender: '',
    height: '',
    weight: '',
    fitness_experience: '',
    primary_fitness_goal: '',
    activity_frequency: '',
    biggest_strength: '',
    biggest_weakness: '',
    fitness_notes: '',
    years_strength_training: '',
    injury_history: '',
    training_goal: '',
    workout_frequency: '',
    training_notes: '',
  });

  useEffect(() => {
    loadExistingForm();
  }, [userId]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [step]);

  const loadExistingForm = async () => {
    try {
      setInitialLoading(true);
      const { data, error } = await supabase
        .from('client_intake_forms')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingFormId(data.id);
        setFormData({
          age: data.age?.toString() || '',
          gender: data.gender || '',
          height: data.height || '',
          weight: data.weight || '',
          fitness_experience: data.fitness_experience?.toString() || data.years_playing_golf?.toString() || '',
          primary_fitness_goal: data.primary_fitness_goal || data.primary_golf_goal || '',
          activity_frequency: data.activity_frequency || data.play_frequency || '',
          biggest_strength: data.biggest_strength || '',
          biggest_weakness: data.biggest_weakness || '',
          fitness_notes: data.fitness_notes || data.golf_notes || '',
          years_strength_training: data.years_strength_training?.toString() || '',
          injury_history: data.injury_history || '',
          training_goal: data.training_goal || '',
          workout_frequency: data.workout_frequency || '',
          training_notes: data.training_notes || '',
        });
      }
    } catch (err) {
      console.error('Error loading existing form:', err);
    } finally {
      setInitialLoading(false);
    }
  };

  const totalSteps = 3;

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError('');
  };

  const validateStep = () => {
    if (step === 1) {
      if (!formData.age || !formData.gender || !formData.height || !formData.weight) {
        setError('Please fill in all fields');
        return false;
      }
      const age = parseInt(formData.age);
      if (age < 5 || age > 120) {
        setError('Please enter a valid age');
        return false;
      }
    }
    if (step === 2) {
      if (!formData.fitness_experience || !formData.primary_fitness_goal ||
          !formData.activity_frequency || !formData.biggest_strength || !formData.biggest_weakness) {
        setError('Please fill in all required fields');
        return false;
      }
      const years = parseInt(formData.fitness_experience);
      if (years < 0 || years > 100) {
        setError('Please enter valid years of experience');
        return false;
      }
    }
    if (step === 3) {
      if (!formData.years_strength_training || !formData.training_goal ||
          !formData.workout_frequency) {
        setError('Please fill in all required fields');
        return false;
      }
      const years = parseInt(formData.years_strength_training);
      if (years < 0 || years > 100) {
        setError('Please enter valid years of experience');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
    setError('');
  };

  const ensureProfileExists = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) return true;

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!validateStep()) return;

    setLoading(true);
    setError('');

    try {
      // For brand-new users, the profile row may not be committed to the
      // database yet (it's created asynchronously after signup). The intake
      // form has a foreign key to profiles(id), so the insert will fail with
      // a constraint violation if the profile doesn't exist. Retry briefly.
      const profileReady = await ensureProfileExists();
      if (!profileReady) {
        throw new Error('Your account is still being set up. Please wait a moment and try again.');
      }

      const formPayload = {
        user_id: userId,
        age: parseInt(formData.age),
        gender: formData.gender,
        height: formData.height,
        weight: formData.weight,
        fitness_experience: parseInt(formData.fitness_experience),
        primary_fitness_goal: formData.primary_fitness_goal,
        activity_frequency: formData.activity_frequency,
        biggest_strength: formData.biggest_strength,
        biggest_weakness: formData.biggest_weakness,
        fitness_notes: formData.fitness_notes || null,
        years_strength_training: parseInt(formData.years_strength_training),
        injury_history: formData.injury_history || null,
        training_goal: formData.training_goal,
        workout_frequency: formData.workout_frequency,
        equipment_access: null,
        training_notes: formData.training_notes || null,
      };

      let submitError;

      if (existingFormId) {
        const { error } = await supabase
          .from('client_intake_forms')
          .update(formPayload)
          .eq('id', existingFormId);
        submitError = error;
      } else {
        const { data, error } = await supabase
          .from('client_intake_forms')
          .upsert(formPayload, { onConflict: 'user_id' })
          .select('id')
          .single();
        submitError = error;
        if (!error && !data) {
          throw new Error('Unable to save form. Please sign out and sign back in, then try again.');
        }
      }

      if (submitError) throw submitError;

      const { data: verification } = await supabase
        .from('client_intake_forms')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (!verification) {
        throw new Error('Form data could not be saved. Please try again.');
      }

      await onComplete();
    } catch (err: any) {
      console.error('Error submitting intake form:', err);
      const detail = err?.message || err?.details || '';
      setError(`Failed to submit form. ${detail ? detail : 'Please try again.'}`);
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4`}>
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-8 text-center">
          <div className="animate-spin h-8 w-8 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embedded ? 'absolute' : 'fixed'} inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[60] modal-overlay`}>
      <div className="modal-panel bg-white rounded-t-2xl sm:rounded-lg shadow-xl max-w-2xl w-full min-h-[100dvh] sm:min-h-0 max-h-[100dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header - pinned via flex-shrink-0, never scrolls */}
        <div
          className="flex-shrink-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-2xl sm:rounded-t-lg"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
        >
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {existingFormId ? 'Complete Your Intake Form' : 'Welcome to Bowtai Fitness!'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {existingFormId
                ? 'Please complete all required fields to continue'
                : 'Help us get to know you better'}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Step {step} of {totalSteps}
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close intake form"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        {/* Progress bar - locked */}
        <div className="flex-shrink-0 px-6 pt-4">
          <div className="flex space-x-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full ${
                  s <= step ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Scrollable form content */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto px-6 pt-6 pb-40"
          style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8rem)' }}
        >
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.age}
                  onChange={(e) => handleInputChange('age', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter your age"
                  min="5"
                  max="120"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height *
                </label>
                <input
                  type="text"
                  value={formData.height}
                  onChange={(e) => handleInputChange('height', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 5'10&quot; or 178 cm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight *
                </label>
                <input
                  type="text"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., 180 lbs or 82 kg"
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Fitness Background</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years of Fitness Experience *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.fitness_experience}
                  onChange={(e) => handleInputChange('fitness_experience', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Number of years (0 if beginner)"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Fitness Goal *
                </label>
                <select
                  value={formData.primary_fitness_goal}
                  onChange={(e) => handleInputChange('primary_fitness_goal', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select your primary goal</option>
                  <option value="Build strength">Build strength</option>
                  <option value="Lose weight">Lose weight</option>
                  <option value="Build muscle">Build muscle</option>
                  <option value="Improve endurance">Improve endurance</option>
                  <option value="Improve mobility">Improve mobility</option>
                  <option value="General fitness">General fitness</option>
                  <option value="Sport performance">Sport-specific performance</option>
                  <option value="Injury rehab">Injury rehabilitation</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How Often Are You Active? *
                </label>
                <select
                  value={formData.activity_frequency}
                  onChange={(e) => handleInputChange('activity_frequency', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select frequency</option>
                  <option value="Daily">Daily</option>
                  <option value="4-6 times per week">4-6 times per week</option>
                  <option value="2-3 times per week">2-3 times per week</option>
                  <option value="Once per week">Once per week</option>
                  <option value="Few times per month">Few times per month</option>
                  <option value="Rarely">Rarely / just starting</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biggest Strength *
                </label>
                <textarea
                  value={formData.biggest_strength}
                  onChange={(e) => handleInputChange('biggest_strength', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={2}
                  placeholder="What are you most confident in physically?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biggest Weakness *
                </label>
                <textarea
                  value={formData.biggest_weakness}
                  onChange={(e) => handleInputChange('biggest_weakness', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={2}
                  placeholder="What area needs the most work?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes
                </label>
                <textarea
                  value={formData.fitness_notes}
                  onChange={(e) => handleInputChange('fitness_notes', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={2}
                  placeholder="Any other information about your fitness background..."
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Training Information</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Years Experience Strength Training *
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formData.years_strength_training}
                  onChange={(e) => handleInputChange('years_strength_training', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Number of years (0 if beginner)"
                  min="0"
                  max="100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Injury History or Physical Limitations
                </label>
                <textarea
                  value={formData.injury_history}
                  onChange={(e) => handleInputChange('injury_history', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Optional: Let us know about any injuries or limitations..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Goal with Training *
                </label>
                <select
                  value={formData.training_goal}
                  onChange={(e) => handleInputChange('training_goal', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select your training goal</option>
                  <option value="Increase strength">Increase strength</option>
                  <option value="Build muscle">Build muscle</option>
                  <option value="Improve mobility">Improve mobility</option>
                  <option value="Injury prevention">Injury prevention</option>
                  <option value="Increase power">Increase power</option>
                  <option value="General fitness">General fitness</option>
                  <option value="Weight loss">Weight loss</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  How many days per week do you workout? *
                </label>
                <select
                  value={formData.workout_frequency}
                  onChange={(e) => handleInputChange('workout_frequency', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value="">Select frequency</option>
                  <option value="0">0</option>
                  <option value="1-2">1-2</option>
                  <option value="3-4">3-4</option>
                  <option value="5+">5+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Training Notes
                </label>
                <textarea
                  value={formData.training_notes}
                  onChange={(e) => handleInputChange('training_notes', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={2}
                  placeholder="Any other information about your training..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Navigation buttons - pinned via flex-shrink-0, never scrolls */}
        <div className="flex-shrink-0 bg-gray-50 px-6 py-4 flex items-center justify-between border-t" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1rem)' }}>
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              step === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Back
          </button>

          {step < totalSteps ? (
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Complete'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClientIntakeModal;
