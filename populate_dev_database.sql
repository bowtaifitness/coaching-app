-- ====================================================================
-- POPULATE DEV DATABASE WITH TEST DATA
-- Run this in Supabase SQL Editor for project: eeujuhdonnweoasstohm
-- ====================================================================

-- First, check if Brian's auth.users account exists and get the ID
DO $$
DECLARE
  brian_user_id uuid;
  brian_exists boolean;
BEGIN
  -- Check if Brian exists in auth.users
  SELECT id INTO brian_user_id FROM auth.users WHERE email = 'brian@bowtaifitness.com';

  IF brian_user_id IS NULL THEN
    RAISE NOTICE 'Brian does not exist in auth.users. Please sign up first at the login page.';
  ELSE
    RAISE NOTICE 'Brian user ID: %', brian_user_id;

    -- Create or update Brian's profile
    INSERT INTO profiles (id, email, role, first_name, last_name)
    VALUES (brian_user_id, 'brian@bowtaifitness.com', 'coach', 'Brian', 'Tai')
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name;

    RAISE NOTICE 'Brian profile created/updated successfully';
  END IF;
END $$;

-- Create test client users (these will only exist in profiles, not auth.users)
-- In a real scenario, these would be created when users sign up
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  confirmation_token
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    'a1111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'test.client1@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a2222222-2222-2222-2222-222222222222',
    'authenticated',
    'authenticated',
    'test.client2@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'a3333333-3333-3333-3333-333333333333',
    'authenticated',
    'authenticated',
    'test.client3@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- Create client profiles
INSERT INTO profiles (id, email, role, first_name, last_name)
VALUES
  ('a1111111-1111-1111-1111-111111111111', 'test.client1@example.com', 'client', 'John', 'Doe'),
  ('a2222222-2222-2222-2222-222222222222', 'test.client2@example.com', 'client', 'Jane', 'Smith'),
  ('a3333333-3333-3333-3333-333333333333', 'test.client3@example.com', 'client', 'Bob', 'Johnson')
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    role = EXCLUDED.role,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name;

-- Assign all test clients to Brian
DO $$
DECLARE
  brian_id uuid;
BEGIN
  SELECT id INTO brian_id FROM profiles WHERE email = 'brian@bowtaifitness.com';

  IF brian_id IS NOT NULL THEN
    INSERT INTO coach_client_assignments (coach_id, client_id, active)
    VALUES
      (brian_id, 'a1111111-1111-1111-1111-111111111111', true),
      (brian_id, 'a2222222-2222-2222-2222-222222222222', true),
      (brian_id, 'a3333333-3333-3333-3333-333333333333', true)
    ON CONFLICT (coach_id, client_id) DO UPDATE
    SET active = EXCLUDED.active;

    RAISE NOTICE 'Test clients assigned to Brian successfully';
  ELSE
    RAISE NOTICE 'Brian profile not found. Cannot assign clients.';
  END IF;
END $$;

-- Verify the data
SELECT
  p.email,
  p.role,
  p.first_name,
  p.last_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM coach_client_assignments WHERE client_id = p.id) THEN 'Assigned'
    ELSE 'Not Assigned'
  END as assignment_status
FROM profiles p
ORDER BY p.role DESC, p.email;

-- Show coach-client relationships
SELECT
  coach.email as coach_email,
  client.email as client_email,
  cca.active
FROM coach_client_assignments cca
JOIN profiles coach ON coach.id = cca.coach_id
JOIN profiles client ON client.id = cca.client_id
ORDER BY coach.email, client.email;

RAISE NOTICE 'Dev database populated successfully!';
