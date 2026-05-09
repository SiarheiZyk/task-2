import { useState } from "react";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function ReportButton({
  targetType,
  targetId,
  userId,
  variant = "icon",
  className,
}: {
  targetType: "event" | "photo";
  targetId: string;
  userId: string | undefined;
  variant?: "icon" | "button";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!userId) {
      toast.error("Sign in to report");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Please enter a reason");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      target_type: targetType,
      target_id: targetId,
      reporter_id: userId,
      reason: reason.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Report submitted");
    setReason("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "icon" ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={className ?? "h-8 w-8 rounded-lg"}
            aria-label="Report"
            title="Report"
          >
            <Flag className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={className ?? "rounded-xl"}
          >
            <Flag className="mr-1.5 h-4 w-4" /> Report
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetType}</DialogTitle>
          <DialogDescription>
            Tell us what's wrong. The host will review your report.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason"
          rows={4}
          className="rounded-xl"
        />
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
