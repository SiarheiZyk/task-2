-- Public read of feedback for public published events
DROP POLICY IF EXISTS "Public reads feedback for public events" ON public.feedback;
CREATE POLICY "Public reads feedback for public events"
ON public.feedback
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = feedback.event_id
      AND e.status = 'published'
      AND e.visibility = 'public'
  )
);

-- Storage policies for gallery uploads under event-assets/gallery/*
DROP POLICY IF EXISTS "Authenticated users upload gallery photos" ON storage.objects;
CREATE POLICY "Authenticated users upload gallery photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-assets'
  AND (storage.foldername(name))[1] = 'gallery'
);

DROP POLICY IF EXISTS "Uploaders update own gallery photos" ON storage.objects;
CREATE POLICY "Uploaders update own gallery photos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-assets'
  AND (storage.foldername(name))[1] = 'gallery'
  AND owner = auth.uid()
);

DROP POLICY IF EXISTS "Uploaders delete own gallery photos" ON storage.objects;
CREATE POLICY "Uploaders delete own gallery photos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-assets'
  AND (storage.foldername(name))[1] = 'gallery'
  AND owner = auth.uid()
);