export type Category =
  | 'Mobility/Reset'
  | 'Speed/Power'
  | 'Primary Strength'
  | 'Rotary/Core';

export type MovementPattern =
  | 'Hinge'
  | 'Squat'
  | 'Push'
  | 'Pull'
  | 'Rotation'
  | 'Anti-Rotation'
  | 'Locomotion';

export type Equipment =
  | 'Bodyweight'
  | 'Dumbbell'
  | 'Kettlebell'
  | 'Barbell'
  | 'Cable'
  | 'Bands';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  tags: string[];
  category: Category;
  movementPattern: MovementPattern;
  equipment: Equipment;
  muscleGroup: string;
  videoUrl: string;
}
