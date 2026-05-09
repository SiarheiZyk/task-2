import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type EventFormValues = {
  title: string;
  description: string;
  start_at: string; // datetime-local string
  end_at: string;
  timezone: string;
  location_kind: "venue" | "online";
  venue: string;
  online_link: string;
  capacity: string;
  visibility: "public" | "unlisted";
  cover_image_url: string;
};

const schema = z
  .object({
    title: z.string().trim().min(1, "Title required").max(160),
    description: z.string().trim().max(10000).optional(),
    start_at: z.string().min(1, "Start date required"),
    end_at: z.string().min(1, "End date required"),
    timezone: z.string().min(1),
    location_kind: z.enum(["venue", "online"]),
    venue: z.string().trim().max(255).optional(),
    online_link: z.string().trim().max(500).optional(),
    capacity: z.string(),
    visibility: z.enum(["public", "unlisted"]),
    cover_image_url: z.string().optional(),
  })
  .refine((d) => new Date(d.end_at) > new Date(d.start_at), {
    message: "End time must be after start time",
    path: ["end_at"],
  })
  .refine(
    (d) => {
      const c = Number(d.capacity);
      return d.capacity === "" || (Number.isFinite(c) && c > 0);
    },
    { message: "Capacity must be greater than 0", path: ["capacity"] },
  )
  .refine(
    (d) => (d.location_kind === "venue" ? !!d.venue?.trim() : !!d.online_link?.trim()),
    { message: "Venue or online link is required", path: ["venue"] },
  );

export function defaultValues(tz?: string): EventFormValues {
  return {
    title: "",
    description: "",
    start_at: "",
    end_at: "",
    timezone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    location_kind: "venue",
    venue: "",
    online_link: "",
    capacity: "",
    visibility: "public",
    cover_image_url: "",
  };
}

export function toFormValues(e: {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  timezone: string;
  venue: string | null;
  online_link: string | null;
  capacity: number | null;
  visibility: "public" | "unlisted" | "private";
  cover_image_url: string | null;
}): EventFormValues {
  const toLocal = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  return {
    title: e.title,
    description: e.description ?? "",
    start_at: toLocal(e.start_at),
    end_at: toLocal(e.end_at),
    timezone: e.timezone,
    location_kind: e.online_link ? "online" : "venue",
    venue: e.venue ?? "",
    online_link: e.online_link ?? "",
    capacity: e.capacity != null ? String(e.capacity) : "",
    visibility: e.visibility === "private" ? "unlisted" : e.visibility,
    cover_image_url: e.cover_image_url ?? "",
  };
}

export function toEventInsert(v: EventFormValues, hostId: string, status: "draft" | "published") {
  return {
    host_id: hostId,
    title: v.title.trim(),
    description: v.description.trim() || null,
    start_at: new Date(v.start_at).toISOString(),
    end_at: new Date(v.end_at).toISOString(),
    timezone: v.timezone,
    venue: v.location_kind === "venue" ? v.venue.trim() || null : null,
    online_link: v.location_kind === "online" ? v.online_link.trim() || null : null,
    capacity: v.capacity ? Number(v.capacity) : null,
    visibility: v.visibility,
    cover_image_url: v.cover_image_url || null,
    is_paid: false,
    status,
  };
}

type Props = {
  initialValues: EventFormValues;
  submitting: boolean;
  onSubmit: (values: EventFormValues, status: "draft" | "published") => Promise<void> | void;
  showPublish?: boolean;
  extraActions?: React.ReactNode;
};

export function EventForm({ initialValues, submitting, onSubmit, showPublish = true, extraActions }: Props) {
  const { user } = useAuth();
  const [v, setV] = useState<EventFormValues>(initialValues);
  const [uploading, setUploading] = useState(false);

  const update = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  const handleUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    if (!file.type.startsWith("image/")) return toast.error("Image files only");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `event-covers/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("event-assets")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    update("cover_image_url", data.publicUrl);
    setUploading(false);
    toast.success("Cover uploaded");
  };

  const handleSubmit = async (status: "draft" | "published") => {
    const parsed = schema.safeParse(v);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    await onSubmit(v, status);
  };

  return (
    <div className="space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-md)] sm:p-8">
      {/* Cover */}
      <div className="space-y-2">
        <Label>Cover image</Label>
        <div className="flex items-center gap-4">
          <div className="flex h-24 w-40 items-center justify-center overflow-hidden rounded-xl border bg-muted">
            {v.cover_image_url ? (
              <img src={v.cover_image_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div
                className="h-full w-full"
                style={{ background: "var(--gradient-primary)" }}
                aria-hidden
              />
            )}
          </div>
          <div>
            <Label
              htmlFor="cover-file"
              className="inline-flex cursor-pointer items-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent"
            >
              {uploading ? "Uploading…" : "Upload cover"}
            </Label>
            <input
              id="cover-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">PNG/JPG, max 5MB.</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={v.title}
          onChange={(e) => update("title", e.target.value)}
          maxLength={160}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (markdown)</Label>
        <Textarea
          id="description"
          value={v.description}
          onChange={(e) => update("description", e.target.value)}
          rows={6}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="start">Starts *</Label>
          <Input
            id="start"
            type="datetime-local"
            value={v.start_at}
            onChange={(e) => update("start_at", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end">Ends *</Label>
          <Input
            id="end"
            type="datetime-local"
            value={v.end_at}
            onChange={(e) => update("end_at", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tz">Timezone</Label>
        <Input id="tz" value={v.timezone} onChange={(e) => update("timezone", e.target.value)} />
        <p className="text-xs text-muted-foreground">IANA name, e.g. America/Los_Angeles.</p>
      </div>

      <div className="space-y-2">
        <Label>Location *</Label>
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={v.location_kind === "venue"}
              onChange={() => update("location_kind", "venue")}
            />
            In person
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              checked={v.location_kind === "online"}
              onChange={() => update("location_kind", "online")}
            />
            Online
          </label>
        </div>
        {v.location_kind === "venue" ? (
          <Input
            placeholder="Venue address"
            value={v.venue}
            onChange={(e) => update("venue", e.target.value)}
          />
        ) : (
          <Input
            placeholder="https://..."
            value={v.online_link}
            onChange={(e) => update("online_link", e.target.value)}
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="cap">Capacity</Label>
          <Input
            id="cap"
            type="number"
            min={1}
            value={v.capacity}
            onChange={(e) => update("capacity", e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div className="space-y-2">
          <Label>Visibility</Label>
          <div className="flex gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={v.visibility === "public"}
                onChange={() => update("visibility", "public")}
              />
              Public
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                checked={v.visibility === "unlisted"}
                onChange={() => update("visibility", "unlisted")}
              />
              Unlisted
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Pricing</Label>
        <div className="flex gap-4 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="radio" checked readOnly />
            Free
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <label className="inline-flex cursor-not-allowed items-center gap-2 opacity-50">
                  <input type="radio" disabled />
                  Paid
                  <Info className="h-3.5 w-3.5" />
                </label>
              </TooltipTrigger>
              <TooltipContent>Coming soon</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        {extraActions}
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={submitting}
          onClick={() => handleSubmit("draft")}
        >
          Save Draft
        </Button>
        {showPublish && (
          <Button
            type="button"
            className="rounded-xl shadow-sm hover:shadow-[var(--shadow-glow)]"
            disabled={submitting}
            onClick={() => handleSubmit("published")}
          >
            Publish
          </Button>
        )}
      </div>
    </div>
  );
}
