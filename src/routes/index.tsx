import { createFileRoute } from "@tanstack/react-router";

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
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        Discover events
      </h1>
      <p className="mt-4 max-w-xl text-base text-muted-foreground">
        Browse upcoming events, RSVP in seconds, and get a QR ticket for check-in.
      </p>
    </section>
  );
}
