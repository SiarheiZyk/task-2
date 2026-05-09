CREATE OR REPLACE FUNCTION public.check_in_ticket(_code uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _ticket public.tickets%ROWTYPE;
  _rsvp public.rsvps%ROWTYPE;
  _event public.events%ROWTYPE;
  _name text;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _ticket FROM public.tickets WHERE code = _code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;

  SELECT * INTO _rsvp FROM public.rsvps WHERE id = _ticket.rsvp_id;
  SELECT * INTO _event FROM public.events WHERE id = _rsvp.event_id;

  IF NOT public.is_host_member(_event.host_id, _user) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _rsvp.status <> 'going' THEN
    RETURN jsonb_build_object('status','not_going');
  END IF;

  SELECT name INTO _name FROM public.profiles WHERE id = _rsvp.user_id;

  IF _ticket.checked_in_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'status','already',
      'name', _name,
      'ticket_id', _ticket.id,
      'event_id', _event.id,
      'checked_in_at', _ticket.checked_in_at
    );
  END IF;

  UPDATE public.tickets
    SET checked_in_at = now(), checked_in_by = _user
    WHERE id = _ticket.id
    RETURNING checked_in_at INTO _ticket.checked_in_at;

  RETURN jsonb_build_object(
    'status','ok',
    'name', _name,
    'ticket_id', _ticket.id,
    'event_id', _event.id,
    'checked_in_at', _ticket.checked_in_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.undo_check_in(_ticket_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _ticket public.tickets%ROWTYPE;
  _rsvp public.rsvps%ROWTYPE;
  _event public.events%ROWTYPE;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _ticket FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  SELECT * INTO _rsvp FROM public.rsvps WHERE id = _ticket.rsvp_id;
  SELECT * INTO _event FROM public.events WHERE id = _rsvp.event_id;

  IF NOT public.is_host_member(_event.host_id, _user) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.tickets SET checked_in_at = NULL, checked_in_by = NULL
    WHERE id = _ticket.id;
END;
$$;