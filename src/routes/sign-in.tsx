import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Search = { redirect_to?: string };

export const Route = createFileRoute("/sign-in")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    redirect_to: typeof s.redirect_to === "string" ? s.redirect_to : undefined,
  }),
  head: () => ({
    meta: [{ title: "Sign in — Gather" }],
  }),
  component: SignInPage,
});

function SignInPage() {
  const { redirect_to } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const safeRedirect = redirect_to && redirect_to.startsWith("/") ? redirect_to : "/";

  useEffect(() => {
    if (user) {
      navigate({ to: safeRedirect, replace: true });
    }
  }, [user, navigate, safeRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const emailRedirectTo = `${window.location.origin}${safeRedirect}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Check your email for a magic link");
  };

  return (
    <section className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4 py-16 sm:px-6">
      <div className="rounded-2xl border border-border/60 bg-card p-8 shadow-[var(--shadow-md)]">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Gather</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll email you a magic link — no password needed.
        </p>

        {sent ? (
          <div className="mt-6 rounded-xl border border-border/60 bg-muted/40 p-4 text-sm">
            Magic link sent to <strong>{email}</strong>. Open it on this device to sign in.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              className="w-full rounded-xl"
              disabled={submitting || !email}
            >
              {submitting ? "Sending…" : "Send magic link"}
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
