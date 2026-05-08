import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Discover events — Gather" },
      { name: "description", content: "Find and RSVP to events near you." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--gradient-subtle)" }}
    >
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[680px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
        <span className="inline-flex items-center rounded-full border border-border/70 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
          New · Events made effortless
        </span>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
          Discover events
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Browse upcoming events, RSVP in seconds, and get a QR ticket for check-in.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button
            size="lg"
            className="rounded-xl shadow-[var(--shadow-md)] transition-all duration-200 hover:shadow-[var(--shadow-glow)] hover:-translate-y-0.5"
          >
            Browse events
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="rounded-xl bg-card/60 backdrop-blur transition-all duration-200 hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
          >
            Host an event
          </Button>
        </div>
      </div>
    </section>
  );
}
