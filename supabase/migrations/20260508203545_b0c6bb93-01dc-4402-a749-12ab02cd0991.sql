
-- ============ ENUMS ============
CREATE TYPE public.host_member_role AS ENUM ('host', 'checker');
CREATE TYPE public.event_visibility AS ENUM ('public', 'unlisted');
CREATE TYPE public.event_status AS ENUM ('draft', 'published');
CREATE TYPE public.rsvp_status AS ENUM ('going', 'waitlisted', 'cancelled');
CREATE TYPE public.gallery_photo_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE public.report_target_type AS ENUM ('event', 'photo');
CREATE TYPE public.report_status AS ENUM ('open', 'hidden', 'dismissed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ HOSTS ============
CREATE TABLE public.hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  bio TEXT,
  contact_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ HOST MEMBERS ============
CREATE TABLE public.host_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.host_member_role NOT NULL DEFAULT 'host',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(host_id, user_id)
);
CREATE INDEX idx_host_members_user ON public.host_members(user_id);
CREATE INDEX idx_host_members_host ON public.host_members(host_id);

-- ============ EVENTS ============
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  venue TEXT,
  online_link TEXT,
  capacity INT,
  cover_image_url TEXT,
  visibility public.event_visibility NOT NULL DEFAULT 'public',
  status public.event_status NOT NULL DEFAULT 'draft',
  is_paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_host ON public.events(host_id);
CREATE INDEX idx_events_start ON public.events(start_at);

-- ============ RSVPS ============
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status public.rsvp_status NOT NULL DEFAULT 'going',
  waitlist_position INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
CREATE INDEX idx_rsvps_event ON public.rsvps(event_id);
CREATE INDEX idx_rsvps_user ON public.rsvps(user_id);

-- ============ TICKETS ============
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rsvp_id UUID NOT NULL UNIQUE REFERENCES public.rsvps(id) ON DELETE CASCADE,
  code UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  checked_in_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES public.profiles(id)
);

-- ============ GALLERY PHOTOS ============
CREATE TABLE public.gallery_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status public.gallery_photo_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_gallery_event ON public.gallery_photos(event_id);

-- ============ FEEDBACK ============
CREATE TABLE public.feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- ============ REPORTS ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type public.report_target_type NOT NULL,
  target_id UUID NOT NULL,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ INVITATIONS ============
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES public.hosts(id) ON DELETE CASCADE,
  role public.host_member_role NOT NULL DEFAULT 'host',
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by UUID REFERENCES public.profiles(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_events_updated_at
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AUTO-CREATE PROFILE ON SIGNUP ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ SECURITY DEFINER HELPERS (avoid RLS recursion) ============
CREATE OR REPLACE FUNCTION public.is_host_member(_host_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.host_members
    WHERE host_id = _host_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.hosts WHERE id = _host_id AND owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_event_host_member(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id
      AND public.is_host_member(e.host_id, _user_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_event(_event_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = _event_id
      AND (
        (e.status = 'published' AND e.visibility = 'public')
        OR public.is_host_member(e.host_id, _user_id)
      )
  );
$$;

-- ============ ENABLE RLS ============
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.host_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES POLICIES ============
CREATE POLICY "Profiles viewable by everyone" ON public.profiles
  FOR SELECT USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============ HOSTS POLICIES ============
CREATE POLICY "Hosts viewable by everyone" ON public.hosts
  FOR SELECT USING (true);
CREATE POLICY "Authenticated users create hosts" ON public.hosts
  FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owner updates host" ON public.hosts
  FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owner deletes host" ON public.hosts
  FOR DELETE USING (auth.uid() = owner_id);

-- ============ HOST MEMBERS POLICIES ============
CREATE POLICY "Members view own membership rows" ON public.host_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );
CREATE POLICY "Host owner manages members" ON public.host_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );
CREATE POLICY "Host owner updates members" ON public.host_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );
CREATE POLICY "Host owner deletes members" ON public.host_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );

-- ============ EVENTS POLICIES ============
CREATE POLICY "Public published events visible" ON public.events
  FOR SELECT USING (
    (status = 'published' AND visibility = 'public')
    OR public.is_host_member(host_id, auth.uid())
  );
CREATE POLICY "Host members create events" ON public.events
  FOR INSERT WITH CHECK (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host members update events" ON public.events
  FOR UPDATE USING (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host members delete events" ON public.events
  FOR DELETE USING (public.is_host_member(host_id, auth.uid()));

-- ============ RSVPS POLICIES ============
CREATE POLICY "Users view own rsvps" ON public.rsvps
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_event_host_member(event_id, auth.uid())
  );
CREATE POLICY "Users create own rsvps" ON public.rsvps
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND public.can_view_event(event_id, auth.uid())
  );
CREATE POLICY "Users update own rsvps" ON public.rsvps
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own rsvps" ON public.rsvps
  FOR DELETE USING (auth.uid() = user_id);

-- ============ TICKETS POLICIES ============
CREATE POLICY "View own or host tickets" ON public.tickets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.rsvps r
      WHERE r.id = rsvp_id
        AND (r.user_id = auth.uid() OR public.is_event_host_member(r.event_id, auth.uid()))
    )
  );
CREATE POLICY "Create ticket for own rsvp" ON public.tickets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.rsvps r WHERE r.id = rsvp_id AND r.user_id = auth.uid())
  );
CREATE POLICY "Host members check in tickets" ON public.tickets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.rsvps r
      WHERE r.id = rsvp_id AND public.is_event_host_member(r.event_id, auth.uid())
    )
  );

-- ============ GALLERY PHOTOS POLICIES ============
CREATE POLICY "View approved photos or own or host" ON public.gallery_photos
  FOR SELECT USING (
    (status = 'approved' AND public.can_view_event(event_id, auth.uid()))
    OR uploader_id = auth.uid()
    OR public.is_event_host_member(event_id, auth.uid())
  );
CREATE POLICY "Authenticated users upload photos" ON public.gallery_photos
  FOR INSERT WITH CHECK (
    auth.uid() = uploader_id
    AND public.can_view_event(event_id, auth.uid())
  );
CREATE POLICY "Uploader or host updates photo" ON public.gallery_photos
  FOR UPDATE USING (
    uploader_id = auth.uid() OR public.is_event_host_member(event_id, auth.uid())
  );
CREATE POLICY "Uploader or host deletes photo" ON public.gallery_photos
  FOR DELETE USING (
    uploader_id = auth.uid() OR public.is_event_host_member(event_id, auth.uid())
  );

-- ============ FEEDBACK POLICIES ============
CREATE POLICY "View own feedback or host reads all" ON public.feedback
  FOR SELECT USING (
    auth.uid() = user_id OR public.is_event_host_member(event_id, auth.uid())
  );
CREATE POLICY "Users create own feedback" ON public.feedback
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND public.can_view_event(event_id, auth.uid())
  );
CREATE POLICY "Users update own feedback" ON public.feedback
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own feedback" ON public.feedback
  FOR DELETE USING (auth.uid() = user_id);

-- ============ REPORTS POLICIES ============
CREATE POLICY "Reporter sees own; host sees event/photo reports" ON public.reports
  FOR SELECT USING (
    auth.uid() = reporter_id
    OR (
      target_type = 'event'
      AND public.is_event_host_member(target_id, auth.uid())
    )
    OR (
      target_type = 'photo'
      AND EXISTS (
        SELECT 1 FROM public.gallery_photos gp
        WHERE gp.id = target_id
          AND public.is_event_host_member(gp.event_id, auth.uid())
      )
    )
  );
CREATE POLICY "Authenticated users create reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ============ INVITATIONS POLICIES ============
CREATE POLICY "Host members view invitations" ON public.invitations
  FOR SELECT USING (public.is_host_member(host_id, auth.uid()));
CREATE POLICY "Host owner creates invitations" ON public.invitations
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );
CREATE POLICY "Host owner deletes invitations" ON public.invitations
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.hosts h WHERE h.id = host_id AND h.owner_id = auth.uid())
  );
CREATE POLICY "Invited user marks invitation used" ON public.invitations
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- ============ STORAGE BUCKET ============
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-assets', 'event-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read event-assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'event-assets');

CREATE POLICY "Authenticated upload event-assets" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'event-assets' AND auth.uid() IS NOT NULL);

CREATE POLICY "Owner updates own event-assets" ON storage.objects
  FOR UPDATE USING (bucket_id = 'event-assets' AND auth.uid() = owner);

CREATE POLICY "Owner deletes own event-assets" ON storage.objects
  FOR DELETE USING (bucket_id = 'event-assets' AND auth.uid() = owner);
