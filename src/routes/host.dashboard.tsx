import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/host/dashboard")({
  head: () => ({ meta: [{ title: "Host dashboard — Gather" }] }),
  component: HostDashboard,
});

type HostRow = {
  role: string;
  hosts: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    bio: string | null;
  } | null;
};

function HostDashboard() {
  const { user, loading } = useRequireAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["my-hosts", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<HostRow[]> => {
      const { data, error } = await supabase
        .from("host_members")
        .select("role, hosts:host_id ( id, name, slug, logo_url, bio )")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as HostRow[];
    },
  });

  if (loading || !user) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-6 h-48 w-full rounded-2xl" />
      </section>
    );
  }

  const hosts = (data ?? []).filter((r) => r.hosts);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link
        to="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to events
      </Link>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Host dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hosts you own or are a member of.
          </p>
        </div>
        <Button asChild className="rounded-xl shadow-sm hover:shadow-[var(--shadow-glow)]">
          <Link to="/host/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New host
          </Link>
        </Button>
      </div>

      <div className="mt-8">
        {isLoading ? (
          <Skeleton className="h-48 w-full rounded-2xl" />
        ) : hosts.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/40 px-6 py-16 text-center">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Users className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">No hosts yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a host to start publishing events.
            </p>
            <Button asChild className="mt-5 rounded-xl">
              <Link to="/host/new">Create a host</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {hosts.map((m) => (
              <Card
                key={m.hosts!.id}
                className="rounded-2xl transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
              >
                <CardContent className="flex gap-4 p-5">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
                    {m.hosts!.logo_url ? (
                      <img
                        src={m.hosts!.logo_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: "var(--gradient-primary)" }}
                        aria-hidden
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      to="/hosts/$slug"
                      params={{ slug: m.hosts!.slug }}
                      className="font-semibold hover:text-primary"
                    >
                      {m.hosts!.name}
                    </Link>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">
                      {m.role}
                    </div>
                    {m.hosts!.bio && (
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                        {m.hosts!.bio}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
