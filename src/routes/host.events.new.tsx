import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useCurrentHost } from "@/hooks/use-current-host";
import { Skeleton } from "@/components/ui/skeleton";
import { EventForm, defaultValues, toEventInsert } from "@/components/EventForm";

export const Route = createFileRoute("/host/events/new")({
  head: () => ({ meta: [{ title: "New event — Gather" }] }),
  component: NewEventPage,
});

function NewEventPage() {
  const { user, loading } = useRequireAuth();
  const { current, hosts, isLoading } = useCurrentHost();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  if (loading || !user || isLoading) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-96 w-full rounded-2xl" />
      </section>
    );
  }

  if (hosts.length === 0) {
    return (
      <section className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Become a host first</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You need to create a host before publishing events.
        </p>
        <Link
          to="/host/new"
          className="mt-6 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Create a host
        </Link>
      </section>
    );
  }

  const canEdit = current?.role === "host";

  const handleSubmit = async (values: ReturnType<typeof defaultValues>, status: "draft" | "published") => {
    if (!current) return toast.error("Select a host");
    if (!canEdit) return toast.error("Only hosts can create events");
    setSubmitting(true);
    const payload = toEventInsert(values, current.id, status);
    const { data, error } = await supabase
      .from("events")
      .insert(payload)
      .select("id")
      .single();
    setSubmitting(false);
    if (error || !data) return toast.error(error?.message ?? "Failed to create event");
    toast.success(status === "published" ? "Event published" : "Draft saved");
    navigate({ to: "/host/dashboard" });
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <Link
        to="/host/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Create event</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Hosting as <span className="font-medium text-foreground">{current?.name}</span>
      </p>
      <div className="mt-8">
        <EventForm
          initialValues={defaultValues()}
          submitting={submitting}
          onSubmit={handleSubmit}
        />
      </div>
    </section>
  );
}
