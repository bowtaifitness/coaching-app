/*
  # Create invitations table for trainer/coach signup

  1. Purpose
    The Admin → Invitations page was showing "Failed to load invitations" because
    the `invitations` table didn't exist in the database. This migration creates
    the table, indexes, RLS policies, and two helper functions used by the
    invitation sign-up flow.

  2. New Tables
    - `invitations`
      - `id` (uuid, primary key)
      - `email` (text)
      - `role` (text, 'trainer' or 'coach')
      - `token` (text, unique, auto-generated)
      - `invited_by` (uuid, FK → profiles.id)
      - `expires_at` (timestamptz, default now + 7 days)
      - `used_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  3. Security
    - RLS enabled.
    - Admins can SELECT / INSERT / UPDATE / DELETE invitations.
    - No anonymous access; token validation happens via the SECURITY DEFINER
      `validate_invitation_token` RPC which bypasses RLS for unauthenticated sign-up.

  4. Functions
    - `validate_invitation_token(token, email, role)` — validates a pending,
      unexpired invitation. Returns jsonb { valid, invitation_id, role } or
      { valid: false, error }.
    - `mark_invitation_used(token, email)` — stamps `used_at = now()`.
*/

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

CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_used_at ON invitations(used_at);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all invitations" ON invitations;
CREATE POLICY "Admins can view all invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can create invitations" ON invitations;
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update invitations" ON invitations;
CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete invitations" ON invitations;
CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

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
  SELECT * INTO v_invitation
  FROM invitations
  WHERE token = p_token
    AND email = p_email
    AND role = p_role
    AND used_at IS NULL
    AND expires_at > now();

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
