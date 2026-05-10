import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { HostSwitcher } from "@/components/HostSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onHostRoute = pathname.startsWith("/host");
  const [profile, setProfile] = useState<{ name: string | null; avatar_url: string | null } | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user]);

  const initials = (profile?.name || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 shadow-[0_1px_0_0_oklch(0_0_0/0.02),0_8px_24px_-16px_oklch(0.2_0.05_270/0.15)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2.5 font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <span
            className="inline-block h-8 w-8 rounded-xl shadow-[var(--shadow-glow)] ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105 group-hover:rotate-3"
            style={{ background: "var(--gradient-primary)" }}
            aria-hidden
          />
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-base text-transparent">
            Gather
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {user && onHostRoute && <HostSwitcher />}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Account menu"
              >
                <Avatar className="h-9 w-9 border border-border/60 shadow-sm transition hover:shadow-[var(--shadow-glow)]">
                  {profile?.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
                  <AvatarFallback className="bg-muted text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-xl">
              <DropdownMenuLabel className="truncate">
                {profile?.name || user.email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: "/my-tickets" })}>
                My Tickets
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: "/my-events" })}>
                My Events
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: "/host/dashboard" })}>
                Host Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate({ to: "/host/new" })}>
                Become a Host
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await signOut();
                  navigate({ to: "/" });
                }}
              >
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            asChild
            size="sm"
            className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5"
          >
            <Link to="/sign-in">Sign in</Link>
          </Button>
        )}
        </div>
      </div>
    </header>
  );
}
