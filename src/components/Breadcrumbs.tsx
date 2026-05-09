import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { Fragment } from "react";

export type Crumb = {
  label: string;
  to?: string;
  params?: Record<string, string>;
};

/**
 * Breadcrumb navigation for host/admin pages.
 * The last item is rendered as the current page (no link).
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link
            to="/"
            aria-label="Home"
            className="inline-flex items-center transition hover:text-foreground"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
        </li>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              <li className="min-w-0">
                {isLast || !item.to ? (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className="truncate font-medium text-foreground"
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    to={item.to}
                    params={item.params as never}
                    className="truncate transition hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
