import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-6 w-6 rounded-lg bg-primary" aria-hidden />
          <span className="text-base">Gather</span>
        </Link>
        <Button asChild size="sm" className="rounded-xl">
          <Link to="/">Sign in</Link>
        </Button>
      </div>
    </header>
  );
}
