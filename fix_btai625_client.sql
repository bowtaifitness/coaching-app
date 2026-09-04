-- ====================================================================
-- FIX btai625@gmail.com CLIENT IN DEV DATABASE
-- Run this in Supabase SQL Editor for project: eeujuhdonnweoasstohm
-- ====================================================================

-- Get the user ID for btai625@gmail.com
DO $$
DECLARE
  client_user_id uuid;
  brian_coach_id uuid;
BEGIN
  -- Get the auth user ID for btai625@gmail.com
  SELECT id INTO client_user_id FROM auth.users WHERE email = 'btai625@gmail.com';

  -- Get Brian's coach ID
  SELECT id INTO brian_coach_id FROM profiles WHERE email = 'brian@bowtaifitness.com';

  IF client_user_id IS NULL THEN
    RAISE EXCEPTION 'User btai625@gmail.com not found in auth.users. Please sign up first.';
  END IF;

  IF brian_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach brian@bowtaifitness.com not found. Please ensure coach profile exists.';
  END IF;

  RAISE NOTICE 'Client user ID: %', client_user_id;
  RAISE NOTICE 'Coach ID: %', brian_coach_id;

  -- Create/update the profile for btai625@gmail.com
  INSERT INTO profiles (id, email, role, first_name, last_name)
  VALUES (client_user_id, 'btai625@gmail.com', 'client', 'Brian', 'Tai')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      role = EXCLUDED.role,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name;

  RAISE NOTICE 'Profile created/updated for btai625@gmail.com';

  -- Assign client to coach Brian
  INSERT INTO coach_client_assignments (coach_id, client_id, active)
  VALUES (brian_coach_id, client_user_id, true)
  ON CONFLICT (coach_id, client_id) DO UPDATE
  SET active = EXCLUDED.active;

  RAISE NOTICE 'Client assigned to coach successfully';

END $$;

-- Verify the assignment
SELECT
  coach.email as coach_email,
  coach.first_name || ' ' || coach.last_name as coach_name,
  client.email as client_email,
  client.first_name || ' ' || client.last_name as client_name,
  cca.active
FROM coach_client_assignments cca
JOIN profiles coach ON coach.id = cca.coach_id
JOIN profiles client ON client.id = cca.client_id
WHERE client.email = 'btai625@gmail.com';
