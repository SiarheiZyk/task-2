import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/host/new")({
  head: () => ({ meta: [{ title: "Create a host — Gather" }] }),
  component: NewHostPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  bio: z.string().trim().max(500).optional(),
  contact_email: z.string().trim().email("Invalid email").max(255).optional().or(z.literal("")),
});

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueSlug(base: string) {
  let slug = base || `host-${Date.now()}`;
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data } = await supabase
      .from("hosts")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

function NewHostPage() {
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading || !user) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
      </section>
    );
  }

  const handleLogo = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5MB");
    if (!file.type.startsWith("image/")) return toast.error("Image files only");
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `host-logos/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("event-assets")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      setUploading(false);
      return toast.error(error.message);
    }
    const { data } = supabase.storage.from("event-assets").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
    toast.success("Logo uploaded");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ name, bio, contact_email: contactEmail });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setSubmitting(true);
    const slug = await uniqueSlug(slugify(parsed.data.name));
    const { data: host, error } = await supabase
      .from("hosts")
      .insert({
        owner_id: user.id,
        name: parsed.data.name,
        slug,
        logo_url: logoUrl || null,
        bio: parsed.data.bio || null,
        contact_email: parsed.data.contact_email || null,
      })
      .select("id, slug")
      .single();
    if (error || !host) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Failed to create host");
    }
    const { error: memberErr } = await supabase
      .from("host_members")
      .insert({ host_id: host.id, user_id: user.id, role: "host" });
    setSubmitting(false);
    if (memberErr) {
      toast.error(`Host created but membership failed: ${memberErr.message}`);
    } else {
      toast.success("Host created!");
    }
    navigate({ to: "/host/dashboard" });
  };

  return (
    <section className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Become a host</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Create a host profile to start publishing events on Gather.
      </p>

      <form
        onSubmit={handleSubmit}
        className="mt-8 space-y-6 rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-md)] sm:p-8"
      >
        <div className="flex items-center gap-5">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border bg-muted">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
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
              htmlFor="logo-file"
              className="inline-flex cursor-pointer items-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-accent"
            >
              {uploading ? "Uploading…" : "Upload logo"}
            </Label>
            <input
              id="logo-file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleLogo(f);
              }}
            />
            <p className="mt-2 text-xs text-muted-foreground">PNG, JPG, max 5MB.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Host name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Indie Makers Berlin"
            maxLength={80}
            required
          />
          {name && (
            <p className="text-xs text-muted-foreground">
              URL: <span className="font-mono">/hosts/{slugify(name) || "…"}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="bio">Short bio</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="What kind of events do you run?"
            rows={4}
            maxLength={500}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-email">Contact email</Label>
          <Input
            id="contact-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hello@example.com"
            maxLength={255}
          />
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="rounded-xl shadow-sm transition hover:shadow-[var(--shadow-glow)]"
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Creating…" : "Create host"}
          </Button>
        </div>
      </form>
    </section>
  );
}
