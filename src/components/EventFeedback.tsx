import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

type Feedback = {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_id: string;
};

export function EventFeedback({
  eventId,
  userId,
  canSubmit,
  showComments,
}: {
  eventId: string;
  userId: string | undefined;
  canSubmit: boolean;
  showComments: boolean;
}) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: all, isLoading } = useQuery({
    queryKey: ["feedback", eventId],
    queryFn: async (): Promise<Feedback[]> => {
      const { data, error } = await supabase
        .from("feedback")
        .select("id, rating, comment, created_at, user_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Feedback[];
    },
  });

  const myFeedback = all?.find((f) => f.user_id === userId);
  const total = all?.length ?? 0;
  const avg = total > 0 ? all!.reduce((s, f) => s + f.rating, 0) / total : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || rating === 0) return;
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      event_id: eventId,
      user_id: userId,
      rating,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (error) {
      const msg =
        error.code === "23505"
          ? "You've already submitted feedback for this event"
          : error.message;
      return toast.error(msg);
    }
    toast.success("Thanks for your feedback!");
    setRating(0);
    setComment("");
    qc.invalidateQueries({ queryKey: ["feedback", eventId] });
  };

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Feedback</h2>
        {total > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span className="font-semibold">{avg.toFixed(1)}</span>
            <span className="text-muted-foreground">
              ({total} {total === 1 ? "rating" : "ratings"})
            </span>
          </div>
        )}
      </div>

      {canSubmit && !myFeedback && userId && (
        <form
          onSubmit={handleSubmit}
          className="mt-4 rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
        >
          <p className="text-sm font-medium">How was the event?</p>
          <div
            className="mt-3 flex items-center gap-1"
            onMouseLeave={() => setHover(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => {
              const active = (hover || rating) >= n;
              return (
                <button
                  key={n}
                  type="button"
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                  className="rounded-md p-1 transition hover:scale-110"
                  aria-label={`${n} star${n === 1 ? "" : "s"}`}
                >
                  <Star
                    className={`h-7 w-7 ${active ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                  />
                </button>
              );
            })}
          </div>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 1000))}
            placeholder="Add a comment (optional)"
            className="mt-3 rounded-xl"
            rows={3}
          />
          <div className="mt-3 flex justify-end">
            <Button
              type="submit"
              className="rounded-xl"
              disabled={rating === 0 || submitting}
            >
              Submit feedback
            </Button>
          </div>
        </form>
      )}

      {canSubmit && myFeedback && (
        <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`h-4 w-4 ${n <= myFeedback.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
              />
            ))}
            <span className="ml-2 font-medium">Thanks for your feedback!</span>
          </div>
          {myFeedback.comment && (
            <p className="mt-2 text-muted-foreground">{myFeedback.comment}</p>
          )}
        </div>
      )}

      {showComments && (
        <div className="mt-6">
          {isLoading ? (
            <Skeleton className="h-32 w-full rounded-xl" />
          ) : (
            <ul className="space-y-3">
              {(all ?? [])
                .filter((f) => f.comment)
                .map((f) => (
                  <li
                    key={f.id}
                    className="rounded-xl border border-border/60 bg-card p-4 text-sm"
                  >
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-3.5 w-3.5 ${n <= f.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-foreground">{f.comment}</p>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
