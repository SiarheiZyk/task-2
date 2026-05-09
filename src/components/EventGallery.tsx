import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ReportButton } from "@/components/ReportButton";

type Photo = {
  id: string;
  url: string;
  status: "pending" | "approved" | "rejected";
  uploader_id: string;
};

export function EventGallery({
  eventId,
  userId,
  canUpload,
}: {
  eventId: string;
  userId: string | undefined;
  canUpload: boolean;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: photos, isLoading } = useQuery({
    queryKey: ["gallery", eventId],
    queryFn: async (): Promise<Photo[]> => {
      const { data, error } = await supabase
        .from("gallery_photos")
        .select("id, url, status, uploader_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Photo[];
    },
  });

  const handleFile = async (file: File) => {
    if (!userId) return;
    if (!file.type.startsWith("image/")) return toast.error("Images only");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `gallery/${eventId}/${userId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("event-assets")
      .upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      return toast.error(upErr.message);
    }
    const { data: pub } = supabase.storage.from("event-assets").getPublicUrl(path);
    const { error: dbErr } = await supabase.from("gallery_photos").insert({
      event_id: eventId,
      uploader_id: userId,
      url: pub.publicUrl,
      status: "pending",
    });
    setUploading(false);
    if (dbErr) return toast.error(dbErr.message);
    toast.success("Photo uploaded — pending review");
    qc.invalidateQueries({ queryKey: ["gallery", eventId] });
  };

  const items = photos ?? [];

  return (
    <section className="mt-12">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Gallery</h2>
        {canUpload && userId && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="mr-1.5 h-4 w-4" />
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
          </>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed bg-card/40 px-6 py-12 text-center">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: "var(--gradient-primary)" }}
          >
            <ImageIcon className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">No photos yet.</p>
        </div>
      ) : (
        <div className="mt-4 columns-1 gap-3 sm:columns-2 lg:columns-3">
          {items.map((p) => (
            <figure
              key={p.id}
              className="relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-border/60 bg-muted"
            >
              <img src={p.url} alt="" className="w-full" loading="lazy" />
              {p.status !== "approved" && (
                <Badge
                  variant="outline"
                  className="absolute left-2 top-2 rounded-md bg-background/90 text-[10px] uppercase"
                >
                  {p.status === "pending" ? "Pending review" : "Rejected"}
                </Badge>
              )}
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
