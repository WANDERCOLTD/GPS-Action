# GPS Action — Documentation Index

*The map of every document in the GPS Action project. If you're lost, start here.*

*Version: 0.1 · April 2026*

---

## Start here

**If you're new to the project:**
1. Read `GPS_Action_Proposal_for_Jeremy.pdf` (2-page proposal, lay audience)
2. Read `GPS_Action_Pilot_Charter.docx` (4 pages, broader context)
3. Skim `GPS_Action_Feature_Spec_v0.5.docx` (current feature truth)
4. Look at `GPS_Action_Prototype.html` to see how it feels
5. Come back to this index for specific questions

**If you're about to write code:**
1. Read `GPS_Action_Feature_Spec_v0.5.docx` §1 primitives and relevant feature section
2. Read the `GPS_Action_Session_Brief_Template.md`
3. Read `GPS_Action_Security_Baseline.md`
4. Consult `GPS_Action_Scenarios.md` for the relevant role × feature
5. Write your brief, have it reviewed, then execute

**If you're reviewing completed work:**
1. `GPS_Action_Reviewer_Checklist.md` is your guide
2. Reference the original session brief
3. Reference `GPS_Action_Security_Baseline.md` for security items
4. Reference `GPS_Action_Scenarios.md` for behavioural validation

---

## Documents by purpose

### Vision & framing

| Document | Purpose | Audience |
|---|---|---|
| `GPS_Action_Proposal_for_Jeremy.pdf` | Director-level sign-off proposal | Directors, partners |
| `GPS_Action_Pilot_Charter.docx` | Pilot-phase framing and approach | Directors, coordinators |
| `GPS_Action_Types_for_Jeremy.pdf` | Action-types decision document | Director (sign-off pending) |

### Feature specification

| Document | Purpose | Status |
|---|---|---|
| `GPS_Action_Feature_Spec_v0.5.docx` | **Canonical feature spec — current** | Active (v0.5) |
| `GPS_Action_Feature_Spec_v0.4.docx` | Previous version | Superseded |
| `GPS_Action_Feature_Spec_v0.3.docx` | Older version | Superseded |
| `GPS_Action_Feature_Spec_v0.2.docx` | Early version | Superseded |
| `GPS_Action_Feature_List_and_Planning.docx` | Initial feature list | Reference only |

### Design system

| Document | Purpose |
|---|---|
| `gps-tokens.css` | All design tokens — colours, spacing, typography (canonical) |
| `gps-components.css` | Reusable component styles built on tokens |
| `GPS_Action_Design_Guide.pdf` | Human-readable design reference (11 pages) |
| `GPS_Action_Mood_Board.html` | Live design system showcase with theme switcher |
| `GPS_Action_Prototype.html` | Clickable prototype, 11 realistic posts |

### Engineering / build process

| Document | Purpose |
|---|---|
| `GPS_Action_Session_Brief_Template.md` | Template for every Claude Code session |
| `GPS_Action_Reviewer_Checklist.md` | Post-session review process |
| `GPS_Action_Security_Baseline.md` | Data protection and security rules |
| `GPS_Action_Ratchet_Discipline.md` | Process rules for forward-only progress |
| `GPS_Action_Change_Absorption_Guide.md` | Hard vs soft vs disposable system parts |

### Product thinking & decisions

| Document | Purpose |
|---|---|
| `GPS_Action_Scenarios.md` | Lived-in walkthroughs per role × feature |
| `GPS_Action_Parking_Lot.md` | Ideas captured but not yet built |
| `GPS_Action_Decision_Log.md` | Every significant decision + reasoning |

### Operational

| Document | Purpose |
|---|---|
| `GPS_Action_WhatsApp_Routing_Matrix.xlsx` | 20 WhatsApp routes mapped to post types |
| `GPS_Action_Taxonomy_Reference.docx` | Post type / action type taxonomy explained |
| `GPS_Producer_Journey_Screens.docx` | Producer role walkthrough |
| `GPS_Reactive_Activist_Journey_Screens_v2.docx` | Reactive member walkthrough |

---

## The "which document answers this?" cheatsheet

### Questions about features (what does the app do?)
→ Feature Spec v0.5

### Questions about design (what does it look like?)
→ Design Guide PDF + Mood Board + gps-tokens.css

### Questions about a specific user flow (what does member X do?)
→ Scenarios document (find the relevant scenario)

### Questions about "should we build Y?"
→ Parking Lot (status might be PARKED / DEFERRED / DECLINED)

### Questions about "why was it built this way?"
→ Decision Log (find the relevant entry)

### Questions about code structure / architecture
→ (Coming) ERD + API contract documents

### Questions about how to build a specific feature
→ Session Brief Template + relevant Feature Spec section + Scenarios

### Questions about security
→ Security Baseline

### Questions about review process
→ Reviewer Checklist

### Questions about build sequencing
→ Ratchet Discipline + Phase documents (coming)

### Questions about absorbing a new requirement
→ Change Absorption Guide + Ratchet Discipline

### Questions about WhatsApp routing
→ Routing Matrix xlsx + §3.13 of Feature Spec

---

## Document maturity

As of April 2026, status of each document:

**Stable — referenced frequently:**
- Feature Spec v0.5 (active)
- gps-tokens.css, gps-components.css
- Design Guide PDF
- Security Baseline
- Ratchet Discipline
- Change Absorption Guide

**Living — will grow during build:**
- Decision Log (appends as decisions made)
- Parking Lot (ideas land continuously)
- Scenarios (expands per new feature)
- Routing Matrix (updates as routes confirmed/added)

**Transitional — superseded by new versions:**
- Feature Spec v0.2, v0.3, v0.4 (kept for history)
- Taxonomy Reference (partially superseded by v0.5 spec)
- Early journey docs (superseded by Scenarios library)

**Coming but not yet built:**
- ERD and database schema document
- API contract (tRPC router skeleton)
- Component inventory (parallel session map)
- Build phase document (week-by-week plan)
- Repository skeleton (directory layout, lint rules)

---

## Version history of the overall project

- **Early April 2026** — initial engagement, WhatsApp observation, reframe from "information management" to "post-first platform"
- **Mid April 2026** — feature spec v0.1-v0.3, design system, prototype, pilot charter, action types defined
- **Late April 2026** — v0.4 (vouching, vetting, routes, nav), v0.5 (self-dispatch, dispatch indicator, auto-comments, edit audit)
- **Late April 2026** — Partner organisations feature added (pending v0.6 spec)
- **Late April 2026** — engineering discipline documents created (this batch)

Next phase:
- ERD + API contracts
- Component inventory
- Build plan with session briefs
- Actual build begins

---

## How this index evolves

Every time a new document is added to the project:
1. Add it to the relevant section above
2. Note its purpose in one line
3. Note its status (stable / living / transitional / coming)

Every time a document is superseded:
1. Move to Transitional section
2. Note what superseded it

Keep this index as the map of everything. When someone asks "where's the thing about X?" — this document answers.
