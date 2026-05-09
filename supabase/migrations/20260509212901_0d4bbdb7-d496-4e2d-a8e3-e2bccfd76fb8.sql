CREATE OR REPLACE FUNCTION public.event_going_count(_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::int FROM public.rsvps
  WHERE event_id = _event_id AND status = 'going';
$$;