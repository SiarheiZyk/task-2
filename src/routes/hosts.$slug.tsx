import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowLeft, Mail, MapPin, Globe, CalendarIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CoverImage } from "@/components/CoverImage";

type HostRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  bio: string | null;
  contact_email: string | null;
};

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  timezone: string;
  venue: string | null;
  cover_image_url: string | null;
};

export const Route = createFileRoute("/hosts/$slug")({
  loader: async ({ params }) => {
    const { data } = await supabase
      .from("hosts")
      .select("name, bio, logo_url")
      .eq("slug", params.slug)
      .maybeSingle();
    return { meta: data };
  },
  head: ({ loaderData, params }) => {
    const m = loaderData?.meta;
    const title = m?.name ? `${m.name} — Gather` : "Host — Gather";
    const desc = (m?.bio ?? `Events by ${m?.name ?? params.slug} on Gather.`).slice(0, 160);
    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: desc },
      { property: "og:title", content: title },
      { property: "og:description", content: desc },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: m?.logo_url ? "summary_large_image" : "summary" },
    ];
    if (m?.logo_url) {
      meta.push({ property: "og:image", content: m.logo_url });
      meta.push({ name: "twitter:image", content: m.logo_url });
    }
    return { meta };
  },
  component: HostPage,
});

function useHost(slug: string) {
  return useQuery({
    queryKey: ["host", slug],
    queryFn: async (): Promise<HostRow | null> => {
      const { data, error } = await supabase
        .from("hosts")
        .select("id, name, slug, logo_url, bio, contact_email")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

function useHostEvents(hostId: string | undefined, mode: "upcoming" | "past") {
  return useQuery({
    queryKey: ["host-events", hostId, mode],
    enabled: !!hostId,
    queryFn: async (): Promise<EventRow[]> => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("events")
        .select("id, title, start_at, end_at, timezone, venue, cover_image_url")
        .eq("host_id", hostId!)
        .eq("status", "published")
        .eq("visibility", "public");
      if (mode === "upcoming") {
        q = q.gte("start_at", nowIso).order("start_at", { ascending: true });
      } else {
        q = q.lt("start_at", nowIso).order("start_at", { ascending: false });
      }
      const { data, error } = await q.limit(60);
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });
}

function HostPage() {
  const { slug } = Route.useParams();
  const { data: host, isLoading } = useHost(slug);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const { data: events, isLoading: eventsLoading } = useHostEvents(host?.id, tab);

  if (isLoading) return <HostSkeleton />;
  if (!host) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">Host not found</h1>
        <Link to="/" className="mt-6 inline-block text-primary hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>

      <header className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border bg-muted shadow-[var(--shadow-md)]">
          {host.logo_url ? (
            <img src={host.logo_url} alt={host.name} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: "var(--gradient-primary)" }}
              aria-hidden
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{host.name}</h1>
          {host.bio && <p className="mt-3 max-w-2xl text-muted-foreground">{host.bio}</p>}
          {host.contact_email && (
            <a
              href={`mailto:${host.contact_email}`}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Mail className="h-3.5 w-3.5" />
              {host.contact_email}
            </a>
          )}
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "upcoming" | "past")}
        className="mt-10"
      >
        <TabsList className="rounded-xl">
          <TabsTrigger value="upcoming" className="rounded-lg">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-lg">
            Past
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {eventsLoading ? (
            <Grid>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full rounded-xl" />
              ))}
            </Grid>
          ) : !events || events.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
              <h3 className="text-base font-semibold">
                No {tab === "upcoming" ? "upcoming" : "past"} events
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {tab === "upcoming"
                  ? "Check back soon for new events from this host."
                  : "This host hasn't run any events yet."}
              </p>
            </div>
          ) : (
            <Grid>
              {events.map((e) => (
                <EventCard key={e.id} event={e} ended={tab === "past"} />
              ))}
            </Grid>
          )}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function EventCard({ event, ended }: { event: EventRow; ended: boolean }) {
  const dateLabel = (() => {
    try {
      return formatInTimeZone(new Date(event.start_at), event.timezone, "MMM d, h:mm a");
    } catch {
      return format(new Date(event.start_at), "MMM d, h:mm a");
    }
  })();

  return (
    <Link
      to="/events/$id"
      params={{ id: event.id }}
      className={cn("group block", ended && "opacity-70")}
    >
      <Card className="overflow-hidden rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          <CoverImage
            src={event.cover_image_url}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          {ended && (
            <Badge variant="secondary" className="absolute left-3 top-3 shadow-sm">
              Ended
            </Badge>
          )}
        </div>
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <CalendarIcon className="h-3 w-3" />
            {dateLabel}
          </div>
          <h3 className="line-clamp-2 text-base font-semibold leading-snug">{event.title}</h3>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {event.venue ? (
              <>
                <MapPin className="h-3 w-3" />
                <span className="line-clamp-1">{event.venue}</span>
              </>
            ) : (
              <>
                <Globe className="h-3 w-3" />
                <span>Online</span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function HostSkeleton() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <div className="flex gap-6">
        <Skeleton className="h-24 w-24 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      </div>
    </section>
  );
}
