import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentHost } from "@/hooks/use-current-host";

export function HostSwitcher() {
  const { hosts, current, setHostId } = useCurrentHost();

  if (hosts.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition hover:bg-accent">
        <span className="inline-block h-5 w-5 overflow-hidden rounded-md border bg-muted">
          {current?.logo_url ? (
            <img src={current.logo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span
              className="block h-full w-full"
              style={{ background: "var(--gradient-primary)" }}
            />
          )}
        </span>
        <span className="max-w-[160px] truncate">{current?.name ?? "Select host"}</span>
        <ChevronDown className="h-4 w-4 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <DropdownMenuLabel>Switch host</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hosts.map((h) => (
          <DropdownMenuItem
            key={h.id}
            onSelect={() => setHostId(h.id)}
            className="flex items-center gap-2"
          >
            <span className="inline-block h-6 w-6 overflow-hidden rounded-md border bg-muted">
              {h.logo_url ? (
                <img src={h.logo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span
                  className="block h-full w-full"
                  style={{ background: "var(--gradient-primary)" }}
                />
              )}
            </span>
            <span className="flex-1 truncate">{h.name}</span>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              {h.role}
            </span>
            {current?.id === h.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
