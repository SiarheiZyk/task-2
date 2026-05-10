-- Remove any accidental duplicates so the unique constraint can be added.
DELETE FROM public.feedback a
USING public.feedback b
WHERE a.ctid < b.ctid
  AND a.event_id = b.event_id
  AND a.user_id  = b.user_id;

ALTER TABLE public.feedback
  ADD CONSTRAINT feedback_event_user_unique UNIQUE (event_id, user_id);

DROP POLICY IF EXISTS "Users create own feedback" ON public.feedback;

CREATE POLICY "Going attendees submit feedback after event ends"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.rsvps r
    JOIN public.events e ON e.id = r.event_id
    WHERE r.event_id = feedback.event_id
      AND r.user_id = auth.uid()
      AND r.status = 'going'
      AND COALESCE(e.end_at, e.start_at) < now()
  )
);