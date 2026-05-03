# /search

App-wide member search surface (BU-search-surface).

## Status

PR C of the BU shipped the **shell only**: page server entry +
`SearchShell` client component with the autofocused input, optional
scope chip from `?filter=`, and empty-state placeholders for
"Recently viewed" / "Your regions". No result rendering yet.

PR D will land:

- Typeahead grouped results (Posts / People / Regions / Partner orgs)
  via `trpc.search.query`
- Full-results view at `/search?q=...&type=...`
- Recently-viewed via `localStorage` (last 5 posts)
- 4 telemetry events (`search_opened`, `search_query_submitted`,
  `search_result_clicked`, `search_see_all_clicked`)

## URL contract (D078 §7)

| Param    | Meaning                                                     |
| -------- | ----------------------------------------------------------- |
| `q`      | Query string (PR D consumes; PR C just hydrates the input). |
| `filter` | Inherited feed filter — renders as a removable scope chip.  |
| `type`   | (PR D) Restricts full-results to one entity group.          |

Both routes are URL-addressable: the URL alone reproduces the result
set 1:1 server-side once PR D lands.

## Auth

Server entry redirects unauthenticated users to
`/dev/login?returnTo=/search`. Same idiom as `/compose`.

## Glyphs

- `Search` (AppNav magnifier) — registered in
  `docs/product/design-philosophy.md` "In-content (shipped)".
- `ChevronLeft` (page header back) — registered in same.
- `X` (scope chip dismiss) — re-used from the existing
  modal/sheet-dismiss family.
