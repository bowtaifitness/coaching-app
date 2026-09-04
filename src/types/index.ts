export interface User {
  id: string;
  email: string;
  role: 'coach' | 'client' | 'admin';
  firstName: string;
  lastName: string;
  avatar?: string;
  createdAt: string;
  trialEndsAt?: string;
  isTrialActive?: boolean;
  hasActiveSubscription?: boolean;
  subscriptionTier?: 'basic' | 'premium';
}

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'mobility' | 'power' | 'stability' | 'conditioning';
  description: string;
  videoUrl?: string;
  instructions: string[];
}

export interface Workout {
  id: string;
  title: string;
  description: string;
  coachId: string;
  clientId: string;
  scheduledDate: string;
  exercises: WorkoutExercise[];
  completed: boolean;
  notes?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  notes?: string;
}

export interface PerformanceMetric {
  id: string;
  clientId: string;
  date: string;
  // Gym metrics
  pushups?: number;
  situps?: number;
  pullups?: number;
  squatMax?: number;
  benchMax?: number;
  deadliftMax?: number;
  mileTime?: number;
  plankTime?: number;
  bodyWeight?: number;
  bodyFatPercentage?: number;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  read: boolean;
}
