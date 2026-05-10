/**
 * Generic admin scaffolding entity metadata.
 *
 * @build-unit BU-001-prep
 * @spec architecture/admin-surface.md
 * @spec architecture/claim-and-lease.md
 * @spec product/groups.md
 * @spec product/post-creation-flow.md
 *
 * One entry per Prisma entity. BU-001's generic admin components
 * (`<EntityListPage>`, `<EntityDetailPage>`, `<EntityForm>`) read this map to
 * render list/detail/form views without per-entity code.
 *
 * Slice 1 covers nine foundation entities; Slice 1.5 adds Group and
 * GroupMembership (D043); Slice 2 (minimal) adds Post (D045).
 * Future slices extend this map
 * — never remove entries, never rename keys (keys are the URL segment in
 * `/admin/[entity]`).
 *
 * See `server/admin/entity-metadata.README.md` for the extension pattern.
 */

type SortDirection = 'asc' | 'desc';
type SortSpec = Record<string, SortDirection> | ReadonlyArray<Record<string, SortDirection>>;
type RequiredRole = 'queue_manager' | 'admin';
type Workflow = 'queue' | null;

export interface EntityMetadataEntry {
  /** Field to show as the row's identifier in admin lists. Dotted paths allowed (e.g. `user.displayName`). */
  readonly displayField: string;

  /** Template composed from related fields when no single field is human-readable. */
  readonly displayTemplate?: string;

  /** Columns rendered in the list view, in order. Dotted paths allowed for relations. */
  readonly listColumns: ReadonlyArray<string>;

  /** Fields searched by the list view's search box. */
  readonly searchableFields?: ReadonlyArray<string>;

  /** Default sort. Single object for one key; array for multi-key. */
  readonly defaultSort?: SortSpec;

  /** Bulk actions available on the list view. Each maps to a tRPC procedure. */
  readonly bulkActions?: ReadonlyArray<string>;

  /** Minimum role to view (list/detail) and edit. */
  readonly requiresRole: {
    readonly view: RequiredRole;
    readonly edit: RequiredRole;
  };

  /** `queue` renders under `/queue` with specialised queue UI; `null` renders under generic `/admin`. */
  readonly workflow: Workflow;

  /** Soft-delete semantics. `true` means the entity has a `deletedAt` column and router middleware filters it out by default. */
  readonly softDelete: boolean;

  /** Free-text note shown in the admin header — useful for surfacing invariants that live in code, not the database. */
  readonly notes?: string;
}

export const entityMetadata: Record<string, EntityMetadataEntry> = {
  user: {
    displayField: 'displayName',
    listColumns: ['displayName', 'email', 'verifiedAt', 'lastSeenAt', 'createdAt'],
    searchableFields: ['displayName', 'email'],
    defaultSort: { createdAt: 'desc' },
    bulkActions: ['softDelete', 'restore'],
    requiresRole: { view: 'queue_manager', edit: 'admin' },
    workflow: null,
    softDelete: true,
  },

  region: {
    displayField: 'displayName',
    listColumns: ['displayName', 'slug', 'type', 'parent.displayName', 'createdAt'],
    searchableFields: ['displayName', 'slug'],
    defaultSort: [{ type: 'asc' }, { displayName: 'asc' }],
    bulkActions: ['softDelete', 'restore'],
    requiresRole: { view: 'queue_manager', edit: 'admin' },
    workflow: null,
    softDelete: true,
    notes: 'Hierarchy-only per D041. No centroids, no boundaries, no geospatial data.',
  },

  userRegion: {
    displayField: 'id',
    displayTemplate: '{user.displayName} — {region.displayName}',
    listColumns: ['user.displayName', 'region.displayName', 'createdAt'],
    searchableFields: ['user.displayName', 'region.displayName', 'region.slug'],
    defaultSort: { createdAt: 'desc' },
    requiresRole: { view: 'queue_manager', edit: 'admin' },
    workflow: null,
    softDelete: false,
    notes: 'Purpose needs confirmation — see open question 0 in docs/architecture/erd.md.',
  },

  request: {
    displayField: 'id',
    displayTemplate: '{type} — {context.summary}',
    listColumns: ['type', 'status', 'priority', 'claimedBy.displayName', 'regionSlug', 'createdAt'],
    searchableFields: ['type', 'regionSlug'],
    defaultSort: [{ priority: 'desc' }, { createdAt: 'asc' }],
    bulkActions: ['forceRelease'],
    requiresRole: { view: 'queue_manager', edit: 'queue_manager' },
    workflow: 'queue',
    softDelete: true,
    notes:
      'Rendered under /requests (D054, renamed from WorkItem per D040). The unified "things needing decision/discussion" primitive.',
  },

  roleGrant: {
    displayField: 'id',
    displayTemplate: '{role} for {user.displayName}',
    listColumns: ['user.displayName', 'role', 'grantedBy.displayName', 'grantedAt', 'revokedAt'],
    searchableFields: ['user.displayName', 'role'],
    defaultSort: { grantedAt: 'desc' },
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: false,
    notes: 'Revocation uses revokedAt + revokedReason; RoleGrant is not soft-deleted.',
  },

  coordinatorProfile: {
    displayField: 'user.displayName',
    listColumns: ['user.displayName', 'notes', 'createdAt'],
    searchableFields: ['user.displayName'],
    defaultSort: { createdAt: 'desc' },
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: true,
  },

  coordinatorGroup: {
    displayField: 'name',
    listColumns: ['name', 'coordinatorProfile.user.displayName', 'reachEstimate', 'createdAt'],
    searchableFields: ['name', 'description', 'coordinatorProfile.user.displayName'],
    defaultSort: { createdAt: 'desc' },
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: true,
  },

  auditLog: {
    displayField: 'id',
    displayTemplate: '{action} on {entityType}',
    listColumns: [
      'action',
      'entityType',
      'user.displayName',
      'targetUser.displayName',
      'createdAt',
    ],
    searchableFields: ['action', 'entityType', 'entityId'],
    defaultSort: { createdAt: 'desc' },
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: false,
    notes: 'Immutable — routers must not expose update or delete procedures.',
  },

  featureFlag: {
    displayField: 'name',
    listColumns: [
      'name',
      'purpose',
      'enabledGlobally',
      'rolloutPercentage',
      'ttlRemoveAfter',
      'owner.displayName',
    ],
    searchableFields: ['name', 'description'],
    defaultSort: { name: 'asc' },
    bulkActions: ['softDelete'],
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: true,
    notes: 'Every flip writes an AuditLog entry (action: feature_flag_flipped).',
  },

  // ── Slice 1.5 — Groups (D043) ──────────────────────────────────────────────

  group: {
    displayField: 'displayName',
    listColumns: [
      'displayName',
      'slug',
      'joinPolicy',
      'isOfficial',
      'createdBy.displayName',
      'createdAt',
    ],
    searchableFields: ['displayName', 'slug', 'description'],
    defaultSort: { displayName: 'asc' },
    bulkActions: ['softDelete', 'restore'],
    requiresRole: { view: 'queue_manager', edit: 'admin' },
    workflow: null,
    softDelete: true,
    notes:
      'Internal affiliation markers (D043). Distinct from CoordinatorGroup (external communities).',
  },

  groupMembership: {
    displayField: 'id',
    displayTemplate: '{user.displayName} in {group.displayName}',
    listColumns: [
      'user.displayName',
      'group.displayName',
      'role',
      'joinedVia',
      'joinedAt',
      'leftAt',
    ],
    searchableFields: ['user.displayName', 'group.displayName'],
    defaultSort: { joinedAt: 'desc' },
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: true,
    notes:
      'leftAt tracks voluntary departures; deletedAt tracks admin removal. One active membership per (user, group).',
  },

  // ── Slice 2 (minimal) — Post (D045) ──────────────────────────────────────────

  post: {
    displayField: 'title',
    listColumns: ['title', 'author.displayName', 'visibility', 'createdAt'],
    searchableFields: ['title', 'body'],
    defaultSort: { createdAt: 'desc' },
    bulkActions: ['softDelete', 'restore'],
    requiresRole: { view: 'queue_manager', edit: 'admin' },
    workflow: null,
    softDelete: true,
    notes:
      'Core content entity. Visibility defaults to public (D045). groupTags are informational only (D041). Full Slice 2 adds Comment, Reaction, Attachment.',
  },

  // ── bu-kanban-event-config (ADR-0014) ──────────────────────────────────────

  kanbanEventConfig: {
    displayField: 'eventKind',
    listColumns: ['eventKind', 'enabled', 'updatedAt', 'updatedBy.displayName'],
    searchableFields: ['eventKind'],
    defaultSort: { eventKind: 'asc' },
    requiresRole: { view: 'admin', edit: 'admin' },
    workflow: null,
    softDelete: false,
    notes:
      'Reference data per D070 — nine event kinds seeded by migration 20260507100000. Toggling `enabled` decides whether the named kanban event writes a system-Comment row in the ticket thread. No backfill: flips affect future events only.',
  },

  // ── bu-network-feed (ADR-0017, D083) ───────────────────────────────────────

  networkCardState: {
    displayField: 'messageId',
    listColumns: ['messageId', 'status', 'ownerUser.displayName', 'updatedAt'],
    searchableFields: ['messageId', 'notes'],
    defaultSort: { updatedAt: 'desc' },
    requiresRole: { view: 'queue_manager', edit: 'queue_manager' },
    workflow: null,
    softDelete: false,
    notes:
      "Workflow state for cards on /network. The cards themselves are read from Grant (AIFA)'s external Supabase view; this table owns the triage state on our side per ADR-0017. messageId is an opaque BigInt join key into the upstream view (no FK across providers). Rows are created lazily on first state mutation — no row = NEW status at read time.",
  },
};

export type EntityKey = keyof typeof entityMetadata;
