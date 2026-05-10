# Project Report

## App access

The app is available here: <https://gather-together-events.lovable.app/>

## Auto generated CSV

Please see **event-rsvps-pitch-practice.csv** in the root of the project — an example file demonstrating the correct schema.

## Tools and Techniques Used

### Tools

- **Lovable** — primary AI builder for full-stack code generation (React + TypeScript + Tailwind + shadcn/ui frontend, Supabase backend).
- **Supabase** — Postgres database, authentication (magic link), Row Level Security, storage for images, and Realtime for live counters and waitlist promotions.
- **Claude** — used as a planning and prompt-engineering assistant: to analyze requirements, design the database schema, generate step-by-step prompts for Lovable, and review the output between iterations.
- **GitHub** — version control and submission artifact, with the project placed in the required `task-2/` folder.

### Process / Techniques

During the development with lovable I used these steps:

1. **Requirements analysis** — read the full task specification carefully and identified all functional areas (publishing, RSVP, waitlist, check-in, gallery, feedback, reports, roles).
2. **Decomposition** — broke the spec down into small, independent feature blocks, each scoped to roughly one Lovable iteration.
3. **Schema design** — designed the database schema upfront on paper before writing any prompt, mapping out tables, relationships, and edge cases (e.g. waitlist position, ticket codes, role membership).
4. **Knowledge setup** — before any feature work, populated Lovable's **Knowledge** section with:
   - The project's tech stack and constraints
   - Code style and naming conventions
   - UI design rules (lu.ma-inspired, shadcn/ui primitives, Tailwind only)
   - Database rules (RLS always on, atomic Postgres functions for risky operations)
   - Business rules from the spec (capacity enforcement, waitlist FIFO, free-only in v1, no camera scanning, etc.)
   - An explicit "do not" list to prevent scope creep and dependency drift
5. **Prompt preparation** — used Claude to draft a sequence of focused, self-contained prompts for Lovable. Each prompt covered one feature area and included clear acceptance criteria.
6. **Iterative delivery** — fed prompts to Lovable **one at a time**, never combining steps.
7. **Validation after each step** — manually tested the result of each prompt against its acceptance criteria before moving on. If something was broken or incomplete, it was fixed with a follow-up prompt before proceeding.
8. **Targeted refinement** — when Lovable misinterpreted a requirement or introduced unrelated changes, used short corrective prompts ("only verify and fix X, do not refactor unrelated code") to keep changes focused.
9. **Final QA** — ran a comprehensive test pass covering anonymous browsing, host registration, event publishing, RSVP, waitlist promotion, check-in, CSV export, gallery moderation, feedback, reports, mobile layout, and RLS security.

---

## What Worked Well

- **Breaking the project into small, focused steps.** Each Lovable prompt covered one concrete feature area (auth, event editor, RSVP flow, check-in, etc.). This dramatically reduced the rate of misinterpretation and made each result easy to verify before moving on.
- **Precise, instruction-style prompts.** Specifying exactly what should happen — including edge cases, button labels, error states, and acceptance criteria — produced much better output than open-ended requests. "Be specific" was the single highest-impact technique.
- **Setting up Knowledge before any feature work.** Filling Lovable's Knowledge section with stack rules, design rules, business rules, and a "do not" list meant Lovable followed conventions automatically across every iteration. It saved many corrective prompts later.
- **Designing the database schema upfront.** Locking the schema before writing prompts prevented painful mid-project refactors and gave Lovable a stable foundation to build against.
- **Validating after every prompt.** Catching issues immediately — before the next layer was built on top — kept the codebase clean and avoided cascading bugs.
- **Using Claude as a planning partner.** Splitting the work between two AI tools — Claude for planning, prompt drafting, and review; Lovable for code generation — produced better results than relying on either alone.
- **Lovable's Supabase integration.** Auth, RLS policies, storage, and Realtime worked smoothly out of the box once correctly prompted, accelerating backend work significantly.

---

## What Did Not Work / Pain Points

- **Race-prone operations** (RSVP capacity check, waitlist promotion, check-in deduplication) needed explicit instruction to wrap in Postgres functions with row-level locks. Lovable's default first attempts handled them in client code, which would have produced race conditions under concurrent use.
- **Lovable occasionally over-edited** — touching unrelated files when asked to change one feature. Adding "do not refactor unrelated code" to follow-up prompts mitigated this.
