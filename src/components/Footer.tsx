import { Link } from "@tanstack/react-router";
import { Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border/60 bg-gradient-to-b from-transparent to-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="space-y-3">
            <Link to="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
              <span
                className="inline-block h-8 w-8 rounded-xl shadow-[var(--shadow-glow)] ring-1 ring-white/20"
                style={{ background: "var(--gradient-primary)" }}
                aria-hidden
              />
              <span>Gather</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Events made simple. Host, RSVP, and check in — all in one place.
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/" className="text-muted-foreground transition-colors hover:text-foreground">
                  Discover events
                </Link>
              </li>
              <li>
                <Link to="/host/new" className="text-muted-foreground transition-colors hover:text-foreground">
                  Become a host
                </Link>
              </li>
              <li>
                <Link to="/my-tickets" className="text-muted-foreground transition-colors hover:text-foreground">
                  My tickets
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Connect</h4>
            <div className="flex items-center gap-2">
              <a
                href="#"
                aria-label="Twitter"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-md"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a
                href="#"
                aria-label="GitHub"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:text-foreground hover:shadow-md"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Gather. All rights reserved.</p>
          <p>Built with care.</p>
        </div>
      </div>
    </footer>
  );
}
