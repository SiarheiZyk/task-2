import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/"
          className="group flex items-center gap-2 font-semibold tracking-tight transition-opacity hover:opacity-90"
        >
          <span
            className="inline-block h-7 w-7 rounded-xl shadow-[var(--shadow-glow)] transition-transform duration-200 group-hover:scale-105"
            style={{ background: "var(--gradient-primary)" }}
            aria-hidden
          />
          <span className="text-base">Gather</span>
        </Link>
        <Button
          asChild
          size="sm"
          className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5"
        >
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    </header>
  );
}
