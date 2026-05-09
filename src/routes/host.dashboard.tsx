import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Copy,
  Download,
  Edit,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  ScanLine,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useCurrentHost } from "@/hooks/use-current-host";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/host/dashboard")({
  head: () => ({ meta: [{ title: "Host dashboard — Gather" }] }),
  component: HostDashboard,
});

type EventRow = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  status: "draft" | "published" | "cancelled";
  visibility: "public" | "unlisted" | "private";
  capacity: number | null;
};

type Counts = { going: number; waitlisted: number; checked_in: number };

function HostDashboard() {
  const { user, loading } = useRequireAuth();
  const { hosts, current, isLoading: hostsLoading } = useCurrentHost();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["host-events", current?.id],
    enabled: !!current,
    queryFn: async (): Promise<EventRow[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_at, end_at, status, visibility, capacity")
        .eq("host_id", current!.id)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const eventIds = useMemo(() => (events ?? []).map((e) => e.id), [events]);

  const { data: countsMap } = useQuery({
    queryKey: ["host-event-counts", current?.id, eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: async (): Promise<Record<string, Counts>> => {
      const [{ data: rsvps }, { data: tickets }] = await Promise.all([
        supabase.from("rsvps").select("event_id, status").in("event_id", eventIds),
        supabase
          .from("tickets")
          .select("checked_in_at, rsvps!inner(event_id)")
          .in("rsvps.event_id", eventIds),
      ]);
      const map: Record<string, Counts> = {};
      eventIds.forEach((id) => (map[id] = { going: 0, waitlisted: 0, checked_in: 0 }));
      (rsvps ?? []).forEach((r: { event_id: string; status: string }) => {
        if (!map[r.event_id]) return;
        if (r.status === "going") map[r.event_id].going += 1;
        if (r.status === "waitlisted") map[r.event_id].waitlisted += 1;
      });
      (tickets ?? []).forEach((t: { checked_in_at: string | null; rsvps: { event_id: string } }) => {
        if (t.checked_in_at && map[t.rsvps.event_id]) map[t.rsvps.event_id].checked_in += 1;
      });
      return map;
    },
  });

  const now = new Date();
  const upcoming = (events ?? []).filter(
    (e) => e.status === "published" && new Date(e.end_at ?? e.start_at) >= now,
  );
  const past = (events ?? []).filter(
    (e) => e.status === "published" && new Date(e.end_at ?? e.start_at) < now,
  );
  const drafts = (events ?? []).filter((e) => e.status === "draft");

  if (loading || !user || hostsLoading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      </section>
    );
  }

  if (hosts.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">No hosts yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a host to start publishing events.
        </p>
        <Link
          to="/host/new"
          className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Create a host
        </Link>
      </section>
    );
  }

  const canEdit = current?.role === "host";

  const handleToggleStatus = async (e: EventRow) => {
    const next = e.status === "published" ? "draft" : "published";
    const { error } = await supabase.from("events").update({ status: next }).eq("id", e.id);
    if (error) return toast.error(error.message);
    toast.success(next === "published" ? "Published" : "Unpublished");
    qc.invalidateQueries({ queryKey: ["host-events", current?.id] });
  };

  const handleDuplicate = async (e: EventRow) => {
    if (!current) return;
    const { data: full } = await supabase
      .from("events")
      .select("*")
      .eq("id", e.id)
      .maybeSingle();
    if (!full) return toast.error("Could not load event");
    const { data, error } = await supabase
      .from("events")
      .insert({
        host_id: current.id,
        title: `${full.title} (Copy)`,
        description: full.description,
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600_000).toISOString(),
        timezone: full.timezone,
        venue: full.venue,
        online_link: full.online_link,
        capacity: full.capacity,
        cover_image_url: full.cover_image_url,
        visibility: full.visibility,
        is_paid: false,
        status: "draft",
      })
      .select("id")
      .single();
    if (error || !data) return toast.error(error?.message ?? "Failed to duplicate");
    toast.success("Duplicated as draft");
    navigate({ to: "/host/events/$id/edit", params: { id: data.id } });
  };

  const handleExportCsv = async (e: EventRow) => {
    const { data, error } = await supabase
      .from("rsvps")
      .select("status, waitlist_position, created_at, profiles:user_id ( name )")
      .eq("event_id", e.id);
    if (error) return toast.error(error.message);
    const rows = [
      ["Name", "Status", "Waitlist position", "Created at"],
      ...((data ?? []) as Array<{
        status: string;
        waitlist_position: number | null;
        created_at: string;
        profiles: { name: string | null } | null;
      }>).map((r) => [
        r.profiles?.name ?? "",
        r.status,
        r.waitlist_position ?? "",
        r.created_at,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${e.title.replace(/[^a-z0-9]+/gi, "-")}-rsvps.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Host dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {current ? <>Managing <span className="font-medium text-foreground">{current.name}</span></> : "Select a host"}
          </p>
        </div>
        {canEdit && (
          <Button asChild className="rounded-xl shadow-sm hover:shadow-[var(--shadow-glow)]">
            <Link to="/host/events/new">
              <Plus className="mr-1.5 h-4 w-4" />
              New event
            </Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="upcoming" className="mt-8">
        <TabsList className="rounded-xl">
          <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="drafts">Drafts ({drafts.length})</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="mt-6">
          <EventList
            events={upcoming}
            counts={countsMap}
            isLoading={isLoading}
            canEdit={canEdit}
            onToggle={handleToggleStatus}
            onDuplicate={handleDuplicate}
            onExport={handleExportCsv}
          />
        </TabsContent>
        <TabsContent value="past" className="mt-6">
          <EventList
            events={past}
            counts={countsMap}
            isLoading={isLoading}
            canEdit={canEdit}
            onToggle={handleToggleStatus}
            onDuplicate={handleDuplicate}
            onExport={handleExportCsv}
          />
        </TabsContent>
        <TabsContent value="drafts" className="mt-6">
          <EventList
            events={drafts}
            counts={countsMap}
            isLoading={isLoading}
            canEdit={canEdit}
            onToggle={handleToggleStatus}
            onDuplicate={handleDuplicate}
            onExport={handleExportCsv}
          />
        </TabsContent>
        <TabsContent value="team" className="mt-6">
          {current && <TeamSection hostId={current.id} isOwner={canEdit} />}
        </TabsContent>
      </Tabs>
    </section>
  );
}

function EventList({
  events,
  counts,
  isLoading,
  canEdit,
  onToggle,
  onDuplicate,
  onExport,
}: {
  events: EventRow[];
  counts: Record<string, Counts> | undefined;
  isLoading: boolean;
  canEdit: boolean;
  onToggle: (e: EventRow) => void;
  onDuplicate: (e: EventRow) => void;
  onExport: (e: EventRow) => void;
}) {
  if (isLoading) return <Skeleton className="h-48 w-full rounded-2xl" />;
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Calendar className="h-6 w-6 text-primary-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No events yet</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Create your first event to see it here.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <ul className="divide-y divide-border/60">
        {events.map((e) => {
          const c = counts?.[e.id] ?? { going: 0, waitlisted: 0, checked_in: 0 };
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <Link
                  to="/events/$id"
                  params={{ id: e.id }}
                  className="font-medium hover:text-primary"
                >
                  {e.title}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{format(new Date(e.start_at), "MMM d, yyyy h:mm a")}</span>
                  <Badge variant="outline" className="rounded-md text-[10px] uppercase">
                    {e.status}
                  </Badge>
                  {e.visibility !== "public" && (
                    <Badge variant="outline" className="rounded-md text-[10px] uppercase">
                      {e.visibility}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{c.going}</span>
                  {e.capacity ? ` / ${e.capacity}` : ""} going
                </span>
                <span>
                  <span className="font-medium text-foreground">{c.waitlisted}</span> waitlist
                </span>
                <span>
                  <span className="font-medium text-foreground">{c.checked_in}</span> checked-in
                </span>
              </div>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-xl">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem asChild>
                      <Link to="/host/events/$id/edit" params={{ id: e.id }}>
                        <Edit className="mr-2 h-4 w-4" /> Edit
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onToggle(e)}>
                      {e.status === "published" ? (
                        <>
                          <EyeOff className="mr-2 h-4 w-4" /> Unpublish
                        </>
                      ) : (
                        <>
                          <Eye className="mr-2 h-4 w-4" /> Publish
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onDuplicate(e)}>
                      <Copy className="mr-2 h-4 w-4" /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/host/events/$id/check-in" params={{ id: e.id }}>
                        <ScanLine className="mr-2 h-4 w-4" /> Check-in
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onExport(e)}>
                      <Download className="mr-2 h-4 w-4" /> Export CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
