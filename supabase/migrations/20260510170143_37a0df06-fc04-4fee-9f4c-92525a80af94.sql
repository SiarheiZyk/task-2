DROP POLICY IF EXISTS "Authenticated users upload photos" ON public.gallery_photos;

CREATE POLICY "Going attendees upload photos after event ends"
ON public.gallery_photos
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = uploader_id
  AND EXISTS (
    SELECT 1
    FROM public.rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.event_id = gallery_photos.event_id
      AND r.user_id = auth.uid()
      AND r.status = 'going'
      AND COALESCE(e.end_at, e.start_at) < now()
  )
);