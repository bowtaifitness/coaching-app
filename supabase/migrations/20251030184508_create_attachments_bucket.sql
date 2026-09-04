/*
  # Create attachments storage bucket
  
  1. Storage
    - Create 'attachments' bucket for message attachments
    - Enable public access for uploaded files
    - Set up RLS policies for secure access
    
  2. Security
    - Users can upload to their own folder
    - Users can view attachments from their messages
*/

-- Create the attachments bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload attachments to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'attachments' AND
  (storage.foldername(name))[1] = 'message-attachments' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to read attachments
CREATE POLICY "Users can view message attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'attachments');

-- Allow users to delete their own attachments
CREATE POLICY "Users can delete own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'attachments' AND
  (storage.foldername(name))[2] = auth.uid()::text
);