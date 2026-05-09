import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Gather" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useRequireAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setName(data?.name ?? "");
        setAvatarUrl(data?.avatar_url ?? "");
        setLoadingProfile(false);
      });
  }, [user]);

  if (loading || !user) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-64 w-full rounded-2xl" />
      </section>
    );
  }

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files allowed");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `avatars/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("event-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast.success("Avatar uploaded");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name: name || null, avatar_url: avatarUrl || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await qc.invalidateQueries();
    toast.success("Profile updated");
  };

  const initials = (name || user.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-1 text-sm text-muted-foreground">Update how you appear on Gather.</p>

      <form
        onSubmit={handleSave}
        className="mt-8 space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-md)] sm:p-8"
      >
        <div className="flex items-center gap-5">
          <Avatar className="h-20 w-20 border border-border/60">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="bg-muted text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <Label
              htmlFor="avatar-file"
              className="inline-flex cursor-pointer items-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent"
            >
              {uploading ? "Uploading…" : "Upload avatar"}
            </Label>
            <input
              id="avatar-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAvatarUpload(f);
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, max 5MB.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            disabled={loadingProfile}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="avatar-url">Avatar URL</Label>
          <Input
            id="avatar-url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://…"
            disabled={loadingProfile}
          />
        </div>

        <div className="flex justify-end">
          <Button type="submit" className="rounded-xl" disabled={saving || loadingProfile}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </section>
  );
}
