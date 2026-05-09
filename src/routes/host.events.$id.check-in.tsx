import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ScanLine, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const Route = createFileRoute("/host/events/$id/check-in")({
  head: () => ({ meta: [{ title: "Check-in — Gather" }] }),
  component: CheckInPage,
});

type Recent = {
  ticket_id: string;
  name: string;
  checked_in_at: string;
};

function CheckInPage() {
  const { id } = Route.useParams();
  const { user, loading } = useRequireAuth();
  void useNavigate;
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["check-in-event", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, host_id, capacity")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: access, isLoading: accessLoading } = useQuery({
    queryKey: ["check-in-access", id, user?.id, event?.host_id],
    enabled: !!user && !!event?.host_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("host_members")
        .select("role")
        .eq("host_id", event!.host_id)
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ["check-in-counts", id],
    enabled: !!access,
    queryFn: async () => {
      const [{ data: rsvps }, { data: tickets }] = await Promise.all([
        supabase.from("rsvps").select("status").eq("event_id", id),
        supabase
          .from("tickets")
          .select("checked_in_at, rsvps!inner(event_id)")
          .eq("rsvps.event_id", id),
      ]);
      let going = 0,
        waitlist = 0,
        checked = 0;
      (rsvps ?? []).forEach((r: { status: string }) => {
        if (r.status === "going") going++;
        else if (r.status === "waitlisted") waitlist++;
      });
      (tickets ?? []).forEach((t: { checked_in_at: string | null }) => {
        if (t.checked_in_at) checked++;
      });
      return { going, waitlist, checked };
    },
  });

  useEffect(() => {
    if (!access) return;
    const channel = supabase
      .channel(`checkin-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rsvps", filter: `event_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["check-in-counts", id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tickets" },
        () => qc.invalidateQueries({ queryKey: ["check-in-counts", id] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [access, id, qc]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [access]);

  const allowed = useMemo(
    () => access && (access.role === "host" || access.role === "checker"),
    [access],
  );

  if (loading || !user || eventLoading || accessLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      </section>
    );
  }

  if (!event) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Event not found</h1>
      </section>
    );
  }

  if (!allowed) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to be a host or checker for this event.
        </p>
        <Button asChild variant="outline" className="mt-6 rounded-xl">
          <Link to="/host/dashboard">Back to dashboard</Link>
        </Button>
      </section>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = code.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("check_in_ticket", { _code: value });
      if (error) throw error;
      const result = data as {
        status: "ok" | "already" | "invalid" | "not_going";
        name?: string;
        ticket_id?: string;
        event_id?: string;
        checked_in_at?: string;
      };
      if (result.status === "invalid") {
        toast.error("Invalid code");
      } else if (result.event_id && result.event_id !== id) {
        toast.error("Ticket is for a different event");
      } else if (result.status === "not_going") {
        toast.error("RSVP is not confirmed");
      } else if (result.status === "already") {
        const t = result.checked_in_at
          ? format(new Date(result.checked_in_at), "h:mm a")
          : "";
        toast.warning(`Already checked in${t ? ` at ${t}` : ""}`, {
          description: result.name ?? undefined,
        });
      } else if (result.status === "ok") {
        toast.success(`Checked in: ${result.name ?? "Guest"}`);
        setRecent((prev) =>
          [
            {
              ticket_id: result.ticket_id!,
              name: result.name ?? "Guest",
              checked_in_at: result.checked_in_at!,
            },
            ...prev,
          ].slice(0, 10),
        );
        qc.invalidateQueries({ queryKey: ["check-in-counts", id] });
      }
      setCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
      inputRef.current?.focus();
    }
  };

  const handleUndo = async () => {
    const last = recent[0];
    if (!last) return;
    const { error } = await supabase.rpc("undo_check_in", { _ticket_id: last.ticket_id });
    if (error) return toast.error(error.message);
    toast.success(`Undid check-in: ${last.name}`);
    setRecent((prev) => prev.slice(1));
    qc.invalidateQueries({ queryKey: ["check-in-counts", id] });
    inputRef.current?.focus();
  };

  const c = counts ?? { going: 0, waitlist: 0, checked: 0 };

  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Host dashboard", to: "/host/dashboard" },
          { label: event.title, to: "/events/$id", params: { id: event.id } },
          { label: "Check-in" },
        ]}
      />

      <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Check-in
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">{event.title}</h1>
          </div>
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ScanLine className="h-5 w-5 text-primary-foreground" />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <Stat label="Going" value={String(c.going)} />
          <Stat
            label="Checked-in"
            value={`${c.checked} / ${c.going}`}
          />
          <Stat label="Waitlist" value={String(c.waitlist)} />
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
      >
        <label className="text-sm font-medium">Ticket code</label>
        <Input
          ref={inputRef}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste or type the ticket code"
          autoComplete="off"
          spellCheck={false}
          className="mt-2 h-14 rounded-xl text-lg font-mono"
        />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button type="submit" size="lg" className="rounded-xl" disabled={submitting}>
            Check in
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-xl"
            onClick={handleUndo}
            disabled={recent.length === 0}
          >
            <Undo2 className="mr-1.5 h-4 w-4" />
            Undo last scan
          </Button>
        </div>
      </form>

      <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="text-sm font-semibold">Recent check-ins</h2>
        {recent.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No check-ins yet in this session.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {recent.map((r) => (
              <li
                key={r.ticket_id + r.checked_in_at}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">
                  {format(new Date(r.checked_in_at), "h:mm:ss a")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
