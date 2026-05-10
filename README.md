# Gather — Usage Guide

Gather is a free event hosting platform (think a simpler lu.ma). This guide
walks through the four main flows end-to-end so you can use the deployed app
with confidence:

1. **Publish** an event as a host
2. **RSVP** as an attendee
3. **Ticket** — view, save, and share your QR
4. **Check-in** at the door

Each section lists the exact steps, where to click, and what to expect.

---

## Before you start

- **Anyone** can browse the homepage (`/`), event pages (`/events/:id`), and
  host pages (`/hosts/:slug`) without signing in.
- **Signing in** is required to RSVP, host events, upload gallery photos,
  submit reports, or check guests in.
- Sign-in preserves where you came from: if you click **RSVP** while signed
  out, you'll land back on the same event after authenticating
  (`/sign-in?redirect_to=...`).

To create an account or sign in, click **Sign in** in the header (or visit
`/sign-in`). Email + password and Google sign-in are both supported.

---

## Flow 1 — Publish an event (Host)

### 1.1 Create a host profile

A "host" is the org or persona that publishes events. You can belong to
multiple hosts. The first time you want to publish, you need a host.

1. Sign in.
2. Open the host switcher in the header, or go to **`/host/new`**.
3. Fill in:
   - **Name** — public host name (e.g. "Indie Makers Berlin").
   - **Slug** — used in your public URL `/hosts/<slug>`.
   - **Bio** and **logo** (optional, used on your host page and social
     previews).
4. Click **Create host**. You're now the **owner** of this host and can
   invite others.

### 1.2 (Optional) Invite teammates

From `/host/dashboard` → **Team** section:

- **Invite by email** — generates an invitation link. Send it to the person.
  When they open `/invite/:token` while signed in, they're added to the host.
- Choose a role:
  - **host** — full control of the host's events.
  - **checker** — can only access the check-in page for your events.

### 1.3 Create the event

1. Go to **`/host/dashboard`** and click **New event** (or visit
   **`/host/events/new`**).
2. Fill the form:
   - **Cover image** — PNG/JPG, max 5MB. Used on cards and as the social
     preview image (`og:image`).
   - **Title** (required) and **description** (markdown supported).
   - **Starts** / **Ends** (required, end must be after start).
   - **Timezone** — IANA name (e.g. `Europe/Berlin`). Defaults to your
     browser timezone. Times will display in each viewer's local time but
     are always labeled with the event's timezone.
   - **Location** — either an in-person **venue address** OR an
     **online link**.
   - **Capacity** — leave blank for unlimited. When set, FIFO waitlist
     activates once full.
   - **Visibility**:
     - **Public** — appears on Explore and the host page.
     - **Unlisted** — accessible only by direct link.
   - **Pricing** — Free only. Paid is "Coming soon" and disabled.

### 1.4 Save as draft or publish

Two buttons at the bottom:

- **Save Draft** — only you (and your host team) can see it.
- **Publish** — the event becomes live.
  - Public events show on the homepage `/` (Explore) and the host page.
  - Unlisted events are reachable only via the direct link.

You can always come back to **`/host/events/:id/edit`** to update details
or unpublish.

---

## Flow 2 — RSVP as an attendee

### 2.1 Find an event

- Browse **`/`** (Explore) for upcoming public events.
- Open a host page **`/hosts/:slug`** to see all of their events.
- Or open a direct link to an unlisted event.

Past events stay browsable but show an **Ended** badge and the RSVP button
is hidden.

### 2.2 RSVP

On the event page **`/events/:id`**:

1. Click **RSVP**.
   - If signed out, you're redirected to sign in and bounced back here
     automatically.
2. The result depends on capacity (enforced server-side in the
   `create_rsvp` function with row-level locking — no double-booking):
   - **Going** — there's space; you instantly get a ticket.
   - **Waitlisted** — capacity is full; you join a FIFO waitlist and see
     your position.
3. You can **Cancel RSVP** any time from the same page or from
   **`/my-events`**.
   - Cancellation auto-promotes the next person on the waitlist (atomic,
     real-time). The promoted attendee sees their status flip to **Going**
     live without refreshing.

### 2.3 Add to calendar

After RSVPing, click **Add to Calendar**. This generates a `.ics` file
client-side that works with Google Calendar, Apple Calendar, Outlook, etc.
The event is added in its original timezone.

---

## Flow 3 — Your ticket

Tickets are shown in-app. There are no email confirmations.

### 3.1 View your ticket

1. Go to **`/my-tickets`** (link in the header once signed in).
2. You'll see a card per upcoming event you're "Going" to, each with:
   - Event title, date, location.
   - A **QR code** containing a unique ticket code (UUID).
   - The raw code printed below the QR (in case the host needs to type it).

### 3.2 Showing it at the door

Open `/my-tickets` on your phone — the QR fits within a 375px viewport and
is high-contrast for scanning. The host will scan or type the code shown.

### 3.3 Where else you can manage RSVPs

- **`/my-events`** — full list of upcoming and past events you've RSVPed to,
  with a **Cancel RSVP** button.

---

## Flow 4 — Check-in (Host or Checker)

### 4.1 Open the check-in page

1. Sign in as a **host** or **checker** for the event.
2. From **`/host/dashboard`**, click **Check-in** on the event row, or go
   directly to **`/host/events/:id/check-in`**.
3. If you don't have access, you'll see "Access denied" and a link back to
   the dashboard.

### 4.2 The check-in screen

At the top you see live stats (updated via Realtime — no refresh needed):

- **Going** — confirmed RSVPs.
- **Checked-in** — `<scanned> / <going>`.
- **Waitlist** — current waitlist size.

### 4.3 Check a guest in

1. The **Ticket code** input is auto-focused.
2. Ask the guest to show their `/my-tickets` page. Either:
   - **Scan the QR with any external scanner app** that fills the input
     (no built-in camera scanning by design), or
   - **Type / paste** the ticket code shown under their QR.
3. Press **Enter** or click **Check in**. The server function
   `check_in_ticket` runs atomically and you'll see one of:
   - ✅ **Checked in: \<Name\>** — success.
   - ⚠️ **Already checked in at H:MM AM/PM** — duplicate scan, ignored.
   - ❌ **Invalid code** — code doesn't exist or is malformed.
   - ❌ **Ticket is for a different event** — wrong event.
   - ❌ **RSVP is not confirmed** — guest is on waitlist or canceled.
4. The input clears and refocuses immediately so you can scan the next guest.

### 4.4 Recent check-ins & undo

- The right-hand list shows the **last 10 check-ins** in this session with
  the time scanned.
- Click **Undo last scan** to reverse the most recent check-in (e.g. a
  mis-scan). Counts update live.

---

## After the event

### Host dashboard (`/host/dashboard`)

For each event you can:

- **Export CSV** — downloads `event-rsvps-<slug>.csv` with columns
  `name, email, status, waitlist_position, checked_in_at, created_at`.
  Only hosts/checkers of the event can export (enforced by
  `export_event_rsvps`).
- **Reports** — review user reports on your events or gallery photos.
  - **Hide** — removes the event from Explore (or photo from the gallery)
    everywhere publicly.
  - **Dismiss** — clears the report from the queue, content stays visible.
- **Gallery moderation** — approve or reject photos attendees uploaded.
  Photos are **pending** until approved.

### Attendees

- Submit **feedback** on events you attended from the event page.
- **Report** an event or gallery photo using the **Report** button — enter
  a reason and submit. The report goes straight to that content's host.

---

## Quick route reference

| Route | Purpose |
|---|---|
| `/` | Explore upcoming public events |
| `/events/:id` | Event details + RSVP |
| `/hosts/:slug` | Public host page |
| `/sign-in` | Auth (preserves `redirect_to`) |
| `/my-tickets` | Your QR tickets |
| `/my-events` | RSVPs you've made |
| `/profile` | Your profile settings |
| `/host/new` | Create a host |
| `/host/dashboard` | Manage events, team, reports, exports |
| `/host/events/new` | Create an event |
| `/host/events/:id/edit` | Edit an event |
| `/host/events/:id/check-in` | Check guests in |
| `/invite/:token` | Accept a host team invite |

---

## Troubleshooting

- **"RSVP" button isn't showing** — the event has ended, or you're
  already RSVPed (look for **Cancel RSVP**).
- **Stuck on the waitlist** — you'll be auto-promoted when someone
  cancels; the page updates live, no refresh required.
- **Check-in says "Invalid code"** — make sure you scanned the code from
  `/my-tickets`, not the event ID. Codes are UUIDs (8-4-4-4-12 hex).
- **Can't access `/host/dashboard`** — you're not a member of any host
  yet. Create one at `/host/new`.
- **Can't export CSV / open check-in for an event** — you're not a host
  or checker of that event. Ask the owner to invite you from their host
  dashboard.
