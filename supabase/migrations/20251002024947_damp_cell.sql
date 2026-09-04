/*
  # Recreate Sample Workouts for Client Testing

  1. New Data
    - Sample workouts for client testing
    - Various dates and completion statuses
    - Includes workout exercises for proper testing

  2. Security
    - Uses existing RLS policies
    - Ensures proper coach-client relationships
*/

-- First, let's check if we have the necessary data (coach and client)
DO $$
DECLARE
    client_id uuid;
    coach_id uuid;
    exercise_ids uuid[];
    workout_id uuid;
    template_id uuid;
BEGIN
    -- Find a client user (the one having issues)
    SELECT id INTO client_id 
    FROM profiles 
    WHERE role = 'client' 
    LIMIT 1;
    
    -- Find a coach user
    SELECT id INTO coach_id 
    FROM profiles 
    WHERE role IN ('coach', 'admin') 
    LIMIT 1;
    
    -- Get some exercise IDs
    SELECT ARRAY(SELECT id FROM exercises LIMIT 5) INTO exercise_ids;
    
    IF client_id IS NOT NULL AND coach_id IS NOT NULL AND array_length(exercise_ids, 1) > 0 THEN
        -- Create a sample workout template first
        INSERT INTO workout_templates (id, title, description, created_by)
        VALUES (
            gen_random_uuid(),
            'Full Body Strength',
            'Complete full body strength training session',
            coach_id
        )
        RETURNING id INTO template_id;
        
        -- Add exercises to the template
        INSERT INTO template_exercises (template_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            template_id,
            exercise_ids[i],
            3,
            CASE 
                WHEN i <= 2 THEN 12
                WHEN i <= 4 THEN 10
                ELSE 8
            END,
            CASE 
                WHEN i <= 2 THEN 25
                WHEN i <= 4 THEN 35
                ELSE 45
            END,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 5)) AS i;
        
        -- Create sample workouts for the past week and upcoming week
        
        -- Workout 1: Yesterday (completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Upper Body Strength',
            'Focus on chest, shoulders, and arms',
            coach_id,
            client_id,
            (CURRENT_DATE - INTERVAL '1 day')::date,
            true,
            'Great form today! Keep up the excellent work.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to yesterday's workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index, notes)
        SELECT 
            workout_id,
            exercise_ids[i],
            3,
            12,
            25,
            i - 1,
            CASE 
                WHEN i = 1 THEN '{"completed": true, "actualSets": 3, "actualReps": 12, "actualWeight": 25, "difficulty": "medium", "savedAt": "' || (NOW() - INTERVAL '1 day')::text || '"}'
                WHEN i = 2 THEN '{"completed": true, "actualSets": 3, "actualReps": 10, "actualWeight": 25, "difficulty": "easy", "savedAt": "' || (NOW() - INTERVAL '1 day')::text || '"}'
                ELSE '{"completed": true, "actualSets": 3, "actualReps": 12, "actualWeight": 25, "savedAt": "' || (NOW() - INTERVAL '1 day')::text || '"}'
            END
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 3)) AS i;
        
        -- Workout 2: Today (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Lower Body Power',
            'Explosive leg movements and core stability',
            coach_id,
            client_id,
            CURRENT_DATE,
            false,
            'Focus on explosive movement and proper landing mechanics.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to today's workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            4,
            8,
            35,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 4)) AS i;
        
        -- Workout 3: Tomorrow (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Mobility & Recovery',
            'Active recovery with mobility work',
            coach_id,
            client_id,
            (CURRENT_DATE + INTERVAL '1 day')::date,
            false,
            'Take your time with each movement. Focus on range of motion.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to tomorrow's workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, duration, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            2,
            15,
            45,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 3)) AS i;
        
        -- Workout 4: Day after tomorrow (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Full Body Circuit',
            'High intensity circuit training',
            coach_id,
            client_id,
            (CURRENT_DATE + INTERVAL '2 days')::date,
            false,
            'Push yourself but maintain good form throughout.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to circuit workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            3,
            CASE 
                WHEN i <= 2 THEN 15
                ELSE 12
            END,
            CASE 
                WHEN i <= 2 THEN 20
                ELSE 30
            END,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 5)) AS i;
        
        -- Workout 5: Next week (not completed)
        INSERT INTO workouts (id, title, description, coach_id, client_id, scheduled_date, completed, notes, template_id)
        VALUES (
            gen_random_uuid(),
            'Strength Assessment',
            'Test your progress with heavier weights',
            coach_id,
            client_id,
            (CURRENT_DATE + INTERVAL '5 days')::date,
            false,
            'This is a strength test. Use proper form and don''t rush.',
            template_id
        )
        RETURNING id INTO workout_id;
        
        -- Add exercises to assessment workout
        INSERT INTO workout_exercises (workout_id, exercise_id, sets, reps, weight, order_index)
        SELECT 
            workout_id,
            exercise_ids[i],
            5,
            5,
            50,
            i - 1
        FROM generate_series(1, LEAST(array_length(exercise_ids, 1), 3)) AS i;
        
        RAISE NOTICE 'Successfully created sample workouts for client % with coach %', client_id, coach_id;
    ELSE
        RAISE NOTICE 'Missing required data: client_id=%, coach_id=%, exercises=%', client_id, coach_id, array_length(exercise_ids, 1);
    END IF;
END $$;