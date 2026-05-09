import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Accept invitation — Gather" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({
        to: "/sign-in",
        search: { redirect_to: `/invite/${token}` },
        replace: true,
      });
      return;
    }
    let cancelled = false;
    (async () => {
      setAccepting(true);
      const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
      if (cancelled) return;
      setAccepting(false);
      if (error) {
        setError(error.message);
        return;
      }
      const result = data as { status: string };
      if (result.status === "ok") {
        toast.success("You've joined the team!");
        navigate({ to: "/host/dashboard", replace: true });
      } else if (result.status === "expired") {
        setError("This invitation has expired.");
      } else if (result.status === "used") {
        setError("This invitation has already been used.");
      } else {
        setError("This invitation link is invalid.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, token, navigate]);

  if (loading || !user || accepting) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mx-auto max-w-md px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold">Can't accept invite</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Button asChild variant="outline" className="mt-6 rounded-xl">
          <Link to="/">Back to events</Link>
        </Button>
      </section>
    );
  }

  return null;
}
