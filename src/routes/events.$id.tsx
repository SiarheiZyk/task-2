import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { formatInTimeZone } from "date-fns-tz";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, CalendarIcon, Globe, MapPin, Users, EyeOff, FileText, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketCard } from "@/components/TicketCard";
import { EventGallery } from "@/components/EventGallery";
import { ReportButton } from "@/components/ReportButton";
import { EventFeedback } from "@/components/EventFeedback";

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  timezone: string;
  venue: string | null;
  online_link: string | null;
  cover_image_url: string | null;
  capacity: number | null;
  status: "draft" | "published" | "cancelled";
  visibility: "public" | "unlisted" | "private";
  host_id: string;
  hosts: { id: string; name: string; slug: string; logo_url: string | null } | null;
};

type RsvpRow = {
  id: string;
  status: "going" | "waitlisted" | "cancelled";
  waitlist_position: number | null;
};

export const Route = createFileRoute("/events/$id")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("events")
      .select("title, description, cover_image_url")
      .eq("id", params.id)
      .maybeSingle();
    return { meta: data };
  },
  head: ({ loaderData }) => {
    const m = loaderData?.meta;
    const title = m?.title ? `${m.title} — Gather` : "Event — Gather";
    const desc = (m?.description ?? "Join this event on Gather.").slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: m?.cover_image_url ? "summary_large_image" : "summary" },
    ];
    if (m?.cover_image_url) {
      meta.push({ property: "og:image", content: m.cover_image_url });
      meta.push({ name: "twitter:image", content: m.cover_image_url });
    }
    return { meta };
  },
  component: EventPage,
});

function useEvent(id: string) {
  return useQuery({
    queryKey: ["event", id],
    queryFn: async (): Promise<EventRow | null> => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, description, start_at, end_at, timezone, venue, online_link, cover_image_url, capacity, status, visibility, host_id, hosts:host_id ( id, name, slug, logo_url )",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as EventRow) ?? null;
    },
  });
}

function useGoingCount(eventId: string) {
  return useQuery({
    queryKey: ["event-going-count", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_going_count", { _event_id: eventId });
      if (error) throw error;
      return (data as number | null) ?? 0;
    },
  });
}

function useMyRsvp(eventId: string, userId?: string) {
  return useQuery({
    queryKey: ["my-rsvp", eventId, userId],
    enabled: !!userId,
    queryFn: async (): Promise<RsvpRow | null> => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, status, waitlist_position")
        .eq("event_id", eventId)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return (data as RsvpRow) ?? null;
    },
  });
}

function useMyTicket(rsvpId: string | undefined) {
  return useQuery({
    queryKey: ["my-ticket", rsvpId],
    enabled: !!rsvpId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tickets")
        .select("id, code")
        .eq("rsvp_id", rsvpId!)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; code: string } | null;
    },
  });
}

function useMyProfileName(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile-name", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId!)
        .maybeSingle();
      return data?.name ?? "";
    },
  });
}

function useIsHostMember(hostId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["is-host-member", hostId, userId],
    enabled: !!hostId && !!userId,
    queryFn: async () => {
      const [{ data: m }, { data: h }] = await Promise.all([
        supabase
          .from("host_members")
          .select("id")
          .eq("host_id", hostId!)
          .eq("user_id", userId!)
          .maybeSingle(),
        supabase
          .from("hosts")
          .select("id")
          .eq("id", hostId!)
          .eq("owner_id", userId!)
          .maybeSingle(),
      ]);
      return !!m || !!h;
    },
  });
}

function EventPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: event, isLoading, error } = useEvent(id);
  const { data: goingCount } = useGoingCount(id);
  const { data: myRsvp } = useMyRsvp(id, user?.id);
  const { data: myTicket } = useMyTicket(
    myRsvp?.status === "going" ? myRsvp.id : undefined,
  );
  const { data: attendeeName } = useMyProfileName(user?.id);
  const { data: isMember } = useIsHostMember(event?.host_id, user?.id);
  const [submitting, setSubmitting] = useState(false);

  const ended = useMemo(() => {
    if (!event) return false;
    const end = event.end_at ? new Date(event.end_at) : new Date(event.start_at);
    return end < new Date();
  }, [event]);

  // Realtime: refetch counts and own RSVP when rsvps change for this event
  useEffect(() => {
    const channel = supabase
      .channel(`event-rsvps-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rsvps", filter: `event_id=eq.${id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["event-going-count", id] });
          qc.invalidateQueries({ queryKey: ["my-rsvp", id] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, qc]);

  // Auto-redirect for drafts/private when not a member
  useEffect(() => {
    if (!event || isMember === undefined) return;
    if ((event.status === "draft" || event.visibility === "private") && !isMember) {
      navigate({ to: "/", replace: true });
    }
  }, [event, isMember, navigate]);

  if (isLoading) return <EventSkeleton />;
  if (error || !event) return <NotFound />;

  const dateLong = safeFormat(event.start_at, event.timezone, "EEE, MMM d, yyyy 'at' h:mm a");
  const tzAbbr = safeFormat(event.start_at, event.timezone, "zzz");
  const seatsLeft =
    event.capacity != null ? Math.max(event.capacity - (goingCount ?? 0), 0) : null;

  const handleRsvp = async () => {
    if (!user) {
      navigate({ to: "/sign-in", search: { redirect_to: `/events/${id}` } });
      return;
    }
    setSubmitting(true);
    const { data, error: rpcErr } = await supabase.rpc("create_rsvp", { _event_id: id });
    setSubmitting(false);
    if (rpcErr) {
      toast.error(rpcErr.message);
      return;
    }
    const status = (data as { status?: string } | null)?.status;
    toast.success(status === "waitlisted" ? "Added to waitlist" : "You're going!");
    qc.invalidateQueries({ queryKey: ["my-rsvp", id] });
    qc.invalidateQueries({ queryKey: ["event-going-count", id] });
    qc.invalidateQueries({ queryKey: ["my-ticket"] });
    qc.invalidateQueries({ queryKey: ["my-rsvps"] });
  };

  const handleCancel = async () => {
    if (!myRsvp) return;
    setSubmitting(true);
    const { error: rpcErr } = await supabase.rpc("cancel_rsvp", { _rsvp_id: myRsvp.id });
    setSubmitting(false);
    if (rpcErr) {
      toast.error(rpcErr.message);
      return;
    }
    toast.success("RSVP cancelled");
    qc.invalidateQueries({ queryKey: ["my-rsvp", id] });
    qc.invalidateQueries({ queryKey: ["event-going-count", id] });
    qc.invalidateQueries({ queryKey: ["my-ticket"] });
  };


  return (
    <article className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      {event.status === "draft" && isMember && (
        <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <FileText className="h-4 w-4 text-amber-600" />
          <span className="font-medium">Draft preview</span>
          <span className="text-muted-foreground">— this event is not yet published.</span>
        </div>
      )}

      <div className="relative aspect-[16/7] w-full overflow-hidden rounded-2xl bg-muted shadow-[var(--shadow-md)]">
        {event.cover_image_url ? (
          <img
            src={event.cover_image_url}
            alt={event.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "var(--gradient-primary)" }}
            aria-hidden
          />
        )}
        {ended && (
          <Badge variant="secondary" className="absolute left-4 top-4 shadow">
            Ended
          </Badge>
        )}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {event.visibility === "unlisted" && isMember && (
              <Badge variant="outline" className="gap-1">
                <EyeOff className="h-3 w-3" /> Unlisted
              </Badge>
            )}
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{event.title}</h1>
            <div className="flex shrink-0 items-center gap-1">
              <ShareButton title={event.title} />
              {user && !isMember && (
                <ReportButton targetType="event" targetId={event.id} userId={user.id} />
              )}
            </div>
          </div>

          {event.hosts && (
            <Link
              to="/hosts/$slug"
              params={{ slug: event.hosts.slug }}
              className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
              aria-label={`Host ${event.hosts.name}`}
            >
              {event.hosts.logo_url ? (
                <img
                  src={event.hosts.logo_url}
                  alt={event.hosts.name}
                  className="h-7 w-7 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs">
                  {event.hosts.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="font-medium text-foreground">{event.hosts.name}</span>
            </Link>
          )}

          <div className="mt-6 grid gap-3 text-sm">
            <div className="flex items-start gap-3">
              <CalendarIcon className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <div className="font-medium">{dateLong}</div>
                <div className="text-muted-foreground">Timezone: {tzAbbr}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              {event.venue ? (
                <>
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="font-medium">{event.venue}</div>
                </>
              ) : (
                <>
                  <Globe className="mt-0.5 h-4 w-4 text-primary" />
                  <div>
                    <div className="font-medium">Online event</div>
                    {event.online_link && (myRsvp?.status === "going" || isMember) ? (
                      <a
                        href={event.online_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Join link
                      </a>
                    ) : (
                      <div className="text-muted-foreground">
                        Link shared after you RSVP.
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {event.description && (
            <div className="prose prose-neutral mt-8 max-w-none dark:prose-invert">
              <ReactMarkdown>{event.description}</ReactMarkdown>
            </div>
          )}

          {ended && (
            <>
              <EventGallery
                eventId={event.id}
                userId={user?.id}
                canUpload={myRsvp?.status === "going"}
              />
              <EventFeedback
                eventId={event.id}
                userId={user?.id}
                canSubmit={myRsvp?.status === "going"}
                showComments={
                  event.status === "published" && event.visibility === "public"
                }
              />
            </>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-2xl shadow-[var(--shadow-md)]">
            <CardContent className="space-y-5 p-6">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    <span className="font-semibold text-foreground">{goingCount ?? 0}</span> going
                  </span>
                </div>
                {event.capacity != null && (
                  <span className="text-xs text-muted-foreground">
                    {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left
                  </span>
                )}
              </div>

              {ended ? (
                <div className="rounded-xl bg-muted px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                  This event has ended
                </div>
              ) : !user ? (
                <Button
                  size="lg"
                  className="w-full rounded-xl shadow-sm transition hover:shadow-[var(--shadow-glow)]"
                  onClick={handleRsvp}
                >
                  Sign in to RSVP
                </Button>
              ) : myRsvp?.status === "going" ? (
                <div className="space-y-4">
                  {myTicket ? (
                    <TicketCard
                      ticketCode={myTicket.code}
                      attendeeName={attendeeName || user.email || "Guest"}
                      event={event}
                    />
                  ) : (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-center text-sm font-medium">
                      You're going 🎉
                    </div>
                  )}
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Cancel RSVP
                  </Button>
                </div>
              ) : myRsvp?.status === "waitlisted" ? (
                <div className="space-y-3">
                  <div className="rounded-xl bg-muted px-4 py-3 text-center text-sm font-medium">
                    You're {myRsvp.waitlist_position ? `#${myRsvp.waitlist_position} ` : ""}on the
                    waitlist
                  </div>
                  <Button
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Leave waitlist
                  </Button>
                </div>
              ) : (
                <Button
                  size="lg"
                  className="w-full rounded-xl shadow-sm transition hover:shadow-[var(--shadow-glow)]"
                  onClick={handleRsvp}
                  disabled={submitting}
                >
                  RSVP
                </Button>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </article>
  );
}

function safeFormat(iso: string, tz: string, pattern: string) {
  try {
    return formatInTimeZone(new Date(iso), tz, pattern);
  } catch {
    return format(new Date(iso), pattern);
  }
}

function ShareButton({ title }: { title: string }) {
  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const shareData = { title, text: `Check out "${title}" on Gather`, url };
    try {
      if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleShare}
      aria-label="Share event"
      title="Share event"
    >
      <Share2 className="h-4 w-4" />
    </Button>
  );
}

function EventSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <Skeleton className="aspect-[16/7] w-full rounded-2xl" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Event not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have been removed or you don't have access.
      </p>
      <Link to="/" className="mt-6 inline-block text-primary underline-offset-4 hover:underline">
        Back to events
      </Link>
    </div>
  );
}
