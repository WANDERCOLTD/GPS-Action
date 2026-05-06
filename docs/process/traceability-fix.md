# Fix — add @spec tags to 3 BU-feed files

BU-feed shipped with 3 files missing the `@spec` traceability tag.
All the files have `@build-unit BU-feed` but no `@spec` reference,
which breaks the traceability chain per D038.

This doc tells you exactly what to edit. 5 minutes of work.

---

## Scope

Fix these 3 files:

1. `app/feed/actions.ts`
2. `tests/unit/post-service.test.ts`
3. `tests/integration/post-list.test.ts`

All need ONE new line added to their existing JSDoc header.

---

## How to apply

Option A — in VS Code, open each file and add the line manually.
Option B — use the sed commands below.

Option A is safer (visual review). Option B is faster. Both work.

---

## File 1 — `app/feed/actions.ts`

### Likely current header

```typescript
/**
 * @build-unit BU-feed
 *
 * Server actions for the feed page. Handles load-more pagination
 * [... existing comment ...]
 */
```

### Change

Add `@spec architecture/api-contract.md` below the `@build-unit` line:

```typescript
/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 *
 * Server actions for the feed page. Handles load-more pagination
 * [... existing comment ...]
 */
```

**Reason for this spec:** server actions are part of the API surface.
The api-contract doc covers tRPC primarily, but server actions
implement the same contracts the product relies on.

---

## File 2 — `tests/unit/post-service.test.ts`

### Likely current header

```typescript
/**
 * @build-unit BU-feed
 *
 * Unit tests for post service layer.
 */
```

### Change

Add `@spec architecture/api-contract.md`:

```typescript
/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 *
 * Unit tests for post service layer.
 */
```

**Reason:** the test verifies behaviour defined by the API contract
(visibility filtering, pagination, etc.).

---

## File 3 — `tests/integration/post-list.test.ts`

### Likely current header

```typescript
/**
 * @build-unit BU-feed
 *
 * Integration tests for post.list procedure.
 */
```

### Change

Add `@spec architecture/api-contract.md` AND `@spec architecture/decision-log.md (D045)`:

```typescript
/**
 * @build-unit BU-feed
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D045)
 *
 * Integration tests for post.list procedure.
 */
```

**Reason for two specs:**

- `api-contract.md` — general procedure shape
- `decision-log.md (D045)` — the visibility filtering behaviour this test verifies

Integration tests that exercise specific decision rationale should
cite the relevant ADR.

---

## Verification

After edits:

```bash
cd ~/projects/gps-action

# Count should now show parity: 27 @build-unit and 27 @spec
grep -rl "@build-unit" server/ app/ components/ scripts/ tests/ shared/ 2>/dev/null | wc -l
grep -rl "@spec" server/ app/ components/ scripts/ tests/ shared/ 2>/dev/null | wc -l

# No files should be missing @spec
for f in $(find server app components scripts tests shared -name "*.ts" -o -name "*.tsx" 2>/dev/null); do
  if grep -q "@build-unit" "$f" && ! grep -q "@spec" "$f"; then
    echo "MISSING @spec: $f"
  fi
done
```

Expected:

- Both counts return `27`
- No "MISSING @spec" output

---

## Run validation before committing

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm format:check
```

All should pass. The changes are comment-only, so no functional change.

---

## Commit

Since this is a post-merge fixup, put it on its own branch:

```bash
git checkout main
git pull

# Skip this step if BU-feed PR hasn't merged yet — wait for it
# Otherwise:
git branch -d phase-1/bu-feed

git checkout -b docs/traceability-fix

git add app/feed/actions.ts \
        tests/unit/post-service.test.ts \
        tests/integration/post-list.test.ts

git commit -m "docs(traceability): add missing @spec tags to BU-feed files"
git push --set-upstream origin docs/traceability-fix
```

Open PR, merge.

---

## Optional: sed one-liners (Option B)

If you prefer command-line speed over visual review:

```bash
# File 1 — insert @spec line after @build-unit line
sed -i '' '/\* @build-unit BU-feed$/a\
 * @spec architecture/api-contract.md
' app/feed/actions.ts

# File 2 — same pattern
sed -i '' '/\* @build-unit BU-feed$/a\
 * @spec architecture/api-contract.md
' tests/unit/post-service.test.ts

# File 3 — add two @spec lines
sed -i '' '/\* @build-unit BU-feed$/a\
 * @spec architecture/api-contract.md\
 * @spec architecture/decision-log.md (D045)
' tests/integration/post-list.test.ts
```

**Note:** `sed -i ''` is macOS syntax. On Linux, drop the empty
string: `sed -i '/...`.

After running, verify with the grep commands above.

---

## Timing

Do this fix AFTER BU-feed PR merges to main. Separate concern =
separate branch = separate PR. Don't mix with any stashed onboarding
work (see the batch-9-era stash).

Order:

1. Merge BU-feed (PR #11 or whatever number it is)
2. Pop onboarding stash onto main, commit, merge that PR
3. THEN this traceability fix
4. THEN BU-composer refinement
