CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user uuid := auth.uid();
  _inv public.invitations%ROWTYPE;
BEGIN
  IF _user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO _inv FROM public.invitations WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status','invalid');
  END IF;

  IF _inv.used_by IS NOT NULL THEN
    RETURN jsonb_build_object('status','used');
  END IF;

  IF _inv.expires_at < now() THEN
    RETURN jsonb_build_object('status','expired');
  END IF;

  INSERT INTO public.host_members (host_id, user_id, role)
    VALUES (_inv.host_id, _user, _inv.role)
    ON CONFLICT (host_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.invitations SET used_by = _user WHERE id = _inv.id;

  RETURN jsonb_build_object('status','ok','host_id', _inv.host_id);
END;
$$;

-- Ensure host_members has a unique constraint for the upsert above
DO $$ BEGIN
  ALTER TABLE public.host_members ADD CONSTRAINT host_members_host_user_unique UNIQUE (host_id, user_id);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;