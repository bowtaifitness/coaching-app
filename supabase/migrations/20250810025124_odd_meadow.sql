/*
  # Create storage bucket for swing videos

  1. Storage Setup
    - Create 'swing-videos' bucket for video file storage
    - Set appropriate permissions for authenticated users
    - Enable public access for video playback

  2. Security
    - Allow authenticated users to upload videos
    - Allow users to view videos they have access to
    - Restrict deletion to file owners
*/

-- Create the swing-videos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('swing-videos', 'swing-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Users can upload swing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'swing-videos');

-- Allow users to view videos they have access to
CREATE POLICY "Users can view swing videos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'swing-videos');

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own swing videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'swing-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow users to update their own videos
CREATE POLICY "Users can update own swing videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'swing-videos' AND auth.uid()::text = (storage.foldername(name))[1]);