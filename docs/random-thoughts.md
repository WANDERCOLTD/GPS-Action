# Random Thought Log

_A capture-and-investigate stream for ideas as they occur. Lightweight by design — anything substantive graduates to a scenario, parking-lot entry, or session brief via promotion._

---

## How this works

- **Capture.** Any user message starting with `RT:` becomes a new entry here, auto-numbered `RT-NNN`, with today's date.
- **Investigate.** When an entry is captured, a background agent reads the codebase, scenarios, decision log, and parking lot, then appends findings under the entry: clarifying questions, overlap with existing work, an implementation sketch, and a promotion suggestion.
- **Promote.** Typing `RT-promote: RT-NNN` moves the thought to its proper home (a scenario, a parking-lot entry, or a session brief). The entry stays here, marked with its destination so the trail is preserved.
- **Reject / park.** Typing `RT-reject: RT-NNN <reason>` marks the thought as not-going-anywhere; the entry stays for posterity.

Entries auto-commit direct to `main` per the documented exception in CLAUDE.md — this is a personal thought stream, not engineering code, and PR-per-thought would be too heavy for the cadence.

---

## Entry format

Each entry follows this shape (the agent fills in everything below `**Status:**`):

```markdown
## RT-NNN — YYYY-MM-DD

**Thought:** <verbatim user thought, RT: prefix stripped>

**Status:** new (awaiting agent investigation)

### Agent investigation

#### Clarifying questions

1. ...

#### Overlap with existing work

- ...

#### Implementation sketch

- ...

#### Promotion suggestion

- Recommended destination: <parking-lot | scenario | brief | reject>
- Reason: ...
```

After the agent completes, **Status** flips to `investigated · YYYY-MM-DD`.
After promotion, **Status** flips to `promoted to <destination> · YYYY-MM-DD`.
After rejection, **Status** flips to `rejected · YYYY-MM-DD — <reason>`.

---

## Index

_Most recent first. Populated as entries are added._

- RT-001 — feed-card UX pattern: best modern practice for expand/collapse, with PRIMARY CTA + title/small image as the anchor (2-column chips on the table).

---

## Entries

## RT-001 — 2026-04-28

**Thought:** do thinking of best UX modern practices. Remeber: key thing it the PRIMARY CTA (and title/small image). we could even have 2 columns of post 'chips' - anyway: find me best pattern.

**Context:** triggered by the prior conversation thread — feed cards in `components/PostCard.tsx` currently render the full body of every post with no clamp / chevron / expand-collapse, and there's no plan for it anywhere (checked decision-log, parking-lot, scenarios, engineering-roadmap, briefs). This RT is the capture for that gap, with Paul's framing: the primary CTA + title + small image are the anchors, body is secondary, and a denser 2-column chip layout is on the table.

**Status:** new (awaiting agent investigation)
