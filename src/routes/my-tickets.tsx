import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ticket, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TicketCard } from "@/components/TicketCard";

export const Route = createFileRoute("/my-tickets")({
  head: () => ({ meta: [{ title: "My tickets — Gather" }] }),
  component: MyTicketsPage,
});

type Row = {
  id: string;
  status: "going" | "waitlisted" | "cancelled";
  waitlist_position: number | null;
  events: {
    id: string;
    title: string;
    description: string | null;
    start_at: string;
    end_at: string | null;
    timezone: string;
    venue: string | null;
    online_link: string | null;
    cover_image_url: string | null;
  } | null;
  tickets: { id: string; code: string } | { id: string; code: string }[] | null;
};

function useMyRsvps(userId?: string) {
  return useQuery({
    queryKey: ["my-rsvps", userId],
    enabled: !!userId,
    queryFn: async (): Promise<Row[]> => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("rsvps")
        .select(
          "id, status, waitlist_position, events:event_id ( id, title, description, start_at, end_at, timezone, venue, online_link, cover_image_url ), tickets ( id, code )",
        )
        .eq("user_id", userId!)
        .in("status", ["going", "waitlisted"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as Row[];
      return rows.filter((r) => {
        if (!r.events) return false;
        const end = r.events.end_at ? new Date(r.events.end_at) : new Date(r.events.start_at);
        return end >= new Date(nowIso);
      });
    },
  });
}

function MyTicketsPage() {
  const { user, loading } = useRequireAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useMyRsvps(user?.id);

  const cancel = async (rsvpId: string) => {
    const { error } = await supabase.rpc("cancel_rsvp", { _rsvp_id: rsvpId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("RSVP cancelled");
    qc.invalidateQueries({ queryKey: ["my-rsvps"] });
  };

  const profileNameQ = useQuery({
    queryKey: ["profile-name", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", user!.id)
        .maybeSingle();
      return data?.name ?? "";
    },
  });
  const attendeeName = profileNameQ.data || user?.email || "Guest";

  const going = (data ?? []).filter((r) => r.status === "going");
  const waitlisted = (data ?? []).filter((r) => r.status === "waitlisted");

  if (loading || !user) return <PageSkeleton />;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">My tickets</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Show your QR at the door to check in.
      </p>

      <div className="mt-8 space-y-10">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Ticket className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Going
            </h2>
          </div>
          {isLoading ? (
            <Skeleton className="h-64 w-full rounded-2xl" />
          ) : going.length === 0 ? (
            <Empty
              title="No upcoming tickets"
              description="RSVP to an event to get your QR code here."
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {going.map((r) => {
                const code = r.tickets?.[0]?.code;
                if (!r.events || !code) return null;
                return (
                  <div key={r.id} className="space-y-3">
                    <TicketCard
                      ticketCode={code}
                      attendeeName={attendeeName}
                      event={r.events}
                    />
                    <div className="flex gap-2">
                      <Button asChild variant="outline" className="flex-1 rounded-xl">
                        <Link to="/events/$id" params={{ id: r.events.id }}>
                          View event
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => cancel(r.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Waitlisted
            </h2>
          </div>
          {isLoading ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : waitlisted.length === 0 ? (
            <Empty
              title="No waitlisted events"
              description="When an event is full, you'll appear here."
            />
          ) : (
            <div className="space-y-3">
              {waitlisted.map((r) =>
                r.events ? (
                  <Card key={r.id} className="rounded-2xl">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <div>
                        <Link
                          to="/events/$id"
                          params={{ id: r.events.id }}
                          className="font-semibold hover:text-primary"
                        >
                          {r.events.title}
                        </Link>
                        <div className="mt-1 text-xs text-muted-foreground">
                          You're {r.waitlist_position ? `#${r.waitlist_position} ` : ""}on the
                          waitlist
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => cancel(r.id)}
                      >
                        Leave waitlist
                      </Button>
                    </CardContent>
                  </Card>
                ) : null,
              )}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/40 px-6 py-10 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button asChild variant="outline" size="sm" className="mt-4 rounded-xl">
        <Link to="/">Discover events</Link>
      </Button>
    </div>
  );
}

function PageSkeleton() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
    </section>
  );
}
