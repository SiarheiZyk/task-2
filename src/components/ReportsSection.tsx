import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { EyeOff, Flag, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Report = {
  id: string;
  target_type: "event" | "photo";
  target_id: string;
  reporter_id: string;
  reason: string;
  status: "open" | "hidden" | "dismissed";
  created_at: string;
};

type EventLite = { id: string; title: string };
type PhotoLite = { id: string; url: string; event_id: string };
type ProfileLite = { id: string; name: string | null };

export function ReportsSection({ hostId }: { hostId: string }) {
  const qc = useQueryClient();

  const { data: eventIds } = useQuery({
    queryKey: ["host-event-ids-reports", hostId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id")
        .eq("host_id", hostId);
      if (error) throw error;
      return (data ?? []).map((e: { id: string }) => e.id);
    },
  });

  const ids = eventIds ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ["reports", hostId, ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      // Photos for these events (used for photo-target lookup + filter)
      const { data: photos, error: pErr } = await supabase
        .from("gallery_photos")
        .select("id, url, event_id")
        .in("event_id", ids);
      if (pErr) throw pErr;
      const photoIds = (photos ?? []).map((p) => p.id);

      // Reports targeting our events OR our photos
      const orFilter = [
        `and(target_type.eq.event,target_id.in.(${ids.join(",")}))`,
        photoIds.length
          ? `and(target_type.eq.photo,target_id.in.(${photoIds.join(",")}))`
          : null,
      ]
        .filter(Boolean)
        .join(",");

      const { data: reports, error: rErr } = await supabase
        .from("reports")
        .select("id, target_type, target_id, reporter_id, reason, status, created_at")
        .or(orFilter)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (rErr) throw rErr;

      const reporterIds = Array.from(
        new Set((reports ?? []).map((r) => r.reporter_id)),
      );
      const eventTargets = (reports ?? [])
        .filter((r) => r.target_type === "event")
        .map((r) => r.target_id);

      const [{ data: profiles }, { data: events }] = await Promise.all([
        reporterIds.length
          ? supabase.from("profiles").select("id, name").in("id", reporterIds)
          : Promise.resolve({ data: [] as ProfileLite[] }),
        eventTargets.length
          ? supabase.from("events").select("id, title").in("id", eventTargets)
          : Promise.resolve({ data: [] as EventLite[] }),
      ]);

      const profileMap = new Map(
        (profiles ?? []).map((p) => [p.id, p as ProfileLite]),
      );
      const eventMap = new Map(
        (events ?? []).map((e) => [e.id, e as EventLite]),
      );
      const photoMap = new Map(
        (photos ?? []).map((p) => [p.id, p as PhotoLite]),
      );

      return (reports ?? []).map((r) => ({
        ...(r as Report),
        reporter: profileMap.get(r.reporter_id) ?? null,
        event:
          r.target_type === "event"
            ? (eventMap.get(r.target_id) ?? null)
            : (() => {
                const ph = photoMap.get(r.target_id);
                return ph ? (eventMap.get(ph.event_id) ?? null) : null;
              })(),
        photo: r.target_type === "photo" ? (photoMap.get(r.target_id) ?? null) : null,
      }));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["reports", hostId] });
  };

  const hide = async (r: NonNullable<typeof data>[number]) => {
    if (r.target_type === "event") {
      const { error } = await supabase
        .from("events")
        .update({ status: "draft" })
        .eq("id", r.target_id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("gallery_photos")
        .update({ status: "rejected" })
        .eq("id", r.target_id);
      if (error) return toast.error(error.message);
    }
    const { error: upErr } = await supabase
      .from("reports")
      .update({ status: "hidden" })
      .eq("id", r.id);
    if (upErr) return toast.error(upErr.message);
    toast.success("Hidden");
    refresh();
  };

  const dismiss = async (id: string) => {
    const { error } = await supabase
      .from("reports")
      .update({ status: "dismissed" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Dismissed");
    refresh();
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
        <Flag className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold">Reports</h2>
        {data && data.length > 0 && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {data.length}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="m-5 h-32 rounded-xl" />
      ) : !data || data.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No open reports.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {data.map((r) => (
            <li key={r.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row">
              <div className="flex-shrink-0">
                {r.target_type === "photo" && r.photo ? (
                  <img
                    src={r.photo.url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-28 items-center justify-center rounded-lg bg-muted text-xs text-muted-foreground">
                    {r.event?.title ?? "Event"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md text-[10px] uppercase">
                    {r.target_type}
                  </Badge>
                  <span className="text-sm font-medium truncate">
                    {r.event?.title ?? "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Reported by {r.reporter?.name ?? "Unknown"} ·{" "}
                  {format(new Date(r.created_at), "MMM d, HH:mm")}
                </p>
                <p className="mt-2 text-sm whitespace-pre-wrap">{r.reason}</p>
              </div>
              <div className="flex gap-2 sm:flex-col">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => hide(r)}
                >
                  <EyeOff className="mr-1 h-3.5 w-3.5" /> Hide
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={() => dismiss(r.id)}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
