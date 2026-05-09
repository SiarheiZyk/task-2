
-- Atomic RSVP creation
CREATE OR REPLACE FUNCTION public.create_rsvp(_event_id uuid)
RETURNS public.rsvps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _event public.events%ROWTYPE;
  _going_count int;
  _next_pos int;
  _existing public.rsvps%ROWTYPE;
  _new public.rsvps%ROWTYPE;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the event row to serialize concurrent RSVPs
  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;

  IF _event.status <> 'published' THEN
    RAISE EXCEPTION 'Event is not open for RSVPs';
  END IF;

  IF COALESCE(_event.end_at, _event.start_at) < now() THEN
    RAISE EXCEPTION 'Event has ended';
  END IF;

  -- Reactivate cancelled RSVP if any
  SELECT * INTO _existing FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user;

  IF FOUND AND _existing.status IN ('going', 'waitlisted') THEN
    RETURN _existing;
  END IF;

  SELECT count(*) INTO _going_count FROM public.rsvps
    WHERE event_id = _event_id AND status = 'going';

  IF _event.capacity IS NULL OR _going_count < _event.capacity THEN
    IF FOUND THEN
      UPDATE public.rsvps SET status = 'going', waitlist_position = NULL
        WHERE id = _existing.id RETURNING * INTO _new;
    ELSE
      INSERT INTO public.rsvps (event_id, user_id, status)
        VALUES (_event_id, _user, 'going') RETURNING * INTO _new;
    END IF;
    INSERT INTO public.tickets (rsvp_id) VALUES (_new.id)
      ON CONFLICT DO NOTHING;
  ELSE
    SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO _next_pos FROM public.rsvps
      WHERE event_id = _event_id AND status = 'waitlisted';
    IF FOUND THEN
      UPDATE public.rsvps SET status = 'waitlisted', waitlist_position = _next_pos
        WHERE id = _existing.id RETURNING * INTO _new;
    ELSE
      INSERT INTO public.rsvps (event_id, user_id, status, waitlist_position)
        VALUES (_event_id, _user, 'waitlisted', _next_pos) RETURNING * INTO _new;
    END IF;
  END IF;

  RETURN _new;
END;
$$;

-- Atomic RSVP cancellation with waitlist promotion
CREATE OR REPLACE FUNCTION public.cancel_rsvp(_rsvp_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _rsvp public.rsvps%ROWTYPE;
  _promoted public.rsvps%ROWTYPE;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _rsvp FROM public.rsvps WHERE id = _rsvp_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'RSVP not found';
  END IF;

  IF _rsvp.user_id <> _user THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Lock event so we can promote safely
  PERFORM 1 FROM public.events WHERE id = _rsvp.event_id FOR UPDATE;

  DELETE FROM public.tickets WHERE rsvp_id = _rsvp.id;

  IF _rsvp.status = 'going' THEN
    -- Remove the cancelled RSVP entirely so unique(event,user) is reusable
    DELETE FROM public.rsvps WHERE id = _rsvp.id;

    -- Promote next waitlister
    SELECT * INTO _promoted FROM public.rsvps
      WHERE event_id = _rsvp.event_id AND status = 'waitlisted'
      ORDER BY waitlist_position ASC NULLS LAST, created_at ASC
      LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.rsvps SET status = 'going', waitlist_position = NULL
        WHERE id = _promoted.id;
      INSERT INTO public.tickets (rsvp_id) VALUES (_promoted.id)
        ON CONFLICT DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.rsvps WHERE id = _rsvp.id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_rsvp(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_rsvp(uuid) TO authenticated;

-- Realtime
ALTER TABLE public.rsvps REPLICA IDENTITY FULL;
ALTER TABLE public.tickets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rsvps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
