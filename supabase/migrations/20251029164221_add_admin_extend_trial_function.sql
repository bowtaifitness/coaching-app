/*
  # Add Admin Function to Extend Trials

  1. New Functions
    - `admin_extend_trial(user_id, days_to_add)` - Extends a client's trial by specified days
      - Only callable by admin users
      - Updates trial_extended_until column
      - Returns success/failure status
  
  2. Security
    - Function is SECURITY DEFINER (runs with creator privileges)
    - Checks if caller is admin before allowing extension
    - Validates user exists and is a client
*/

-- Create function to extend trial
CREATE OR REPLACE FUNCTION admin_extend_trial(
  target_user_id uuid,
  days_to_add integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  calling_user_email text;
  target_user_role text;
  current_trial_end timestamptz;
  new_trial_end timestamptz;
BEGIN
  -- Get calling user's email
  SELECT email INTO calling_user_email
  FROM auth.users
  WHERE id = auth.uid();

  -- Check if caller is admin
  IF calling_user_email != 'brian@bowtaifitness.com' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only administrators can extend trials'
    );
  END IF;

  -- Check if target user exists and is a client
  SELECT role INTO target_user_role
  FROM profiles
  WHERE id = target_user_id;

  IF target_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found'
    );
  END IF;

  IF target_user_role != 'client' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only extend trials for clients'
    );
  END IF;

  -- Calculate new trial end date
  -- Use existing trial_extended_until if set, otherwise use trial_ends_at
  SELECT 
    COALESCE(trial_extended_until, trial_ends_at, created_at + interval '14 days')
  INTO current_trial_end
  FROM profiles
  WHERE id = target_user_id;

  new_trial_end := current_trial_end + (days_to_add || ' days')::interval;

  -- Update trial extension
  UPDATE profiles
  SET trial_extended_until = new_trial_end
  WHERE id = target_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_trial_end', new_trial_end,
    'days_added', days_to_add
  );
END;
$$;

-- Grant execute permission to authenticated users (function itself checks admin status)
GRANT EXECUTE ON FUNCTION admin_extend_trial TO authenticated;