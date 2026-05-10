/**
 * @build-unit BU-seed
 * @spec docs/build/phase-0-foundations.md (F10)
 * @spec docs/build/session-briefs/f10-seed-data.md
 * @spec architecture/decision-log.md (D038)
 *
 * F10 — deterministic, idempotent fixture seed.
 *
 * Populates a fresh Postgres with realistic, clearly-synthetic data
 * across every model the current schema supports (Slices 1, 1.5,
 * 2 minimal + Reaction + Comment). Pairs with `scripts/seed.ts`
 * (the curated demo seed) — the two coexist without collision; see
 * the "Two seed scripts — why" section of the F10 brief.
 *
 * Invocation:
 *   npx prisma db seed              (via the prisma.seed config in package.json)
 *   prisma migrate reset            (Prisma calls this seed automatically)
 *
 * NOT invoked by `npm run db:seed` — that runs `scripts/seed.ts`.
 *
 * Determinism: every random draw is sourced from a single faker RNG
 * seeded with a fixed integer derived from F10_SEED. Two consecutive
 * runs against the same starting state produce identical row content.
 *
 * Idempotency: every write is an `upsert` keyed on either a unique
 * field (email, slug, name) or a deterministic UUID. Re-running the
 * seed updates rows in place rather than duplicating.
 *
 * Safety: refuses to run against a non-localhost / non-staging
 * database when NODE_ENV === 'production'. Belt and braces — Prisma's
 * own contract is "the seed only runs when explicitly invoked", but
 * the cost of a guard is one if-statement and the cost of an
 * accidental prod seed is catastrophic.
 *
 * No PII in console output: row counts only.
 */

/* eslint-disable no-console -- CLI script: console output is the contract. */

// Prisma 7 (D071): the runtime adapter reads DATABASE_URL at module
// init; tsx doesn't auto-load .env, so we import it here before the
// prisma client is constructed. Mirrors scripts/seed.ts.
import 'dotenv/config';

import { createHash } from 'crypto';
import type {
  FeatureFlagPurpose,
  GroupJoinPolicy,
  GroupMembershipRole,
  JoinSource,
  PostVisibility,
  ReactionEmoji,
  ReactionTargetType,
  RegionType,
  SystemRole,
  RequestPriority,
  RequestResolution,
  RequestStatus,
  RequestType,
} from '@prisma/client';
import { faker, en_GB, en, Faker } from '@faker-js/faker';
import { prisma } from '@/server/db/client';

// ── Production guard ─────────────────────────────────────────────────────

const productionMode = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL ?? '';
const looksSafe = /localhost|127\.0\.0\.1|\bstaging\b|\bdev\b|\bfixture\b|\btest\b/i.test(
  databaseUrl,
);

if (productionMode && !looksSafe) {
  console.error(
    'Refusing to run F10 fixture seed against a production database. ' +
      'Set NODE_ENV != production, or point DATABASE_URL at a localhost / staging / dev / test instance.',
  );
  process.exit(1);
}

// ── RNG / faker setup ────────────────────────────────────────────────────
//
// One seeded RNG drives every random draw. We use a UK-locale faker
// instance with the global English fallback so we never get an
// undefined locale field at runtime.

const F10_SEED = 'gps-action-f10-v1';
const F10_SEED_INT =
  // 32-bit unsigned integer derived from the string seed. Stable across
  // Node versions; faker.seed accepts a number.
  parseInt(createHash('sha256').update(F10_SEED).digest('hex').slice(0, 8), 16);

// Faker v9+ uses locale-specific instances; build one with en_GB +
// en fallback so personal names + UK phone formats are realistic.
const fixtureFaker = new Faker({ locale: [en_GB, en] });
fixtureFaker.seed(F10_SEED_INT);

// Also seed the default exported faker — some helpers (date, helpers)
// use module-level state in older code paths; keep them deterministic
// too as a safety net.
faker.seed(F10_SEED_INT);

// SEED_NOW is the fixed "now" the seed pretends it's running at.
// All time-based fields are computed as offsets from this baseline so
// they don't drift between days.
const SEED_NOW = new Date('2026-04-26T12:00:00Z');

// ── Deterministic UUID derivation ────────────────────────────────────────
//
// Same pattern as scripts/seed.ts — a UUIDv4-shaped hash of (namespace,
// key) so that re-runs hit the same IDs and `upsert` works as expected.

function seedUuid(namespace: string, key: string): string {
  const hash = createHash('sha256').update(`${namespace}:${key}`).digest('hex');
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    '4' + hash.slice(13, 16),
    ((parseInt(hash.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ── Volume knobs ─────────────────────────────────────────────────────────
//
// Tweak these to dial seed size up or down. Defaults match the F10 brief.

const COUNTS = {
  users: 50,
  regions: 10, // fixed — see REGION_DEFS below
  groups: 5, // fixed — see GROUP_DEFS below
  posts: 200,
  requests: 30,
  auditLogEntries: 50,
  coordinatorProfiles: 5,
  // Fraction of users who get soft-deleted post-seed (must own at
  // least one post first)
  softDeletedUserPercent: 0.05,
  // Fraction of posts soft-deleted
  softDeletedPostPercent: 0.03,
  // Fraction of comments soft-deleted
  softDeletedCommentPercent: 0.02,
  // Fraction of posts that get NO comments (realistic distribution)
  postsWithoutCommentsPercent: 0.2,
  // Fraction of posts with an Activist Mailer URL
  postsWithAmUrlPercent: 0.3,
  // Fraction of users with phoneNumber populated
  usersWithPhonePercent: 0.7,
  // Fraction of users with verifiedAt populated
  usersWithVerifiedPercent: 0.85,
};

// ── Static fixture definitions ───────────────────────────────────────────

interface RegionDef {
  slug: string;
  displayName: string;
  type: RegionType;
  parentSlug: string | null;
}

const REGION_DEFS: RegionDef[] = [
  { slug: 'national', displayName: 'UK National', type: 'national', parentSlug: null },
  { slug: 'north-london', displayName: 'North London', type: 'region', parentSlug: 'national' },
  {
    slug: 'manchester-region',
    displayName: 'Greater Manchester',
    type: 'region',
    parentSlug: 'national',
  },
  { slug: 'leeds-region', displayName: 'West Yorkshire', type: 'region', parentSlug: 'national' },
  {
    slug: 'birmingham-region',
    displayName: 'West Midlands',
    type: 'region',
    parentSlug: 'national',
  },
  {
    slug: 'glasgow-region',
    displayName: 'Greater Glasgow',
    type: 'region',
    parentSlug: 'national',
  },
  {
    slug: 'barnet-council',
    displayName: 'Barnet Council',
    type: 'council',
    parentSlug: 'north-london',
  },
  {
    slug: 'camden-council',
    displayName: 'Camden Council',
    type: 'council',
    parentSlug: 'north-london',
  },
  {
    slug: 'salford-council',
    displayName: 'Salford Council',
    type: 'council',
    parentSlug: 'manchester-region',
  },
  {
    slug: 'bury-council',
    displayName: 'Bury Council',
    type: 'council',
    parentSlug: 'manchester-region',
  },
];

interface GroupDef {
  slug: string;
  displayName: string;
  description: string;
  joinPolicy: GroupJoinPolicy;
  isOfficial: boolean;
  /** Approximate target membership count */
  membersTarget: number;
}

const GROUP_DEFS: GroupDef[] = [
  {
    slug: 'letter-writers',
    displayName: 'Letter Writers',
    description: 'Members who draft and send formal complaints, op-eds, and constituency letters.',
    joinPolicy: 'open',
    isOfficial: true,
    membersTarget: 14,
  },
  {
    slug: 'media-response',
    displayName: 'Media Response',
    description: 'Coordinated rapid response to broadcast and print media coverage.',
    joinPolicy: 'request_to_join',
    isOfficial: true,
    membersTarget: 10,
  },
  {
    slug: 'regional-leeds',
    displayName: 'Leeds Activists',
    description: 'Yorkshire-area members coordinating local actions and meet-ups.',
    joinPolicy: 'open',
    isOfficial: false,
    membersTarget: 8,
  },
  {
    slug: 'students',
    displayName: 'Students Network',
    description: 'University and FE college members coordinating campus-level work.',
    joinPolicy: 'request_to_join',
    isOfficial: true,
    membersTarget: 12,
  },
  {
    slug: 'wellbeing',
    displayName: 'Wellbeing Circle',
    description: 'Quiet space for cultural moments, reflection, and peer support.',
    joinPolicy: 'open',
    isOfficial: false,
    membersTarget: 6,
  },
];

const ALL_REACTION_EMOJIS: ReactionEmoji[] = [
  'candle',
  'pray',
  'heart',
  'strong',
  'target',
  'sparkle',
  'thumbsup',
  'sad',
];

const REQUEST_TYPES: { type: RequestType; count: number }[] = [
  { type: 'vetting', count: 8 },
  { type: 'flag', count: 6 },
  { type: 'outcome_review', count: 4 },
  { type: 'dedup_merge', count: 3 },
  { type: 'edit_request', count: 3 },
  { type: 'incident', count: 3 },
  { type: 'content_submission', count: 2 },
  { type: 'link_submission', count: 1 },
];

const AUDIT_ACTIONS = [
  'role_granted',
  'role_revoked',
  'feature_flag_flipped',
  'claim_ttl_expired',
  'group_member_approved',
  'work_item_resolved',
  'post_soft_deleted',
];

// ── Helpers ──────────────────────────────────────────────────────────────

function pick<T>(items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick called on empty array');
  }
  const idx = fixtureFaker.number.int({ min: 0, max: items.length - 1 });
  return items[idx]!;
}

function pickN<T>(items: readonly T[], n: number): T[] {
  if (n >= items.length) return [...items];
  const copy = [...items];
  // Fisher-Yates partial shuffle, deterministic via fixtureFaker
  for (let i = 0; i < n; i += 1) {
    const j = fixtureFaker.number.int({ min: i, max: copy.length - 1 });
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, n);
}

function randomInt(min: number, max: number): number {
  return fixtureFaker.number.int({ min, max });
}

/**
 * Triangular distribution over the past `daysWindow` days, biased
 * toward recent. Returns a Date offset from SEED_NOW.
 */
function recentDate(daysWindow: number): Date {
  // Two uniform draws averaged → triangular peak at midpoint;
  // square it to bias toward 0 (recent).
  const u = fixtureFaker.number.float({ min: 0, max: 1, multipleOf: 0.0001 });
  const v = fixtureFaker.number.float({ min: 0, max: 1, multipleOf: 0.0001 });
  const t = u * v; // biased toward 0
  const offsetMs = Math.floor(t * daysWindow * 24 * 60 * 60 * 1000);
  return new Date(SEED_NOW.getTime() - offsetMs);
}

function dateBetween(earliest: Date, latest: Date): Date {
  const span = latest.getTime() - earliest.getTime();
  if (span <= 0) return new Date(latest);
  const offset = fixtureFaker.number.int({ min: 0, max: span });
  return new Date(earliest.getTime() + offset);
}

interface SeededUser {
  id: string;
  email: string;
  displayName: string;
  index: number;
  isAdmin: boolean;
  isQueueManager: boolean;
  isCoordinator: boolean;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.warn('F10 fixture seed → starting');
  console.warn(`  seed=${F10_SEED} (int=${F10_SEED_INT})`);
  console.warn(`  baseline=${SEED_NOW.toISOString()}`);

  try {
    // ── Users ────────────────────────────────────────────────────────────
    const seededUsers: SeededUser[] = [];
    let usersCreated = 0;

    for (let i = 0; i < COUNTS.users; i += 1) {
      const username = fixtureFaker.internet
        .username()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
      const email = `${username}-${i}@fixture.gps-action.test`;
      const displayName = fixtureFaker.person.fullName();
      const verified =
        fixtureFaker.number.float({ min: 0, max: 1 }) < COUNTS.usersWithVerifiedPercent;
      const hasPhone = fixtureFaker.number.float({ min: 0, max: 1 }) < COUNTS.usersWithPhonePercent;

      const phoneNumber = hasPhone
        ? `+44 7${fixtureFaker.string.numeric(3)} ${fixtureFaker.string.numeric(6)}`
        : null;

      const createdAt = recentDate(180);
      const lastSeenAt = dateBetween(createdAt, SEED_NOW);

      const id = seedUuid('user', email);

      const before = await prisma.user.findUnique({ where: { email } });
      await prisma.user.upsert({
        where: { email },
        update: {
          displayName,
          phoneNumber,
          verifiedAt: verified ? createdAt : null,
          lastSeenAt,
        },
        create: {
          id,
          email,
          displayName,
          phoneNumber,
          verifiedAt: verified ? createdAt : null,
          lastSeenAt,
          createdAt,
        },
      });
      if (!before) usersCreated += 1;

      seededUsers.push({
        id,
        email,
        displayName,
        index: i,
        isAdmin: i < 2, // first 2 → admin
        isQueueManager: i >= 2 && i < 5, // next 3 → queue_manager
        isCoordinator: i >= 5 && i < 10, // next 5 → coordinator profile
      });
    }
    console.warn(`  users: ${COUNTS.users} (${usersCreated} new)`);

    // ── Role grants ──────────────────────────────────────────────────────
    let roleGrantsCreated = 0;
    const adminUsers = seededUsers.filter((u) => u.isAdmin);
    const grantor = adminUsers[0]!;

    for (const user of seededUsers) {
      const roles: SystemRole[] = [];
      if (user.isAdmin) roles.push('admin');
      if (user.isQueueManager) roles.push('queue_manager');

      for (const role of roles) {
        const existing = await prisma.roleGrant.findFirst({
          where: { userId: user.id, role, revokedAt: null },
        });
        if (existing) continue;

        // Bootstrapping: the very first admin self-grants. Others are
        // granted by the bootstrap admin.
        const granter = role === 'admin' && user.id === grantor.id ? user : grantor;

        await prisma.roleGrant.create({
          data: {
            id: seedUuid('rolegrant', `${user.email}:${role}`),
            userId: user.id,
            role,
            grantedByUserId: granter.id,
            grantedReason: 'F10 fixture seed — bootstrap role for dev / preview environments',
          },
        });
        roleGrantsCreated += 1;
      }
    }
    console.warn(`  role grants: ${roleGrantsCreated} created (idempotent — skipped if active)`);

    // ── Regions ──────────────────────────────────────────────────────────
    const regionIds: Record<string, string> = {};
    let regionsCreated = 0;

    // Pass 1: create national + region tier (so council parents exist)
    for (const def of REGION_DEFS.filter((r) => r.type !== 'council')) {
      const id = seedUuid('region', def.slug);
      regionIds[def.slug] = id;

      const before = await prisma.region.findUnique({ where: { slug: def.slug } });
      await prisma.region.upsert({
        where: { slug: def.slug },
        update: {
          displayName: def.displayName,
          type: def.type,
          parentId: def.parentSlug ? regionIds[def.parentSlug] : null,
        },
        create: {
          id,
          slug: def.slug,
          displayName: def.displayName,
          type: def.type,
          parentId: def.parentSlug ? regionIds[def.parentSlug] : null,
        },
      });
      if (!before) regionsCreated += 1;
    }
    // Pass 2: councils
    for (const def of REGION_DEFS.filter((r) => r.type === 'council')) {
      const id = seedUuid('region', def.slug);
      regionIds[def.slug] = id;

      const before = await prisma.region.findUnique({ where: { slug: def.slug } });
      await prisma.region.upsert({
        where: { slug: def.slug },
        update: {
          displayName: def.displayName,
          type: def.type,
          parentId: def.parentSlug ? regionIds[def.parentSlug] : null,
        },
        create: {
          id,
          slug: def.slug,
          displayName: def.displayName,
          type: def.type,
          parentId: def.parentSlug ? regionIds[def.parentSlug] : null,
        },
      });
      if (!before) regionsCreated += 1;
    }
    console.warn(`  regions: ${REGION_DEFS.length} (${regionsCreated} new)`);

    // ── UserRegion ───────────────────────────────────────────────────────
    let userRegionsCreated = 0;
    const allRegionSlugs = REGION_DEFS.map((r) => r.slug);

    for (const user of seededUsers) {
      const regionCount = randomInt(1, 3);
      const slugs = pickN(allRegionSlugs, regionCount);

      for (const slug of slugs) {
        const regionId = regionIds[slug]!;
        const before = await prisma.userRegion.findUnique({
          where: { userId_regionId: { userId: user.id, regionId } },
        });
        if (!before) {
          await prisma.userRegion.create({
            data: {
              id: seedUuid('userregion', `${user.email}:${slug}`),
              userId: user.id,
              regionId,
            },
          });
          userRegionsCreated += 1;
        }
      }
    }
    console.warn(`  user-region affinities: ${userRegionsCreated} new`);

    // ── Groups ───────────────────────────────────────────────────────────
    const groupIds: Record<string, string> = {};
    let groupsCreated = 0;

    for (const def of GROUP_DEFS) {
      const id = seedUuid('group', def.slug);
      groupIds[def.slug] = id;
      const creator = seededUsers[def.slug.length % seededUsers.length]!;

      const before = await prisma.group.findUnique({ where: { slug: def.slug } });
      await prisma.group.upsert({
        where: { slug: def.slug },
        update: {
          displayName: def.displayName,
          description: def.description,
          joinPolicy: def.joinPolicy,
          isOfficial: def.isOfficial,
        },
        create: {
          id,
          slug: def.slug,
          displayName: def.displayName,
          description: def.description,
          joinPolicy: def.joinPolicy,
          isOfficial: def.isOfficial,
          createdByUserId: creator.id,
        },
      });
      if (!before) groupsCreated += 1;
    }
    console.warn(`  groups: ${GROUP_DEFS.length} (${groupsCreated} new)`);

    // ── GroupMembership ──────────────────────────────────────────────────
    let membershipsCreated = 0;
    for (const def of GROUP_DEFS) {
      const groupId = groupIds[def.slug]!;
      const members = pickN(seededUsers, def.membersTarget);

      for (const member of members) {
        const before = await prisma.groupMembership.findUnique({
          where: { userId_groupId: { userId: member.id, groupId } },
        });
        if (before) continue;

        const isGroupAdmin = member.isAdmin || member.isCoordinator;
        const role: GroupMembershipRole = isGroupAdmin ? 'admin' : 'member';
        const joinedVia: JoinSource =
          def.joinPolicy === 'request_to_join' ? 'request_approved' : 'self_join';

        // 10% of memberships have leftAt set (history preservation)
        const hasLeft = fixtureFaker.number.float({ min: 0, max: 1 }) < 0.1;
        const joinedAt = recentDate(120);
        const leftAt = hasLeft ? dateBetween(joinedAt, SEED_NOW) : null;

        await prisma.groupMembership.create({
          data: {
            id: seedUuid('membership', `${def.slug}:${member.email}`),
            userId: member.id,
            groupId,
            role,
            joinedAt,
            joinedVia,
            leftAt,
            leftReason: hasLeft ? 'Seeded historical departure' : null,
            approvedByUserId: joinedVia === 'request_approved' ? grantor.id : null,
            approvedAt: joinedVia === 'request_approved' ? joinedAt : null,
          },
        });
        membershipsCreated += 1;
      }
    }
    console.warn(`  group memberships: ${membershipsCreated} new`);

    // ── CoordinatorProfile + CoordinatorGroup ────────────────────────────
    let coordProfilesCreated = 0;
    let coordGroupsCreated = 0;

    const coordinators = seededUsers.filter((u) => u.isCoordinator);

    for (const coord of coordinators) {
      const profileId = seedUuid('coordinatorprofile', coord.email);
      const beforeProfile = await prisma.coordinatorProfile.findUnique({
        where: { userId: coord.id },
      });
      if (!beforeProfile) {
        await prisma.coordinatorProfile.create({
          data: {
            id: profileId,
            userId: coord.id,
            notes: 'F10 fixture seed — synthetic coordinator profile',
          },
        });
        coordProfilesCreated += 1;
      }

      const profile = beforeProfile ?? { id: profileId };
      const externalGroupCount = randomInt(1, 3);
      for (let g = 0; g < externalGroupCount; g += 1) {
        const cgId = seedUuid('coordinatorgroup', `${coord.email}:${g}`);
        const before = await prisma.coordinatorGroup.findUnique({ where: { id: cgId } });
        if (before) continue;

        await prisma.coordinatorGroup.create({
          data: {
            id: cgId,
            coordinatorProfileId: profile.id,
            name: `${fixtureFaker.location.city()} ${pick(['WhatsApp Group', 'Newsletter', 'Network', 'Circle'])}`,
            description: 'Synthetic external community for fixture purposes.',
            logoUrl: null,
            reachEstimate: randomInt(20, 800),
          },
        });
        coordGroupsCreated += 1;
      }
    }
    console.warn(
      `  coordinator profiles: ${coordProfilesCreated} new, external groups: ${coordGroupsCreated} new`,
    );

    // ── Posts ────────────────────────────────────────────────────────────
    interface SeededPost {
      id: string;
      authorId: string;
      visibility: PostVisibility;
      hasAmUrl: boolean;
      isCultural: boolean;
      createdAt: Date;
    }

    const seededPosts: SeededPost[] = [];
    let postsCreated = 0;
    const liveUsers = seededUsers; // soft-delete happens after posts

    for (let i = 0; i < COUNTS.posts; i += 1) {
      // Weight: admins/coords (first 10) write 35% of posts
      const author =
        fixtureFaker.number.float({ min: 0, max: 1 }) < 0.35
          ? pick(liveUsers.slice(0, 10))
          : pick(liveUsers);

      const seedKey = `post-${i}`;
      const id = seedUuid('post', seedKey);

      const isCultural = fixtureFaker.number.float({ min: 0, max: 1 }) < 0.12;
      const hasAmUrl =
        !isCultural && fixtureFaker.number.float({ min: 0, max: 1 }) < COUNTS.postsWithAmUrlPercent;

      const culturalTitles = [
        'Shabbat shalom — a moment to pause',
        'Holocaust Memorial Day — we remember',
        'Yom HaShoah — quiet reflection',
        'Tu B’Shvat greetings from the network',
        'Chag sameach — community moments',
      ];
      const actionTitles = [
        `Write to your MP about ${fixtureFaker.lorem.words({ min: 2, max: 4 })}`,
        `Council motion — ${fixtureFaker.lorem.words({ min: 2, max: 3 })}`,
        `Ofcom complaint — ${fixtureFaker.lorem.words({ min: 2, max: 3 })}`,
        `BBC complaint — ${fixtureFaker.lorem.words({ min: 2, max: 3 })}`,
        `School board letter — ${fixtureFaker.lorem.words({ min: 2, max: 3 })}`,
      ];
      const newsTitles = [
        `Worth reading — ${fixtureFaker.lorem.words({ min: 3, max: 5 })}`,
        `Update — ${fixtureFaker.lorem.words({ min: 3, max: 5 })}`,
        `Outcome — ${fixtureFaker.lorem.words({ min: 2, max: 4 })}`,
      ];

      let title: string;
      if (isCultural) title = pick(culturalTitles);
      else if (hasAmUrl) title = pick(actionTitles);
      else title = pick(newsTitles);

      // Cap title length to be realistic
      if (title.length > 120) title = title.slice(0, 117) + '...';

      const body = fixtureFaker.lorem.paragraphs({ min: 2, max: 5 }, '\n\n');

      const visibility: PostVisibility =
        fixtureFaker.number.float({ min: 0, max: 1 }) < 0.2 ? 'authenticated_only' : 'public';

      const activistMailerUrl = hasAmUrl
        ? `https://activist-mailer.example.com/campaign/${fixtureFaker.string.alphanumeric({ length: 12, casing: 'lower' })}`
        : null;

      const groupTags = pickN(
        GROUP_DEFS.map((g) => g.slug),
        randomInt(0, 2),
      );

      // BU-post-hero-demo (D064): assign a hero image to ~half of seeded
      // posts, distributed across all 8 seeded URLs so every image is
      // visually testable in the feed without cramming them in.
      const SEED_HERO_IMAGE_URLS = [
        '/seed-images/01.svg',
        '/seed-images/02.svg',
        '/seed-images/03.svg',
        '/seed-images/04.svg',
        '/seed-images/05.svg',
        '/seed-images/06.svg',
        '/seed-images/07.svg',
        '/seed-images/08.svg',
      ];
      const heroImageUrl =
        !isCultural && fixtureFaker.number.float({ min: 0, max: 1 }) < 0.5
          ? (SEED_HERO_IMAGE_URLS[i % SEED_HERO_IMAGE_URLS.length] ?? null)
          : null;

      const createdAt = recentDate(90);

      const before = await prisma.post.findUnique({ where: { id } });
      await prisma.post.upsert({
        where: { id },
        update: {
          authorId: author.id,
          title,
          body,
          visibility,
          activistMailerUrl,
          heroImageUrl,
          groupTags,
        },
        create: {
          id,
          authorId: author.id,
          title,
          body,
          visibility,
          activistMailerUrl,
          heroImageUrl,
          groupTags,
          createdAt,
        },
      });
      if (!before) postsCreated += 1;

      seededPosts.push({
        id,
        authorId: author.id,
        visibility,
        hasAmUrl,
        isCultural,
        createdAt,
      });
    }
    console.warn(`  posts: ${COUNTS.posts} (${postsCreated} new)`);

    // ── Soft-delete a fraction of posts ──────────────────────────────────
    let postsSoftDeleted = 0;
    const softDeletedPostCount = Math.floor(seededPosts.length * COUNTS.softDeletedPostPercent);
    const postsToSoftDelete = pickN(seededPosts, softDeletedPostCount);
    for (const p of postsToSoftDelete) {
      const result = await prisma.post.updateMany({
        where: { id: p.id, deletedAt: null },
        data: { deletedAt: dateBetween(p.createdAt, SEED_NOW) },
      });
      postsSoftDeleted += result.count;
    }
    console.warn(`  posts soft-deleted: ${postsSoftDeleted}`);

    // ── Comments ─────────────────────────────────────────────────────────
    let commentsCreated = 0;
    let commentsSoftDeleted = 0;
    interface SeededComment {
      id: string;
      postId: string;
      createdAt: Date;
    }
    const seededComments: SeededComment[] = [];

    for (const post of seededPosts) {
      const skip =
        fixtureFaker.number.float({ min: 0, max: 1 }) < COUNTS.postsWithoutCommentsPercent;
      if (skip) continue;

      // Skewed: most posts get 2-4 comments, some get up to 8
      const r = fixtureFaker.number.float({ min: 0, max: 1 });
      const commentCount = r < 0.7 ? randomInt(1, 4) : randomInt(5, 8);

      for (let c = 0; c < commentCount; c += 1) {
        const commenter = pick(liveUsers);
        const commentSeed = `${post.id}:${c}`;
        const id = seedUuid('comment', commentSeed);
        const createdAt = dateBetween(post.createdAt, SEED_NOW);
        const body = fixtureFaker.lorem.sentences({ min: 1, max: 3 });
        const isSoftDeleted =
          fixtureFaker.number.float({ min: 0, max: 1 }) < COUNTS.softDeletedCommentPercent;

        const before = await prisma.comment.findUnique({ where: { id } });
        await prisma.comment.upsert({
          where: { id },
          update: {
            postId: post.id,
            authorId: commenter.id,
            body,
          },
          create: {
            id,
            postId: post.id,
            authorId: commenter.id,
            body,
            createdAt,
            deletedAt: isSoftDeleted ? dateBetween(createdAt, SEED_NOW) : null,
          },
        });
        if (!before) {
          commentsCreated += 1;
          if (isSoftDeleted) commentsSoftDeleted += 1;
        }

        seededComments.push({ id, postId: post.id, createdAt });
      }
    }
    console.warn(
      `  comments: ${commentsCreated} new (${commentsSoftDeleted} soft-deleted at create time)`,
    );

    // ── Reactions on posts ───────────────────────────────────────────────
    let postReactionsCreated = 0;

    for (const post of seededPosts) {
      const reactionCount = randomInt(0, 15);
      if (reactionCount === 0) continue;

      // Per-post emoji bias
      const emojiPool: ReactionEmoji[] = post.isCultural
        ? ['candle', 'pray', 'heart', 'sad', 'sparkle']
        : post.hasAmUrl
          ? ['strong', 'thumbsup', 'target', 'heart']
          : ALL_REACTION_EMOJIS;

      // Spread across distinct (user, emoji) pairs to satisfy unique
      // constraint
      const reactingUsers = pickN(liveUsers, reactionCount);
      for (const user of reactingUsers) {
        const emoji = pick(emojiPool);
        const id = seedUuid('reaction', `post:${post.id}:${user.id}:${emoji}`);

        const targetType: ReactionTargetType = 'post';
        const before = await prisma.reaction.findUnique({ where: { id } });
        await prisma.reaction.upsert({
          where: { id },
          update: {},
          create: {
            id,
            userId: user.id,
            targetType,
            targetId: post.id,
            postId: post.id,
            emoji,
          },
        });
        if (!before) postReactionsCreated += 1;
      }
    }
    console.warn(`  reactions on posts: ${postReactionsCreated} new`);

    // ── Reactions on comments (D052 — schema-ready, UI deferred) ─────────
    let commentReactionsCreated = 0;
    const commentReactionTargetCount = Math.floor(seededComments.length * 0.1);
    const commentTargets = pickN(seededComments, commentReactionTargetCount);

    for (const comment of commentTargets) {
      const reactionCount = randomInt(1, 3);
      const reactingUsers = pickN(liveUsers, reactionCount);
      for (const user of reactingUsers) {
        const emoji = pick(ALL_REACTION_EMOJIS);
        const id = seedUuid('reaction', `comment:${comment.id}:${user.id}:${emoji}`);

        const targetType: ReactionTargetType = 'comment';
        const before = await prisma.reaction.findUnique({ where: { id } });
        await prisma.reaction.upsert({
          where: { id },
          update: {},
          create: {
            id,
            userId: user.id,
            targetType,
            targetId: comment.id,
            commentId: comment.id,
            emoji,
          },
        });
        if (!before) commentReactionsCreated += 1;
      }
    }
    console.warn(`  reactions on comments: ${commentReactionsCreated} new`);

    // ── Requests ────────────────────────────────────────────────────────
    let requestsCreated = 0;
    let wiIndex = 0;
    for (const { type, count } of REQUEST_TYPES) {
      for (let n = 0; n < count; n += 1) {
        const id = seedUuid('workitem', `${type}:${n}`);
        // ADR-0012: status reframed to backlog | active | done | abandoned.
        const status: RequestStatus =
          n === 0 && type === 'flag'
            ? 'active'
            : n === 0 && type === 'outcome_review'
              ? 'done'
              : 'backlog';

        const priority: RequestPriority = pick<RequestPriority>([
          'low',
          'normal',
          'normal',
          'high',
          'urgent',
        ]);

        const claimer =
          status === 'active' ? pick(seededUsers.filter((u) => u.isQueueManager)) : null;
        const resolver =
          status === 'done' ? pick(seededUsers.filter((u) => u.isQueueManager || u.isAdmin)) : null;
        const resolution: RequestResolution | null = status === 'done' ? 'approved' : null;

        const createdAt = recentDate(60);
        const claimedAt = claimer ? dateBetween(createdAt, SEED_NOW) : null;
        const resolvedAt = resolver ? dateBetween(createdAt, SEED_NOW) : null;

        const before = await prisma.request.findUnique({ where: { id } });
        await prisma.request.upsert({
          where: { id },
          update: {
            status,
            priority,
            resolvedAt,
            resolvedByUserId: resolver?.id ?? null,
            resolution,
            resolutionNotes: resolver ? 'Synthetic resolution note for fixture data.' : null,
          },
          create: {
            id,
            type,
            status,
            priority,
            context: {
              note: `F10 fixture Request (${type})`,
              syntheticRef: `synthetic-${type}-${n}`,
              summary: fixtureFaker.lorem.sentence(),
            },
            regionSlug: pick(allRegionSlugs),
            groupTags: pickN(
              GROUP_DEFS.map((g) => g.slug),
              randomInt(0, 2),
            ),
            createdAt,
            createdByUserId: pick(seededUsers).id,
            resolvedAt,
            resolvedByUserId: resolver?.id ?? null,
            resolution,
            resolutionNotes: resolver ? 'Synthetic resolution note for fixture data.' : null,
          },
        });
        // ADR-0011: ownership lives on Assignment now. Seed an Assignment
        // row when there's a claimer so fixtures look identical to the
        // legacy single-owner shape after the cutover.
        if (claimer && claimedAt) {
          await prisma.assignment.upsert({
            where: { requestId_userId: { requestId: id, userId: claimer.id } },
            create: { requestId: id, userId: claimer.id, assignedAt: claimedAt },
            update: { unassignedAt: null, assignedAt: claimedAt },
          });
        }
        if (!before) requestsCreated += 1;
        wiIndex += 1;
      }
    }
    console.warn(`  work items: ${wiIndex} (${requestsCreated} new)`);

    // ── AuditLog ─────────────────────────────────────────────────────────
    let auditCreated = 0;
    for (let i = 0; i < COUNTS.auditLogEntries; i += 1) {
      const id = seedUuid('auditlog', `entry-${i}`);
      const action = pick(AUDIT_ACTIONS);
      const actor = pick(seededUsers);
      const target = pick(seededUsers);

      const before = await prisma.auditLog.findUnique({ where: { id } });
      await prisma.auditLog.upsert({
        where: { id },
        update: {},
        create: {
          id,
          action,
          entityType: action.startsWith('feature_flag') ? 'FeatureFlag' : 'User',
          entityId: target.id,
          userId: actor.id,
          targetUserId: target.id,
          changes: { synthetic: true, action },
          context: { source: 'F10 fixture seed' },
          createdAt: recentDate(60),
        },
      });
      if (!before) auditCreated += 1;
    }
    console.warn(`  audit log entries: ${COUNTS.auditLogEntries} (${auditCreated} new)`);

    // ── FeatureFlags (3 — distinct from demo seed's ff_reactions / ff_comments) ─
    const flagDefs: {
      name: string;
      description: string;
      purpose: FeatureFlagPurpose;
      enabledGlobally: boolean;
      rolloutPercentage: number;
      ttlRemoveAfter: Date | null;
      ownerUserId: string | null;
      enabledForGroupIds: string[];
    }[] = [
      {
        name: 'ff_seed_rollout',
        description: 'F10 fixture: rollout-purpose flag at 25% for testing rollout UI.',
        purpose: 'rollout',
        enabledGlobally: false,
        rolloutPercentage: 25,
        ttlRemoveAfter: new Date(SEED_NOW.getTime() + 90 * 24 * 60 * 60 * 1000),
        ownerUserId: null,
        enabledForGroupIds: [],
      },
      {
        name: 'ff_seed_kill',
        description: 'F10 fixture: kill-switch flag (default ON; admin-owned).',
        purpose: 'kill_switch',
        enabledGlobally: true,
        rolloutPercentage: 0,
        ttlRemoveAfter: null,
        ownerUserId: adminUsers[0]!.id,
        enabledForGroupIds: [],
      },
      {
        name: 'ff_seed_pilot',
        description: 'F10 fixture: pilot-gate flag enabled for the letter-writers group.',
        purpose: 'pilot_gate',
        enabledGlobally: false,
        rolloutPercentage: 0,
        ttlRemoveAfter: null,
        ownerUserId: adminUsers[0]!.id,
        enabledForGroupIds: [groupIds['letter-writers']!],
      },
    ];

    let flagsCreated = 0;
    for (const def of flagDefs) {
      const before = await prisma.featureFlag.findUnique({ where: { name: def.name } });
      await prisma.featureFlag.upsert({
        where: { name: def.name },
        update: {
          description: def.description,
          enabledGlobally: def.enabledGlobally,
          rolloutPercentage: def.rolloutPercentage,
          ttlRemoveAfter: def.ttlRemoveAfter,
          ownerUserId: def.ownerUserId,
          enabledForGroupIds: def.enabledForGroupIds,
          updatedByUserId: adminUsers[0]!.id,
        },
        create: {
          id: seedUuid('featureflag', def.name),
          name: def.name,
          description: def.description,
          purpose: def.purpose,
          enabledGlobally: def.enabledGlobally,
          rolloutPercentage: def.rolloutPercentage,
          ttlRemoveAfter: def.ttlRemoveAfter,
          ownerUserId: def.ownerUserId,
          enabledForGroupIds: def.enabledForGroupIds,
          createdByUserId: adminUsers[0]!.id,
          updatedByUserId: adminUsers[0]!.id,
        },
      });
      if (!before) flagsCreated += 1;
    }
    console.warn(`  feature flags: ${flagDefs.length} (${flagsCreated} new)`);

    // ── Soft-delete a fraction of users (after posts so the
    //    "soft-deleted users still own posts" invariant is exercised) ───
    let usersSoftDeleted = 0;
    const softDeletedUserCount = Math.floor(seededUsers.length * COUNTS.softDeletedUserPercent);
    // Deterministic selection: take the last N user indices (avoids
    // accidentally soft-deleting our admins / coordinators)
    const softDeleteCandidates = seededUsers.slice(-softDeletedUserCount);
    for (const user of softDeleteCandidates) {
      const result = await prisma.user.updateMany({
        where: { id: user.id, deletedAt: null },
        data: { deletedAt: dateBetween(SEED_NOW, SEED_NOW) },
      });
      usersSoftDeleted += result.count;
    }
    console.warn(`  users soft-deleted: ${usersSoftDeleted}`);

    console.warn('F10 fixture seed → complete');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error('F10 fixture seed failed:', err);
  process.exit(1);
});
