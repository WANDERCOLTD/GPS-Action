/**
 * @build-unit BU-001-lite BU-feed
 * @spec product/scenarios.md
 *
 * Database seed — populates a realistic demo environment.
 * Idempotent: uses upsert for users, hash-based deterministic IDs
 * for groups and posts. Safe to re-run.
 *
 * BU-001-lite: 5 demo users + 2 role grants.
 * BU-feed: 3 groups + 18 posts across 5 users.
 */

import { createHash } from 'crypto';
import type { PostVisibility } from '@prisma/client';
import { prisma } from '@/server/db/client';

// ── Deterministic ID generator ──────────────────────────────────────────
// Produces a stable UUID-formatted string from a namespace + key so that
// re-running the seed doesn't create duplicates.

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

// ── Seed users ───────────────────────────────────────────────────────────
// Invented characters — not real people. Names riff on classic film stars
// with fabricated surnames.

const SEED_USERS = [
  {
    email: 'eddie@demo.gps-action.test',
    displayName: 'Eddie Morales',
  },
  {
    email: 'cary@demo.gps-action.test',
    displayName: 'Cary Whitfield',
  },
  {
    email: 'bette@demo.gps-action.test',
    displayName: 'Bette Rosenthal',
  },
  {
    email: 'humphrey@demo.gps-action.test',
    displayName: 'Humphrey Kline',
  },
  {
    email: 'ingrid@demo.gps-action.test',
    displayName: 'Ingrid Blum',
  },
  {
    email: 'maya@demo.gps-action.test',
    displayName: 'Maya Greenberg',
  },
] as const;

// ── Seed groups ──────────────────────────────────────────────────────────

interface SeedGroup {
  slug: string;
  displayName: string;
  description: string;
  createdByKey: string;
  memberKeys: string[];
}

const SEED_GROUPS: SeedGroup[] = [
  {
    slug: 'writers',
    displayName: 'Writers',
    description: 'Letter-writers, op-ed drafters, and media responders.',
    createdByKey: 'bette',
    memberKeys: ['bette', 'ingrid', 'eddie'],
  },
  {
    slug: 'manchester',
    displayName: 'Manchester',
    description: 'Manchester-area members coordinating local actions.',
    createdByKey: 'eddie',
    memberKeys: ['eddie', 'humphrey', 'cary'],
  },
  {
    slug: 'rapid-response',
    displayName: 'Rapid Response',
    description: 'First responders for time-sensitive actions and media moments.',
    createdByKey: 'cary',
    memberKeys: ['cary', 'bette', 'eddie'],
  },
];

// ── Seed posts ───────────────────────────────────────────────────────────
// 18 posts across all 5 users. Spread over last 14 days.
// Mix of action calls (with AM URLs), cultural moments, news shares,
// event announcements, outcome reports, and community questions.

interface SeedPost {
  seedKey: string;
  authorKey: string;
  title: string;
  body: string;
  visibility: PostVisibility;
  activistMailerUrl: string | null;
  groupTags: string[];
  /** Days ago from seed run time */
  daysAgo: number;
}

const SEED_POSTS: SeedPost[] = [
  // ── Action calls (with AM URLs) ──────────────────────────────────────
  {
    seedKey: 'council-housing-motion',
    authorKey: 'eddie',
    title: 'Council housing motion — write to your councillor',
    body: `Manchester City Council is debating a motion on Thursday about housing allocation criteria. The proposed changes would disadvantage families who've been on the waiting list longest.\n\nWe need letters from residents in the M1-M20 postcodes before Wednesday evening. The council has confirmed they read every letter that arrives before the debate.\n\nClick below to send a pre-drafted letter (you can edit it before sending).`,
    visibility: 'public',
    activistMailerUrl: 'https://activist-mailer.example.com/campaign/council-housing-2026',
    groupTags: ['manchester'],
    daysAgo: 1,
  },
  {
    seedKey: 'ofcom-sky-complaint',
    authorKey: 'cary',
    title: 'Ofcom complaint about Sky News coverage',
    body: `Sky News ran a segment last night that failed to mention key context about the October 7th anniversary events. Ofcom requires broadcasters to maintain due impartiality.\n\nWe've drafted a formal complaint that references the specific Ofcom Broadcasting Code sections. Takes about 2 minutes to send.\n\nOver 200 complaints have already been submitted. Ofcom has confirmed they investigate when complaint volumes reach a threshold.`,
    visibility: 'public',
    activistMailerUrl: 'https://activist-mailer.example.com/campaign/ofcom-sky-2026',
    groupTags: ['rapid-response'],
    daysAgo: 2,
  },
  {
    seedKey: 'school-board-curriculum',
    authorKey: 'bette',
    title: 'School board meeting — Holocaust education curriculum',
    body: `Barnet school board is reviewing its KS3 history curriculum next month. The current proposal reduces Holocaust education from six lessons to three.\n\nWe need parents and community members to write to the board expressing support for maintaining the current allocation. Evidence from the UCL Centre for Holocaust Education shows that depth of study correlates with long-term understanding.\n\nThe letter template includes the relevant research citations.`,
    visibility: 'public',
    activistMailerUrl: 'https://activist-mailer.example.com/campaign/barnet-curriculum-2026',
    groupTags: ['writers'],
    daysAgo: 3,
  },
  {
    seedKey: 'mp-letter-antisemitism',
    authorKey: 'ingrid',
    title: 'Write to your MP about the antisemitism statistics',
    body: `The Community Security Trust published their annual report yesterday. Antisemitic incidents are at a record high for the third consecutive year.\n\nWe've prepared a letter that asks your MP three specific questions about what they plan to do in response. The letter is personalised to your constituency automatically.\n\nPlease send before Friday — parliamentary recess starts next week.`,
    visibility: 'public',
    activistMailerUrl: 'https://activist-mailer.example.com/campaign/mp-cst-report-2026',
    groupTags: [],
    daysAgo: 4,
  },
  {
    seedKey: 'bbc-complaint-template',
    authorKey: 'cary',
    title: 'BBC complaint — biased panel composition',
    body: `Last week's Question Time had a panel discussion on the Middle East with no Jewish voices represented. This is the fourth time this quarter.\n\nWe've drafted a measured complaint focusing on the pattern rather than the individual episode. The BBC's editorial guidelines require representative voices on contested topics.\n\nFiling takes about 90 seconds through the template.`,
    visibility: 'public',
    activistMailerUrl: 'https://activist-mailer.example.com/campaign/bbc-qt-panel-2026',
    groupTags: ['rapid-response'],
    daysAgo: 5,
  },
  {
    seedKey: 'university-divestment-letters',
    authorKey: 'humphrey',
    title: 'University divestment motion — alumni letters needed',
    body: `Three Russell Group universities are debating divestment motions this term. If you're an alumnus of Manchester, Leeds, or Sheffield, your voice carries particular weight with the governing bodies.\n\nThe letter explains why blanket divestment motions are counterproductive and suggests alternative engagement approaches. It's factual, not emotional — designed to be taken seriously by academic governance.\n\nAlumni letters carry significantly more weight than general public submissions.`,
    visibility: 'authenticated_only',
    activistMailerUrl: 'https://activist-mailer.example.com/campaign/uni-divestment-2026',
    groupTags: ['manchester'],
    daysAgo: 6,
  },

  // ── Cultural moments ─────────────────────────────────────────────────
  {
    seedKey: 'shabbat-reflection',
    authorKey: 'ingrid',
    title: 'Shabbat shalom — a moment of quiet',
    body: `This week has been a lot. The news cycle doesn't pause and neither do our inboxes.\n\nBut Shabbat does pause. Whatever you're carrying from this week — the frustration with that council vote, the worry about the school board decision, the exhaustion of explaining the same things again — you can put it down for a day.\n\nWe'll pick it all back up on Saturday night. For now, rest.\n\nShabbat shalom to everyone.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: [],
    daysAgo: 2,
  },
  {
    seedKey: 'yom-hashoah-reflection',
    authorKey: 'bette',
    title: 'Yom HaShoah — we remember',
    body: `Today we remember the six million.\n\nThere are no action buttons on this post. No letters to write, no complaints to file. Today is for remembering.\n\nIf you're attending a local memorial service, hold that space gently. If you're at home, light a candle if that feels right.\n\nWe remember because we must.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: [],
    daysAgo: 8,
  },
  {
    seedKey: 'chanukah-greetings',
    authorKey: 'eddie',
    title: 'Chanukah sameach from Manchester',
    body: `Happy Chanukah to the whole GPS Action community.\n\nThe Manchester group lit the communal menorah in Albert Square last night. About 80 people came despite the rain — including the deputy mayor, who stayed for latkes.\n\nPhotos are on the Manchester WhatsApp group. If you're not in it yet, ask to join.\n\nChag sameach and stay warm out there.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['manchester'],
    daysAgo: 12,
  },

  // ── News shares ──────────────────────────────────────────────────────
  {
    seedKey: 'guardian-oped-response',
    authorKey: 'ingrid',
    title: 'Worth reading — Guardian op-ed on diaspora identity',
    body: `David Baddiel published a thoughtful piece in the Guardian this morning about what it means to be visibly Jewish in Britain in 2026. It's not a polemic — it's genuinely reflective.\n\nParticularly good on the section about how younger Jews navigate identity differently from their parents' generation. Worth reading even if you don't agree with all of it.\n\nNo action needed — just sharing because it's the kind of writing that helps us think more clearly about what we're doing.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 3,
  },
  {
    seedKey: 'jc-council-coverage',
    authorKey: 'humphrey',
    title: 'JC coverage of the Manchester council debate',
    body: `The Jewish Chronicle covered Thursday's council debate. Their reporting is broadly accurate but misses some context about the housing allocation criteria that we'd included in our letters.\n\nIf journalists contact you for comment, please refer them to Cary who is coordinating our media response. Consistent messaging matters here — the council is watching the coverage closely.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: ['manchester', 'rapid-response'],
    daysAgo: 0,
  },

  // ── Event announcements ──────────────────────────────────────────────
  {
    seedKey: 'letter-writing-workshop',
    authorKey: 'bette',
    title: 'Letter-writing workshop — Thursday 7pm',
    body: `Joining us for the first time? Or been writing letters for years and want to sharpen your approach?\n\nThis Thursday at 7pm we're running a workshop on effective complaint writing. We'll cover:\n\n- How to reference specific broadcasting codes and guidelines\n- Structuring a letter that gets read (not just filed)\n- The difference between a complaint and a campaign letter\n- When to use formal vs conversational register\n\nZoom link will be posted in the Writers group on Thursday afternoon. Open to all members.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 5,
  },
  {
    seedKey: 'manchester-meetup',
    authorKey: 'eddie',
    title: "Manchester meetup — Sunday at Nelly's",
    body: `Informal get-together this Sunday at 11am at Nelly's on Burton Road. No agenda, no presentations — just coffee and catching up.\n\nLast time we had about 15 people and it was genuinely nice to put faces to names. If you've only ever interacted with GPS Action through the app, this is a good way to meet the humans behind the usernames.\n\nNelly's has step-free access. Parking on Burton Road is free on Sundays.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['manchester'],
    daysAgo: 7,
  },

  // ── Outcome reports ──────────────────────────────────────────────────
  {
    seedKey: 'ofcom-outcome-update',
    authorKey: 'cary',
    title: 'Update — Ofcom complaint reached investigation threshold',
    body: `Good news. The Ofcom complaint about Sky News coverage from two weeks ago has crossed the investigation threshold. Ofcom confirmed they received 847 individual complaints referencing the same broadcast.\n\nThis doesn't guarantee action, but it means a formal assessment will take place. We'll update you when we hear more.\n\nThank you to everyone who took two minutes to file. This is what coordinated action looks like — 847 people, each spending 90 seconds, creating something that gets formally investigated.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 4,
  },
  {
    seedKey: 'council-letters-count',
    authorKey: 'eddie',
    title: 'Council housing motion — 340 letters delivered',
    body: `The council debate happened yesterday. Our letter campaign delivered 340 letters before the Wednesday deadline.\n\nThe motion was amended — not everything we asked for, but the worst elements were removed. Two councillors specifically referenced the volume of correspondence in their speeches.\n\nWe're preparing a detailed outcome report with what worked, what didn't, and what we'd do differently. That'll be posted by the end of the week.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['manchester'],
    daysAgo: 0,
  },

  // ── Community questions ──────────────────────────────────────────────
  {
    seedKey: 'media-response-question',
    authorKey: 'humphrey',
    title: 'Question — how do you respond to "but what about..." arguments?',
    body: `Genuine question for the group. When I'm talking to non-Jewish friends and colleagues about antisemitism, I keep hitting the same deflection: "but what about what's happening in Gaza?"\n\nI know the two aren't mutually exclusive. I know antisemitism doesn't require justification. But I struggle to articulate that in the moment without sounding dismissive of genuine suffering.\n\nHas anyone found language that works? Not debate tactics — actual honest responses that acknowledge complexity without accepting the false equivalence.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: [],
    daysAgo: 9,
  },
  {
    seedKey: 'new-member-intro',
    authorKey: 'ingrid',
    title: 'Welcome thread — introduce yourself',
    body: `We've had about 30 new members join in the last fortnight. Welcome, all of you.\n\nIf you're comfortable, drop a reply saying hello and what brought you to GPS Action. No pressure — lurking is absolutely fine too.\n\nFor the regulars: please be warm and welcoming. Remember that joining a platform like this can feel like a big step for people who've never done organised activism before.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: [],
    daysAgo: 11,
  },
  {
    seedKey: 'coordination-thank-you',
    authorKey: 'bette',
    title: "Thank you to this week's volunteers",
    body: `Quick appreciation post. This week:\n\n- Cary coordinated the Ofcom response across three time zones\n- Eddie ran the Manchester letter campaign while also working full time\n- Ingrid drafted four template letters in two days\n- Humphrey fielded press enquiries at short notice\n\nNone of this is paid. All of it matters. Thank you.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: [],
    daysAgo: 1,
  },
];

async function main(): Promise<void> {
  console.warn('Seeding GPS Action database...');

  const now = new Date();

  // ── Upsert users ─────────────────────────────────────────────────────
  const userIds: Record<string, string> = {};

  for (const seed of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: seed.email },
      update: { displayName: seed.displayName },
      create: {
        email: seed.email,
        displayName: seed.displayName,
        verifiedAt: now,
      },
    });
    // Use the first part of the email (before @) as the lookup key
    const key = seed.email.split('@')[0]!;
    userIds[key] = user.id;
  }

  console.warn(`  ✓ ${SEED_USERS.length} users upserted`);

  // ── Role grants ──────────────────────────────────────────────────────
  // Bette: admin. Cary: queue_manager. Self-granted for seed purposes.

  const betteId = userIds['bette']!;
  const caryId = userIds['cary']!;

  // Bette → admin (granted by herself for bootstrap)
  const existingAdminGrant = await prisma.roleGrant.findFirst({
    where: { userId: betteId, role: 'admin', revokedAt: null },
  });

  if (!existingAdminGrant) {
    await prisma.roleGrant.create({
      data: {
        userId: betteId,
        role: 'admin',
        grantedByUserId: betteId,
        grantedReason: 'Seeded dev-environment role for demo purposes',
      },
    });
    console.warn('  ✓ Bette granted admin role');
  } else {
    console.warn('  ✓ Bette already has admin role');
  }

  // Cary → queue_manager (granted by Bette)
  const existingQmGrant = await prisma.roleGrant.findFirst({
    where: { userId: caryId, role: 'queue_manager', revokedAt: null },
  });

  if (!existingQmGrant) {
    await prisma.roleGrant.create({
      data: {
        userId: caryId,
        role: 'queue_manager',
        grantedByUserId: betteId,
        grantedReason: 'Seeded dev-environment role for demo purposes',
      },
    });
    console.warn('  ✓ Cary granted queue_manager role');
  } else {
    console.warn('  ✓ Cary already has queue_manager role');
  }

  // ── System user (BU-requests-vetting / D057) ─────────────────────────
  // Sentinel author for auto-written timeline comments on state transitions.
  // Service upserts at write time too; seeding here makes it deterministic.

  const systemUserId = '00000000-0000-4000-8000-00000000c001';
  await prisma.user.upsert({
    where: { email: 'system@gps-action.test' },
    create: {
      id: systemUserId,
      email: 'system@gps-action.test',
      displayName: 'system',
    },
    update: {},
  });
  console.warn('  ✓ system user (BU-requests-vetting) ensured');

  // ── Demo Requests (BU-requests-foundation / D054 / SCN-21) ───────────

  const eddieId = userIds['eddie']!;

  // Eddie's vetting application — pending review (per SCN-21)
  const eddieVettingId = '00000000-0000-4000-8000-00000000a001';
  const existingVetting = await prisma.request.findUnique({ where: { id: eddieVettingId } });

  if (!existingVetting) {
    await prisma.request.create({
      data: {
        id: eddieVettingId,
        type: 'vetting',
        status: 'unclaimed',
        priority: 'normal',
        context: {
          summary: 'Eddie Morales — vetting application',
          subjectUserId: eddieId,
          submittedFrom: 'self-signup',
          notes: 'Voucher: Sharon Whitfield. Region: London E1.',
        },
        regionSlug: 'north-london',
        createdByUserId: eddieId,
      },
    });
    // System welcome comment so the timeline isn't empty on demo open
    await prisma.comment.create({
      data: {
        requestId: eddieVettingId,
        authorId: systemUserId,
        body: 'Eddie submitted this request.',
        audience: 'all',
      },
    });
    console.warn('  ✓ Demo vetting Request created for Eddie (with system welcome)');
  } else {
    console.warn('  ✓ Demo vetting Request for Eddie already present');
  }

  // A second pending Request so Cary's queue isn't lonely — a flag from Humphrey
  const humphreyId = userIds['humphrey']!;
  const humphreyFlagId = '00000000-0000-4000-8000-00000000a002';
  const existingFlag = await prisma.request.findUnique({ where: { id: humphreyFlagId } });

  if (!existingFlag) {
    await prisma.request.create({
      data: {
        id: humphreyFlagId,
        type: 'flag',
        status: 'unclaimed',
        priority: 'normal',
        context: {
          summary: 'Possible misinformation — bias in linked source',
          flaggedPostTitle: 'Sky News coverage misses key context',
          flaggedReason: 'reporter_bias',
        },
        createdByUserId: humphreyId,
      },
    });
    console.warn('  ✓ Demo flag Request created (Humphrey)');
  } else {
    console.warn('  ✓ Demo flag Request already present');
  }

  // ── BU-fab-intent-picker (D062 revised) — PostKind catalogue ──────────
  // Code defines the 8 slugs; admin manages per-row policy. Seed marks
  // happening_now and meeting as alert-eligible.

  const POST_KINDS = [
    {
      slug: 'happening_now',
      displayName: 'Happening now',
      icon: 'alert-triangle',
      sortOrder: 0,
      isAlertEligible: true,
    },
    // BU-tick-or-cross (D069): "✅ or ❌" — author picks promote/remove,
    // post is auto-handed-off to the GPS Network WhatsApp channel.
    // Prominent slot but never #1 (alert-eligible kind keeps top).
    {
      slug: 'tick_or_cross',
      displayName: '✅ or ❌',
      icon: 'check-square',
      sortOrder: 5,
      isAlertEligible: false,
    },
    {
      slug: 'meeting',
      displayName: 'Meeting',
      icon: 'users',
      sortOrder: 10,
      isAlertEligible: true,
    },
    {
      slug: 'cultural',
      displayName: 'Cultural moment',
      icon: 'feather',
      sortOrder: 20,
      isAlertEligible: false,
    },
    {
      slug: 'call_to_action',
      displayName: 'Call to action',
      icon: 'megaphone',
      sortOrder: 30,
      isAlertEligible: false,
    },
    { slug: 'outcome', displayName: 'Outcome', icon: 'pin', sortOrder: 40, isAlertEligible: false },
    {
      slug: 'thought',
      displayName: 'Just a thought',
      icon: 'message-circle',
      sortOrder: 50,
      isAlertEligible: false,
    },
    {
      slug: 'link_share',
      displayName: 'Share a link',
      icon: 'link',
      sortOrder: 60,
      isAlertEligible: false,
    },
    {
      slug: 'event',
      displayName: 'Event',
      icon: 'calendar-days',
      sortOrder: 70,
      isAlertEligible: false,
    },
  ];

  for (const def of POST_KINDS) {
    await prisma.postKind.upsert({
      where: { slug: def.slug },
      create: def,
      update: {
        displayName: def.displayName,
        icon: def.icon,
        sortOrder: def.sortOrder,
        isAlertEligible: def.isAlertEligible,
      },
    });
  }
  console.warn(`  ✓ ${POST_KINDS.length} PostKinds upserted`);

  const happeningNowKind = await prisma.postKind.findUniqueOrThrow({
    where: { slug: 'happening_now' },
  });

  // SystemSetting: urgent_ttl_hours = 4 (D058 default)
  const existingTtl = await prisma.systemSetting.findUnique({ where: { key: 'urgent_ttl_hours' } });
  if (!existingTtl) {
    await prisma.systemSetting.create({
      data: {
        key: 'urgent_ttl_hours',
        value: '4',
        updatedByUserId: betteId,
      },
    });
    console.warn('  ✓ SystemSetting urgent_ttl_hours=4 created');
  } else {
    console.warn('  ✓ SystemSetting urgent_ttl_hours already present');
  }

  // Maya's pre-seeded urgent — SCN-23 starting state, now under the
  // Send-for-Review pattern (D063): a Request wraps the draft alert
  // post fields. Reviewers can publish or archive.
  const mayaId = userIds['maya']!;
  const mayaAlertId = '00000000-0000-4000-8000-00000000a003';
  const existingMayaAlert = await prisma.request.findUnique({ where: { id: mayaAlertId } });

  if (!existingMayaAlert) {
    await prisma.request.create({
      data: {
        id: mayaAlertId,
        type: 'content_submission',
        status: 'unclaimed',
        priority: 'urgent',
        urgency: true,
        urgencyExpiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
        kindId: happeningNowKind.id,
        regionSlug: 'tower-hamlets',
        context: {
          summary: 'Antisemitic leaflets at school gate — Cheddar Road, Bristol',
          body: 'Two people handing out leaflets that appear antisemitic at school pickup. Took photos discreetly. Need someone with media contacts to act fast.',
          source: 'send_for_review',
          // Draft post fields for the Publish action
          draftPost: {
            title: 'Antisemitic leaflets at school gate — Bristol',
            body: 'Two people handing out leaflets that appear antisemitic at school pickup, Cheddar Road, Bristol. Took photos discreetly. Need someone with media contacts to act fast.',
            visibility: 'authenticated_only',
            kindSlug: 'happening_now',
            urgency: true,
          },
        },
        createdByUserId: mayaId,
      },
    });
    console.warn('  ✓ Demo Send-for-Review alert created (Maya, school gate)');
  } else {
    console.warn('  ✓ Demo Send-for-Review alert already present');
  }

  // ── Seed groups ──────────────────────────────────────────────────────

  const groupIds: Record<string, string> = {};
  let groupsCreated = 0;

  for (const group of SEED_GROUPS) {
    const groupId = seedUuid('group', group.slug);
    const creatorId = userIds[group.createdByKey]!;

    const existing = await prisma.group.findUnique({ where: { id: groupId } });
    if (!existing) {
      await prisma.group.create({
        data: {
          id: groupId,
          slug: group.slug,
          displayName: group.displayName,
          description: group.description,
          createdByUserId: creatorId,
        },
      });
      groupsCreated++;
    }
    groupIds[group.slug] = groupId;

    // Seed memberships
    for (const memberKey of group.memberKeys) {
      const memberId = userIds[memberKey]!;
      const membershipId = seedUuid('membership', `${group.slug}:${memberKey}`);

      const existingMembership = await prisma.groupMembership.findUnique({
        where: { id: membershipId },
      });
      if (!existingMembership) {
        await prisma.groupMembership.create({
          data: {
            id: membershipId,
            userId: memberId,
            groupId: groupId,
            role: memberKey === group.createdByKey ? 'lead' : 'member',
            joinedVia: memberKey === group.createdByKey ? 'self_join' : 'admin_added',
          },
        });
      }
    }
  }

  console.warn(`  ✓ ${SEED_GROUPS.length} groups seeded (${groupsCreated} new)`);

  // ── Seed posts ───────────────────────────────────────────────────────

  let postsCreated = 0;

  for (const post of SEED_POSTS) {
    const postId = seedUuid('post', post.seedKey);
    const authorId = userIds[post.authorKey]!;
    const createdAt = new Date(now.getTime() - post.daysAgo * 24 * 60 * 60 * 1000);

    // Verify groupTags reference seeded groups; use empty array if group
    // doesn't exist (per Q6 — defensive).
    const validGroupTags = post.groupTags.filter((slug) => slug in groupIds);

    const existing = await prisma.post.findUnique({ where: { id: postId } });
    if (!existing) {
      await prisma.post.create({
        data: {
          id: postId,
          authorId,
          title: post.title,
          body: post.body,
          visibility: post.visibility,
          activistMailerUrl: post.activistMailerUrl,
          groupTags: validGroupTags,
          createdAt,
        },
      });
      postsCreated++;
    }
  }

  console.warn(`  ✓ ${SEED_POSTS.length} posts seeded (${postsCreated} new)`);

  // ── Feature flags (BU-reactions / D050) ─────────────────────────────
  await prisma.featureFlag.upsert({
    where: { name: 'ff_reactions' },
    update: { enabledGlobally: true },
    create: {
      name: 'ff_reactions',
      description: 'Quiet, multi-select reactions on posts (BU-reactions / D050).',
      purpose: 'rollout',
      enabledGlobally: true,
      createdBy: { connect: { id: betteId } },
      updatedBy: { connect: { id: betteId } },
    },
  });
  console.warn('  ✓ ff_reactions flag enabled');

  // ── Feature flags (BU-comments / D052) ──────────────────────────────
  await prisma.featureFlag.upsert({
    where: { name: 'ff_comments' },
    update: { enabledGlobally: true },
    create: {
      name: 'ff_comments',
      description: 'Post-detail page + flat comment thread (BU-comments / D052).',
      purpose: 'rollout',
      enabledGlobally: true,
      createdBy: { connect: { id: betteId } },
      updatedBy: { connect: { id: betteId } },
    },
  });
  console.warn('  ✓ ff_comments flag enabled');

  // ── Seed comments (BU-comments / D052) ──────────────────────────────
  // Idempotent: skip if any comments already exist for the seeded posts.
  const existingComments = await prisma.comment.count();
  if (existingComments === 0) {
    const allPosts = await prisma.post.findMany({
      where: { deletedAt: null },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
      take: 18,
    });

    const commenters = [
      userIds['cary']!,
      userIds['bette']!,
      userIds['eddie']!,
      userIds['humphrey']!,
      userIds['ingrid']!,
    ];

    const sampleComments = [
      'Sent mine on Sunday. Took 90 seconds.',
      'Brilliant work 💕',
      'Worth a complaint to Ofcom — template attached below.',
      'Just saw this. Done.',
      'First time using GPS Action — the template made it easy. Thanks.',
      'Echoing — important to keep the pressure consistent.',
    ];

    let commentsCreated = 0;
    let commenterIdx = 0;
    let textIdx = 0;
    for (const post of allPosts) {
      const numComments = 2 + (commentsCreated % 3); // 2-4 per post
      for (let i = 0; i < numComments; i += 1) {
        await prisma.comment.create({
          data: {
            postId: post.id,
            authorId: commenters[commenterIdx % commenters.length]!,
            body: sampleComments[textIdx % sampleComments.length]!,
          },
        });
        commenterIdx += 1;
        textIdx += 1;
        commentsCreated += 1;
      }
    }
    console.warn(`  ✓ ${commentsCreated} comments seeded across ${allPosts.length} posts`);
  } else {
    console.warn(`  ✓ Comments already seeded (${existingComments} present); skipping`);
  }

  console.warn('✓ Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
