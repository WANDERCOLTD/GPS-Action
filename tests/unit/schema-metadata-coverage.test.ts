/**
 * @build-unit B14
 * @spec build/engineering-roadmap.md (B14)
 * @spec architecture/admin-surface.md
 *
 * CI guard — schema models ↔ entity-metadata coverage.
 *
 * Diffs Prisma's DMMF model list against the keys of `entityMetadata`
 * in `server/admin/entity-metadata.ts`. Hard-fails on either-direction
 * drift:
 *
 *   - A new model in `prisma/schema.prisma` without a metadata entry
 *     (silent invisibility from the admin surface).
 *   - A metadata key with no corresponding model (stale entry).
 *
 * The allow-list at the top intentionally documents existing gaps so
 * the guard catches *new* drift while pending entries are absorbed
 * into metadata in their own BUs. Removing an allow-list entry is the
 * forcing function for that work.
 *
 * Companion to G2 + G3 in `tests/unit/admin-registry.test.ts`
 * (registry-coverage and Prisma-enum-literal drift); together they
 * police the chain schema → metadata → registry → admin UI.
 */

import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { entityMetadata } from '@/server/admin/entity-metadata';

// ── Allow-list ───────────────────────────────────────────────────────────
//
// Models that exist in the schema but don't yet have a metadata entry.
// Each line names the BU that added the schema and the follow-up BU
// that's expected to add the metadata. Removing a line forces the
// follow-up.
//
// PRINCIPLE: every entry is a TODO that should shrink over time.
// Adding a new entry should require explicit justification in the PR.

const SCHEMA_MODELS_AWAITING_METADATA: ReadonlyArray<string> = [
  // BU-reactions (D050) — added the Reaction model. Admin metadata pending.
  'Reaction',
  // BU-comments (D052) — added the Comment model. Admin metadata pending.
  'Comment',
  // BU-fab-intent-picker (D062-revised) — added the PostKind model.
  // Admin metadata pending.
  'PostKind',
  // BU-requests-urgent (D058) — added SystemSetting. Admin metadata pending.
  'SystemSetting',
  // BU-requests-vetting — added the Notification model.
  // Admin metadata pending.
  'Notification',
  // bu-coordination-board (ADRs 0005-0009) — schema PR (#1 of 8). Admin
  // metadata for these entities lands once services + UI exist (PRs
  // #2-#7); the kanban surface is the primary CRUD path, with admin
  // metadata covering the configuration corners (BoardColumn,
  // GroupShareWorkflow) and the auditable joins (Assignment,
  // RequestGroup, RequestSubscription).
  'Assignment',
  'RequestGroup',
  'GroupShareWorkflow',
  'BoardColumn',
  'RequestSubscription',
  // bu-share-event-polymorphic Phase A (ADR-0018) — added the ShareEvent
  // model. Admin metadata lands once the service + UI consumer exists
  // (Phase B). Drops off this list when bu-share-event-polymorphic
  // Phase B ships the share-event admin surface.
  'ShareEvent',
  // bu-link-preview-store (ADR-0019, D084) — added LinkPreview as a
  // service-internal cache for URL preview metadata. No admin CRUD
  // surface in scope; rows are managed entirely by the read-through
  // service (`getLinkPreview`). A read-only admin browser is a
  // follow-up if cache-debugging needs surface in production.
  'LinkPreview',
  // BU-source-and-kind-icons (ADR-0020, D085) — added SourceIconOverride.
  // Slug-keyed local overrides for Grant's gps_chat_labels icons.
  // Admin surface deferred to a follow-up BU (Vercel Blob upload UI);
  // v1 ships with /public-relative seeded paths from the migration.
  'SourceIconOverride',
];

// Metadata keys with no corresponding schema model. None today.
const METADATA_KEYS_WITHOUT_MODEL: ReadonlyArray<string> = [];

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Schema model names from Prisma's DMMF, in PascalCase as Prisma
 * declares them. Compare against camelCased metadata keys via
 * `lowerFirst`.
 */
function schemaModelNames(): ReadonlyArray<string> {
  return Prisma.dmmf.datamodel.models.map((m) => m.name);
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('schema models ↔ entity-metadata coverage (B14)', () => {
  it('every schema model has a metadata entry (or is allow-listed)', () => {
    const metadataKeys = new Set(Object.keys(entityMetadata));
    const allowed = new Set(SCHEMA_MODELS_AWAITING_METADATA);
    const missing: string[] = [];
    for (const model of schemaModelNames()) {
      const expectedKey = lowerFirst(model);
      if (!metadataKeys.has(expectedKey) && !allowed.has(model)) {
        missing.push(model);
      }
    }
    expect(
      missing,
      `Add a metadata entry to server/admin/entity-metadata.ts for: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('every metadata key has a schema model (or is allow-listed)', () => {
    const schemaKeys = new Set(schemaModelNames().map(lowerFirst));
    const allowed = new Set(METADATA_KEYS_WITHOUT_MODEL);
    const stale: string[] = [];
    for (const key of Object.keys(entityMetadata)) {
      if (!schemaKeys.has(key) && !allowed.has(key)) {
        stale.push(key);
      }
    }
    expect(
      stale,
      `Remove stale metadata entries from server/admin/entity-metadata.ts: ${stale.join(', ')}`,
    ).toEqual([]);
  });

  it('the allow-list shrinks over time — every allowlisted model still exists in the schema', () => {
    const schemaModels = new Set(schemaModelNames());
    const orphanedAllowList: string[] = [];
    for (const allowed of SCHEMA_MODELS_AWAITING_METADATA) {
      if (!schemaModels.has(allowed)) {
        orphanedAllowList.push(allowed);
      }
    }
    expect(
      orphanedAllowList,
      `Remove from SCHEMA_MODELS_AWAITING_METADATA — these models no longer exist in the schema: ${orphanedAllowList.join(', ')}`,
    ).toEqual([]);
  });
});
