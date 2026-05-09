import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Copy, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EventForm, toEventInsert, toFormValues } from "@/components/EventForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const Route = createFileRoute("/host/events/$id/edit")({
  head: () => ({ meta: [{ title: "Edit event — Gather" }] }),
  component: EditEventPage,
});

function EditEventPage() {
  const { id } = Route.useParams();
  const { user, loading } = useRequireAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["edit-event", id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, host_id, title, description, start_at, end_at, timezone, venue, online_link, capacity, status, visibility, cover_image_url",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: role } = useQuery({
    queryKey: ["event-role", event?.host_id, user?.id],
    enabled: !!event && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("host_members")
        .select("role")
        .eq("host_id", event!.host_id)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.role ?? null;
    },
  });

  if (loading || !user || isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
      </section>
    );
  }

  if (!event) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Event not found</h1>
      </section>
    );
  }

  if (role !== "host") {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Not authorized</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Only hosts can edit events.
        </p>
      </section>
    );
  }

  const handleSubmit = async (values: ReturnType<typeof toFormValues>, status: "draft" | "published") => {
    setSubmitting(true);
    const payload = toEventInsert(values, event.host_id, status);
    const { error } = await supabase.from("events").update(payload).eq("id", event.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event saved");
    navigate({ to: "/host/dashboard" });
  };

  const handleUnpublish = async () => {
    setSubmitting(true);
    const { error } = await supabase.from("events").update({ status: "draft" }).eq("id", event.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Event unpublished");
    navigate({ to: "/host/dashboard" });
  };

  const handleDuplicate = async () => {
    setSubmitting(true);
    const { data, error } = await supabase
      .from("events")
      .insert({
        host_id: event.host_id,
        title: `${event.title} (Copy)`,
        description: event.description,
        start_at: new Date().toISOString(),
        end_at: new Date(Date.now() + 3600_000).toISOString(),
        timezone: event.timezone,
        venue: event.venue,
        online_link: event.online_link,
        capacity: event.capacity,
        cover_image_url: event.cover_image_url,
        visibility: event.visibility,
        is_paid: false,
        status: "draft",
      })
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) {
      toast.error(error?.message ?? "Failed to duplicate");
      return;
    }
    toast.success("Duplicated as draft");
    navigate({ to: "/host/events/$id/edit", params: { id: data.id } });
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Breadcrumbs
        items={[
          { label: "Host dashboard", to: "/host/dashboard" },
          { label: event.title, to: "/events/$id", params: { id: event.id } },
          { label: "Edit" },
        ]}
      />
      <h1 className="text-3xl font-semibold tracking-tight">Edit event</h1>
      <div className="mt-8">
        <EventForm
          initialValues={toFormValues(event)}
          submitting={submitting}
          onSubmit={handleSubmit}
          extraActions={
            <>
              <Button type="button" variant="ghost" className="rounded-xl" onClick={handleDuplicate} disabled={submitting}>
                <Copy className="mr-1.5 h-4 w-4" /> Duplicate
              </Button>
              {event.status === "published" && (
                <Button type="button" variant="outline" className="rounded-xl" onClick={handleUnpublish} disabled={submitting}>
                  <EyeOff className="mr-1.5 h-4 w-4" /> Unpublish
                </Button>
              )}
            </>
          }
        />
      </div>
    </section>
  );
}
