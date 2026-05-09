import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

/**
 * Format an ISO timestamp in the given timezone using a date-fns pattern.
 * Falls back to local formatting if the timezone is invalid.
 */
export function formatEventDate(iso: string, tz: string | null | undefined, pattern: string): string {
  try {
    if (tz) return formatInTimeZone(new Date(iso), tz, pattern);
    return format(new Date(iso), pattern);
  } catch {
    return format(new Date(iso), pattern);
  }
}

/**
 * Returns the timezone short name (e.g. "PST") for an instant.
 */
export function tzAbbr(iso: string, tz: string | null | undefined): string {
  try {
    if (tz) return formatInTimeZone(new Date(iso), tz, "zzz");
    return format(new Date(iso), "zzz");
  } catch {
    return "";
  }
}

/**
 * Compact event date for cards/lists, e.g. "Mar 15, 7:00 PM (PST)".
 */
export function formatEventDateShort(iso: string, tz: string | null | undefined): string {
  const date = formatEventDate(iso, tz, "MMM d, h:mm a");
  const abbr = tzAbbr(iso, tz);
  return abbr ? `${date} (${abbr})` : date;
}

/**
 * Long event date for headings, e.g. "Sat, Mar 15, 2026 at 7:00 PM (PST)".
 */
export function formatEventDateLong(iso: string, tz: string | null | undefined): string {
  const date = formatEventDate(iso, tz, "EEE, MMM d, yyyy 'at' h:mm a");
  const abbr = tzAbbr(iso, tz);
  return abbr ? `${date} (${abbr})` : date;
}
