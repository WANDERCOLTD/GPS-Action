# Design Tokens Convention

**Build Unit:** F15
**Enforcement:** `local-rules/require-design-tokens` ESLint rule (error severity)
**Canonical source:** `styles/tokens.css`

---

## Why we have a token system

Every colour, spacing value, font size, radius, shadow, and motion timing
in GPS Action is defined once in `styles/tokens.css` and referenced
everywhere else via `var(--...)`. This is the same shape of problem F13
solved for `@spec` traceability: convention-only doesn't survive growth.
Without mechanical enforcement, hardcoded hex values drift into components
and the visual identity fragments.

The token system gives us:

- **Visual consistency** — one change to a token propagates everywhere
- **Dark mode for free** — `[data-theme="dark"]` overrides cascade
  automatically when components use tokens
- **Accessibility** — future high-contrast themes become possible
- **Design review** — new tokens are deliberate decisions, not drive-by
  additions

---

## Token taxonomy

| Prefix                      | Purpose                                                     | Examples                                      |
| --------------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| `--colour-[role]-[variant]` | Colours: brand, semantic, cultural, surfaces, borders, text | `--colour-primary`, `--colour-surface-canvas` |
| `--space-[scale]`           | Spacing on a 4pt grid                                       | `--space-2` (8px), `--space-4` (16px)         |
| `--radius-[scale]`          | Border radii                                                | `--radius-sm`, `--radius-pill`                |
| `--font-[role]`             | Font families                                               | `--font-ui`, `--font-body`                    |
| `--text-[scale]`            | Font sizes                                                  | `--text-sm`, `--text-xl`                      |
| `--weight-[scale]`          | Font weights                                                | `--weight-medium`, `--weight-bold`            |
| `--shadow-[scale]`          | Box shadows                                                 | `--shadow-sm`, `--shadow-modal`               |
| `--motion-[role]`           | Transition/animation durations                              | `--motion-fast`, `--motion-slow`              |

See `styles/tokens.css` for the full list.

---

## How to use them

### In inline styles (TSX)

```tsx
<div
  style={{
    background: 'var(--colour-surface-canvas)',
    padding: 'var(--space-4)',
    color: 'var(--colour-text-primary)',
  }}
/>
```

### In CSS component classes

```css
.gps-card {
  background: var(--colour-surface-raised);
  border: 1px solid var(--colour-border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
}
```

### Using component classes (preferred when available)

```tsx
<article className="gps-card">
  <h2 className="gps-subtitle">{title}</h2>
  <div className="gps-card__body">{body}</div>
</article>
```

`styles/components.css` defines `.gps-*` classes for common patterns.
Prefer these over inline styles when the component class matches the
intent exactly.

---

## What lenient mode means (v1 — current)

F15 ships in **lenient mode**. Today it enforces:

- **No hardcoded hex colours** (`#1851cc`, `#fff`, `#11223344`)
- **No `rgb()` / `rgba()` literals**
- **No `hsl()` / `hsla()` literals**

It does NOT yet enforce:

- Pixel values (`padding: '12px'` instead of `var(--space-3)`) — future F16
- Tailwind utility classes for colour (`bg-blue-500`) — future F16
- Inline `style={{}}` where a `.gps-*` class exists — future F-rule
- Whether `var(--...)` references point to a real token — future audit

Lenient mode is a ratchet: once a file passes, it can't regress.

---

## Anti-patterns

### Hardcoded hex (blocked by F15)

```tsx
// BAD — hardcoded hex
<div style={{ color: '#1851cc' }} />;
const COLOURS = ['#4577e8', '#0f6e56'];

// GOOD — token reference
<div style={{ color: 'var(--colour-primary)' }} />;
const COLOURS = ['var(--colour-primary-bright)', 'var(--colour-success)'];
```

### Hardcoded rgb/hsl (blocked by F15)

```tsx
// BAD
<div style={{ background: 'rgb(24, 81, 204)' }} />
<div style={{ color: 'hsl(220, 70%, 45%)' }} />

// GOOD
<div style={{ background: 'var(--colour-primary)' }} />
<div style={{ color: 'var(--colour-primary)' }} />
```

### Inline style where class exists (not yet enforced)

```tsx
// Works but verbose — prefer the class
<button style={{
  background: 'var(--colour-primary)',
  color: 'var(--colour-primary-contrast)',
  padding: 'var(--space-3) var(--space-5)',
  borderRadius: 'var(--radius-md)',
}} />

// Better
<button className="gps-btn gps-btn--primary" />
```

---

## When to add a new token

Rarely. New tokens are a deliberate design conversation, not a drive-by
addition during feature work. If you need a colour that doesn't exist in
`tokens.css`:

1. Check if an existing semantic token fits (it usually does)
2. If not, surface the need in the PR description
3. A design conversation produces the new token name and value
4. The token lands in a separate PR to `styles/tokens.css`
5. Then your feature PR can reference it

Never add a token and use it in the same PR without explicit approval.

---

## Exemptions

- `styles/tokens.css` — the canonical source; defines hex values
- `eslint-rules/tests/require-design-tokens.test.js` — test fixtures
- Hex in comments (`/* #1851cc */`, `// #1851cc`) — informational only

---

## Related

- `styles/tokens.css` — the canonical token definitions
- `styles/components.css` — component classes built on tokens
- `docs/product/design-philosophy.md` — the 5 design principles
- `docs/process/ratchet-discipline.md` — forward-only progress philosophy
- `eslint-rules/README.md` — rule documentation (§7)
