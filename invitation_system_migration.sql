/*
  # Create Invitations System for Trainer/Coach Signup

  1. New Tables
    - `invitations`
      - `id` (uuid, primary key)
      - `email` (text, email to send invitation to)
      - `role` (text, either 'trainer' or 'coach')
      - `token` (text, unique token for validation)
      - `invited_by` (uuid, admin who sent the invite)
      - `expires_at` (timestamptz, when invitation expires)
      - `used_at` (timestamptz, when invitation was used)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `invitations` table
    - Only admins can create and view invitations
    - Anyone can validate a token (needed for signup)

  3. Functions
    - Function to generate unique invitation token
    - Function to validate invitation token
    - Function to mark invitation as used
*/

-- Create invitations table
CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('trainer', 'coach')),
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  invited_by uuid REFERENCES profiles(id) NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_used_at ON invitations(used_at);

-- Enable RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all invitations
CREATE POLICY "Admins can view all invitations"
  ON invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can update invitations (e.g., to resend)
CREATE POLICY "Admins can update invitations"
  ON invitations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Policy: Admins can delete invitations
CREATE POLICY "Admins can delete invitations"
  ON invitations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to validate invitation token
CREATE OR REPLACE FUNCTION public.validate_invitation_token(
  p_token text,
  p_email text,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation invitations;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND email = p_email
    AND role = p_role
    AND used_at IS NULL
    AND expires_at > now();

  -- Check if invitation exists and is valid
  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'Invalid, expired, or already used invitation token'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invitation_id', v_invitation.id,
    'role', v_invitation.role
  );
END;
$$;

-- Function to mark invitation as used
CREATE OR REPLACE FUNCTION public.mark_invitation_used(
  p_token text,
  p_email text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE invitations
  SET used_at = now()
  WHERE token = p_token
    AND email = p_email
    AND used_at IS NULL;

  RETURN FOUND;
END;
$$;
