# App-wide search surfaces — best-practice survey

**Status:** research only · 2026-04-27
**Audience:** anyone designing GPS Action's search / filter UX
**Context:** Next.js 15 PWA, mobile-first, feed-centric, sticky AppNav
in flight (`feat/bu-sticky-nav`). The H1 "Feed" on `/feed` is to be
replaced with a filter UI; an app-wide search surface is the wider
question. Design philosophy (1-click is king, no anxiety amplification,
honest copy) is the tiebreaker for any tradeoff below.

---

## 1. Where on screen does search live?

| Pattern                         | Used by                          | Pros                                | Cons                                                     |
| ------------------------------- | -------------------------------- | ----------------------------------- | -------------------------------------------------------- |
| Persistent header bar           | Bluesky web, Slack, Substack web | Always visible, discoverable        | Vertical space, fights sticky nav, bad on small screens  |
| Header icon, expands inline     | Twitter/X mobile, GitHub mobile  | Compact, single tap to focus        | Hidden — needs a clear icon                              |
| Full-screen overlay from icon   | Mastodon mobile, Reddit mobile   | All screen for results, clean focus | Loses page context unless passed in                      |
| Cmd-K / palette                 | Linear, Notion, GitHub desktop   | Fast, scoped, entity-typed natively | Desktop-only — useless on touch                          |
| FAB                             | (rare for search)                | Thumb-reachable                     | Conflicts with GPS's IntentFab; two FABs is anti-pattern |
| Tab-bar entry                   | Instagram, Bluesky mobile        | One-thumb reach, persistent         | Costs a precious tab slot                                |
| In-content (search-this-thread) | Discord, Slack thread search     | Scope-clear, context preserved      | Not app-wide                                             |

**For GPS Action:** FAB is taken. Tab-bar slot too costly for a weekly
feature. Cmd-K useless on iPhone-standalone. Realistic options are
**header-icon-that-expands** (Twitter mobile) or **full-screen overlay
from header magnifier** (Mastodon). The overlay wins because the iOS
keyboard already eats half the screen — give the rest to results, not
chrome. That's honest about the constraint.

---

## 2. How is "context-aware" usually implemented?

Context in modern apps means one or more of:

- **Current page / route** — Linear scopes Cmd-K to active project.
- **Current entity in view** — Notion defaults to current workspace;
  Slack to the channel you opened search from.
- **Current filter / tab** — Twitter inherits the active tab.
- **Recency-biased ranking** — GitHub, Linear, Notion all surface
  recently-touched entities first when query is empty.
- **Entity-typed grouping** — Slack groups results into Messages /
  Files / Channels / People; Bluesky into Posts / Users / Feeds.

**Concrete patterns to borrow:**

- **Scoped chip on the input.** Open from a post detail page → input
  shows removable "in this thread" chip; tap-X widens to app-wide.
  Slack and Discord both do this — legible and reversible.
- **Recency-biased zero-state.** Empty search shows "Recently viewed"
  (last 5 posts), "Your regions", and partner orgs the member has
  engaged with. The member who just opened search to find "that post
  about Tuesday" sees it before typing.
- **Entity-typed result sections.** Don't return one flat list. Group:
  **Posts · People · Regions · Partner orgs · Comments**. Each capped
  at ~3 with a "See all 14 posts" link. Mastodon and Bluesky both ship
  this; it scans fast on a phone.

---

## 3. How are results surfaced for easy nav?

| Pattern                              | Strength on mobile                                     | Weakness                                   |
| ------------------------------------ | ------------------------------------------------------ | ------------------------------------------ |
| Inline typeahead dropdown            | Snappy on desktop                                      | iOS keyboard collapses dropdowns; clipping |
| Full-screen results page             | All space for results; survives keyboard               | Heavier transition; back-button needs care |
| Split: instant suggestions + see-all | Best of both — top 3 while typing, full page on submit | Slightly more state to manage              |
| Grouped-by-type sections             | Scans fast; right shape of result found quickly        | Costs a label row per section              |

**On mobile with the keyboard up:** visible space above the keyboard is
roughly the top half of the viewport — useful results must fit in **5–8
rows of 44pt touch targets**. Auto-suggest as you type (debounced
~150ms) is the standard now (Bluesky, Mastodon, Slack); min query
length 2. **Submit / Enter** commits to a full-screen results page with
deeper grouping and pagination — typeahead is the preview, the results
page is the destination.

**Recommended pattern:** split surface. Typeahead overlay shows top 3
per entity group with "See all" links. Submit → full-screen results
page, same grouping, paginated per group — preserving "feed has an end"
by paginating, not auto-loading.

---

## 4. Filtering vs search — where's the line?

Top apps treat them as **adjacent but distinct**:

- **Filter** = a closed set of preset views over a known stream. Fast,
  one-tap, always visible. Bluesky's "Following / Discover", Twitter's
  "For you / Following", Reddit's "Hot / New / Top", Linear's saved
  views. Members pick — they don't type.
- **Search** = open-text query against the whole app. Discoverable but
  secondary. Members type — what they're looking for is unpredictable.

**The line:** if the result set has more than ~5 reasonable preset
views, search is needed. If it's a small finite set, filter chips
suffice. Most apps end up with both: chips at the top of the feed plus
a search icon in the header for the long tail.

**Reconciliation patterns:**

- **Chips persist; search is modal.** Twitter's tabs stay above every
  feed; the magnifier opens a separate surface. Filters answer "where
  am I looking", search answers "find me one specific thing".
- **Search inherits the active filter.** Member on "Urgent" filter
  opens search → results default to "in Urgent" with a removable
  scope chip. Slack's channel-search pattern.
- **Filters can be saved as searches.** Linear lets a saved filter
  become a query. Out of scope for first cut.

**For GPS Action:** the requested H1-replacement filter (All / Urgent /
My region / Partner orgs / Bookmarked) is a classic chip strip —
finite, demo-able. Search is a separate, lower-frequency surface.
**Build them as two distinct UI elements that sit side-by-side** (chips

- magnifier icon in the sticky header), not one conflated input.

---

## 5. PWA-specific gotchas

- **iOS standalone has no URL bar.** No system pull-to-refresh on
  results. Reuse `HeaderRefreshButton` from the sticky-nav work.
- **Keyboard handling.** Use `inputmode="search"` and
  `enterKeyHint="search"` for the right return key. Set
  `autoComplete="off"` or Safari hijacks the form. Listen to
  `visualViewport.resize` if you need results above the keyboard
  reliably — `vh` units lie when the keyboard is up.
- **Back-button semantics.** Search results is a real route, not modal
  state. Use `/search?q=...&type=posts`; system Back returns to the
  feed. The transient typeahead overlay can be modal (history-less),
  but the committed results page must be URL-addressable.
- **Deep-linkable URLs.** `/search?q=hendon&type=posts&region=brent`
  must reproduce the result set 1:1. Members forward URLs in WhatsApp;
  if the URL doesn't carry the query the recipient sees a blank page.
  Aligns with D018-style inbound sharing.
- **Service worker / offline.** Don't precache results. Cache the
  search shell so it opens instantly offline; show a clear "Search
  needs a connection" empty state if no network. Honest copy rule.
- **No autoplay weirdness.** Image previews in result cards must be
  static thumbnails, not GIFs. No anxiety amplification.

---

## 6. Concrete recommendation for GPS Action

**The design.** A magnifier icon in the sticky `AppNav` header, right
of the nav links. Tap → a **full-screen search overlay** slides up
(route: `/search`, history entry created). Filter chips are unrelated:
they live above the feed list and are not affected by search.

**Layout, top-to-bottom (mobile portrait, keyboard up):** sticky
header (back arrow, "Search", refresh button) → autofocused input with
optional removable scope chip below it → grouped results (Posts →
People → Regions → Partner orgs), each capped at 3 rows with a "See
all N" link.

**Empty state (zero query):** Recently viewed posts (top 5) · Your
regions · Bookmarked posts. No "trending", no "hot now" framing.

**Interaction details:**

- `inputmode="search"`, `enterKeyHint="search"`, `autoComplete="off"`,
  autofocus on overlay open.
- Debounce 150ms, min 2 chars.
- "See all X" → `/search?q=...&type=posts` — full results page, same
  grouping, paginated. Keeps "feed has an end" honest.
- Back: typeahead → feed (one pop). Full results → typeahead → feed.
- Scope chip auto-populates from origin (post detail / thread); tap-X
  widens to app-wide.
- Inherits active filter: opened with "Urgent" chip → defaults to
  "in Urgent" with a removable scope chip.
- Honest empty results: "Nothing matching that yet. Try a region name
  or a person." Not "No results found."

**Why this design wins for GPS Action:**

1. **One-click preserved.** Search is a deliberate query, not the
   primary mode; three taps (icon → type → tap result) is fine.
2. **No FAB conflict.** IntentFab keeps creation; search lives in
   the header. Two distinct affordances for two distinct intents.
3. **No anxiety amplification.** Empty state is "recently viewed", not
   "trending". Results paginate, not infinite-scroll.
4. **Filter and search stay distinct.** Chips answer "where am I
   looking"; search answers "find one specific thing".
5. **PWA-honest.** URL-addressable results, system Back works,
   keyboard ergonomics handled, refresh button reused.
6. **Sharon-warmth in copy.** Warm without cutesy.

**Out of scope for first cut (park):** saved searches; search-as-you-
scroll filter narrowing; cross-region partner-org graph search (needs
ERD work); voice / dictation (iOS handles natively).

**Suggested next step:** session brief `bu-search-surface.md` —
header magnifier in sticky AppNav, `/search` overlay route, typeahead
with entity grouping, full-results page, URL-addressable queries. The
filter chip strip stays inside `feat/feed-filter-and-search`.
