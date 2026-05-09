import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon, MapPin, Search, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Discover events — Gather" },
      { name: "description", content: "Find and RSVP to events near you." },
    ],
  }),
  component: Explore,
});

type EventCard = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  timezone: string;
  venue: string | null;
  online_link: string | null;
  cover_image_url: string | null;
  hosts: { id: string; name: string; slug: string; logo_url: string | null } | null;
};

function useEvents(filters: {
  search: string;
  location: string;
  from?: Date;
  to?: Date;
  includePast: boolean;
}) {
  return useQuery({
    queryKey: ["explore-events", filters],
    queryFn: async (): Promise<EventCard[]> => {
      let q = supabase
        .from("events")
        .select(
          "id, title, description, start_at, end_at, timezone, venue, online_link, cover_image_url, hosts:host_id ( id, name, slug, logo_url )",
        )
        .eq("status", "published")
        .eq("visibility", "public")
        .order("start_at", { ascending: true })
        .limit(60);

      const nowIso = new Date().toISOString();
      if (!filters.includePast) {
        q = q.gte("start_at", filters.from ? filters.from.toISOString() : nowIso);
      } else if (filters.from) {
        q = q.gte("start_at", filters.from.toISOString());
      }
      if (filters.to) q = q.lte("start_at", filters.to.toISOString());

      if (filters.search.trim()) {
        const term = filters.search.trim().replace(/[%,]/g, "");
        q = q.or(
          `title.ilike.%${term}%,description.ilike.%${term}%,venue.ilike.%${term}%`,
        );
      }
      if (filters.location.trim()) {
        q = q.ilike("venue", `%${filters.location.trim()}%`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EventCard[];
    },
  });
}

function Explore() {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();

  const { data, isLoading } = useEvents({
    search,
    location,
    from: range?.from,
    to: range?.to,
    includePast,
  });

  const events = data ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Discover events</h1>
        <p className="mt-2 text-muted-foreground">
          Browse upcoming events, RSVP in seconds, and get a QR ticket.
        </p>
      </div>

      <Filters
        search={search}
        setSearch={setSearch}
        location={location}
        setLocation={setLocation}
        range={range}
        setRange={setRange}
        includePast={includePast}
        setIncludePast={setIncludePast}
      />

      <div className="mt-8">
        {isLoading ? (
          <Grid>
            {Array.from({ length: 6 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </Grid>
        ) : events.length === 0 ? (
          <EmptyState />
        ) : (
          <Grid>
            {events.map((e) => (
              <EventCardItem key={e.id} event={e} />
            ))}
          </Grid>
        )}
      </div>
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Filters(props: {
  search: string;
  setSearch: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  range: DateRange | undefined;
  setRange: (v: DateRange | undefined) => void;
  includePast: boolean;
  setIncludePast: (v: boolean) => void;
}) {
  const rangeLabel = useMemo(() => {
    if (!props.range?.from) return "Upcoming";
    if (!props.range.to) return format(props.range.from, "MMM d, yyyy");
    return `${format(props.range.from, "MMM d")} – ${format(props.range.to, "MMM d, yyyy")}`;
  }, [props.range]);

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.search}
            onChange={(e) => props.setSearch(e.target.value)}
            placeholder="Search events"
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="justify-start gap-2 md:w-[220px]">
              <CalendarIcon className="h-4 w-4" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={props.range}
              onSelect={props.setRange}
              numberOfMonths={2}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="flex justify-end border-t p-2">
              <Button variant="ghost" size="sm" onClick={() => props.setRange(undefined)}>
                Reset
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <div className="relative">
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.location}
            onChange={(e) => props.setLocation(e.target.value)}
            placeholder="Location"
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 md:justify-end">
          <Switch
            id="include-past"
            checked={props.includePast}
            onCheckedChange={props.setIncludePast}
          />
          <Label htmlFor="include-past" className="cursor-pointer text-sm">
            Include past
          </Label>
        </div>
      </div>
    </div>
  );
}

function EventCardItem({ event }: { event: EventCard }) {
  const start = new Date(event.start_at);
  const ended = (event.end_at ? new Date(event.end_at) : start) < new Date();
  const tzAbbr = (() => {
    try {
      return formatInTimeZone(start, event.timezone, "zzz");
    } catch {
      return event.timezone;
    }
  })();
  const dateLabel = (() => {
    try {
      return formatInTimeZone(start, event.timezone, "MMM d, h:mm a");
    } catch {
      return format(start, "MMM d, h:mm a");
    }
  })();

  return (
    <Link to="/" className={cn("group block", ended && "opacity-70")}>
      <Card className="overflow-hidden rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {event.cover_image_url ? (
            <img
              src={event.cover_image_url}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: "var(--gradient-primary)" }}
              aria-hidden
            />
          )}
          {ended && (
            <Badge variant="secondary" className="absolute left-3 top-3 shadow-sm">
              Ended
            </Badge>
          )}
        </div>
        <CardContent className="space-y-3 p-5">
          <div className="text-xs font-medium text-primary">
            {dateLabel} <span className="text-muted-foreground">({tzAbbr})</span>
          </div>
          <h3 className="line-clamp-2 text-lg font-semibold leading-snug">{event.title}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {event.venue ? (
              <>
                <MapPin className="h-3.5 w-3.5" />
                <span className="line-clamp-1">{event.venue}</span>
              </>
            ) : (
              <>
                <Globe className="h-3.5 w-3.5" />
                <span>Online</span>
              </>
            )}
          </div>
          {event.hosts && (
            <div className="flex items-center gap-2 border-t pt-3">
              {event.hosts.logo_url ? (
                <img
                  src={event.hosts.logo_url}
                  alt={event.hosts.name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-foreground">
                  {event.hosts.name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs text-muted-foreground">{event.hosts.name}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl">
      <Skeleton className="aspect-[16/9] w-full rounded-none" />
      <CardContent className="space-y-3 p-5">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-6 w-2/3" />
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/40 px-6 py-20 text-center">
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full"
        style={{ background: "var(--gradient-primary)" }}
      >
        <CalendarIcon className="h-6 w-6 text-primary-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">No events found</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Try clearing filters or toggling "Include past" to see ended events.
      </p>
    </div>
  );
}
