# `app/capabilities/` — SRS capabilities mockup

A static, marketing-style landing page that maps every module of the
canonical SRS (`docs/feature-spec/GPS_Software_Requirements_v1.1.docx`)
onto a tile, with a status badge sourced from
`docs/build/srs-coverage.md`.

Reached at `/capabilities`. Public — no auth gate.

**Build Unit:** none (one-off showcase page, not a feature build).
Last refresh against the audit: `chore/capabilities-refresh-20260511`.
**Spec:** `docs/build/srs-coverage.md`

---

## What it is

- Hero band with the **only real link** on the page: a primary CTA
  "Open the App" → `/feed`. Sub-counter splits shipped SRS tiles
  from shipped beyond-SRS surfaces so the headline number isn't
  misleading (most of the shipped product sits outside SRS v1.1).
- One section per SRS module (§4 Intelligence Gathering through §14
  Councillor Campaign Engine), plus §19 Networks addendum, §3 Roles,
  §15 NFRs and §16 Integrations.
- A final **"Beyond the SRS"** section catalogues phantom features
  shipped under the D001 / D002 post-first reframe — Coordination
  Feed, Network Feed, Coordination Board, Composer + Intent Picker,
  Nav Tabs, Reactions, Comments, Cultural-moment posts, Tick-or-cross,
  Hero images, Demo mode, Feature flags, Spec-traceability, Honest
  reach metrics, Self-dispatch, Admin tools. Source of truth for the
  list: the "Phantom features" appendix in `srs-coverage.md`.
- Each tile uses an SRS-verbatim phrase (or BU/decision ref for
  phantom tiles), the section reference, a Lucide icon, and one of
  five status badges.

## Status legend

| Badge              | Meaning                                          |
| ------------------ | ------------------------------------------------ |
| Shipped            | Live in the codebase today                       |
| Partial            | Some shipped, bounded gap remains                |
| Future build       | Native build pending — brief / roadmap row       |
| Future integration | Possible via 3rd-party (Whisper, SendGrid, etc.) |
| Not done           | Nothing shipped, no decision either way          |

## What it isn't

- Not interactive. Tiles do nothing on click.
- Not a navigation page. The only working entry point is `/feed`.
- Not connected to live data. Tile statuses are hard-coded from the
  audit and will go stale; refresh by re-reading `srs-coverage.md`
  when the audit updates.
