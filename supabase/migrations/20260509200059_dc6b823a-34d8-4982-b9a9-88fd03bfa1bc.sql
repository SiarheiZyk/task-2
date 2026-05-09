CREATE OR REPLACE FUNCTION public.export_event_rsvps(_event_id uuid)
RETURNS TABLE (
  name text,
  email text,
  status text,
  waitlist_position int,
  checked_in_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.is_event_host_member(_event_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  RETURN QUERY
    SELECT
      p.name,
      u.email::text,
      r.status::text,
      r.waitlist_position,
      t.checked_in_at,
      r.created_at
    FROM public.rsvps r
    LEFT JOIN public.profiles p ON p.id = r.user_id
    LEFT JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.tickets t ON t.rsvp_id = r.id
    WHERE r.event_id = _event_id
    ORDER BY r.created_at ASC;
END;
$$;