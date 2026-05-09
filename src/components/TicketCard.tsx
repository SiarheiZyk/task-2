import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarIcon, MapPin, Globe, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadIcs } from "@/lib/ics";

type Props = {
  ticketCode: string;
  attendeeName: string;
  event: {
    id: string;
    title: string;
    description?: string | null;
    start_at: string;
    end_at: string | null;
    timezone: string;
    venue: string | null;
    online_link: string | null;
  };
};

function safeFmt(iso: string, tz: string, p: string) {
  try {
    return formatInTimeZone(new Date(iso), tz, p);
  } catch {
    return format(new Date(iso), p);
  }
}

export function TicketCard({ ticketCode, attendeeName, event }: Props) {
  const dateLabel = safeFmt(event.start_at, event.timezone, "EEE, MMM d 'at' h:mm a");
  const tzAbbr = safeFmt(event.start_at, event.timezone, "zzz");

  return (
    <Card className="overflow-hidden rounded-2xl border-primary/30 shadow-[var(--shadow-md)]">
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-5 py-3 text-xs font-medium uppercase tracking-wider text-primary">
        Your ticket
      </div>
      <CardContent className="space-y-5 p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-xl border bg-white p-3 shadow-sm">
            <QRCodeSVG value={ticketCode} size={160} level="M" />
          </div>
          <div className="font-mono text-[11px] tracking-wider text-muted-foreground">
            {ticketCode.slice(0, 8).toUpperCase()}
          </div>
        </div>

        <div className="space-y-2 border-t pt-4 text-sm">
          <div className="font-semibold leading-snug">{event.title}</div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <CalendarIcon className="mt-0.5 h-3.5 w-3.5" />
            <span>
              {dateLabel} <span className="opacity-70">({tzAbbr})</span>
            </span>
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            {event.venue ? (
              <>
                <MapPin className="mt-0.5 h-3.5 w-3.5" />
                <span>{event.venue}</span>
              </>
            ) : (
              <>
                <Globe className="mt-0.5 h-3.5 w-3.5" />
                <span>Online</span>
              </>
            )}
          </div>
          <div className="text-muted-foreground">
            Attendee: <span className="text-foreground">{attendeeName}</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full rounded-xl"
          onClick={() =>
            downloadIcs({
              uid: ticketCode,
              title: event.title,
              description: event.description ?? undefined,
              location: event.venue ?? event.online_link ?? undefined,
              startISO: event.start_at,
              endISO: event.end_at,
            })
          }
        >
          <Download className="mr-2 h-4 w-4" />
          Add to calendar
        </Button>
      </CardContent>
    </Card>
  );
}
