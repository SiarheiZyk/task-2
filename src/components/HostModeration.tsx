import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, ImageIcon, Star, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type PendingPhoto = {
  id: string;
  url: string;
  event_id: string;
  created_at: string;
  events: { title: string } | null;
};

type FeedbackItem = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  event_id: string;
  events: { title: string } | null;
  profiles: { name: string | null } | null;
};

export function HostModeration({ hostId }: { hostId: string }) {
  const qc = useQueryClient();

  const { data: events } = useQuery({
    queryKey: ["host-event-ids", hostId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("id")
        .eq("host_id", hostId);
      if (error) throw error;
      return (data ?? []).map((e: { id: string }) => e.id);
    },
  });

  const eventIds = events ?? [];

  const { data: pending, isLoading: pendingLoading } = useQuery({
    queryKey: ["pending-photos", hostId, eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: async (): Promise<PendingPhoto[]> => {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("id, url, event_id, created_at, events:event_id ( title )")
        .in("event_id", eventIds)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PendingPhoto[];
    },
  });

  const { data: feedback, isLoading: feedbackLoading } = useQuery({
    queryKey: ["host-feedback", hostId, eventIds.join(",")],
    enabled: eventIds.length > 0,
    queryFn: async (): Promise<FeedbackItem[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select(
          "id, rating, comment, created_at, event_id, events:event_id ( title ), profiles:user_id ( name )",
        )
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FeedbackItem[];
    },
  });

  const setStatus = async (id: string, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("gallery_photos")
      .update({ status })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(status === "approved" ? "Photo approved" : "Photo rejected");
    qc.invalidateQueries({ queryKey: ["pending-photos", hostId] });
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Pending photos</h2>
          {pending && pending.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {pending.length}
            </span>
          )}
        </div>
        {pendingLoading ? (
          <Skeleton className="m-5 h-40 rounded-xl" />
        ) : !pending || pending.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No photos awaiting review.
          </p>
        ) : (
          <ul className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((p) => (
              <li
                key={p.id}
                className="overflow-hidden rounded-xl border border-border/60 bg-background"
              >
                <img src={p.url} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="p-3">
                  <p className="truncate text-xs text-muted-foreground">
                    {p.events?.title ?? "Event"} ·{" "}
                    {format(new Date(p.created_at), "MMM d")}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1 rounded-xl"
                      onClick={() => setStatus(p.id, "approved")}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 rounded-xl"
                      onClick={() => setStatus(p.id, "rejected")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 bg-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-4">
          <Star className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold">Feedback</h2>
        </div>
        {feedbackLoading ? (
          <Skeleton className="m-5 h-32 rounded-xl" />
        ) : !feedback || feedback.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            No feedback yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {feedback.map((f) => (
              <li key={f.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {f.profiles?.name ?? "Anonymous"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {f.events?.title ?? "Event"} ·{" "}
                      {format(new Date(f.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={`h-3.5 w-3.5 ${n <= f.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                </div>
                {f.comment && (
                  <p className="mt-2 text-sm text-muted-foreground">{f.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
