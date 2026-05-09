CREATE OR REPLACE FUNCTION public.create_rsvp(_event_id uuid)
 RETURNS rsvps
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _user uuid := auth.uid();
  _event public.events%ROWTYPE;
  _going_count int;
  _next_pos int;
  _existing public.rsvps%ROWTYPE;
  _has_existing boolean := false;
  _new public.rsvps%ROWTYPE;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

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

  SELECT * INTO _existing FROM public.rsvps
    WHERE event_id = _event_id AND user_id = _user;
  _has_existing := FOUND;

  IF _has_existing AND _existing.status IN ('going', 'waitlisted') THEN
    RETURN _existing;
  END IF;

  SELECT count(*) INTO _going_count FROM public.rsvps
    WHERE event_id = _event_id AND status = 'going';

  IF _event.capacity IS NULL OR _going_count < _event.capacity THEN
    IF _has_existing THEN
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
    IF _has_existing THEN
      UPDATE public.rsvps SET status = 'waitlisted', waitlist_position = _next_pos
        WHERE id = _existing.id RETURNING * INTO _new;
    ELSE
      INSERT INTO public.rsvps (event_id, user_id, status, waitlist_position)
        VALUES (_event_id, _user, 'waitlisted', _next_pos) RETURNING * INTO _new;
    END IF;
  END IF;

  RETURN _new;
END;
$function$;