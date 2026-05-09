import { Link } from "@tanstack/react-router";
import { Github, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-12 border-t border-border/60 bg-gradient-to-b from-transparent to-muted/30">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:px-6">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-4 w-4 rounded-md"
            style={{ background: "var(--gradient-primary)" }}
            aria-hidden
          />
          <p>© {new Date().getFullYear()} Gather</p>
        </div>

        <nav className="flex items-center gap-4">
          <Link to="/" className="transition-colors hover:text-foreground">
            Discover
          </Link>
          <Link to="/host/new" className="transition-colors hover:text-foreground">
            Become a host
          </Link>
        </nav>

        <div className="flex items-center gap-1.5">
          <a
            href="#"
            aria-label="Twitter"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Twitter className="h-3.5 w-3.5" />
          </a>
          <a
            href="#"
            aria-label="GitHub"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
