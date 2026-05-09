import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Calendar, Edit, LayoutDashboard, Search, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useMyHosts } from "@/hooks/use-current-host";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/my-events")({
  head: () => ({ meta: [{ title: "My events — Gather" }] }),
  component: MyEventsPage,
});

type Row = {
  id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  status: string;
  cover_image_url: string | null;
  host_id: string;
};

function MyEventsPage() {
  const { user, loading } = useRequireAuth();
  const { data: hosts } = useMyHosts();
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hostFilter, setHostFilter] = useState<Set<string>>(new Set());

  const hostIds = useMemo(() => (hosts ?? []).map((h) => h.id), [hosts]);
  const roleByHost = useMemo(() => {
    const m = new Map<string, string>();
    (hosts ?? []).forEach((h) => m.set(h.id, h.role));
    return m;
  }, [hosts]);
  const nameByHost = useMemo(() => {
    const m = new Map<string, string>();
    (hosts ?? []).forEach((h) => m.set(h.id, h.name));
    return m;
  }, [hosts]);

  const { data: events, isLoading } = useQuery({
    queryKey: ["my-events", hostIds.join(",")],
    enabled: !!user && hostIds.length > 0,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, start_at, end_at, status, cover_image_url, host_id")
        .in("host_id", hostIds)
        .order("start_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = (events ?? []).filter((e) => {
    if (hostFilter.size > 0 && !hostFilter.has(e.host_id)) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (from && new Date(e.start_at) < new Date(from)) return false;
    if (to && new Date(e.start_at) > new Date(to + "T23:59:59")) return false;
    return true;
  });

  const toggleHost = (id: string) => {
    setHostFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading || !user) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </section>
    );
  }

  if ((hosts ?? []).length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">No host memberships yet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create a host or accept an invitation to manage events.
        </p>
        <Button asChild className="mt-6 rounded-xl">
          <Link to="/host/new">Create a host</Link>
        </Button>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">My events</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All events from the hosts you're part of.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search events"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="rounded-xl pl-9"
          />
        </div>
        <Input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-auto rounded-xl"
          aria-label="From"
        />
        <Input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-auto rounded-xl"
          aria-label="To"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="rounded-xl">
              Hosts {hostFilter.size > 0 && `(${hostFilter.size})`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl">
            <DropdownMenuLabel>Filter by host</DropdownMenuLabel>
            {(hosts ?? []).map((h) => (
              <DropdownMenuCheckboxItem
                key={h.id}
                checked={hostFilter.has(h.id)}
                onCheckedChange={() => toggleHost(h.id)}
              >
                {h.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isLoading ? (
        <Skeleton className="mt-8 h-64 w-full rounded-2xl" />
      ) : filtered.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Calendar className="h-6 w-6 text-primary-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No matching events</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Try adjusting filters or search.
          </p>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((e) => {
            const role = roleByHost.get(e.host_id) ?? "checker";
            const isHost = role === "host";
            return (
              <li
                key={e.id}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm"
              >
                <Link to="/events/$id" params={{ id: e.id }}>
                  <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                    {e.cover_image_url ? (
                      <img
                        src={e.cover_image_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: "var(--gradient-primary)" }}
                      />
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="rounded-md text-[10px] uppercase">
                      {role}
                    </Badge>
                    {e.status !== "published" && (
                      <Badge variant="outline" className="rounded-md text-[10px] uppercase">
                        {e.status}
                      </Badge>
                    )}
                  </div>
                  <Link to="/events/$id" params={{ id: e.id }}>
                    <h3 className="mt-2 line-clamp-2 font-semibold hover:text-primary">
                      {e.title}
                    </h3>
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(new Date(e.start_at), "MMM d, yyyy h:mm a")} ·{" "}
                    {nameByHost.get(e.host_id)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isHost && (
                      <>
                        <Button asChild size="sm" variant="outline" className="rounded-xl">
                          <Link to="/host/events/$id/edit" params={{ id: e.id }}>
                            <Edit className="mr-1.5 h-3.5 w-3.5" /> Edit
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline" className="rounded-xl">
                          <Link to="/host/dashboard">
                            <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" /> Dashboard
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button asChild size="sm" variant="outline" className="rounded-xl">
                      <Link to="/host/events/$id/check-in" params={{ id: e.id }}>
                        <ScanLine className="mr-1.5 h-3.5 w-3.5" /> Check-in
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
