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
 * bu-coordination-board: default BoardColumns + 3 demo kanban tickets
 *   per demo group, so `/board/<slug>` lands on a populated kanban for
 *   smoke-testing Surface 1 + Surface 2 without manually inserting rows.
 */

// Prisma 7 (D071): the runtime adapter reads DATABASE_URL at module
// init; tsx doesn't auto-load .env, so we import it here before the
// prisma client is constructed.
import 'dotenv/config';

import { createHash } from 'crypto';
import type { PostVisibility } from '@prisma/client';
import { prisma } from '@/server/db/client';
import { eventInputToUtc } from '@/shared/format-event-time';

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
  // ── Phase-2 demo enrichment (PR #0.2.181) ──────────────────────────
  // Six additional members so each group has plausible membership and
  // the kanban / feed demo features (assignments, sharing, comments,
  // notes, reactions) have varied actors. Lookup keys (the part of
  // the email before @) are: sharon, rachel, jonathan, naomi, david,
  // esther.
  {
    email: 'sharon@demo.gps-action.test',
    displayName: 'Sharon Levi',
  },
  {
    email: 'rachel@demo.gps-action.test',
    displayName: 'Rachel Cohen',
  },
  {
    email: 'jonathan@demo.gps-action.test',
    displayName: 'Jonathan Stein',
  },
  {
    email: 'naomi@demo.gps-action.test',
    displayName: 'Naomi Goldberg',
  },
  {
    email: 'david@demo.gps-action.test',
    displayName: 'David Friedman',
  },
  {
    email: 'esther@demo.gps-action.test',
    displayName: 'Esther Klein',
  },
] as const;

// ── Seed groups ──────────────────────────────────────────────────────────

interface SeedGroup {
  slug: string;
  displayName: string;
  description: string;
  createdByKey: string;
  memberKeys: string[];
  /** Optional GroupKind override; falls back to schema default `team`. */
  kind?: 'workstream' | 'region' | 'network' | 'team' | 'topic';
}

const SEED_GROUPS: SeedGroup[] = [
  {
    slug: 'writers',
    displayName: 'Writers',
    description: 'Letter-writers, op-ed drafters, and media responders.',
    createdByKey: 'bette',
    memberKeys: ['bette', 'ingrid', 'eddie', 'rachel', 'naomi'],
    kind: 'workstream',
  },
  {
    slug: 'manchester',
    displayName: 'Manchester',
    description: 'Manchester-area members coordinating local actions.',
    createdByKey: 'eddie',
    memberKeys: ['eddie', 'humphrey', 'cary', 'jonathan', 'david'],
    kind: 'region',
  },
  {
    slug: 'rapid-response',
    displayName: 'Rapid Response',
    description: 'First responders for time-sensitive actions and media moments.',
    createdByKey: 'cary',
    memberKeys: ['cary', 'bette', 'eddie', 'maya', 'sharon'],
    kind: 'team',
  },
  // ── Phase-2 demo enrichment groups ──────────────────────────────────
  // Three additional groups with varied GroupKind values so the board
  // palette demo has shape — region (north-london), network (cst-link),
  // topic (students). Each lands with 4–5 active members.
  {
    slug: 'north-london',
    displayName: 'North London',
    description:
      'Barnet / Camden / Hackney members coordinating local council actions and shul-network outreach.',
    createdByKey: 'rachel',
    memberKeys: ['rachel', 'naomi', 'sharon', 'esther', 'bette'],
    kind: 'region',
  },
  {
    slug: 'students',
    displayName: 'Students',
    description: 'Russell-Group student members coordinating campus and SU motions.',
    createdByKey: 'jonathan',
    memberKeys: ['jonathan', 'david', 'esther', 'humphrey'],
    kind: 'topic',
  },
  {
    slug: 'cst-link',
    displayName: 'CST liaison',
    description:
      'Partner-org channel — coordinates with Community Security Trust on safeguarding and security incidents.',
    createdByKey: 'sharon',
    memberKeys: ['sharon', 'cary', 'bette', 'maya'],
    kind: 'network',
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
  // ── Optional fields for the new post-card layout demo ───────────────
  // BU-link-share / D060: link preview card data.
  linkUrl?: string;
  linkTitle?: string;
  linkDescription?: string;
  linkImageUrl?: string;
  linkSiteName?: string;
  // BU-fab-intent-picker / D062: intent kind slug (resolved → kindId).
  kindSlug?: string;
  urgency?: boolean;
  // BU-post-hero-demo / D064: hero image, must be a SEED_HERO_IMAGES URL.
  heroImageUrl?: string;
  // BU-event-time / D073: structured event-time fields.
  // `eventInDays` schedules the event N days FROM seed-run time (positive
  // = future). `eventStartHour` / `eventStartMinute` set the
  // Europe/London wall-clock start; `eventDurationMinutes` (optional)
  // computes eventEndsAt. `locationText` is free-text.
  eventInDays?: number;
  eventStartHour?: number;
  eventStartMinute?: number;
  eventDurationMinutes?: number;
  locationText?: string;
  // BU-publish-router / D072: when set, the post renders the three-tier
  // review-attribution UI (badge in feed, sub-byline on detail, pinned
  // auto-comment in thread) for the named reviewer.
  reviewedByKey?: string;
  // BU-tick-or-cross / D069: 'promote' or 'remove' verdict — only set
  // when kindSlug === 'tick_or_cross'.
  signal?: 'promote' | 'remove';
  // BU-calendar-near-me / D076 / ADR-0002: hand-coded structured
  // location. `latitude` + `longitude` populate the Near-me view
  // (Path A — composer geocoding deferred to a follow-up BU). Leave
  // unset when the event is online. `isOnline=true` excludes the
  // post from distance-based views.
  latitude?: number;
  longitude?: number;
  isOnline?: boolean;
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
    // D072 demo — Bette reviewed and shaped this post via the kind_review
    // flow. The badge appears on the feed card, the sub-byline on the
    // detail page, and the pinned auto-comment in the thread.
    reviewedByKey: 'bette',
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

  // ── CTA-layout demo posts (PR #100 right-rail + top-CTA layout) ──────
  // These exercise the new post-card layout: primary CTA at the top of
  // the card with the social-CTA placeholder rail to its right. Spread
  // across kinds + urgency flags + visual variations (linkUrl with full
  // OG metadata, AM URLs, hero images, hero+link layered).
  {
    seedKey: 'demo-guardian-oped-link',
    authorKey: 'ingrid',
    title: 'Guardian op-ed on diaspora identity — worth your 5 minutes',
    body: `David Baddiel's piece in the Guardian this morning is the most thoughtful long-read on British Jewish identity I've seen in months.\n\nIt's not a polemic. It's reflective, honest, and useful for anyone navigating these conversations with friends and colleagues. Worth reading even if you don't agree with all of it.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 1,
    kindSlug: 'link_share',
    urgency: false,
    linkUrl:
      'https://www.theguardian.com/commentisfree/2026/apr/24/british-jewish-identity-diaspora-baddiel',
    linkTitle: 'What it means to be visibly Jewish in Britain in 2026',
    linkDescription:
      'A reflective long-read on identity, generational change, and the questions younger British Jews are asking that their parents never had to.',
    // Self-hosted seed image — the previous Guardian hotlink returned
    // 401 (hotlinking protection) and surfaced as a broken preview tile.
    linkImageUrl: '/seed-images/05.svg',
    linkSiteName: 'The Guardian',
  },
  {
    seedKey: 'demo-bbc-investigation',
    authorKey: 'cary',
    title: 'BBC investigation into far-right organising on encrypted platforms',
    body: `BBC News published a six-month investigation into far-right organising networks operating on encrypted platforms. Names sources, includes documented evidence, names specific platforms.\n\nReally good journalism. Sharing because it's the kind of context that helps when people ask "where is this coming from".`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 2,
    kindSlug: 'link_share',
    urgency: false,
    linkUrl: 'https://www.bbc.co.uk/news/uk-66789012',
    linkTitle: 'Inside the encrypted networks coordinating far-right activity in the UK',
    linkDescription:
      'A six-month BBC News investigation maps the platforms, personalities, and money flows behind a growing far-right organising ecosystem.',
    linkImageUrl: 'https://ichef.bbci.co.uk/news/social/uk-66789012.jpg',
    linkSiteName: 'BBC News',
    heroImageUrl: '/seed-images/02.svg',
  },
  {
    seedKey: 'demo-cst-campaign-page',
    authorKey: 'bette',
    title: 'CST has launched a public donation campaign — share with your networks',
    body: `The Community Security Trust opened public donations this morning to fund expanded school-gate security through the autumn term.\n\nIf you can spare even £5 it goes a long way. The link below is the canonical campaign page — please share it widely rather than reposting screenshots.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 3,
    kindSlug: 'call_to_action',
    urgency: false,
    linkUrl: 'https://cst.org.uk/campaigns/autumn-2026-schools',
    linkTitle: 'Autumn 2026 schools campaign — Community Security Trust',
    linkDescription:
      'Help fund expanded security at Jewish schools through the autumn term. Every £5 contributes to staffing, training, and equipment.',
    linkImageUrl: 'https://cst.org.uk/images/campaigns/autumn-2026-share.png',
    linkSiteName: 'Community Security Trust',
  },
  {
    seedKey: 'demo-am-mp-housing',
    authorKey: 'eddie',
    title: 'Write to your MP — housing allocation criteria amendments',
    body: `The amendments to the Housing Allocation Bill go to committee next Wednesday. Cross-party support is real but soft — MPs need to hear from constituents that this is a priority.\n\nThe template letter explains the four amendments we are backing. Personalises automatically to your constituency. Takes about 90 seconds.`,
    visibility: 'public',
    activistMailerUrl: 'https://activistmailer.com/campaign/mp-housing-allocation-2026',
    groupTags: ['manchester'],
    daysAgo: 1,
    kindSlug: 'call_to_action',
    urgency: false,
    heroImageUrl: '/seed-images/03.svg',
  },
  {
    seedKey: 'demo-am-urgent-school-gate',
    authorKey: 'maya',
    title: 'URGENT — school gate incident, Bristol — write to local police commissioner now',
    body: `Confirmed antisemitic leaflets distributed at a Bristol school gate this morning. Local police commissioner is already aware but is publicly minimising it.\n\nWe need a wave of constituent letters before the weekend press cycle. The template references the specific public order legislation that applies. 60 seconds to send.`,
    visibility: 'public',
    activistMailerUrl: 'https://activistmailer.com/campaign/bristol-school-gate-2026',
    groupTags: ['rapid-response'],
    daysAgo: 0,
    kindSlug: 'happening_now',
    urgency: true,
  },
  {
    seedKey: 'demo-meeting-manchester-may',
    authorKey: 'eddie',
    title: 'Manchester regional meeting — Sunday 12 May, 11am',
    body: `Regional gathering for Manchester members. We will agree priorities for the summer letter campaigns, hear an update on the council motion outcome, and there will be coffee and pastries.\n\nVenue is step-free, on-street parking free on Sundays. Come if you can — bring someone if you would like to.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['manchester'],
    daysAgo: 4,
    kindSlug: 'meeting',
    urgency: false,
    heroImageUrl: '/seed-images/04.svg',
  },

  // ── BU-event-time / D073 — structured event-time demo posts ─────────
  // Eight posts spanning the next four weeks: a mix of meetings,
  // events, and one happening_now. All have a real eventAt + most
  // have eventEndsAt + locationText. The composer / PostCard / future
  // calendar all consume the same shape via shared/format-event-time.
  {
    seedKey: 'event-vigil-cheddar-road',
    authorKey: 'cary',
    title: 'Saturday morning vigil — Cheddar Road',
    body: `Quiet vigil this Saturday morning. We will gather, light candles, hold the space for an hour, then go for coffee at the cafe across the road.\n\nNot a march, not a protest — a moment of public presence. Bring a friend if you can.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 0,
    kindSlug: 'event',
    urgency: false,
    eventInDays: 3,
    eventStartHour: 10,
    eventStartMinute: 0,
    eventDurationMinutes: 90,
    locationText: 'Cheddar Road, Bristol — outside the school gate',
    // Bristol — Cheddar Road area, BS3.
    latitude: 51.4537,
    longitude: -2.5919,
  },
  {
    seedKey: 'event-letter-writing-workshop',
    authorKey: 'bette',
    title: 'Letter-writing workshop — effective complaint writing',
    body: `Two-hour workshop on writing letters that get read, not filed. We will cover: how to reference specific broadcasting codes, structuring a complaint, when to use formal vs. conversational register, and a live edit of a real letter.\n\nBring a draft if you have one. Tea + biscuits provided.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 0,
    kindSlug: 'event',
    urgency: false,
    eventInDays: 5,
    eventStartHour: 19,
    eventStartMinute: 0,
    eventDurationMinutes: 120,
    locationText: 'Online via Zoom — link posted in the Writers group',
    isOnline: true,
  },
  {
    seedKey: 'meeting-rapid-response-weekly',
    authorKey: 'cary',
    title: 'Rapid Response weekly check-in',
    body: `Standing Tuesday evening call. We review what is on the watch list, what landed in the last week, and who is on call for the week ahead.\n\nIf you are new to Rapid Response, this is the right meeting to come and listen. Camera optional.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 0,
    kindSlug: 'meeting',
    urgency: false,
    eventInDays: 7,
    eventStartHour: 20,
    eventStartMinute: 0,
    eventDurationMinutes: 60,
    locationText: 'Online — Zoom link in the Rapid Response group',
    isOnline: true,
  },
  {
    seedKey: 'event-manchester-meetup-burton',
    authorKey: 'eddie',
    title: 'Manchester meetup — Sunday at Nelly’s',
    body: `Informal get-together at Nelly’s on Burton Road. No agenda. Just coffee and faces.\n\nLast time about 15 of us came. Step-free access, parking free on Sundays. Stay an hour or three.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['manchester'],
    daysAgo: 0,
    kindSlug: 'event',
    urgency: false,
    eventInDays: 11,
    eventStartHour: 11,
    eventStartMinute: 0,
    eventDurationMinutes: 180,
    locationText: 'Nelly’s, Burton Road, West Didsbury',
    // Manchester — Burton Road, West Didsbury (M20).
    latitude: 53.4225,
    longitude: -2.2305,
  },
  {
    seedKey: 'meeting-school-board-curriculum',
    authorKey: 'bette',
    title: 'Barnet school board public meeting — Holocaust curriculum',
    body: `Public school board meeting where the KS3 history curriculum is on the agenda. Members of the public can attend; speaking slots open in advance.\n\nWe are coordinating attendance so we have a visible presence. Reply if you plan to come — Bette will collate and share notes.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 0,
    kindSlug: 'meeting',
    urgency: false,
    eventInDays: 14,
    eventStartHour: 18,
    eventStartMinute: 30,
    eventDurationMinutes: 120,
    locationText: 'Barnet Council, Hendon NW9 — committee room 2',
    // Barnet Council offices, Hendon NW9.
    latitude: 51.5851,
    longitude: -0.2363,
  },
  {
    seedKey: 'event-yom-haatzmaut-picnic',
    authorKey: 'ingrid',
    title: 'Yom Ha’atzmaut community picnic',
    body: `Communal picnic to mark Yom Ha’atzmaut. Children very welcome. Bring something sweet if you can; we will provide drinks and savoury platters.\n\nGazebos pitched by 11; music starts at 12. Rain plan: indoor at the JCC if needed.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: [],
    daysAgo: 0,
    kindSlug: 'event',
    urgency: false,
    eventInDays: 17,
    eventStartHour: 11,
    eventStartMinute: 0,
    eventDurationMinutes: 240,
    locationText: 'Hampstead Heath — meet by the bandstand',
    heroImageUrl: '/seed-images/01.svg',
    // Hampstead Heath bandstand area, NW London.
    latitude: 51.5608,
    longitude: -0.1644,
  },
  {
    seedKey: 'happening-now-school-gate-bristol',
    authorKey: 'maya',
    title: 'Police commissioner public surgery — Bristol',
    body: `Bristol PCC running an open-doors surgery this evening. Constituents can raise individual concerns; the school-gate leaflet incident is on the public agenda.\n\nIf you live in Bristol, please come if you can — visible turnout matters here.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 0,
    kindSlug: 'happening_now',
    urgency: true,
    eventInDays: 1,
    eventStartHour: 18,
    eventStartMinute: 0,
    eventDurationMinutes: 90,
    locationText: 'Bristol City Hall, College Green',
    // Bristol City Hall, College Green BS1.
    latitude: 51.4533,
    longitude: -2.597,
  },
  {
    seedKey: 'meeting-writers-summer-planning',
    authorKey: 'ingrid',
    title: 'Writers group — summer campaigns planning',
    body: `Quarterly Writers planning session. We will agree the four campaigns we will throw weight behind across June–August, divide the drafting work, and pair newer members with experienced writers.\n\nIf you are new and want to get involved with letter-writing, this is the meeting that gets you a buddy.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: ['writers'],
    daysAgo: 0,
    kindSlug: 'meeting',
    urgency: false,
    eventInDays: 21,
    eventStartHour: 19,
    eventStartMinute: 30,
    eventDurationMinutes: 90,
    locationText: 'Online via Zoom — link in the Writers group',
    isOnline: true,
  },

  // ── BU-tick-or-cross demo posts (D069) ────────────────────────────────
  // ✅ promote / ❌ remove — quick verdict posts that route to the GPS
  // Network WhatsApp channel. These exist so the ✅❌ chip on /feed
  // surfaces real content in dev + on the Vercel demo deploy.
  {
    seedKey: 'tick-bbc-correction',
    authorKey: 'bette',
    title: 'BBC issued a correction on the Manchester report — promote',
    body: `BBC News updated the online article with a correction footnote acknowledging the misattributed quote. Worth signal-boosting so the corrected version gets the same reach as the original.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 1,
    kindSlug: 'tick_or_cross',
    urgency: false,
    signal: 'promote',
    linkUrl: 'https://www.bbc.co.uk/news/uk-manchester-correction-2026',
    linkTitle: 'Correction: Manchester community report',
    linkDescription:
      'Following further review, this article has been updated to correct an attribution error in the original.',
    linkSiteName: 'BBC News',
  },
  {
    seedKey: 'cross-fake-petition',
    authorKey: 'cary',
    title: 'Fake petition circulating on social — remove',
    body: `A petition styled to look like one of ours is circulating on Twitter and Facebook. It is NOT from us. The wording is similar but the signatories list is fabricated and the sponsoring organisation does not exist. Please flag and unshare wherever you see it.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 0,
    kindSlug: 'tick_or_cross',
    urgency: true,
    signal: 'remove',
  },

  // ── Phase-2 demo enrichment posts (PR #0.2.181) ─────────────────────
  // Ten additional posts spread across the last ~30 days so the feed has
  // depth, not all today. Mix of authors (including the new members),
  // visibility, kinds, and group tags. Each gets reactions + comments
  // seeded later in the enrichment block at the end of main().
  {
    seedKey: 'enrich-rachel-am-mp-housing',
    authorKey: 'rachel',
    title: 'North London — write to Mike Freer about the Barnet housing motion',
    body: `Mike Freer chairs the housing committee that votes on Tuesday. North London members in his constituency carry particular weight — please send the template letter today rather than tomorrow.\n\nThe template covers the four amendments we are pushing for. Personalises automatically. 90 seconds.`,
    visibility: 'public',
    activistMailerUrl: 'https://activistmailer.com/campaign/freer-housing-2026',
    groupTags: ['north-london'],
    daysAgo: 4,
    kindSlug: 'call_to_action',
    urgency: false,
  },
  {
    seedKey: 'enrich-jonathan-su-motion',
    authorKey: 'jonathan',
    title: 'SU motion at Manchester — alumni voices needed by Friday',
    body: `Manchester SU is debating a divestment motion at Friday's council meeting. If you graduated in the last 10 years your voice carries — alumni cards still get scanned at the door.\n\nThe Students channel has a draft of the alumni letter; please pick it up, send it, and tell me you've done it so I can keep a tally.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: ['students', 'manchester'],
    daysAgo: 6,
    kindSlug: 'call_to_action',
    urgency: false,
  },
  {
    seedKey: 'enrich-sharon-cst-incident',
    authorKey: 'sharon',
    title: 'CST liaison — incident at Hendon shul, please be vigilant',
    body: `Quick note from the CST liaison channel: a graffiti incident overnight at the Hendon Adath shul. CST and Met are both engaged. No injuries.\n\nIf you have services scheduled this Shabbat at NW4 / NW9 / NW11, please brief stewards. CST has updated its incident-line guidance.\n\nNot a panic — a heads-up.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: ['cst-link', 'north-london'],
    daysAgo: 9,
    kindSlug: 'happening_now',
    urgency: false,
  },
  {
    seedKey: 'enrich-naomi-thank-you',
    authorKey: 'naomi',
    title: 'Quiet thank-you to Rachel and Esther for last night',
    body: `Rachel and Esther staffed the door at Wednesday's letter-writing session. 22 people came; we sent 89 letters between us.\n\nNo one had to ask twice for tea or a stamp. Both of you set the tone.\n\nFor anyone who wanted to come and didn't — there's another session next Wednesday.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['writers', 'north-london'],
    daysAgo: 12,
    kindSlug: 'thought',
    urgency: false,
  },
  {
    seedKey: 'enrich-david-jewish-news',
    authorKey: 'david',
    title: 'Jewish News piece on student campaigning — link share',
    body: `Decent piece in the Jewish News this morning on student-led campaigning across Russell-Group SUs this term. Names actual numbers, quotes named students, doesn't editorialise.\n\nHelpful for anyone arguing the case to a sceptical relative that "students are doing nothing".`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['students'],
    daysAgo: 14,
    kindSlug: 'link_share',
    urgency: false,
    linkUrl: 'https://www.jewishnews.co.uk/students-campaign-2026/',
    linkTitle: 'Russell-Group student campaigners — what they did this term',
    linkDescription:
      'Names, numbers, and motions. A grounded look at what student-led Jewish campaigning actually moved this term.',
    linkSiteName: 'Jewish News',
  },
  {
    seedKey: 'enrich-esther-shabbat',
    authorKey: 'esther',
    title: 'Shabbat shalom from North London',
    body: `It has been a long week. The Hendon incident, the council vote, three deadlines.\n\nWhatever you are carrying — set it down for Shabbat. We pick it back up Saturday night.\n\nShabbat shalom 💕`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['north-london'],
    daysAgo: 16,
    kindSlug: 'cultural',
    urgency: false,
    heroImageUrl: '/seed-images/09-shabbat-shalom.jpg',
  },
  {
    seedKey: 'enrich-rachel-outcome-barnet',
    authorKey: 'rachel',
    title: 'Outcome — 412 letters delivered to Barnet councillors',
    body: `The Barnet motion debate is on Tuesday. We delivered 412 letters before the Friday cut-off. Two ward councillors have replied personally.\n\nThe writers in this group did the work. I just collected the count.\n\nNext step: physical attendance at Tuesday's public gallery. Reply if you can come and I will collate.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['north-london', 'writers'],
    daysAgo: 19,
    kindSlug: 'outcome',
    urgency: false,
  },
  {
    seedKey: 'enrich-maya-bristol-update',
    authorKey: 'maya',
    title: 'Update — Bristol school-gate incident, police statement',
    body: `Avon and Somerset Police published a statement an hour ago on the Cheddar Road school-gate leaflet incident. Investigation is continuing; one person has been spoken to under caution.\n\nThe public statement is measured but firm. CST coordinated the family-support side; thanks Sharon for the introductions.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response', 'cst-link'],
    daysAgo: 21,
    kindSlug: 'outcome',
    urgency: false,
  },
  {
    seedKey: 'enrich-jonathan-meeting-students',
    authorKey: 'jonathan',
    title: 'Students network — May planning call',
    body: `Monthly Students planning call. We will agree summer-term priorities, hear back from each campus, and pair returning members with new joiners.\n\nIf you joined this term and want to find your feet — this is the call to come to.`,
    visibility: 'authenticated_only',
    activistMailerUrl: null,
    groupTags: ['students'],
    daysAgo: 25,
    kindSlug: 'meeting',
    urgency: false,
    eventInDays: 12,
    eventStartHour: 19,
    eventStartMinute: 0,
    eventDurationMinutes: 90,
    locationText: 'Online via Zoom — link in the Students group',
    isOnline: true,
  },
  {
    seedKey: 'enrich-sharon-tick-times-correction',
    authorKey: 'sharon',
    title: 'Times printed a correction on the Hackney piece — promote',
    body: `The Times correction is on page 28 of today's print edition and pinned to the online article. Quietly factual, not grudging. Worth boosting — corrections this clean are rare.`,
    visibility: 'public',
    activistMailerUrl: null,
    groupTags: ['rapid-response'],
    daysAgo: 28,
    kindSlug: 'tick_or_cross',
    urgency: false,
    signal: 'promote',
    linkUrl: 'https://www.thetimes.co.uk/article/correction-hackney-2026',
    linkTitle: 'Correction: Hackney community piece — The Times',
    linkSiteName: 'The Times',
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
        status: 'backlog',
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
        status: 'backlog',
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

  // D071 — per-kind config columns added in addition to the existing
  // basics. Values mirror the migration (D071 §2). Migration is the
  // source of truth; this exists for fresh-DB seed flows that bypass
  // the migration data inserts (rare, but defensive).
  const POST_KINDS = [
    {
      slug: 'happening_now',
      displayName: 'Happening now',
      icon: 'alert-triangle',
      sortOrder: 0,
      isAlertEligible: true,
      actionSlugs: [],
      reviewMode: 'review_after_publish' as const,
      canSelfPublish: true,
      reviewPriority: 'urgent' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'tick_or_cross',
      displayName: '✅ or ❌',
      icon: 'check-square',
      sortOrder: 5,
      isAlertEligible: false,
      actionSlugs: ['share_to_gps_whatsapp'],
      reviewMode: 'either_with_default_review_first' as const,
      canSelfPublish: true,
      reviewPriority: 'high' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'meeting',
      displayName: 'Meeting',
      icon: 'users',
      sortOrder: 10,
      isAlertEligible: true,
      actionSlugs: ['open_join_link'],
      reviewMode: 'either_with_default_publish' as const,
      canSelfPublish: true,
      reviewPriority: 'normal' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'cultural',
      displayName: 'Cultural moment',
      icon: 'feather',
      sortOrder: 20,
      isAlertEligible: false,
      actionSlugs: ['schedule_for_sundown'],
      reviewMode: 'review_first' as const,
      canSelfPublish: false,
      reviewPriority: 'high' as const,
      feedCommentPeekEnabled: false,
    },
    {
      slug: 'call_to_action',
      displayName: 'Call to action',
      icon: 'megaphone',
      sortOrder: 30,
      isAlertEligible: false,
      actionSlugs: ['open_activist_mailer'],
      reviewMode: 'either_with_default_review_first' as const,
      canSelfPublish: true,
      reviewPriority: 'normal' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'outcome',
      displayName: 'Outcome',
      icon: 'pin',
      sortOrder: 40,
      isAlertEligible: false,
      actionSlugs: [],
      reviewMode: 'either_with_default_publish' as const,
      canSelfPublish: true,
      reviewPriority: 'low' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'thought',
      displayName: 'Just a thought',
      icon: 'message-circle',
      sortOrder: 50,
      isAlertEligible: false,
      actionSlugs: [],
      reviewMode: 'either_with_default_publish' as const,
      canSelfPublish: true,
      reviewPriority: 'low' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'link_share',
      displayName: 'Share a link',
      icon: 'link',
      sortOrder: 60,
      isAlertEligible: false,
      actionSlugs: ['share_to_socials'],
      reviewMode: 'either_with_default_publish' as const,
      canSelfPublish: true,
      reviewPriority: 'normal' as const,
      feedCommentPeekEnabled: true,
    },
    {
      slug: 'event',
      displayName: 'Event',
      icon: 'calendar-days',
      sortOrder: 70,
      isAlertEligible: false,
      actionSlugs: ['add_to_calendar'],
      reviewMode: 'either_with_default_publish' as const,
      canSelfPublish: true,
      reviewPriority: 'normal' as const,
      feedCommentPeekEnabled: true,
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
        actionSlugs: def.actionSlugs,
        reviewMode: def.reviewMode,
        canSelfPublish: def.canSelfPublish,
        reviewPriority: def.reviewPriority,
        feedCommentPeekEnabled: def.feedCommentPeekEnabled,
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
        status: 'backlog',
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
          kind: group.kind ?? 'team',
          createdByUserId: creatorId,
        },
      });
      groupsCreated++;
    } else if (group.kind && existing.kind !== group.kind) {
      // Idempotent backfill — keep declared GroupKind in sync if the
      // seed declaration changes between runs.
      await prisma.group.update({
        where: { id: groupId },
        data: { kind: group.kind },
      });
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
            role: memberKey === group.createdByKey ? 'admin' : 'member',
            joinedVia: memberKey === group.createdByKey ? 'self_join' : 'admin_added',
          },
        });
      }
    }
  }

  console.warn(`  ✓ ${SEED_GROUPS.length} groups seeded (${groupsCreated} new)`);

  // ── Seed posts ───────────────────────────────────────────────────────

  // Resolve PostKind slugs → ids once so per-post lookup is O(1) and
  // missing slugs surface immediately rather than at the first post that
  // references them.
  const postKindRows = await prisma.postKind.findMany({ select: { id: true, slug: true } });
  const kindIdsBySlug: Record<string, string> = Object.fromEntries(
    postKindRows.map((k) => [k.slug, k.id]),
  );

  let postsCreated = 0;

  for (const post of SEED_POSTS) {
    const postId = seedUuid('post', post.seedKey);
    const authorId = userIds[post.authorKey]!;
    const createdAt = new Date(now.getTime() - post.daysAgo * 24 * 60 * 60 * 1000);

    // Verify groupTags reference seeded groups; use empty array if group
    // doesn't exist (per Q6 — defensive).
    const validGroupTags = post.groupTags.filter((slug) => slug in groupIds);

    // Resolve optional kind slug → id. Unknown slug = no kind (defensive,
    // mirrors the groupTags pattern).
    const kindId = post.kindSlug ? (kindIdsBySlug[post.kindSlug] ?? null) : null;

    // BU-event-time / D073: build eventAt / eventEndsAt from the
    // seed's relative-day specification. Europe/London wall-clock →
    // UTC via shared/format-event-time, matching the composer's path.
    let eventAt: Date | null = null;
    let eventEndsAt: Date | null = null;
    if (typeof post.eventInDays === 'number') {
      const target = new Date(now.getTime() + post.eventInDays * 24 * 60 * 60 * 1000);
      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, '0');
      const dd = String(target.getDate()).padStart(2, '0');
      const hh = String(post.eventStartHour ?? 18).padStart(2, '0');
      const min = String(post.eventStartMinute ?? 0).padStart(2, '0');
      eventAt = eventInputToUtc(`${yyyy}-${mm}-${dd}`, `${hh}:${min}`);
      if (eventAt && typeof post.eventDurationMinutes === 'number') {
        eventEndsAt = new Date(eventAt.getTime() + post.eventDurationMinutes * 60 * 1000);
      }
    }
    const locationText = post.locationText ?? null;

    // D072 — resolve reviewer user id (idempotent backfill below).
    const reviewerId = post.reviewedByKey ? (userIds[post.reviewedByKey] ?? null) : null;

    const existing = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, reviewedByUserId: true },
    });
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
          // Optional CTA-layout fields — only set when the seed defines
          // them, so the existing posts continue to render exactly as
          // before.
          linkUrl: post.linkUrl ?? null,
          linkTitle: post.linkTitle ?? null,
          linkDescription: post.linkDescription ?? null,
          linkImageUrl: post.linkImageUrl ?? null,
          linkSiteName: post.linkSiteName ?? null,
          heroImageUrl: post.heroImageUrl ?? null,
          kindId,
          urgency: post.urgency ?? false,
          // BU-event-time / D073
          eventAt,
          eventEndsAt,
          locationText,
          // BU-calendar-near-me / D076 / ADR-0002 — Path A hand-coded
          // coords on event-bearing seed posts. `isOnline=true` excludes
          // the post from `/calendar?view=near` regardless of coords.
          latitude: post.latitude ?? null,
          longitude: post.longitude ?? null,
          isOnline: post.isOnline ?? false,
          // D072 — demo posts ship as published-and-live. Drafts are
          // an authenticated-author state; seed has no need for them.
          status: 'published',
          publishedAt: createdAt,
          reviewedByUserId: reviewerId,
          // D069 — tick_or_cross verdict (promote / remove); null otherwise.
          signal: post.signal ?? null,
        },
      });
      postsCreated++;
    } else {
      // BU-post-location-input. Idempotent backfill for the new
      // location columns (`latitude`, `longitude`, `isOnline`) so a
      // seed re-run after schema changes propagates the declared
      // values onto pre-existing rows. The previous behaviour only
      // ever updated `reviewedByUserId`; we now also reconcile any
      // declared lat/lng/isOnline drift. We intentionally do NOT
      // overwrite member-authored coords (the seed only owns posts
      // it created; deterministic IDs guarantee that).
      const declaredLat = post.latitude ?? null;
      const declaredLng = post.longitude ?? null;
      const declaredOnline = post.isOnline ?? false;
      const declaredReviewer = reviewerId;

      // Read the current row state so we can build a minimal `data`
      // patch — running seed twice in a row with no declarative
      // changes still issues zero updates.
      const current = await prisma.post.findUnique({
        where: { id: postId },
        select: {
          latitude: true,
          longitude: true,
          isOnline: true,
          reviewedByUserId: true,
        },
      });
      if (current) {
        const data: Record<string, unknown> = {};
        if (current.latitude !== declaredLat) data['latitude'] = declaredLat;
        if (current.longitude !== declaredLng) data['longitude'] = declaredLng;
        if (current.isOnline !== declaredOnline) data['isOnline'] = declaredOnline;
        if (declaredReviewer && current.reviewedByUserId !== declaredReviewer) {
          data['reviewedByUserId'] = declaredReviewer;
        }
        if (Object.keys(data).length > 0) {
          await prisma.post.update({
            where: { id: postId },
            data,
          });
        }
      }
    }

    // D072 demo — when the post is reviewed, also seed the pinned
    // attribution comment so the three-tier UI lights up end-to-end
    // in dev. Idempotent via deterministic id.
    if (reviewerId) {
      const reviewer = SEED_USERS.find(
        (u) => u.email === `${post.reviewedByKey}@demo.gps-action.test`,
      );
      if (reviewer) {
        const attributionId = seedUuid('comment', `${post.seedKey}-review-attribution`);
        const attributionExists = await prisma.comment.findUnique({
          where: { id: attributionId },
        });
        if (!attributionExists) {
          await prisma.comment.create({
            data: {
              id: attributionId,
              postId,
              authorId: reviewerId,
              body: `${reviewer.displayName} helped review and shape this post.`,
              audience: 'all',
              systemKind: 'post_review_attribution',
              createdAt,
            },
          });
        }
      }
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

  // ── Demo warmth on the tick-bbc-correction post ─────────────────────
  // Idempotent via deterministic seedUuid ids — the bulk seed above is
  // one-shot (skips entirely once any comment exists), so on a re-seeded
  // dev DB those warm comments would never land. This block is fire-
  // and-forget per id: each comment is created if absent.
  //
  // Counterpart: `cross-fake-petition` deliberately gets ZERO comments so
  // the empty-state demo path keeps working.
  const tickPostId = seedUuid('post', 'tick-bbc-correction');
  const tickPostRow = await prisma.post.findUnique({
    where: { id: tickPostId },
    select: { id: true, createdAt: true },
  });
  if (tickPostRow) {
    const tickWarmComments: { authorKey: string; body: string }[] = [
      {
        authorKey: 'cary',
        body: "Thanks for spotting the correction. I'll boost on Twitter and our Bluesky. Worth confirming the original framing has been updated everywhere — sometimes only the lead article gets the update.",
      },
      {
        authorKey: 'eddie',
        body: 'Shared in the Manchester WhatsApp group. People have been asking about this all week.',
      },
      {
        authorKey: 'ingrid',
        body: 'Boosted. The correction wording is solid — credit to whoever drafted the complaint that landed it.',
      },
    ];
    let warmCreated = 0;
    for (let i = 0; i < tickWarmComments.length; i += 1) {
      const tw = tickWarmComments[i]!;
      const commentId = seedUuid('comment', `tick-bbc-correction:warm-${i + 1}`);
      const exists = await prisma.comment.findUnique({ where: { id: commentId } });
      if (exists) continue;
      const authorId = userIds[tw.authorKey];
      if (!authorId) continue;
      // Stagger by 5 minutes so the order is stable + chronological.
      const createdAt = new Date(tickPostRow.createdAt.getTime() + (i + 1) * 5 * 60 * 1000);
      await prisma.comment.create({
        data: {
          id: commentId,
          postId: tickPostId,
          authorId,
          body: tw.body,
          createdAt,
        },
      });
      warmCreated += 1;
    }
    console.warn(`  ✓ tick-bbc-correction warm comments (${warmCreated} new)`);
  }

  // ── Seed coord-board defaults + demo kanban tickets ─────────────────
  // bu-coordination-board: default BoardColumns + a small set of
  // populated kanban cards per demo group, so `/board/<slug>` lands on a
  // working board straight after `npm run db:seed`. Idempotent — uses
  // deterministic IDs throughout.
  //
  // Seeded across 3 demo groups: writers, manchester, rapid-response.
  // The F10 fixture seed (`prisma/seed.ts`) creates more groups; those
  // stay empty for now (they get a populated board only when someone
  // creates a ticket via the UI, or when this section grows).

  const COORD_BOARD_DEFAULT_COLUMNS = [
    'Recruitment',
    'Preparation',
    'Implementation',
    'Monitoring',
  ];

  let columnsCreated = 0;
  for (const slug of ['writers', 'manchester', 'rapid-response'] as const) {
    const groupId = groupIds[slug];
    if (!groupId) continue;
    for (let ordinal = 0; ordinal < COORD_BOARD_DEFAULT_COLUMNS.length; ordinal++) {
      const displayName = COORD_BOARD_DEFAULT_COLUMNS[ordinal]!;
      const columnId = seedUuid('board-column', `${slug}:${ordinal}`);
      const existing = await prisma.boardColumn.findUnique({ where: { id: columnId } });
      if (!existing) {
        await prisma.boardColumn.create({
          data: { id: columnId, groupId, ordinal, displayName },
        });
        columnsCreated++;
      }
    }
  }
  console.warn(`  ✓ Default BoardColumns seeded for 3 demo groups (${columnsCreated} new)`);

  interface SeedKanbanTicket {
    seedKey: string;
    groupSlug: 'writers' | 'manchester' | 'rapid-response';
    /** 0-indexed BoardColumn ordinal within the group's default set. */
    columnOrdinal: number;
    title: string;
    body: string | null;
    urgency: boolean;
    assigneeKey: string | null;
    /** Order within the column (lower = top). Multiplied by 1024 for boardPosition. */
    positionWithinColumn: number;
  }

  const SEED_KANBAN_TICKETS: SeedKanbanTicket[] = [
    // Writers
    {
      seedKey: 'writers-press-vigil',
      groupSlug: 'writers',
      columnOrdinal: 1,
      title: "Press release — Tuesday's vigil",
      body: 'Two-paragraph release with a quote from Bette. Send to the local paper desk by Tuesday lunchtime so it makes the evening edition.',
      urgency: true,
      assigneeKey: 'bette',
      positionWithinColumn: 0,
    },
    {
      seedKey: 'writers-guardian-pitch',
      groupSlug: 'writers',
      columnOrdinal: 2,
      title: 'Op-ed pitch to The Guardian',
      body: 'Drafting an angle around community resilience after this month. 800 words. Eddie has the draft going through Ingrid for a read.',
      urgency: false,
      assigneeKey: 'eddie',
      positionWithinColumn: 0,
    },
    {
      seedKey: 'writers-energy-letter',
      groupSlug: 'writers',
      columnOrdinal: 0,
      title: 'Letter template — energy bills',
      body: null,
      urgency: false,
      assigneeKey: null,
      positionWithinColumn: 0,
    },

    // Manchester
    {
      seedKey: 'manchester-town-hall',
      groupSlug: 'manchester',
      columnOrdinal: 0,
      title: 'Town hall booking — Saturday week',
      body: 'Need confirmed venue + AV setup. Cary has a contact at the Friends Meeting House — check availability.',
      urgency: true,
      assigneeKey: 'cary',
      positionWithinColumn: 0,
    },
    {
      seedKey: 'manchester-leafleting',
      groupSlug: 'manchester',
      columnOrdinal: 1,
      title: 'Door-to-door leafleting plan',
      body: 'Three streets prioritised. Eddie has the route map; needs another two volunteers for Saturday morning.',
      urgency: false,
      assigneeKey: 'eddie',
      positionWithinColumn: 0,
    },
    {
      seedKey: 'manchester-photographer',
      groupSlug: 'manchester',
      columnOrdinal: 0,
      title: 'Photographer for Saturday action',
      body: null,
      urgency: false,
      assigneeKey: null,
      positionWithinColumn: 1,
    },

    // Rapid Response
    {
      seedKey: 'rapid-bbc-interview',
      groupSlug: 'rapid-response',
      columnOrdinal: 2,
      title: 'BBC interview — Cary on Newsnight',
      body: "Producer wants 90 seconds, live. Cary's prepping the three key points; Bette is on standby for backup quotes.",
      urgency: true,
      assigneeKey: 'cary',
      positionWithinColumn: 0,
    },
    {
      seedKey: 'rapid-itv-followup',
      groupSlug: 'rapid-response',
      columnOrdinal: 1,
      title: 'ITV regional — pitch follow-up',
      body: 'Sent the brief on Monday; chasing for a slot this week.',
      urgency: false,
      assigneeKey: 'bette',
      positionWithinColumn: 0,
    },
    {
      seedKey: 'rapid-quote-bank',
      groupSlug: 'rapid-response',
      columnOrdinal: 3,
      title: 'Quote bank for press',
      body: null,
      urgency: false,
      assigneeKey: null,
      positionWithinColumn: 0,
    },
  ];

  let ticketsCreated = 0;
  for (const t of SEED_KANBAN_TICKETS) {
    const groupId = groupIds[t.groupSlug];
    if (!groupId) continue;
    const requestId = seedUuid('coord-ticket', t.seedKey);
    const columnId = seedUuid('board-column', `${t.groupSlug}:${t.columnOrdinal}`);
    const boardPosition = (t.positionWithinColumn + 1) * 1024;
    const requestGroupId = seedUuid('coord-rg', t.seedKey);

    const existing = await prisma.request.findUnique({ where: { id: requestId } });
    if (!existing) {
      await prisma.request.create({
        data: {
          id: requestId,
          type: null,
          status: 'active',
          priority: 'normal',
          title: t.title,
          body: t.body,
          context: {},
          urgency: t.urgency,
          columnId,
          boardPosition,
          createdByUserId: userIds[t.assigneeKey ?? 'bette']!,
        },
      });
      await prisma.requestGroup.create({
        data: {
          id: requestGroupId,
          requestId,
          groupId,
          origin: 'originating',
          columnId,
          boardPosition,
          isUrgent: t.urgency,
          sharedByUserId: userIds[t.assigneeKey ?? 'bette']!,
        },
      });
      if (t.assigneeKey) {
        const assignmentId = seedUuid('coord-assign', t.seedKey);
        await prisma.assignment.create({
          data: {
            id: assignmentId,
            requestId,
            userId: userIds[t.assigneeKey]!,
          },
        });
      }
      ticketsCreated++;
    }
  }
  console.warn(
    `  ✓ Demo kanban tickets seeded across writers / manchester / rapid-response (${ticketsCreated} new)`,
  );

  // ── Group share workflow allow-list (atom 5e) ──────────────────────────
  // Wire every demo group as a workflow target of every other demo group,
  // so the Surface 2 Share-with-team picker has populated targets out of
  // the box. Without these rows the picker renders disabled and pilot
  // smoke-tests can't exercise SCN-33.
  const SEED_SHARE_WORKFLOWS: Array<{ source: string; target: string }> = [
    { source: 'writers', target: 'manchester' },
    { source: 'writers', target: 'rapid-response' },
    { source: 'manchester', target: 'writers' },
    { source: 'manchester', target: 'rapid-response' },
    { source: 'rapid-response', target: 'writers' },
    { source: 'rapid-response', target: 'manchester' },
  ];
  let shareWorkflowsCreated = 0;
  for (const w of SEED_SHARE_WORKFLOWS) {
    const id = seedUuid('group-share-workflow', `${w.source}->${w.target}`);
    const existing = await prisma.groupShareWorkflow.findUnique({ where: { id } });
    if (!existing) {
      await prisma.groupShareWorkflow.create({
        data: {
          id,
          sourceGroupId: groupIds[w.source]!,
          targetGroupId: groupIds[w.target]!,
          addedByUserId: userIds.bette!,
        },
      });
      shareWorkflowsCreated++;
    }
  }
  console.warn(
    `  ✓ GroupShareWorkflow allow-list seeded (${shareWorkflowsCreated} new across ${SEED_SHARE_WORKFLOWS.length} pairs)`,
  );

  // ─────────────────────────────────────────────────────────────────────
  // Phase-2 demo enrichment (PR #0.2.181)
  // ─────────────────────────────────────────────────────────────────────
  // Adds realistic, narratable scenarios on top of the demo seed:
  //   - Default BoardColumns for the three new groups (north-london /
  //     students / cst-link).
  //   - 17 additional kanban tickets across the lifecycle (backlog /
  //     active in named columns / done) with one urgent.
  //   - Re-assignment history on 5 tickets (one Assignment soft-deleted
  //     ~3 days ago, a fresh one current — narrates "ticket moved from
  //     X to Y").
  //   - RequestSubscription rows per ticket (mix of auto_assignee +
  //     explicit follower).
  //   - Cross-team RequestGroup shares on 6 tickets, 2 of which carry a
  //     prior unshare (deletedAt set) plus a different active share —
  //     demonstrates "shared from Team A to Team B then to Team C".
  //   - 4–6 Comment / Note rows per ticket, audience mix, all human.
  //   - lastActivityAt populated to recent comment / share / assignment
  //     change so the board's "Last activity" labels stagger.
  //   - Reactions on every existing seeded post: 4–9 per post by varied
  //     authors and emoji.
  //   - Comment threads on 4 posts with 4–5 back-and-forth replies.
  //   - 15 AuditLog rows using existing action codes (assignment_created,
  //     assignment_unassigned, request_group_shared, request_group_
  //     unshared, ticket_title_edited, request_status_changed, etc).
  //   - 8 Notifications across mixed users / lifecycle / read state.
  //
  // Idempotency: every row keyed by seedUuid('<entity>', '<seedKey>'),
  // create-if-absent, no overwrites of member-authored data.

  console.warn('Seeding Phase-2 demo enrichment...');

  // ── Default board columns for the 3 new groups ─────────────────────
  const ENRICH_BOARD_GROUPS = ['north-london', 'students', 'cst-link'] as const;
  let enrichColumnsCreated = 0;
  for (const slug of ENRICH_BOARD_GROUPS) {
    const groupId = groupIds[slug];
    if (!groupId) continue;
    for (let ordinal = 0; ordinal < COORD_BOARD_DEFAULT_COLUMNS.length; ordinal++) {
      const displayName = COORD_BOARD_DEFAULT_COLUMNS[ordinal]!;
      const columnId = seedUuid('board-column', `${slug}:${ordinal}`);
      const existing = await prisma.boardColumn.findUnique({ where: { id: columnId } });
      if (!existing) {
        await prisma.boardColumn.create({
          data: { id: columnId, groupId, ordinal, displayName },
        });
        enrichColumnsCreated++;
      }
    }
  }
  console.warn(`  ✓ Default BoardColumns for 3 new groups (${enrichColumnsCreated} new)`);

  // ── Helpers ─────────────────────────────────────────────────────────
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const daysAgo = (n: number): Date => new Date(now.getTime() - n * dayMs);

  // ── Group-share workflow allow-list extension (so the 3 new groups
  //    surface in each other's "Share with team" pickers) ─────────────
  const ENRICH_SHARE_WORKFLOWS: Array<{ source: string; target: string }> = [
    { source: 'north-london', target: 'writers' },
    { source: 'north-london', target: 'rapid-response' },
    { source: 'north-london', target: 'cst-link' },
    { source: 'writers', target: 'north-london' },
    { source: 'rapid-response', target: 'north-london' },
    { source: 'rapid-response', target: 'cst-link' },
    { source: 'cst-link', target: 'rapid-response' },
    { source: 'cst-link', target: 'north-london' },
    { source: 'students', target: 'writers' },
    { source: 'students', target: 'manchester' },
    { source: 'manchester', target: 'students' },
    { source: 'writers', target: 'students' },
  ];
  let enrichShareWorkflows = 0;
  for (const w of ENRICH_SHARE_WORKFLOWS) {
    const id = seedUuid('group-share-workflow', `${w.source}->${w.target}`);
    const existing = await prisma.groupShareWorkflow.findUnique({ where: { id } });
    if (!existing) {
      await prisma.groupShareWorkflow.create({
        data: {
          id,
          sourceGroupId: groupIds[w.source]!,
          targetGroupId: groupIds[w.target]!,
          addedByUserId: userIds.bette!,
        },
      });
      enrichShareWorkflows++;
    }
  }
  console.warn(`  ✓ Cross-group share workflows extended (${enrichShareWorkflows} new)`);

  // ── Enrichment kanban tickets ──────────────────────────────────────
  // 17 additional tickets distributed across the lifecycle. Status
  // mapping:
  //   - backlog: no columnId, RequestStatus.backlog
  //   - active : columnId set (Recruitment/Preparation/Implementation/
  //              Monitoring), RequestStatus.active
  //   - done   : RequestStatus.done, columnId on Monitoring (last column)
  type GroupSlug =
    | 'writers'
    | 'manchester'
    | 'rapid-response'
    | 'north-london'
    | 'students'
    | 'cst-link';

  interface EnrichTicket {
    seedKey: string;
    groupSlug: GroupSlug;
    /** Backlog = -1, otherwise BoardColumn ordinal 0..3. */
    columnOrdinal: -1 | 0 | 1 | 2 | 3;
    title: string;
    body: string | null;
    urgency: boolean;
    /** RequestStatus override; defaults derived from columnOrdinal. */
    status?: 'backlog' | 'active' | 'done';
    /** Current assignee (null = unassigned). */
    assigneeKey: string | null;
    /** Prior assignee — when set, an unassigned (deletedAt) Assignment row
     *  is seeded ahead of the current one to narrate "reassigned from X
     *  to Y" history. */
    previousAssigneeKey?: string | null;
    /** Followers (RequestSubscription rows). The current assignee is
     *  added automatically with source = auto_assignee; entries here
     *  use source = explicit. */
    followerKeys?: string[];
    createdByKey: string;
    /** How many days ago the ticket was created. */
    createdDaysAgo: number;
    /** Optional verdict for done tickets: 'approved' | 'rejected' etc. */
    resolution?: 'approved' | 'rejected' | 'edited' | 'duplicate' | 'dismissed';
    resolvedByKey?: string;
    /** Manual position bias — controls vertical order within column. */
    positionWithinColumn: number;
    /** Cross-team shares. Each entry creates an active RequestGroup row
     *  (origin = ad_hoc_share or workflow_share). The sharedDaysAgo
     *  controls createdAt so the activity timeline staggers. */
    shares?: Array<{ groupSlug: GroupSlug; sharedByKey: string; sharedDaysAgo: number }>;
    /** Prior shares that were unshared (deletedAt set). Demonstrates
     *  the "ticket moved teams" history. */
    unshares?: Array<{
      groupSlug: GroupSlug;
      sharedByKey: string;
      sharedDaysAgo: number;
      unsharedDaysAgo: number;
    }>;
    /** Comment + note rows. Author key + body + kind. */
    threadEntries?: Array<{
      authorKey: string;
      body: string;
      kind: 'comment' | 'note';
      audience?: 'all' | 'reviewers';
      daysAgo: number;
    }>;
  }

  const ENRICH_TICKETS: EnrichTicket[] = [
    // ── Writers (3 new) ───────────────────────────────────────────────
    {
      seedKey: 'enrich-writers-conservative-letters',
      groupSlug: 'writers',
      columnOrdinal: 1,
      title: 'Conservative-leaning publication — research letter angle',
      body: "Looking for a writer with a Telegraph / Spectator readership tone. Want to land a guest letter on the housing motion that doesn't read as identity-politics. Naomi has a contact at the comment desk.",
      urgency: false,
      assigneeKey: 'rachel',
      previousAssigneeKey: 'naomi',
      followerKeys: ['naomi', 'bette', 'ingrid'],
      createdByKey: 'naomi',
      createdDaysAgo: 9,
      positionWithinColumn: 0,
      shares: [{ groupSlug: 'north-london', sharedByKey: 'rachel', sharedDaysAgo: 4 }],
      threadEntries: [
        {
          authorKey: 'naomi',
          body: 'Started this. Realised I do not have the tone for a centre-right desk; passing to Rachel.',
          kind: 'comment',
          daysAgo: 7,
        },
        {
          authorKey: 'rachel',
          body: 'Picked it up. I will draft something this week.',
          kind: 'comment',
          daysAgo: 4,
        },
        {
          authorKey: 'rachel',
          body: 'Note: my contact at the Telegraph said the comment desk closes at 16:00 — anything submitted after that lands in the next-day pile.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 3,
        },
        {
          authorKey: 'bette',
          body: 'Worth pinging Ingrid for an early read once you have a draft.',
          kind: 'comment',
          daysAgo: 2,
        },
      ],
    },
    {
      seedKey: 'enrich-writers-fact-check',
      groupSlug: 'writers',
      columnOrdinal: 0,
      title: 'Fact-check pack for the May complaint cycle',
      body: 'Build the canonical fact-check pack for the four campaigns we are running in May. CST stats, council minutes, JC archive links.',
      urgency: false,
      assigneeKey: null,
      followerKeys: ['ingrid', 'naomi'],
      createdByKey: 'ingrid',
      createdDaysAgo: 13,
      positionWithinColumn: 1,
      threadEntries: [
        {
          authorKey: 'ingrid',
          body: 'Will draft the structure when I get a quiet evening this week. Volunteer slots welcome.',
          kind: 'comment',
          daysAgo: 11,
        },
      ],
    },
    {
      seedKey: 'enrich-writers-baddiel-followup',
      groupSlug: 'writers',
      columnOrdinal: 3,
      title: 'Baddiel piece — internal commentary digest',
      body: 'Collect best internal commentary on the Baddiel Guardian op-ed — to send round once landed, not before.',
      urgency: false,
      status: 'done',
      assigneeKey: 'ingrid',
      followerKeys: ['bette', 'naomi'],
      createdByKey: 'ingrid',
      createdDaysAgo: 22,
      resolution: 'approved',
      resolvedByKey: 'bette',
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'ingrid',
          body: 'Digest is up. Sending round on Friday.',
          kind: 'comment',
          daysAgo: 14,
        },
        {
          authorKey: 'bette',
          body: 'Closing this — read it, it is good, signed off.',
          kind: 'comment',
          daysAgo: 11,
        },
      ],
    },

    // ── Manchester (3 new) ────────────────────────────────────────────
    {
      seedKey: 'enrich-manchester-museum-installation',
      groupSlug: 'manchester',
      columnOrdinal: 2,
      title: 'Museum installation — Holocaust memorial corner',
      body: 'Coordinate with Manchester Jewish Museum on the September installation. Confirmed: Daniel Friedman (David here is one of his contacts) is curating; we provide volunteer hours.',
      urgency: false,
      assigneeKey: 'david',
      previousAssigneeKey: 'humphrey',
      followerKeys: ['humphrey', 'eddie'],
      createdByKey: 'humphrey',
      createdDaysAgo: 27,
      positionWithinColumn: 0,
      shares: [{ groupSlug: 'writers', sharedByKey: 'david', sharedDaysAgo: 8 }],
      unshares: [
        {
          groupSlug: 'rapid-response',
          sharedByKey: 'humphrey',
          sharedDaysAgo: 21,
          unsharedDaysAgo: 14,
        },
      ],
      threadEntries: [
        {
          authorKey: 'humphrey',
          body: 'Originally shared this to Rapid Response thinking the museum had a press window — turns out the timeline is months. Pulling that share now.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 14,
        },
        {
          authorKey: 'humphrey',
          body: 'Passing to David — he has the curator contact. I will stay on the thread.',
          kind: 'comment',
          daysAgo: 13,
        },
        {
          authorKey: 'david',
          body: 'Got it. Meeting Daniel next Wednesday.',
          kind: 'comment',
          daysAgo: 11,
        },
        {
          authorKey: 'david',
          body: 'Met. Volunteer pool target: 12. Will share with Writers for sign-up help.',
          kind: 'comment',
          daysAgo: 8,
        },
      ],
    },
    {
      seedKey: 'enrich-manchester-mosque-solidarity',
      groupSlug: 'manchester',
      columnOrdinal: 0,
      title: 'Solidarity message to Cheetham Hill mosque',
      body: 'Draft and send a quiet solidarity message to the Cheetham Hill mosque after the weekend incident. No press, no photos. Just a card.',
      urgency: false,
      assigneeKey: 'cary',
      followerKeys: ['eddie', 'jonathan'],
      createdByKey: 'jonathan',
      createdDaysAgo: 5,
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'jonathan',
          body: 'Suggested by a friend who lives nearby. Nothing performative — just acknowledged.',
          kind: 'comment',
          daysAgo: 5,
        },
        {
          authorKey: 'cary',
          body: 'Drafting. Will post the wording before sending so anyone can adjust.',
          kind: 'comment',
          daysAgo: 4,
        },
      ],
    },
    {
      seedKey: 'enrich-manchester-volunteer-rota',
      groupSlug: 'manchester',
      columnOrdinal: 1,
      title: 'Volunteer rota — May letter campaign',
      body: 'Six campaigns this month. Need two co-leads per campaign. Eddie to coordinate the matching; volunteers to self-nominate.',
      urgency: true,
      assigneeKey: 'eddie',
      followerKeys: ['humphrey', 'jonathan', 'david'],
      createdByKey: 'eddie',
      createdDaysAgo: 3,
      positionWithinColumn: 1,
      shares: [
        { groupSlug: 'writers', sharedByKey: 'eddie', sharedDaysAgo: 2 },
        { groupSlug: 'students', sharedByKey: 'eddie', sharedDaysAgo: 1 },
      ],
      threadEntries: [
        {
          authorKey: 'eddie',
          body: 'Marked urgent — we need the rota by Friday or campaign 1 slips.',
          kind: 'comment',
          daysAgo: 3,
        },
        {
          authorKey: 'jonathan',
          body: 'Students network can supply 4 volunteers. Will collect names by Wednesday.',
          kind: 'comment',
          daysAgo: 2,
        },
        {
          authorKey: 'humphrey',
          body: 'I can co-lead the Holocaust-curriculum letter campaign with Bette.',
          kind: 'comment',
          daysAgo: 1,
        },
      ],
    },

    // ── Rapid Response (3 new) ────────────────────────────────────────
    {
      seedKey: 'enrich-rapid-channel4-followup',
      groupSlug: 'rapid-response',
      columnOrdinal: 1,
      title: 'Channel 4 News — push for follow-up segment',
      body: 'C4 ran a 90-second piece on the Bristol incident. The follow-up they promised has not materialised; chase the producer this week.',
      urgency: false,
      assigneeKey: 'maya',
      previousAssigneeKey: 'cary',
      followerKeys: ['cary', 'sharon', 'bette'],
      createdByKey: 'cary',
      createdDaysAgo: 11,
      positionWithinColumn: 0,
      shares: [{ groupSlug: 'cst-link', sharedByKey: 'sharon', sharedDaysAgo: 6 }],
      threadEntries: [
        {
          authorKey: 'cary',
          body: 'Producer chased; no reply. Passing to Maya — she has the editor contact.',
          kind: 'comment',
          daysAgo: 6,
        },
        {
          authorKey: 'maya',
          body: 'Got it. I will email today.',
          kind: 'comment',
          daysAgo: 5,
        },
        {
          authorKey: 'sharon',
          body: 'CST safeguarding lead is happy to be quoted on background — tell them.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 4,
        },
        {
          authorKey: 'maya',
          body: 'Editor responded. Filming Thursday morning. Cary on standby for sound bite.',
          kind: 'comment',
          daysAgo: 2,
        },
      ],
    },
    {
      seedKey: 'enrich-rapid-coordinated-statement',
      groupSlug: 'rapid-response',
      columnOrdinal: 2,
      title: 'Joint statement with three London shul boards',
      body: 'Three NW London shul boards want to co-sign a joint statement on the Hendon graffiti. Coordinate the wording and the sign-off.',
      urgency: true,
      assigneeKey: 'sharon',
      previousAssigneeKey: 'cary',
      followerKeys: ['cary', 'bette', 'rachel', 'esther'],
      createdByKey: 'cary',
      createdDaysAgo: 4,
      positionWithinColumn: 0,
      shares: [
        { groupSlug: 'cst-link', sharedByKey: 'sharon', sharedDaysAgo: 3 },
        { groupSlug: 'north-london', sharedByKey: 'rachel', sharedDaysAgo: 2 },
      ],
      threadEntries: [
        {
          authorKey: 'cary',
          body: 'Sharon — you have the shul-board relationships. Taking your name off as assignee and putting yours on.',
          kind: 'comment',
          daysAgo: 3,
        },
        {
          authorKey: 'sharon',
          body: 'Got it. Will draft v1 tonight and circulate for the three boards by 09:00 tomorrow.',
          kind: 'comment',
          daysAgo: 3,
        },
        {
          authorKey: 'sharon',
          body: 'Internal note — Hendon Adath board chair is currently sitting shiva. We will route through their vice-chair, not him.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 2,
        },
        {
          authorKey: 'rachel',
          body: 'North London picked it up via the share. Two more shul boards interested in co-signing — Finchley Reform and Edgware United.',
          kind: 'comment',
          daysAgo: 1,
        },
        {
          authorKey: 'esther',
          body: 'Sending the draft to my friend who used to write for the Board of Deputies — for a tone read.',
          kind: 'comment',
          daysAgo: 1,
        },
      ],
    },
    {
      seedKey: 'enrich-rapid-bbc-followup-done',
      groupSlug: 'rapid-response',
      columnOrdinal: 3,
      title: 'BBC followup — week-2 ratchet on the Manchester correction',
      body: 'Following BBC online correction, push for a parallel correction on radio output. Resolved.',
      urgency: false,
      status: 'done',
      assigneeKey: 'cary',
      followerKeys: ['bette', 'eddie'],
      createdByKey: 'bette',
      createdDaysAgo: 18,
      resolution: 'approved',
      resolvedByKey: 'cary',
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'cary',
          body: 'Radio correction landed Tuesday morning. Same wording as online. Closing.',
          kind: 'comment',
          daysAgo: 9,
        },
      ],
    },

    // ── North London (4 new) ──────────────────────────────────────────
    {
      seedKey: 'enrich-nl-barnet-gallery',
      groupSlug: 'north-london',
      columnOrdinal: 1,
      title: 'Barnet council Tuesday — public gallery sign-up',
      body: 'Public gallery seats 28. Tuesday is the housing-motion debate. Get visible turnout by signing the gallery list before Friday.',
      urgency: true,
      assigneeKey: 'rachel',
      previousAssigneeKey: 'esther',
      followerKeys: ['esther', 'naomi', 'sharon'],
      createdByKey: 'rachel',
      createdDaysAgo: 6,
      positionWithinColumn: 0,
      shares: [{ groupSlug: 'writers', sharedByKey: 'rachel', sharedDaysAgo: 3 }],
      unshares: [
        {
          groupSlug: 'manchester',
          sharedByKey: 'rachel',
          sharedDaysAgo: 5,
          unsharedDaysAgo: 4,
        },
      ],
      threadEntries: [
        {
          authorKey: 'esther',
          body: 'Started. Realised this is a Tuesday-in-person ticket — I cannot do Tuesdays. Reassigning Rachel.',
          kind: 'comment',
          daysAgo: 4,
        },
        {
          authorKey: 'rachel',
          body: 'Got it. Will update the gallery list this evening and confirm 12 names by Wednesday.',
          kind: 'comment',
          daysAgo: 4,
        },
        {
          authorKey: 'rachel',
          body: 'Initially shared to Manchester — that was a mistake, this is a North London gallery. Removed and shared to Writers instead since several are Barnet residents.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 3,
        },
        {
          authorKey: 'naomi',
          body: 'I will be there Tuesday. Eight others from the Wednesday letter-writing crowd are confirmed.',
          kind: 'comment',
          daysAgo: 2,
        },
        {
          authorKey: 'sharon',
          body: 'I will join from the back row. CST has a quiet steward there too — separate from us.',
          kind: 'comment',
          daysAgo: 1,
        },
      ],
    },
    {
      seedKey: 'enrich-nl-letter-writing-evening',
      groupSlug: 'north-london',
      columnOrdinal: 0,
      title: 'Letter-writing evening — recurring Wednesday slot',
      body: 'Set up a recurring Wednesday evening letter-writing session. Naomi and Esther co-host. Hot drinks, biscuits, six laptops, decent wifi.',
      urgency: false,
      assigneeKey: 'naomi',
      followerKeys: ['esther', 'rachel'],
      createdByKey: 'naomi',
      createdDaysAgo: 24,
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'naomi',
          body: 'Hosted the first three; attendance has grown each week. Want to formalise.',
          kind: 'comment',
          daysAgo: 16,
        },
        {
          authorKey: 'esther',
          body: 'I am in. Happy to co-host alternate weeks.',
          kind: 'comment',
          daysAgo: 15,
        },
      ],
    },
    {
      seedKey: 'enrich-nl-shul-rabbi-circular',
      groupSlug: 'north-london',
      columnOrdinal: 2,
      title: 'Shul rabbi circular — May newsletters',
      body: 'Get the GPS-Action call-to-action item into the May newsletters of five North London shuls. Quiet, factual paragraph; not a campaign blast.',
      urgency: false,
      assigneeKey: 'esther',
      previousAssigneeKey: 'rachel',
      followerKeys: ['rachel', 'naomi', 'sharon', 'bette'],
      createdByKey: 'rachel',
      createdDaysAgo: 14,
      positionWithinColumn: 0,
      shares: [{ groupSlug: 'cst-link', sharedByKey: 'sharon', sharedDaysAgo: 7 }],
      threadEntries: [
        {
          authorKey: 'rachel',
          body: 'Started. My capacity is full this week — handing to Esther who has rabbi contacts at three of the five.',
          kind: 'comment',
          daysAgo: 9,
        },
        {
          authorKey: 'esther',
          body: 'Got it. Will reach out by end of week.',
          kind: 'comment',
          daysAgo: 8,
        },
        {
          authorKey: 'sharon',
          body: 'CST liaison can vouch for the wording with rabbi-circular gatekeepers if asked.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 7,
        },
      ],
    },
    {
      seedKey: 'enrich-nl-tea-with-mp',
      groupSlug: 'north-london',
      columnOrdinal: -1,
      title: 'Constituency tea with Hendon MP — exploratory',
      body: 'Idea: ask the Hendon MP for an informal constituency tea with five GPS-Action members. Not a press event — a relationship build.',
      urgency: false,
      assigneeKey: null,
      followerKeys: ['rachel', 'naomi'],
      createdByKey: 'naomi',
      createdDaysAgo: 2,
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'naomi',
          body: 'Floating this. No pressure for anyone to pick it up — sitting in backlog is fine.',
          kind: 'comment',
          daysAgo: 2,
        },
      ],
    },

    // ── Students (2 new) ──────────────────────────────────────────────
    {
      seedKey: 'enrich-students-russell-roundtable',
      groupSlug: 'students',
      columnOrdinal: 1,
      title: 'Russell-Group student roundtable — May 18',
      body: 'One student from each of the 24 RG SUs we are connected to. Two-hour round-table on what each campus is dealing with. David is hosting in Manchester.',
      urgency: false,
      assigneeKey: 'david',
      followerKeys: ['jonathan', 'esther', 'humphrey'],
      createdByKey: 'jonathan',
      createdDaysAgo: 8,
      positionWithinColumn: 0,
      shares: [{ groupSlug: 'manchester', sharedByKey: 'eddie', sharedDaysAgo: 5 }],
      threadEntries: [
        {
          authorKey: 'jonathan',
          body: 'David — you have the venue and the moderation skills. Picking you for this one.',
          kind: 'comment',
          daysAgo: 8,
        },
        {
          authorKey: 'david',
          body: 'On it. Venue confirmed; agenda draft Wednesday.',
          kind: 'comment',
          daysAgo: 6,
        },
        {
          authorKey: 'humphrey',
          body: 'Manchester locals can host overnight stays — DM me if you need a sofa.',
          kind: 'comment',
          daysAgo: 4,
        },
      ],
    },
    {
      seedKey: 'enrich-students-leeds-su-motion',
      groupSlug: 'students',
      columnOrdinal: -1,
      title: 'Leeds SU — divestment motion timing',
      body: 'Leeds SU motion timing is unclear. Find out when council debates and whether alumni letters are accepted.',
      urgency: false,
      assigneeKey: null,
      followerKeys: ['jonathan', 'david'],
      createdByKey: 'david',
      createdDaysAgo: 17,
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'david',
          body: 'Logging this. Low priority — we will get to it after the May rota.',
          kind: 'comment',
          daysAgo: 17,
        },
      ],
    },

    // ── CST liaison (2 new) ───────────────────────────────────────────
    {
      seedKey: 'enrich-cst-shabbat-roster',
      groupSlug: 'cst-link',
      columnOrdinal: 2,
      title: 'Shabbat steward roster — extra cover for next 4 weeks',
      body: 'Following the Hendon incident, three NW London shuls asked CST for extra steward cover. Coordinate volunteer availability and pair with CST scheduler.',
      urgency: true,
      assigneeKey: 'sharon',
      followerKeys: ['cary', 'bette', 'maya'],
      createdByKey: 'sharon',
      createdDaysAgo: 7,
      positionWithinColumn: 0,
      shares: [
        { groupSlug: 'rapid-response', sharedByKey: 'cary', sharedDaysAgo: 5 },
        { groupSlug: 'north-london', sharedByKey: 'rachel', sharedDaysAgo: 4 },
      ],
      threadEntries: [
        {
          authorKey: 'sharon',
          body: 'CST scheduler has slot pings open for the next four Shabbatot. We need 6 volunteer hours per week.',
          kind: 'comment',
          daysAgo: 7,
        },
        {
          authorKey: 'maya',
          body: 'I can do Friday evenings for the next three weeks.',
          kind: 'comment',
          daysAgo: 5,
        },
        {
          authorKey: 'sharon',
          body: 'CST asked us to keep volunteer names off public threads. Note here is internal only.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 4,
        },
      ],
    },
    {
      seedKey: 'enrich-cst-incident-log-quarterly',
      groupSlug: 'cst-link',
      columnOrdinal: 3,
      title: 'Q1 incident-log digest — internal only',
      body: 'CST shared the Q1 anonymised incident log for our region. Write a one-page internal digest for GPS-Action coordinators only. Done — circulated.',
      urgency: false,
      status: 'done',
      assigneeKey: 'sharon',
      followerKeys: ['bette', 'cary'],
      createdByKey: 'sharon',
      createdDaysAgo: 30,
      resolution: 'approved',
      resolvedByKey: 'bette',
      positionWithinColumn: 0,
      threadEntries: [
        {
          authorKey: 'sharon',
          body: 'Digest sent to coordinators by encrypted attachment. Original log returned to CST per data-handling agreement.',
          kind: 'note',
          audience: 'reviewers',
          daysAgo: 23,
        },
        {
          authorKey: 'bette',
          body: 'Read. Closing.',
          kind: 'comment',
          daysAgo: 22,
        },
      ],
    },
  ];

  // ── Seed enrichment tickets ────────────────────────────────────────
  let enrichTicketsCreated = 0;
  let enrichAssignmentsActive = 0;
  let enrichAssignmentsHistorical = 0;
  let enrichSharesActive = 0;
  let enrichSharesDeleted = 0;
  let enrichCommentsCreated = 0;
  let enrichNotesCreated = 0;
  let enrichSubscriptionsCreated = 0;

  for (const t of ENRICH_TICKETS) {
    const groupId = groupIds[t.groupSlug];
    if (!groupId) continue;
    const requestId = seedUuid('enrich-ticket', t.seedKey);
    const isBacklog = t.columnOrdinal === -1;
    const status = t.status ?? (isBacklog ? 'backlog' : 'active');
    const columnId = isBacklog
      ? null
      : seedUuid('board-column', `${t.groupSlug}:${t.columnOrdinal}`);
    const boardPosition = isBacklog ? null : (t.positionWithinColumn + 1) * 1024;

    const createdByUserId = userIds[t.createdByKey]!;
    const createdAt = daysAgo(t.createdDaysAgo);

    // Compute lastActivityAt from the most recent thread entry / share /
    // assignment change so the staggering on the board is realistic.
    const candidateActivityDays: number[] = [t.createdDaysAgo];
    if (t.threadEntries) {
      for (const e of t.threadEntries) candidateActivityDays.push(e.daysAgo);
    }
    if (t.shares) {
      for (const s of t.shares) candidateActivityDays.push(s.sharedDaysAgo);
    }
    if (t.unshares) {
      for (const u of t.unshares) candidateActivityDays.push(u.unsharedDaysAgo);
    }
    if (t.previousAssigneeKey) candidateActivityDays.push(3); // reassignment ~3 days ago
    const minDays = Math.min(...candidateActivityDays);
    const lastActivityAt = daysAgo(minDays);

    const resolvedByUserId =
      status === 'done' && t.resolvedByKey ? (userIds[t.resolvedByKey] ?? null) : null;
    const resolvedAt = status === 'done' ? daysAgo(Math.max(0, minDays - 1)) : null;

    const existing = await prisma.request.findUnique({ where: { id: requestId } });
    if (!existing) {
      await prisma.request.create({
        data: {
          id: requestId,
          type: null,
          status,
          priority: t.urgency ? 'urgent' : 'normal',
          title: t.title,
          body: t.body,
          context: {},
          urgency: t.urgency,
          urgencyExpiresAt: t.urgency ? new Date(now.getTime() + 4 * hourMs) : null,
          columnId,
          boardPosition,
          createdAt,
          createdByUserId,
          lastActivityAt,
          resolvedByUserId,
          resolvedAt,
          resolution: status === 'done' ? (t.resolution ?? 'approved') : null,
        },
      });

      // Originating RequestGroup row.
      const originatingRgId = seedUuid('enrich-rg-orig', t.seedKey);
      await prisma.requestGroup.create({
        data: {
          id: originatingRgId,
          requestId,
          groupId,
          origin: 'originating',
          columnId,
          boardPosition,
          isUrgent: t.urgency,
          sharedByUserId: createdByUserId,
          createdAt,
        },
      });

      // Cross-team active shares.
      if (t.shares) {
        for (const s of t.shares) {
          const targetGroupId = groupIds[s.groupSlug];
          if (!targetGroupId) continue;
          const rgId = seedUuid('enrich-rg-share', `${t.seedKey}->${s.groupSlug}`);
          // Place the share on the target's first active column (ordinal
          // 1 = Preparation) so per-team kanban placement is plausible.
          const targetColumnId = seedUuid('board-column', `${s.groupSlug}:1`);
          await prisma.requestGroup.create({
            data: {
              id: rgId,
              requestId,
              groupId: targetGroupId,
              origin: 'workflow_share',
              columnId: targetColumnId,
              boardPosition: 1024,
              isUrgent: t.urgency,
              sharedByUserId: userIds[s.sharedByKey] ?? createdByUserId,
              createdAt: daysAgo(s.sharedDaysAgo),
              updatedAt: daysAgo(s.sharedDaysAgo),
            },
          });
          enrichSharesActive++;
        }
      }

      // Prior shares that were unshared (deletedAt set).
      if (t.unshares) {
        for (const u of t.unshares) {
          const targetGroupId = groupIds[u.groupSlug];
          if (!targetGroupId) continue;
          const rgId = seedUuid('enrich-rg-unshare', `${t.seedKey}->${u.groupSlug}`);
          await prisma.requestGroup.create({
            data: {
              id: rgId,
              requestId,
              groupId: targetGroupId,
              origin: 'ad_hoc_share',
              columnId: null,
              boardPosition: null,
              isUrgent: false,
              sharedByUserId: userIds[u.sharedByKey] ?? createdByUserId,
              createdAt: daysAgo(u.sharedDaysAgo),
              updatedAt: daysAgo(u.unsharedDaysAgo),
              deletedAt: daysAgo(u.unsharedDaysAgo),
            },
          });
          enrichSharesDeleted++;
        }
      }

      // Re-assignment history — prior assignee soft-removed ~3 days ago.
      if (t.previousAssigneeKey && userIds[t.previousAssigneeKey]) {
        const prevAssignmentId = seedUuid(
          'enrich-assign-prev',
          `${t.seedKey}:${t.previousAssigneeKey}`,
        );
        await prisma.assignment.create({
          data: {
            id: prevAssignmentId,
            requestId,
            userId: userIds[t.previousAssigneeKey]!,
            assignedAt: daysAgo(t.createdDaysAgo - 1),
            unassignedAt: daysAgo(3),
          },
        });
        enrichAssignmentsHistorical++;

        // Audit row — assignment_unassigned (reassignment narrative).
        await prisma.auditLog.create({
          data: {
            action: 'assignment_unassigned',
            entityType: 'assignment',
            entityId: prevAssignmentId,
            userId: userIds[t.previousAssigneeKey]!,
            targetUserId: userIds[t.previousAssigneeKey]!,
            changes: { requestId },
            createdAt: daysAgo(3),
          },
        });
      }

      // Current assignee.
      if (t.assigneeKey && userIds[t.assigneeKey]) {
        const assignmentId = seedUuid('enrich-assign-current', `${t.seedKey}:${t.assigneeKey}`);
        await prisma.assignment.create({
          data: {
            id: assignmentId,
            requestId,
            userId: userIds[t.assigneeKey]!,
            assignedAt: t.previousAssigneeKey
              ? daysAgo(2)
              : daysAgo(Math.max(0, t.createdDaysAgo - 1)),
          },
        });
        enrichAssignmentsActive++;

        // Auto-subscribe the current assignee.
        const subId = seedUuid('enrich-sub-auto', `${t.seedKey}:${t.assigneeKey}`);
        await prisma.requestSubscription.create({
          data: {
            id: subId,
            requestId,
            userId: userIds[t.assigneeKey]!,
            source: 'auto_assignee',
          },
        });
        enrichSubscriptionsCreated++;

        await prisma.auditLog.create({
          data: {
            action: 'assignment_created',
            entityType: 'assignment',
            entityId: assignmentId,
            userId: userIds[t.assigneeKey]!,
            targetUserId: userIds[t.assigneeKey]!,
            changes: { requestId },
            createdAt: t.previousAssigneeKey
              ? daysAgo(2)
              : daysAgo(Math.max(0, t.createdDaysAgo - 1)),
          },
        });
      }

      // Explicit follower subscriptions (skip whoever is already
      // auto-subscribed as the assignee).
      if (t.followerKeys) {
        for (const fk of t.followerKeys) {
          if (fk === t.assigneeKey) continue;
          const followerId = userIds[fk];
          if (!followerId) continue;
          const subId = seedUuid('enrich-sub-explicit', `${t.seedKey}:${fk}`);
          await prisma.requestSubscription.create({
            data: {
              id: subId,
              requestId,
              userId: followerId,
              source: 'explicit',
            },
          });
          enrichSubscriptionsCreated++;
        }
      }

      // Thread entries — comments + notes.
      if (t.threadEntries) {
        for (let i = 0; i < t.threadEntries.length; i += 1) {
          const e = t.threadEntries[i]!;
          const authorId = userIds[e.authorKey];
          if (!authorId) continue;
          const commentId = seedUuid('enrich-comment', `${t.seedKey}:${i}:${e.authorKey}`);
          await prisma.comment.create({
            data: {
              id: commentId,
              requestId,
              authorId,
              body: e.body,
              kind: e.kind,
              source: 'human',
              audience: e.audience ?? (e.kind === 'note' ? 'reviewers' : 'all'),
              createdAt: daysAgo(e.daysAgo),
            },
          });
          if (e.kind === 'note') enrichNotesCreated++;
          else enrichCommentsCreated++;
        }
      }

      enrichTicketsCreated++;
    }
  }
  console.warn(
    `  ✓ Phase-2 kanban tickets seeded (${enrichTicketsCreated} new) — ` +
      `assignments: ${enrichAssignmentsActive} active + ${enrichAssignmentsHistorical} history; ` +
      `shares: ${enrichSharesActive} active + ${enrichSharesDeleted} unshared; ` +
      `comments: ${enrichCommentsCreated}, notes: ${enrichNotesCreated}; ` +
      `subscriptions: ${enrichSubscriptionsCreated}`,
  );

  // ── Reactions on existing seeded posts ─────────────────────────────
  // Every active post gets 4–9 reactions of varied emoji from at least
  // 3 different users. Idempotent via the (userId, targetType, targetId,
  // emoji) unique constraint — re-running the seed re-attempts the same
  // upserts without duplicating.
  const allActivePosts = await prisma.post.findMany({
    where: { deletedAt: null },
    select: { id: true, createdAt: true },
  });
  const reactionUserKeys = [
    'sharon',
    'rachel',
    'jonathan',
    'naomi',
    'david',
    'esther',
    'eddie',
    'cary',
    'bette',
    'humphrey',
    'ingrid',
    'maya',
  ] as const;
  const reactionEmojis = [
    'heart',
    'pray',
    'strong',
    'target',
    'sparkle',
    'thumbsup',
    'candle',
    'sad',
  ] as const;

  let enrichReactionsCreated = 0;
  for (let pIdx = 0; pIdx < allActivePosts.length; pIdx += 1) {
    const post = allActivePosts[pIdx]!;
    // Vary count per post: 4..9. Driven by post index for determinism.
    const count = 4 + (pIdx % 6);
    for (let r = 0; r < count; r += 1) {
      const reactor = reactionUserKeys[(pIdx * 3 + r) % reactionUserKeys.length]!;
      const emoji = reactionEmojis[(pIdx + r * 2) % reactionEmojis.length]!;
      const reactorId = userIds[reactor];
      if (!reactorId) continue;
      try {
        await prisma.reaction.upsert({
          where: {
            one_emoji_per_user_per_target: {
              userId: reactorId,
              targetType: 'post',
              targetId: post.id,
              emoji,
            },
          },
          create: {
            userId: reactorId,
            targetType: 'post',
            targetId: post.id,
            postId: post.id,
            emoji,
            // Reactions land staggered after the post creation.
            createdAt: new Date(post.createdAt.getTime() + (r + 1) * hourMs),
          },
          update: {},
        });
        enrichReactionsCreated += 1;
      } catch {
        // If the unique constraint composite name differs across Prisma
        // generator versions, fall through silently — re-running is fine.
      }
    }
  }
  console.warn(
    `  ✓ Phase-2 reactions seeded (${enrichReactionsCreated} attempted across ${allActivePosts.length} posts)`,
  );

  // ── Threaded conversations on a few existing posts ─────────────────
  // Layer 4–5 back-and-forth replies onto four posts with deterministic
  // ids so the demo's "comments on a post" surface looks lived-in.
  interface ThreadEntry {
    seedKey: string;
    postSeedKey: string;
    entries: Array<{ authorKey: string; body: string; minutesOffset: number }>;
  }
  const POST_THREADS: ThreadEntry[] = [
    {
      seedKey: 'thread-mp-letter',
      postSeedKey: 'mp-letter-antisemitism',
      entries: [
        {
          authorKey: 'rachel',
          body: 'Sent. My MP is on a select committee that handles this — worth saying so in the personalisation field.',
          minutesOffset: 60,
        },
        {
          authorKey: 'naomi',
          body: 'Useful tip — added that to the template note.',
          minutesOffset: 95,
        },
        {
          authorKey: 'jonathan',
          body: "Quick question: does it matter whether I send from a constituency address or my parents' address (where I am registered)?",
          minutesOffset: 180,
        },
        {
          authorKey: 'ingrid',
          body: "Constituency address every time — that is what your MP's case-load filter is keyed on.",
          minutesOffset: 220,
        },
        {
          authorKey: 'jonathan',
          body: 'Got it, thank you. Resending.',
          minutesOffset: 260,
        },
      ],
    },
    {
      seedKey: 'thread-bbc-complaint',
      postSeedKey: 'bbc-complaint-template',
      entries: [
        {
          authorKey: 'sharon',
          body: 'Filed mine. Took 2 minutes. The BBC complaint form has a "pattern" tickbox now — useful.',
          minutesOffset: 45,
        },
        {
          authorKey: 'esther',
          body: 'I noticed that too. Helpful change.',
          minutesOffset: 110,
        },
        {
          authorKey: 'humphrey',
          body: 'Worth adding to the template that the complainant should attach the previous-quarter incident references — increases the pattern signal.',
          minutesOffset: 175,
        },
        {
          authorKey: 'cary',
          body: 'Good point. Will add that note to the next iteration of the complaint pack.',
          minutesOffset: 240,
        },
      ],
    },
    {
      seedKey: 'thread-yom-hashoah',
      postSeedKey: 'yom-hashoah-reflection',
      entries: [
        {
          authorKey: 'naomi',
          body: 'Thank you Bette 🕯️',
          minutesOffset: 90,
        },
        {
          authorKey: 'esther',
          body: 'My grandmother lit the candle this morning before sunrise. She is 91. We sat with her in silence.',
          minutesOffset: 150,
        },
        {
          authorKey: 'sharon',
          body: '🕯️',
          minutesOffset: 200,
        },
        {
          authorKey: 'rachel',
          body: 'Holding everyone in this thread today.',
          minutesOffset: 240,
        },
      ],
    },
    {
      seedKey: 'thread-new-member-intro',
      postSeedKey: 'new-member-intro',
      entries: [
        {
          authorKey: 'david',
          body: 'Hi all — student in Manchester, joined after the JC piece. Quietly here to learn before doing.',
          minutesOffset: 120,
        },
        {
          authorKey: 'sharon',
          body: 'Welcome David! Lurking is absolutely the right place to start. Glad you are here.',
          minutesOffset: 180,
        },
        {
          authorKey: 'esther',
          body: 'New too — joined this week. North London. Thanks for the warm tone of this group, very different from where I was before.',
          minutesOffset: 240,
        },
        {
          authorKey: 'naomi',
          body: 'Welcome both. If you ever want to chat 1:1 to find your fit, drop me a DM.',
          minutesOffset: 290,
        },
        {
          authorKey: 'jonathan',
          body: 'Welcome 💕',
          minutesOffset: 350,
        },
      ],
    },
  ];

  let enrichPostThreadCommentsCreated = 0;
  for (const th of POST_THREADS) {
    const postId = seedUuid('post', th.postSeedKey);
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, createdAt: true },
    });
    if (!post) continue;
    for (let i = 0; i < th.entries.length; i += 1) {
      const e = th.entries[i]!;
      const authorId = userIds[e.authorKey];
      if (!authorId) continue;
      const commentId = seedUuid('enrich-post-thread', `${th.seedKey}:${i}:${e.authorKey}`);
      const exists = await prisma.comment.findUnique({ where: { id: commentId } });
      if (exists) continue;
      await prisma.comment.create({
        data: {
          id: commentId,
          postId: post.id,
          authorId,
          body: e.body,
          createdAt: new Date(post.createdAt.getTime() + e.minutesOffset * 60 * 1000),
        },
      });
      enrichPostThreadCommentsCreated += 1;
    }
  }
  console.warn(
    `  ✓ Threaded post conversations seeded (${enrichPostThreadCommentsCreated} new across ${POST_THREADS.length} posts)`,
  );

  // ── Notifications ──────────────────────────────────────────────────
  // 8 realistic notifications across users, mixed read/unread + lifecycle.
  // Each row is keyed by a deterministic seedUuid so re-runs are no-ops.
  interface SeedNotification {
    seedKey: string;
    recipientKey: string;
    fromKey: string | null;
    type:
      | 'request_status_changed'
      | 'request_mention'
      | 'request_resolved'
      | 'request_published'
      | 'request_archived';
    requestSeedKey: string | null;
    message: string;
    daysAgo: number;
    read: boolean;
    lifecycle: 'new' | 'acknowledged' | 'dismissed';
    reasonKind?:
      | 'assignment'
      | 'mention'
      | 'status_change'
      | 'comment'
      | 'urgent_flip'
      | 'team_blast';
  }

  const SEED_NOTIFICATIONS: SeedNotification[] = [
    {
      seedKey: 'notif-rachel-reassigned',
      recipientKey: 'rachel',
      fromKey: 'naomi',
      type: 'request_status_changed',
      requestSeedKey: 'enrich-writers-conservative-letters',
      message: 'Naomi reassigned the Conservative-leaning publication ticket to you.',
      daysAgo: 3,
      read: false,
      lifecycle: 'new',
      reasonKind: 'assignment',
    },
    {
      seedKey: 'notif-sharon-shul-share',
      recipientKey: 'sharon',
      fromKey: 'rachel',
      type: 'request_mention',
      requestSeedKey: 'enrich-rapid-coordinated-statement',
      message: 'Rachel mentioned you on the joint statement ticket.',
      daysAgo: 1,
      read: false,
      lifecycle: 'new',
      reasonKind: 'mention',
    },
    {
      seedKey: 'notif-cary-bbc-resolved',
      recipientKey: 'cary',
      fromKey: 'cary',
      type: 'request_resolved',
      requestSeedKey: 'enrich-rapid-bbc-followup-done',
      message: 'You resolved the BBC week-2 ratchet ticket.',
      daysAgo: 9,
      read: true,
      lifecycle: 'acknowledged',
      reasonKind: 'status_change',
    },
    {
      seedKey: 'notif-bette-comment',
      recipientKey: 'bette',
      fromKey: 'esther',
      type: 'request_mention',
      requestSeedKey: 'enrich-rapid-coordinated-statement',
      message: 'Esther commented on a thread you follow.',
      daysAgo: 1,
      read: false,
      lifecycle: 'new',
      reasonKind: 'comment',
    },
    {
      seedKey: 'notif-eddie-share',
      recipientKey: 'eddie',
      fromKey: 'eddie',
      type: 'request_status_changed',
      requestSeedKey: 'enrich-manchester-volunteer-rota',
      message: 'You marked the May volunteer rota urgent.',
      daysAgo: 3,
      read: true,
      lifecycle: 'acknowledged',
      reasonKind: 'urgent_flip',
    },
    {
      seedKey: 'notif-david-roundtable',
      recipientKey: 'david',
      fromKey: 'jonathan',
      type: 'request_status_changed',
      requestSeedKey: 'enrich-students-russell-roundtable',
      message: 'Jonathan assigned you to the Russell-Group roundtable.',
      daysAgo: 8,
      read: true,
      lifecycle: 'acknowledged',
      reasonKind: 'assignment',
    },
    {
      seedKey: 'notif-naomi-team-blast',
      recipientKey: 'naomi',
      fromKey: null,
      type: 'request_published',
      requestSeedKey: 'enrich-nl-letter-writing-evening',
      message: 'Letter-writing Wednesday — sign-up open.',
      daysAgo: 14,
      read: false,
      lifecycle: 'new',
      reasonKind: 'team_blast',
    },
    {
      seedKey: 'notif-maya-cst-share',
      recipientKey: 'maya',
      fromKey: 'cary',
      type: 'request_mention',
      requestSeedKey: 'enrich-cst-shabbat-roster',
      message: 'Cary shared the Shabbat steward roster with Rapid Response.',
      daysAgo: 5,
      read: false,
      lifecycle: 'new',
      reasonKind: 'team_blast',
    },
  ];

  let enrichNotificationsCreated = 0;
  for (const n of SEED_NOTIFICATIONS) {
    const notifId = seedUuid('enrich-notif', n.seedKey);
    const exists = await prisma.notification.findUnique({ where: { id: notifId } });
    if (exists) continue;
    const recipientId = userIds[n.recipientKey];
    if (!recipientId) continue;
    const fromId = n.fromKey ? (userIds[n.fromKey] ?? null) : null;
    const requestId = n.requestSeedKey ? seedUuid('enrich-ticket', n.requestSeedKey) : null;
    // If the notification references an enrichment ticket, ensure the
    // request actually exists (it might not on a partial-seed db).
    let resolvedRequestId: string | null = null;
    if (requestId) {
      const reqRow = await prisma.request.findUnique({
        where: { id: requestId },
        select: { id: true },
      });
      resolvedRequestId = reqRow?.id ?? null;
    }
    const createdAt = daysAgo(n.daysAgo);
    await prisma.notification.create({
      data: {
        id: notifId,
        recipientUserId: recipientId,
        fromUserId: fromId,
        type: n.type,
        requestId: resolvedRequestId,
        message: n.message,
        createdAt,
        readAt: n.read ? new Date(createdAt.getTime() + 6 * hourMs) : null,
        lifecycle: n.lifecycle,
        reasonKind: n.reasonKind ?? null,
      },
    });
    enrichNotificationsCreated += 1;
  }
  console.warn(`  ✓ Phase-2 notifications seeded (${enrichNotificationsCreated} new)`);

  // ── Additional AuditLog rows ───────────────────────────────────────
  // Cover the action codes that surface in admin audit views: shares,
  // unshares, ticket title edits, request_status_changed, request_deleted
  // (soft, on a tombstone id only). All idempotent — keyed by the
  // composite (entityType, entityId, action, createdAt) is not unique
  // in Prisma, so we use deterministic ids on synthetic rows that we
  // insert via auditLog.create with a stable id. AuditLog has no
  // upsert by id without findFirst — we guard with findUnique.
  // `changes` typed as an InputJsonValue-compatible literal: the
  // Prisma-generated type rejects `Record<string, unknown>` because
  // unknown is not narrowable to JSON-allowed primitives.
  type AuditChangeValue = string | number | boolean | null;
  interface ExtraAudit {
    seedKey: string;
    action: string;
    entityType: string;
    entityIdSeed: string;
    actorKey: string;
    targetKey?: string;
    daysAgo: number;
    changes?: Record<string, AuditChangeValue>;
  }
  const EXTRA_AUDITS: ExtraAudit[] = [
    {
      seedKey: 'audit-rg-shared-1',
      action: 'request_group_shared',
      entityType: 'request',
      entityIdSeed: 'enrich-writers-conservative-letters',
      actorKey: 'rachel',
      daysAgo: 4,
      changes: { targetGroupSlug: 'north-london' },
    },
    {
      seedKey: 'audit-rg-shared-2',
      action: 'request_group_shared',
      entityType: 'request',
      entityIdSeed: 'enrich-rapid-coordinated-statement',
      actorKey: 'rachel',
      daysAgo: 2,
      changes: { targetGroupSlug: 'north-london' },
    },
    {
      seedKey: 'audit-rg-unshared-1',
      action: 'request_group_unshared',
      entityType: 'request',
      entityIdSeed: 'enrich-manchester-museum-installation',
      actorKey: 'humphrey',
      daysAgo: 14,
      changes: { targetGroupSlug: 'rapid-response' },
    },
    {
      seedKey: 'audit-rg-unshared-2',
      action: 'request_group_unshared',
      entityType: 'request',
      entityIdSeed: 'enrich-nl-barnet-gallery',
      actorKey: 'rachel',
      daysAgo: 4,
      changes: { targetGroupSlug: 'manchester' },
    },
    {
      seedKey: 'audit-title-edit-1',
      action: 'ticket_title_edited',
      entityType: 'request',
      entityIdSeed: 'enrich-manchester-volunteer-rota',
      actorKey: 'eddie',
      daysAgo: 3,
      changes: { from: 'Volunteer rota — May', to: 'Volunteer rota — May letter campaign' },
    },
    {
      seedKey: 'audit-status-change-1',
      action: 'request_status_changed',
      entityType: 'request',
      entityIdSeed: 'enrich-writers-baddiel-followup',
      actorKey: 'bette',
      daysAgo: 11,
      changes: { from: 'active', to: 'done' },
    },
    {
      seedKey: 'audit-status-change-2',
      action: 'request_status_changed',
      entityType: 'request',
      entityIdSeed: 'enrich-rapid-bbc-followup-done',
      actorKey: 'cary',
      daysAgo: 9,
      changes: { from: 'active', to: 'done' },
    },
    {
      seedKey: 'audit-status-change-3',
      action: 'request_status_changed',
      entityType: 'request',
      entityIdSeed: 'enrich-cst-incident-log-quarterly',
      actorKey: 'bette',
      daysAgo: 22,
      changes: { from: 'active', to: 'done' },
    },
    {
      seedKey: 'audit-urgency-1',
      action: 'request_urgency_changed',
      entityType: 'request',
      entityIdSeed: 'enrich-manchester-volunteer-rota',
      actorKey: 'eddie',
      daysAgo: 3,
      changes: { from: false, to: true },
    },
    {
      seedKey: 'audit-urgency-2',
      action: 'request_urgency_changed',
      entityType: 'request',
      entityIdSeed: 'enrich-nl-barnet-gallery',
      actorKey: 'rachel',
      daysAgo: 4,
      changes: { from: false, to: true },
    },
    {
      seedKey: 'audit-board-card-moved-1',
      action: 'board_card_moved',
      entityType: 'request',
      entityIdSeed: 'enrich-writers-conservative-letters',
      actorKey: 'rachel',
      daysAgo: 4,
      changes: { fromOrdinal: 0, toOrdinal: 1 },
    },
    {
      seedKey: 'audit-board-card-moved-2',
      action: 'board_card_moved',
      entityType: 'request',
      entityIdSeed: 'enrich-rapid-channel4-followup',
      actorKey: 'maya',
      daysAgo: 5,
      changes: { fromOrdinal: 0, toOrdinal: 1 },
    },
    {
      seedKey: 'audit-comment-add-1',
      action: 'kanban_comment.add',
      entityType: 'comment',
      entityIdSeed: 'enrich-comment-naomi-conservative-0',
      actorKey: 'naomi',
      daysAgo: 7,
      changes: { requestSeedKey: 'enrich-writers-conservative-letters' },
    },
    {
      seedKey: 'audit-note-add-1',
      action: 'kanban_note.add',
      entityType: 'comment',
      entityIdSeed: 'enrich-comment-rachel-conservative-2',
      actorKey: 'rachel',
      daysAgo: 3,
      changes: { audience: 'reviewers' },
    },
    {
      seedKey: 'audit-note-add-2',
      action: 'kanban_note.add',
      entityType: 'comment',
      entityIdSeed: 'enrich-comment-sharon-shabbat-2',
      actorKey: 'sharon',
      daysAgo: 4,
      changes: { audience: 'reviewers' },
    },
  ];
  let enrichAuditsCreated = 0;
  for (const a of EXTRA_AUDITS) {
    const auditId = seedUuid('enrich-audit', a.seedKey);
    const exists = await prisma.auditLog.findUnique({ where: { id: auditId } });
    if (exists) continue;
    const actorId = userIds[a.actorKey];
    if (!actorId) continue;
    // Resolve entity id — entityType=request → enrich-ticket seedUuid;
    // entityType=comment → use entityIdSeed verbatim as the seed input
    // (synthetic, OK for audit immutability since downstream does not
    // FK-resolve audit rows).
    const entityId =
      a.entityType === 'request'
        ? seedUuid('enrich-ticket', a.entityIdSeed)
        : seedUuid('enrich-comment', a.entityIdSeed);
    await prisma.auditLog.create({
      data: {
        id: auditId,
        action: a.action,
        entityType: a.entityType,
        entityId,
        userId: actorId,
        targetUserId: a.targetKey ? (userIds[a.targetKey] ?? null) : null,
        changes: a.changes ?? {},
        createdAt: daysAgo(a.daysAgo),
      },
    });
    enrichAuditsCreated += 1;
  }
  console.warn(`  ✓ Phase-2 audit-log entries seeded (${enrichAuditsCreated} new)`);

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
