---
title: SRS v1.1 — Codebase Coverage Audit
status: draft
date: 2026-04-28
authored_by: Paul + Claude
spec_source: docs/feature-spec/GPS_Software_Requirements_v1.1.docx
codebase_ref: 1ed6ed8 (main, 2026-04-28)
---

# SRS v1.1 — Codebase Coverage Audit

Maps every numbered requirement in the canonical SRS (`GPS_Software_Requirements_v1.1.docx`, sections 1–18 + Addendum §19) against the codebase as of `1ed6ed8`. NFRs (§15) are surfaced as their own table. Phantom features — shipped, but not in the SRS — appear in a final appendix.

---

## Plain-English summary (for non-technical readers)

**The SRS is the document the development team was originally given as the blueprint for the GPS platform.** This audit checks that blueprint, line by line, against what has actually been built.

**Headline:** the platform we are building is *not* the platform the SRS describes — and that is mostly intentional, but the SRS has not been updated to reflect those decisions. The SRS imagines a large intelligence-and-campaign system: web crawlers monitoring news and social media, AI generating alerts, automated email campaigns to councillors, a transcription engine for radio and YouTube. What we have actually built so far is a **focused activist coordination feed**: members post calls-to-action, others react, comment, vet, and share via WhatsApp.

**Why the difference?** Two early decisions (recorded in the project's decision log as D001 and D002) reframed GPS Action away from "information management" and toward "post-first community coordination." Most of the SRS's monitoring and intelligence modules were quietly deprioritised at that point. They are not impossible to add later — many would be third-party integrations rather than ground-up builds — but they are not what the team is building today.

**What the SRS still gets right:** the audit log, UK data residency, accessibility target, the role-grant model, the WhatsApp share affordance, and the Activist-Mailer link pattern have all shipped largely as specified.

**What the SRS misses about reality:** roughly fifteen features have shipped that the SRS does not mention at all — the FAB intent picker, comments, reactions, hero images, the cultural-marker visual treatment, the feed-filter chip strip, demo mode, the home-grown feature-flag system, and others. These should be folded into the next version of the SRS.

**The four biggest gaps that need a decision soon:**

1. **The Councillor Campaign Engine** (SRS §14) is marked URGENT in the spec. Zero of it is built. Either it gets briefed and built, or it gets re-tagged as Phase 2.
2. **Multi-Factor Authentication** (NFR-01) is required but not built; this blocks several other modules that say "MFA-protected".
3. **The "Network of Networks" scaffolding** in the §19 Addendum (`networks` table, partner-network tracking, signed enrolment tokens, etc.) was specified as "from day one" Phase 1, but none of it is in the database yet.
4. **The intelligence-gathering and monitoring modules** (SRS §4, §10) are still treated by the SRS as Phase 1 must-haves, even though we have effectively retired them. The spec needs to formally rescope.

**Recommendation:** the next thing to write is **SRS v1.2**, not more code. Once the spec catches up to the decisions already taken, the audit becomes much shorter and the team can focus its remaining build effort on Module 11 and the Networks scaffolding.

The full table-by-table detail follows.

---

## Status legend

| Code | Meaning |
|---|---|
| ✅ Done | Shipped and verified in code or schema |
| 🟡 Partial | Some shipped; bounded gap remains |
| ❌ Not done | Nothing shipped, no decision either way |
| 🛠️ Future build | Native build — brief, roadmap row, or parking-lot entry exists |
| 🔮 Future integration | Possible via 3rd-party platform (SendGrid, Whisper, Brightdata, etc.) |
| 🚫 Out of scope | Consciously declined or replaced (cite ADR / parking-lot) |

## Headline read

The SRS describes an **intelligence-and-campaign platform**: scrapers → alerts → AI-drafted campaigns → councillor engine. The codebase is a **post-first coordination feed** — explicitly reframed by **D001** ("replace WhatsApp coordination with a purpose-built platform") and **D002** ("post-first, not information-management"). The §19 Addendum part-ratified that drift by introducing Networks and Action Groups, but Modules 1–11 of the body remain almost entirely unshipped.

Read this audit as a **checklist for SRS v1.2** rather than a punch-list for engineering. Many ❌ rows below should probably promote to 🚫 once the spec is rewritten.

---

## §1–2 Purpose & System Overview

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | Document framed as authoritative spec | 🟡 | `docs/feature-spec/README.md` marks v1.1 "Current" | Codebase has materially diverged via D001/D002. SRS v1.2 needed. |
| 2 | Venn diagram architecture (Volunteers / R&W / Tech / Coord / Outer reach) | 🚫 | D001, D002 | Outer-reach modules (mass email, talk radio, social removal) were consciously scoped out of MVP. |
| 2 | National + granular regional coordination | 🟡 | `Region` hierarchy in schema | Hierarchy modelled; **regional access-control intentionally not enforced** (D041). |
| 2 | AI assistance throughout | 🛠️ | parking-lot "AI provider choice" OPEN | No LLM hooks anywhere yet. |

---

## §3 User Roles & Access Control

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 3 | Super Admin role | 🟡 | `SystemRole.admin` (schema:46) | Single admin tier; no GPS-vs-network split. |
| 3 | National Coordinator role | ❌ | — | Not modelled. |
| 3 | Regional Volunteer role | 🟡 | `User` + `UserRegion` join | Region tag is informational only per **D041**. |
| 3 | Subscriber (notification-only public) | ❌ | — | No public signup yet. |
| 3 | Read-Only / Analyst role | ❌ | — | |
| 3 | MFA / 2FA on all accounts | ❌ | dev-auth cookie only (BU-001-lite) | Pending BU-auth. NFR-01 also pending. |
| 3 | Manual admin approval before activation | 🟡 | `User.verifiedAt` + BU-requests-vetting | Vetting flow shipped; activation gating not enforced in dev. |
| 3.1 | Hierarchical regions (National > Region > County > Local) | 🟡 | `Region` + `RegionType` (national / region / council) | "Local Authority/Borough" tier flattened to `council`. |
| 3.1 | Implicit "tick parent → grant children" | ❌ | — | No region access-control logic at all. |
| 3.1 | Free combination of region assignments per volunteer | 🟡 | `UserRegion` many-to-many | Affordance exists; not used for filtering. |
| 3.1 | Volunteer requests own area | ❌ | — | |
| 3.1 | Alert / queue / calendar feeds filtered by assigned regions | 🚫 | D041 | Conscious divergence — region is tag, not filter. |
| 3.1 | Topic filtering (antisemitism / BDS / far-left / NHS / etc.) | 🚫 | D043 | "Groups" replaces "topics" — identity markers, not topic queues. Naming overlap to reconcile in v1.2. |

---

## §4 Module 1 — Intelligence Gathering & Monitoring

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 4 | Continuous monitoring of councils / press / unions / charities / education / public sector / parties / events / socials / video / adversaries | 🔮 | — | Out of MVP per D001/D002. Possible via Brightdata / Apify / Diffbot + scheduled jobs. |
| 4.1 | Admin-managed keyword list UI (no code changes) | 🛠️ | — | Pre-req for any monitoring module. |
| 4.1 | Per-topic keyword groups | 🛠️ | — | |
| 4.1 | Entity tracking (named individuals + orgs) | 🛠️ | D-log line 1935 (`BU-contact`) | Slice 4 entity. |
| 4.2 | YouTube channel ingest from configured list | 🔮 | — | YouTube Data API. |
| 4.2 | Whisper transcription of completed videos | 🔮 | — | Cost model TBD. |
| 4.2 | Transcript scanning + flagging | 🛠️ | — | |
| 4.2 | Source video links stored alongside transcripts | 🛠️ | — | |
| 4.2 | Live transcription | 🚫 | SRS §4.2 explicit | "Not required for MVP" per spec. |
| 4.3 | Alerts auto-generated from matched content | 🛠️ | — | Maps conceptually to `Request` (type `incident` / `link_submission`) — no `Alert` entity yet. |
| 4.3 | Alert metadata (URL / source / date / matched keywords / region / topic / severity / excerpt) | 🛠️ | — | Schema gap. |
| 4.3 | Alert routing to regional volunteers + national | 🚫 | D041 | Conscious. |
| 4.3 | In-app + email delivery | 🟡 | `Notification` (in-app) | In-app polling shipped (D057); email channel not built. |
| 4.3 | "Unassigned" claim queue | ✅ | `Request.status = unclaimed` + claim-and-lease | Generic queue shipped (D040, M3a) — would carry alerts when added. |

---

## §5 Module 2 — Task & Campaign Management

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 5 | Monday.com-style task system tailored to GPS | 🟡 | `Request` model | Generic claim-and-lease queue ✓; not the multi-board kanban UX SRS implies. |
| 5.1 | Lifecycle Unassigned → In Progress → Under Review → Completed/Closed | 🟡 | `RequestStatus` enum | Five values today; D054 plans collapse to three. |
| 5.1 | Individual or team assignment | ❌ | — | Single-claimer only. |
| 5.1 | Escalation to national team | ❌ | — | |
| 5.1 | Status-change audit log | ✅ | `AuditLog` (B07) | Append-only ✓. |
| 5.1 | Tasks linked to alerts / campaigns / CRM / outbound comms | ❌ | — | Linked entities don't exist. |
| 5.2 | AI analyses alert + suggests response type | 🛠️ | — | |
| 5.2 | AI suggests best method (single email / petition / media alert) | 🛠️ | — | |
| 5.2 | AI identifies recipients (council complaint, editor, etc.) | 🛠️ | — | |
| 5.2 | AI pre-populates To/CC/BCC/Subject/Body | 🛠️ | — | |
| 5.2 | AI BCCs councillors when target is council-funded | 🛠️ | — | Depends on §14 councillor DB. |
| 5.2 | Configurable on-side political-ally rules (admin-overridable) | 🛠️ | — | |
| 5.2 | Human approval mandatory before send | ✅ | NFR-05 satisfied by absence of auto-send | No autonomous send path. |
| 5.3 | SMTP / email-provider sending from platform | 🔮 | — | SendGrid / SES / Postmark. |
| 5.3 | Activist Mailer mass-send via export | ✅ | BU-am-link-collapse / D060 | URL on Post + auto-collapse to "Send email →" CTA. |
| 5.3 | Sentiment management (suppress donate CTA in adversarial mail) | ❌ | — | |
| 5.3 | Donations included in supporter newsletters | ❌ | — | Newsletter system not built. |
| 19.6 | One primary recommended action surfaced per alert (extends §5.2) | 🟡 | `PostKind` intent picker | Primary action concept ✓; rendering on alerts deferred. |
| 19.6 | Ranked secondary actions in detail mode | 🛠️ | parking-lot "Multi-CTA model" | |
| 19.6 | Capture primary-vs-secondary choice as ML signal | ❌ | — | |

---

## §6 Module 3 — Volunteer & Contact CRM

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 6.1 | Volunteer fields (name / email / phone / postcode / regions / topics / role-group / status / skills / training / affiliations) | 🟡 | `User` + `UserRegion` | Postcode/skills/training/affiliations not modelled; **D041 dropped postcode + lat/lng**. |
| 6.1 | Volunteer verifiable before access | 🟡 | `verifiedAt` + BU-vetting | Schema + flow ✓; production gating not yet wired. |
| 6.1 | Public signup form (name / postcode / email → queue) | 🛠️ | — | Maps to §19.4 enrolment forms — also not built. |
| 6.1 | NDAs + IP rights assignment | ❌ | — | |
| 6.2 | Third-party individual records (journalists / politicians / councillors / event organisers / activists) | ❌ | D-log 1935 (`BU-contact` Slice 4) | |
| 6.2 | Per-individual fields (affiliations / region / track record / linked alerts/campaigns) | 🛠️ | — | |
| 6.2 | Organisation records (type / regions / contacts / funding sources / linked individuals/alerts) | ❌ | — | |
| 6.2 | Full CRM search (region / category / association) | ❌ | — | NFR-10 also pending. |
| 19.7 | Display name with three options (handle / first / full) | ❌ | `User.displayName` only — single field | No policy enum. |
| 19.7 | Default = handle (most cautious) | ❌ | — | |
| 19.7 | "Who did what" visibility respects this setting | ❌ | — | |

---

## §7 Module 4 — Petitions

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 7 | Internal petition creation | 🛠️ | parking-lot "Multi-CTA model" | Schema-ready via `Post.linkUrl`; native petition entity not built. |
| 7 | External hosting (Change.org / 38 Degrees) | 🔮 | parking-lot "Integrations deferred" | API integration deferred. |
| 7 | AI petition suggestions from alerts/content | 🛠️ | — | |
| 7 | Petition fields (title/description/target/goal/count/status/linked campaign/alert) | 🛠️ | — | |
| 7 | AI optimises send-time + audience targeting | 🛠️ | — | |
| 7 | Distribution to regional volunteers + subscriber list | ❌ | — | No subscriber list. |
| 7 | Result data collected, curated, analysed | 🛠️ | — | |

---

## §8 Module 5 — Content Library

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 8 | MFA-protected secure repository | ❌ | — | MFA itself not done (NFR-01, NFR-12). |
| 8 | Role-based per-asset access | ❌ | — | |
| 8 | Content types (PDF / DOCX / images / memes / video / audio / fact-sheets / research / surveys / toolkits) | 🛠️ | D-log `BU-resource` Slice 4 | |
| 8 | Per-asset metadata (title / category / topic / region / date / source / rights) | 🛠️ | — | |
| 8 | User-submitted content for admin review | 🟡 | `RequestType.content_submission` enum value | Plumbing scaffolded; UI not shipped. |
| 8 | Training-topic submission | ❌ | — | |
| 8 | Incident-report submission | 🟡 | `RequestType.incident` enum | Same as above. |
| 8 | AI curation of submissions | 🛠️ | — | |

---

## §9 Module 6 — Activist Calendar

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 9 | Shared calendar (GPS / concerning / neutral / deadlines) | ❌ | — | No `Event` entity. |
| 9 | Colour-coded categories | ❌ | — | |
| 9 | Filter by region / location / date / type | ❌ | — | |
| 9 | AI auto-detection from Eventbrite + event sites + social listings | 🔮 | — | |
| 9 | Auto-alert volunteers on concerning events | ❌ | — | Depends on alert subsystem. |
| 9 | Recommended-response actions on alerts | ❌ | — | |

---

## §10 Module 7 — Media & Broadcast Monitoring

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 10.1 | Talk-radio station list + broadcast schedules | ❌ | — | |
| 10.1 | Real-time stream transcription | 🔮 | — | Whisper streaming. |
| 10.1 | Volunteer call-in alerts with talking-point briefings | 🛠️ | — | |
| 10.1 | Manual broadcast logging | 🛠️ | — | |
| 10.1 | Auto-complaints to stations + advertisers + ombudsman + revenue sources | 🛠️ | — | |
| 10.1 | Network-wide alert hub for radio actions | 🛠️ | — | |
| 10.2 | Newspaper + RSS scraping on schedule | 🔮 | — | |
| 10.2 | Match → alert queue with suggested response | 🛠️ | — | |
| 10.2 | Newswriters digest with pre-drafted templates | 🛠️ | — | "Newspaper" AG (Sharon, §19.5.2) infrastructure ready. |
| 10.2 | Cross-AG alert hub for outreach groups | 🟡 | `groupTags[]` on `Request` allows multi-tag | Data shape ✓; UX deferred. |
| 10.2 | Editor / journalist contacts in CRM, auto-populated in drafts | 🛠️ | `BU-contact` | |

---

## §11 Module 8 — Social Media Tools

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 11 | AI-generated proactive post suggestions framing adversary agenda | 🛠️ | — | |
| 11 | Volunteer review before publish | ✅ | NFR-05 satisfied by absence of auto-publish | |
| 11 | Schedule + publish to GPS-owned TikTok / X / FB / IG | 🔮 | parking-lot "Scheduled publishing" PARKED | |
| 11 | Antisemitic-content one-click reporting workflow | 🛠️ | — | |
| 11 | Public-profile discovery + add-to-CRM for tracking | 🛠️ | — | |
| 19.8 | Universal "Send via WhatsApp" affordance | ✅ | BU-whatsapp-share | wa.me deep link. |
| 19.8 | wa.me implementation, no Business API for v1 | ✅ | D016 confirms | |
| 19.8 | Same pattern for SMS + email | 🟡 | mailto: shipped (AM CTA); SMS not shipped | |
| 19.8 | Posts support multi-AG visibility/targeting | ✅ | `Post.groupTags[]` | |

---

## §12 Module 9 — Fundraising

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 12 | Fundraising campaigns (target / raised / donor count / status) | ❌ | — | |
| 12 | Donation buttons embeddable in supporter newsletters | 🔮 | — | Stripe / GoCardless. |
| 12 | Suppress donations from complaint / adversarial emails | ❌ | — | Mirrors §5.3 sentiment rule. |
| 12 | Fundraising tasks tracked in task module | 🛠️ | — | |
| 12 | AI suggests fundraising campaigns + donor segments from CRM | 🛠️ | — | |

---

## §13 Module 10 — Workshops & Training

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 13 | Admins create + publish workshop events | ❌ | — | |
| 13 | Region-filterable workshop alerts to verified users + subscribers | ❌ | — | |
| 13 | In-platform sign-up | ❌ | — | |
| 13 | Post-event toolkits in content library | ❌ | — | Depends on §8. |

---

## §14 Module 11 — Councillor Campaign Engine [URGENT]

**SRS marks this Phase 1 priority. Zero shipped. Largest single SRS-vs-reality gap.**

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 14.1 | Councillor DB populated from public sources (council sites / Electoral Commission / Democracy Club / moderngov) | 🛠️ | — | Schema gap. |
| 14.1 | Required fields (name / council + type / ward / party / roles / committees / s151 / s95 / email / phone / profile URL / region) | 🛠️ | — | |
| 14.1 | Region mapped to GPS hierarchy | 🛠️ | — | |
| 14.1 | Engagement history per councillor (sent / opened / clicked / pledged / verified) | 🛠️ | — | |
| 14.2 | Audience builder with AND/OR filters | 🛠️ | — | |
| 14.2 | Filters: geo / party / role+committee / engagement status / council type | 🛠️ | — | |
| 14.2 | Live count of matching councillors before send | 🛠️ | — | |
| 14.3 | Campaign types Pledge / Agreement / Reply | 🛠️ | — | |
| 14.3 | Per-campaign sender name + verified address + reply-to + HTML+text body | 🛠️ | — | |
| 14.3 | Merge fields ({{first_name}} etc.) | 🛠️ | — | |
| 14.3 | Per-councillor unique pledge link | 🛠️ | — | |
| 14.3 | AI draft on demand (human review required) | 🛠️ | — | |
| 14.3 | Save as draft + test send to internal address | 🛠️ | — | |
| 14.4 | SPF record validated at send time | 🔮 | — | Provider-side. |
| 14.4 | DKIM signing + key+selector config per domain | 🔮 | — | |
| 14.4 | DMARC at p=none with reporting (recommended quarantine/reject later) | 🔮 | — | |
| 14.4 | Configurable, non-generic sender name | 🛠️ | — | |
| 14.4 | Pre-verified sending addresses managed by admin | 🛠️ | — | |
| 14.4 | Independent reply-to per campaign | 🛠️ | — | |
| 14.4 | Transactional provider with bounce + complaint handling | 🔮 | — | SendGrid / Postmark / SES. |
| 14.4 | Configurable sends-per-hour throttle | 🛠️ | — | |
| 14.4 | One-click unsubscribe + auto-suppression | 🛠️ | — | |
| 14.5 | Admin UI to add/remove sending domains | 🛠️ | — | |
| 14.5 | Generated copy-paste DNS records (SPF / DKIM / DMARC) | 🛠️ | — | |
| 14.5 | DNS verification check pass/fail per record | 🛠️ | — | |
| 14.5 | Add + verify individual sender addresses | 🛠️ | — | |
| 14.5 | Default sender name/email per campaign type | 🛠️ | — | |
| 14.6 | Pledge double-confirmation (link → landing → email → verify link) | 🛠️ | — | |
| 14.6 | Mobile-friendly landing page | 🛠️ | — | |
| 14.6 | Verification expiry (default 7 days, configurable) | 🛠️ | — | |
| 14.7 | Tracked events: sent / bounced (hard/soft) / opened / clicked / pledge-clicked / pledged-not-verified / pledged-and-verified / unsubscribed / complained | 🛠️ | — | |
| 14.7 | Open-rate pixel with reliability caveat in reports | 🛠️ | — | |
| 14.8 | Real-time campaign dashboard (audience / sent / bounce / open / click / pledge / verified) | 🛠️ | — | |
| 14.8 | Segment-driven follow-up campaigns (e.g. opened-not-pledged) | 🛠️ | — | |
| 14.8 | Per-councillor history on CRM profile | 🛠️ | — | |
| 14.9 | Campaign-level reports by party / region / council type / role | 🛠️ | — | |
| 14.9 | Cross-campaign aggregate reports | 🛠️ | — | |
| 14.9 | Council / party leaderboard | 🛠️ | — | |
| 14.9 | CSV / Excel export per councillor engagement | 🛠️ | — | NFR-09 too. |
| 14.9 | Scheduled email reports to admins | 🛠️ | — | |
| 14.10 | Post-council escalation (pension funds, fund execs, external auditors, audit engagement leads) | 🛠️ | — | |

---

## §15 Non-Functional Requirements

| ID | Requirement | Priority | Status | Evidence | Notes |
|---|---|---|---|---|---|
| NFR-01 | MFA / 2FA for all accounts (TOTP minimum) | High | ❌ | dev cookie only (BU-001-lite) | BU-auth not yet briefed. Blocks NFR-12 + Module 8 + 11 + 14. |
| NFR-02 | RBAC restricting visibility to authorised regions + functions | High | 🟡 | `RoleGrant` + scoped `queue_manager:*` (D055) | RBAC plumbing ✓; **region-based access intentionally absent (D041)**. |
| NFR-03 | Data stored in UK or EEA (GDPR) | High | ✅ | AWS RDS eu-west-2 (D004) | Documented in CLAUDE.md stack section. |
| NFR-04 | Standard browser + mobile-responsive | High | ✅ | PWA, design system, WCAG 2.2 AA (D034) | |
| NFR-05 | All AI content labelled + human-approved (no autonomous send) | High | ✅ | Compliance-by-default (no AI hooks exist) | Will need re-checking when LLM hooks land. |
| NFR-06 | Full audit log of all actions | High | 🟡 | `AuditLog` model (B07), append-only | Coverage grows per BU; not yet exhaustive across all routers. |
| NFR-07 | Configurable scrape / monitor schedule | Medium | ❌ | — | No scrape jobs exist. |
| NFR-08 | Scale to 500 concurrent volunteers | Medium | 🛠️ | — | Untested; engineering-roadmap will surface load testing. |
| NFR-09 | CSV / Excel export from CRM / alerts / campaigns | Medium | ❌ | — | |
| NFR-10 | Full-text search across records / alerts / transcripts / CRM | Medium | 🛠️ | `BU-search-surface` planned | Member search first; broader search later. |
| NFR-11 | SMTP + OAuth Gmail/Outlook integration | Medium | 🔮 | — | |
| NFR-12 | Content-library MFA + RBAC separate from main login | High | ❌ | — | Depends on NFR-01. |

---

## §16 Third-Party Integrations

| Integration | Priority | Status | Notes |
|---|---|---|---|
| AI / LLM (GPT-4o / Claude) | High | 🔮 | parking-lot "AI provider choice" OPEN. |
| Speech-to-text (Whisper) | High | 🔮 | |
| Email provider (SMTP / SendGrid / Mailgun) | High | 🔮 | |
| Activist Mailer (export) | Medium | ✅ | `Post.activistMailerUrl` + AM-link collapse. |
| Activist Mailer (API) | Medium | 🔮 | parking-lot "Integrations deferred". |
| YouTube Data API | High | 🔮 | |
| Social media APIs (X / FB / IG) | Medium | 🔮 | Auto-posting via unofficial WhatsApp APIs explicitly DECLINED (parking-lot). |
| Eventbrite API / scrape | Medium | 🔮 | |
| Payment gateway (Stripe / GoCardless) | Medium | 🔮 | Depends on §12. |
| Democracy Club / council sites | High (§14) | 🔮 | |
| Transactional email (Postmark / SendGrid + DKIM/SPF) | High (§14) | 🔮 | |

---

## §17 Phased Delivery — SRS vs reality

| SRS Phase | SRS Item | Status |
|---|---|---|
| 1 | MFA + RBAC + geo permissions | ❌ |
| 1 | Web scraping (council / press / YouTube + transcription) | ❌ |
| 1 | Alert feed with regional routing + email | ❌ |
| 1 | Basic task management | 🟡 (Request queue, not Monday-style) |
| 1 | Volunteer CRM + approval workflow | 🟡 (vetting flow shipped; full profile not modelled) |
| 1 | AI-assisted email drafting | ❌ |
| 1 | Content library with access control | ❌ |
| 1 | Module 11 Councillor Campaign Engine [URGENT] | ❌ |
| 2 | Full alert→task→outbound flow | ❌ |
| 2 | Petitions + AI suggestion | ❌ |
| 2 | Activist calendar + scrape | ❌ |
| 2 | Newswriters workflow + media CRM | ❌ |
| 2 | Talk radio monitoring | ❌ |
| 2 | Subscriber sign-up + verification | ❌ |
| 3 | Social publishing + monitoring | 🟡 (WhatsApp share shipped) |
| 3 | Fundraising + payment | ❌ |
| 3 | Workshops / training | ❌ |
| 3 | Activist Mailer API | 🔮 |
| 3 | Advanced reporting / analytics | ❌ |
| 3 | Full audit logging + compliance tooling | 🟡 (audit log primitive ✓) |

**Interpretation:** SRS §17 has been silently superseded by `bu-sequence.md`. SRS v1.2 should rewrite §17, not the codebase.

---

## §18 Open Questions (SRS) — current answers

| Q | Status | Source |
|---|---|---|
| AI / LLM provider | OPEN | parking-lot "AI provider choice" |
| Monolith vs microservices | OPEN (lean: modular monolith) | parking-lot |
| Cloud hosting | RESOLVED | D004 — AWS eu-west-2 |
| AM API vs export for Phase 1 | RESOLVED | export shipped (D060); API parked |
| Volunteer-volume target (launch + 12mo) | OPEN | — |
| Content library subdomain vs integrated | OPEN | — |
| GDPR / Charity Commission compliance sign-off | OPEN | — |

---

## §19 Addendum — Networks & Action Groups

The Addendum *amends* §17 and is meant to be Phase 1. Schema check follows.

### 19.1 Network of Networks

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 19.1.1 | `networks` table (flat) | ❌ | absent from schema | Hard schema gap. |
| 19.1.1 | `is_master` boolean + partial unique index (single master) | ❌ | — | |
| 19.1.1 | `parent_network_id` FK to GPS row | ❌ | — | |
| 19.1.2 | `User.home_network_id` FK | ❌ | schema:119–179 | |
| 19.1.2 | `volunteer_networks` junction (deferred per §19.9.2) | 🚫 | SRS itself defers | — |
| 19.1.3 | `originating_network_id` on alerts / tasks / posts / content (from day one) | ❌ | `Post`, `Request` schema | Hard gap; spec is explicit "from day one". |
| 19.1.4 | Per-volunteer network badge (post attribution) | ❌ | — | |
| 19.1.4 | GPS chrome stays GPS-branded (no white-label) | ✅ | by absence | Aligned. |

### 19.2 Role table amendments

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 19.2 | ADD Network Coordinator role | ❌ | — | Not modelled. |
| 19.2 | `network_coordinators` junction (Alistair → CUFI) | ❌ | — | |
| 19.2 | Aggregate-stats-only visibility scoping for Coords | ❌ | — | |
| 19.2 | REMOVE Gatekeeper role | ✅ | never built | Aligned by absence. |
| 19.2 | CHANGE Vetting Team → `is_vetter` flag on User | ❌ | currently inferred from `RoleGrant` of `queue_manager:vetting` (D055) | Functional equivalence, but column not added. |
| 19.2 | `vetting_scope` field (all / specific network ID) | ❌ | — | |

### 19.3 Default visibility

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 19.3 | Open coordination across networks + AGs by default | ✅ | D041, D043 | Aligned by accident — but aligned. |
| 19.3 | Coordinators see aggregate stats only | ❌ | — | Coord role not built. |
| 19.3 | Restrictions added explicitly, not by default | ✅ | D041, D043 | Aligned. |

### 19.4 Enrolment routing

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 19.4 | Three form variants (direct / partner-locked / open) | ❌ | — | |
| 19.4 | Pre-filled-and-locked network field with visible caption | ❌ | — | |
| 19.4 | Signed enrolment tokens preventing spoofing | ❌ | — | |
| 19.4 | Vetting team can override network field before approval | ❌ | — | Depends on `home_network_id` existing. |

### 19.5 Action Groups

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 19.5 | AGs as tag/filter, not permission boundary | ✅ (under "Group" name) | `Group` model (schema:579–599); `groupTags[]` on `Post` + `Request` | Implemented under different naming. Reconcile in v1.2. |
| 19.5 | Volunteers can belong to multiple AGs | ✅ | `GroupMembership` join | |
| 19.5 | AG Leader as per-AG flag, not global role | ✅ | `GroupMembershipRole.lead` | |
| 19.5 | Posts / alerts can be tagged with one or many AGs at creation | ✅ | `Post.groupTags[]`, `Request.groupTags[]` | |
| 19.5 | Default feed view = "my AGs", widen to all | ❌ | — | Public-first feed per D045. BU-feed-filter (in flight) does NOT include "my groups" chip. |
| 19.5.1 | Cross-AG forwarding via re-tagging | 🟡 | `groupTags String[]` | Schema-ready; one-click "also send to" UI not built. |
| 19.5.1 | Shared record model (one row, shared status/assignee) | ✅ | single row + array tag | Correct by data shape. |
| 19.5.2 | Initial AG leadership seed (Petitions/Calls/Mass Email = Tabatha; Newspaper = Sharon; Radio = TBC) | ❌ | `prisma/seed.ts` | Not seeded. |

### 19.6 Primary + secondary actions — covered under §5 above.

### 19.7 Identity & display name — covered under §6 above.

### 19.8 WhatsApp share — covered under §11 above.

### 19.9 Phase 1 scope updates

| § | Requirement | Status | Evidence | Notes |
|---|---|---|---|---|
| 19.9.1 | Network Coordinator role + junction (Alistair → CUFI) | ❌ | — | |
| 19.9.1 | Minimum-viable Coord dashboard (aggregate counts only) | ❌ | — | |
| 19.9.1 | Co-branded enrolment landing for CUFI | ❌ | — | |
| 19.9.1 | Three enrolment form variants | ❌ | — | |
| 19.9.1 | Signed enrolment tokens | ❌ | — | |
| 19.9.1 | Action Group tagging on alerts / posts / tasks | ✅ | `groupTags[]` on Post + Request | Alerts not yet a separate entity. |
| 19.9.1 | `originating_network_id` columns scaffolded on relevant tables | ❌ | — | |
| 19.9.1 | `is_vetter` + `vetting_scope` scaffolded | ❌ | — | |
| 19.9.2 | Phase 2 deferrals (delegated vetting UI / multi-network membership / per-Coord analytics / network-scoped messaging) | ✅ (deferred per spec) | — | Aligned. |

**Bottom line on §19:** the Action-Group half (§19.5) is materially built under the name "Group". The Networks half (§19.1–19.4) has zero schema scaffolding despite being explicit Phase 1. Highest-priority concrete gap below Module 11.

---

## Phantom features — built, not in SRS

### New (post-SRS — likely v1.2 absorption candidates)

| Feature | Brief / ADR | Notes |
|---|---|---|
| FAB intent picker (composer cards) | BU-fab-intent-picker / D044, D062 | Replaces "post a thing" with intent-led tile selector. |
| AM-link auto-detection + collapse to CTA | BU-am-link-collapse / D060 | Activist Mailer URL pasted → preview with "Send email →". |
| Reactions (8-emoji curated set) | BU-reactions / D050, D032 | Quiet appreciation primitive. |
| Comments (post + request, polymorphic) | BU-comments / D052 | Flat thread; @mentions trigger notifications. |
| Tick-or-cross post kind | BU-tick-or-cross / D069 | Author amplify-or-flag with WhatsApp handoff. |
| Cultural-marker bordeaux treatment | D033 | Shabbat / remembrance posts get distinct register. |
| Hero images (curated allow-list) | BU-post-hero-demo / D064 | Member-picked from seeded set; full upload deferred (D046). |
| URL-driven feed-filter chip strip | BU-feed-filter (in flight) | All / Urgent / Now / Meetings / Events. |
| FeatureFlag DB table + audit-on-flip | D036 | Homegrown rollout / kill-switch / pilot-gate. Not in SRS NFRs. |
| Demo mode (Vercel preview unlock) | BU-demo-mode | Not in SRS. |
| Sticky bottom nav | BU-sticky-nav | UX detail not in SRS. |
| Brief-status traceability (`@spec` / `@bu` / `@adr` annotations + `trace` script) | F13 / D038 | Eng discipline. |
| Honest-tracking-only commitment | D047 | Reach numbers never inflated. |
| Self-dispatch as default (vs SRS dispatch-queue framing) | D013, D016 | Conscious divergence from §5 task-assignment model. |

### Done (also in SRS — worth confirming)

| Feature | SRS § | Notes |
|---|---|---|
| Activist Mailer export-via-link | §5.3 / §16 | Counts as AM "copy-paste export". |
| WhatsApp share affordance | §19.8 | wa.me deep link. |
| Audit log primitive | NFR-06 / B07 | Append-only, immutable. |
| Region hierarchy modelling | §3.1 | Hierarchy ✓; access-control divergence (D041). |
| Soft-delete + role-grant audit chain | NFR-06 / D042 | |
| WCAG 2.2 AA target | NFR-04 / D034 | |
| UK data residency (RDS eu-west-2) | NFR-03 / D004 | |

---

## What to do with this audit

The four highest-priority gaps to either build or formally retire from spec:

1. **§14 Module 11 (Councillor Campaign Engine)** — SRS-marked URGENT. Zero shipped. Decide: brief now or move to Phase 2 in v1.2.
2. **§19.1–19.4 Networks scaffolding** — `networks`, `home_network_id`, `originating_network_id`, `is_vetter`, `vetting_scope`, enrolment-form variants, signed tokens. The Addendum mandates these "from day one"; codebase has none of them.
3. **NFR-01 (MFA)** — every section saying "MFA-protected" depends on this. BU-auth not yet briefed.
4. **§4 Module 1 (Intelligence Gathering)** — explicit reframe via D001/D002 has effectively retired this from MVP, but SRS still treats it as Phase 1 spine. v1.2 should formally retire-or-rescope.

**Suggested SRS v1.2 work:**

- Absorb D001/D002 reframe into §1–2.
- Merge Addendum §19 into the body.
- Reconcile "Action Groups" vs "Groups" naming (D043).
- Move unshipped Phase 1 modules (§4, §14) into a clearly-labelled future-state appendix or rescope.
- Re-anchor §17 phasing to `bu-sequence.md`.
- Capture phantom features (above) as new sub-sections under the right modules.
