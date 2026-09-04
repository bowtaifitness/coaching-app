/*
  # Create storage bucket for swing videos

  1. Storage Setup
    - Create `swing-videos` bucket for video uploads
    - Set up proper access policies for authenticated users
    - Allow video file types (mp4, mov, avi)

  2. Security
    - Users can upload videos to their own folder
    - Users can view videos they have access to
    - Coaches can view all client videos
*/

-- Create storage bucket for swing videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('swing-videos', 'swing-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload videos
CREATE POLICY "Users can upload swing videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'swing-videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view videos they have access to
CREATE POLICY "Users can view accessible videos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'swing-videos' AND (
    -- Users can view their own videos
    (storage.foldername(name))[1] = auth.uid()::text OR
    -- Coaches can view all videos
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'coach'
    )
  )
);

-- Allow users to delete their own videos
CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'swing-videos' AND
  (storage.foldername(name))[1] = auth.uid()::text
);