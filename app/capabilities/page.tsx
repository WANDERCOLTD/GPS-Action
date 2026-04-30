/**
 * @build-unit bu-capabilities-mockup
 * @spec docs/feature-spec/GPS_Software_Requirements_v1.1.docx
 * @spec docs/build/srs-coverage.md
 *
 * Capabilities mockup — a marketing-style "what GPS Action will be"
 * landing page that maps every SRS §1–§19 module onto a tile.
 * The only real link is the "Open the App" CTA → /feed. Every other
 * tile is a non-interactive placeholder showing SRS-verbatim wording
 * + a status badge sourced from the codebase coverage audit.
 *
 * Server component, no auth gate. Public showcase surface.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Antenna,
  ArrowRight,
  AtSign,
  BarChart3,
  BookMarked,
  BookOpen,
  Boxes,
  Building2,
  Calendar,
  CalendarSearch,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  CircleDollarSign,
  Cloud,
  Database,
  Eye,
  FileSignature,
  FileSpreadsheet,
  FolderLock,
  Gavel,
  GitBranch,
  Globe,
  GraduationCap,
  Hammer,
  HeartHandshake,
  IdCard,
  Inbox,
  KeyRound,
  Languages,
  Lock,
  Mail,
  Megaphone,
  Network,
  Newspaper,
  PenLine,
  PiggyBank,
  Plug,
  Radar,
  Radio,
  Search,
  Send,
  Server,
  Share2,
  ShieldCheck,
  Sparkles,
  Tv,
  UserCheck,
  UserCog,
  Users,
  Video,
  Vote,
  Workflow,
  type LucideProps,
} from 'lucide-react';
import type { ReactElement } from 'react';

export const metadata = {
  title: 'Capabilities — GPS Action',
  description:
    'Every module in the GPS Software Requirements Spec (v1.1), mapped to current build status.',
};

type Status = 'shipped' | 'partial' | 'future-build' | 'future-integration' | 'not-done';

interface Tile {
  icon: LucideIcon;
  title: string;
  ref: string;
  status: Status;
  note?: string;
}

interface Section {
  kicker: string;
  title: string;
  ref: string;
  blurb: string;
  urgent?: boolean;
  tiles: Tile[];
}

const STATUS_LABEL: Record<Status, string> = {
  shipped: 'Shipped',
  partial: 'Partial',
  'future-build': 'Future build',
  'future-integration': 'Future integration',
  'not-done': 'Not done',
};

const STATUS_CHIP_CLASS: Record<Status, string> = {
  shipped: 'gps-chip--success',
  partial: 'gps-chip--warning',
  'future-build': 'gps-chip--info',
  'future-integration': 'gps-chip--cultural',
  'not-done': 'gps-chip',
};

function StatusIcon({ status, ...props }: { status: Status } & LucideProps): ReactElement {
  switch (status) {
    case 'shipped':
      return <CheckCircle2 {...props} />;
    case 'partial':
      return <CircleDashed {...props} />;
    case 'future-build':
      return <Hammer {...props} />;
    case 'future-integration':
      return <Plug {...props} />;
    case 'not-done':
      return <CircleSlash {...props} />;
  }
}

const SECTIONS: Section[] = [
  {
    kicker: 'Module 1',
    title: 'Intelligence Gathering & Monitoring',
    ref: '§4',
    blurb:
      'Continuous monitoring of councils, press, unions, charities, education, public sector, parties, events, socials, video and adversaries.',
    tiles: [
      { icon: Search, title: 'Keyword Manager', ref: '§4.1', status: 'future-build' },
      { icon: IdCard, title: 'Entity Tracker', ref: '§4.1', status: 'future-build' },
      { icon: Video, title: 'YouTube Channel Ingest', ref: '§4.2', status: 'future-integration' },
      {
        icon: Languages,
        title: 'Whisper Transcription',
        ref: '§4.2',
        status: 'future-integration',
      },
      { icon: Megaphone, title: 'Alert Feed', ref: '§4.3', status: 'future-build' },
      {
        icon: Inbox,
        title: 'Unassigned Claim Queue',
        ref: '§4.3',
        status: 'shipped',
        note: 'claim-and-lease (D040)',
      },
    ],
  },
  {
    kicker: 'Module 2',
    title: 'Task & Campaign Management',
    ref: '§5',
    blurb: 'Monday-style task system tailored to GPS, with AI-assisted response drafting.',
    tiles: [
      { icon: Workflow, title: 'Task Board', ref: '§5.1', status: 'partial' },
      { icon: Sparkles, title: 'AI Response Suggester', ref: '§5.2', status: 'future-build' },
      { icon: Sparkles, title: 'AI Recipient Identifier', ref: '§5.2', status: 'future-build' },
      {
        icon: Mail,
        title: 'Activist Mailer Export',
        ref: '§5.3',
        status: 'shipped',
        note: '"Send email →" CTA',
      },
      { icon: Activity, title: 'Primary + Secondary Actions', ref: '§19.6', status: 'partial' },
    ],
  },
  {
    kicker: 'Module 3',
    title: 'Volunteer & Contact CRM',
    ref: '§6',
    blurb:
      'Volunteer profiles, third-party contacts (journalists, politicians, councillors, event organisers, activists) and organisation records.',
    tiles: [
      { icon: Users, title: 'Volunteer Directory', ref: '§6.1', status: 'partial' },
      { icon: UserCheck, title: 'Public Sign-Up Form', ref: '§6.1', status: 'future-build' },
      { icon: IdCard, title: 'Third-Party Contacts', ref: '§6.2', status: 'not-done' },
      { icon: Building2, title: 'Organisation Records', ref: '§6.2', status: 'not-done' },
      { icon: UserCog, title: 'Display-Name Policy', ref: '§19.7', status: 'not-done' },
    ],
  },
  {
    kicker: 'Module 4',
    title: 'Petitions',
    ref: '§7',
    blurb: 'Internal + external petitions with AI-suggested send-time and audience targeting.',
    tiles: [
      { icon: PenLine, title: 'Internal Petition Builder', ref: '§7', status: 'future-build' },
      {
        icon: FileSignature,
        title: 'External Petition Sync',
        ref: '§7',
        status: 'future-integration',
        note: 'Change.org / 38 Degrees',
      },
      { icon: Sparkles, title: 'AI Petition Suggestions', ref: '§7', status: 'future-build' },
      {
        icon: Sparkles,
        title: 'Send-Time + Audience Optimiser',
        ref: '§7',
        status: 'future-build',
      },
    ],
  },
  {
    kicker: 'Module 5',
    title: 'Content Library',
    ref: '§8',
    blurb: 'MFA-protected secure repository for fact-sheets, research, toolkits, memes and media.',
    tiles: [
      {
        icon: BookOpen,
        title: 'Fact-Sheets / Research / Toolkits',
        ref: '§8',
        status: 'future-build',
      },
      { icon: FolderLock, title: 'Per-Asset Access Control', ref: '§8', status: 'not-done' },
      { icon: BookMarked, title: 'User-Submitted Content', ref: '§8', status: 'partial' },
      { icon: BookMarked, title: 'Training-Topic Submissions', ref: '§8', status: 'not-done' },
      { icon: Inbox, title: 'Incident Reports', ref: '§8', status: 'partial' },
    ],
  },
  {
    kicker: 'Module 6',
    title: 'Activist Calendar',
    ref: '§9',
    blurb: 'Shared calendar of GPS, concerning, neutral and deadline events with auto-detection.',
    tiles: [
      { icon: Calendar, title: 'Shared Calendar', ref: '§9', status: 'not-done' },
      {
        icon: CalendarSearch,
        title: 'Event Auto-Detection',
        ref: '§9',
        status: 'future-integration',
        note: 'Eventbrite + social',
      },
      { icon: Megaphone, title: 'Concerning-Event Alerts', ref: '§9', status: 'not-done' },
    ],
  },
  {
    kicker: 'Module 7',
    title: 'Media & Broadcast Monitoring',
    ref: '§10',
    blurb: 'Talk-radio call-in alerts, newspaper + RSS scraping, newswriters digest.',
    tiles: [
      {
        icon: Antenna,
        title: 'Talk-Radio Call-In Briefings',
        ref: '§10.1',
        status: 'future-build',
      },
      {
        icon: Radio,
        title: 'Real-Time Stream Transcription',
        ref: '§10.1',
        status: 'future-integration',
      },
      { icon: Tv, title: 'Manual Broadcast Logging', ref: '§10.1', status: 'future-build' },
      { icon: Megaphone, title: 'Auto-Complaints', ref: '§10.1', status: 'future-build' },
      { icon: Newspaper, title: 'Newswriters Digest', ref: '§10.2', status: 'future-build' },
      { icon: GitBranch, title: 'Cross-AG Alert Hub', ref: '§10.2', status: 'partial' },
    ],
  },
  {
    kicker: 'Module 8',
    title: 'Social Media Tools',
    ref: '§11',
    blurb: 'AI proactive-post suggestions, scheduled publishing, antisemitic-content reporting.',
    tiles: [
      { icon: Sparkles, title: 'AI Proactive-Post Suggester', ref: '§11', status: 'future-build' },
      { icon: Send, title: 'Schedule + Publish', ref: '§11', status: 'future-integration' },
      { icon: AtSign, title: 'Antisemitic-Content Reporting', ref: '§11', status: 'future-build' },
      {
        icon: Share2,
        title: 'Send via WhatsApp',
        ref: '§19.8',
        status: 'shipped',
        note: 'wa.me deep link (D016)',
      },
    ],
  },
  {
    kicker: 'Module 9',
    title: 'Fundraising',
    ref: '§12',
    blurb:
      'Fundraising campaigns with embeddable donation buttons and AI-suggested donor segments.',
    tiles: [
      { icon: HeartHandshake, title: 'Fundraising Campaigns', ref: '§12', status: 'not-done' },
      {
        icon: CircleDollarSign,
        title: 'Embeddable Donation Buttons',
        ref: '§12',
        status: 'future-integration',
      },
      { icon: PiggyBank, title: 'AI Donor-Segment Suggester', ref: '§12', status: 'future-build' },
    ],
  },
  {
    kicker: 'Module 10',
    title: 'Workshops & Training',
    ref: '§13',
    blurb: 'Workshop event publishing, region-filtered alerts, in-platform sign-up.',
    tiles: [
      { icon: GraduationCap, title: 'Workshop Events', ref: '§13', status: 'not-done' },
      { icon: Megaphone, title: 'Region-Filtered Workshop Alerts', ref: '§13', status: 'not-done' },
      { icon: UserCheck, title: 'In-Platform Sign-Up', ref: '§13', status: 'not-done' },
      { icon: BookMarked, title: 'Post-Event Toolkits', ref: '§13', status: 'not-done' },
    ],
  },
  {
    kicker: 'Module 11',
    title: 'Councillor Campaign Engine',
    ref: '§14',
    blurb:
      'SRS-marked URGENT. Audience builder, campaign types Pledge / Agreement / Reply, sending-domain management, double-confirmed pledges, and per-councillor engagement history.',
    urgent: true,
    tiles: [
      {
        icon: Database,
        title: 'Councillor DB',
        ref: '§14.1',
        status: 'future-build',
        note: 'Democracy Club / moderngov',
      },
      { icon: Eye, title: 'Engagement History', ref: '§14.1', status: 'future-build' },
      {
        icon: Radar,
        title: 'Audience Builder',
        ref: '§14.2',
        status: 'future-build',
        note: 'AND/OR filters',
      },
      { icon: BarChart3, title: 'Live Match Count', ref: '§14.2', status: 'future-build' },
      { icon: Vote, title: 'Pledge Campaigns', ref: '§14.3', status: 'future-build' },
      { icon: Gavel, title: 'Agreement Campaigns', ref: '§14.3', status: 'future-build' },
      { icon: Mail, title: 'Reply Campaigns', ref: '§14.3', status: 'future-build' },
      { icon: Sparkles, title: 'AI Draft (human review)', ref: '§14.3', status: 'future-build' },
      {
        icon: ShieldCheck,
        title: 'SPF / DKIM / DMARC',
        ref: '§14.4',
        status: 'future-integration',
      },
      { icon: Send, title: 'Sending Domain Manager', ref: '§14.5', status: 'future-build' },
      {
        icon: CheckCircle2,
        title: 'Pledge Double-Confirmation',
        ref: '§14.6',
        status: 'future-build',
      },
      {
        icon: BarChart3,
        title: 'Real-Time Campaign Dashboard',
        ref: '§14.8',
        status: 'future-build',
      },
      { icon: GitBranch, title: 'Follow-Up Segments', ref: '§14.8', status: 'future-build' },
      {
        icon: FileSpreadsheet,
        title: 'Council / Party Leaderboards',
        ref: '§14.9',
        status: 'future-build',
      },
      { icon: FileSpreadsheet, title: 'CSV / Excel Export', ref: '§14.9', status: 'future-build' },
      { icon: Megaphone, title: 'Post-Council Escalation', ref: '§14.10', status: 'future-build' },
    ],
  },
  {
    kicker: 'Addendum',
    title: 'Network of Networks',
    ref: '§19.1–19.4',
    blurb:
      'Master + partner networks (e.g. CUFI under GPS), Network Coordinator role, signed enrolment tokens, originating-network tagging.',
    tiles: [
      { icon: Network, title: 'Networks Directory', ref: '§19.1.1', status: 'not-done' },
      { icon: UserCog, title: 'Network Coordinator Console', ref: '§19.2', status: 'not-done' },
      { icon: Boxes, title: 'Co-Branded Enrolment Landing', ref: '§19.9.1', status: 'not-done' },
      { icon: UserCheck, title: 'Three Enrolment Form Variants', ref: '§19.4', status: 'not-done' },
      { icon: KeyRound, title: 'Signed Enrolment Tokens', ref: '§19.4', status: 'not-done' },
      { icon: BarChart3, title: 'Aggregate-Stats Dashboard', ref: '§19.3', status: 'not-done' },
      { icon: GitBranch, title: 'Originating Network Tag', ref: '§19.1.3', status: 'not-done' },
    ],
  },
  {
    kicker: 'Roles & Access',
    title: 'User Roles & Access Control',
    ref: '§3 + §19.2',
    blurb: 'Hierarchical regions, MFA-protected accounts, role-based scoping.',
    tiles: [
      { icon: ShieldCheck, title: 'Super Admin', ref: '§3', status: 'partial' },
      { icon: UserCog, title: 'National Coordinator', ref: '§3', status: 'not-done' },
      { icon: UserCog, title: 'Network Coordinator', ref: '§19.2', status: 'not-done' },
      { icon: Users, title: 'Regional Volunteer', ref: '§3', status: 'partial' },
      { icon: UserCheck, title: 'Vetting Team', ref: '§19.2', status: 'partial' },
      { icon: Users, title: 'Subscriber', ref: '§3', status: 'not-done' },
      { icon: Eye, title: 'Read-Only Analyst', ref: '§3', status: 'not-done' },
      { icon: Lock, title: 'MFA / 2FA (TOTP)', ref: 'NFR-01', status: 'not-done' },
      { icon: Globe, title: 'Hierarchical Regions', ref: '§3.1', status: 'partial' },
    ],
  },
  {
    kicker: 'Non-Functional',
    title: 'System & Compliance',
    ref: 'NFR §15',
    blurb: 'Cross-cutting requirements that every module depends on.',
    tiles: [
      { icon: FileSpreadsheet, title: 'Audit Log', ref: 'NFR-06', status: 'partial' },
      {
        icon: Globe,
        title: 'UK Data Residency',
        ref: 'NFR-03',
        status: 'shipped',
        note: 'eu-west-2',
      },
      { icon: ShieldCheck, title: 'WCAG 2.2 AA', ref: 'NFR-04', status: 'shipped' },
      { icon: FileSpreadsheet, title: 'CSV / Excel Export', ref: 'NFR-09', status: 'not-done' },
      { icon: Search, title: 'Full-Text Search', ref: 'NFR-10', status: 'future-build' },
      { icon: Mail, title: 'SMTP + OAuth Mail', ref: 'NFR-11', status: 'future-integration' },
      { icon: Server, title: 'Configurable Scrape Schedule', ref: 'NFR-07', status: 'not-done' },
      { icon: Activity, title: 'Scale: 500 concurrent', ref: 'NFR-08', status: 'future-build' },
    ],
  },
  {
    kicker: 'Integrations',
    title: 'Third-Party Integrations',
    ref: '§16',
    blurb: 'External providers GPS Action will plug into rather than rebuild.',
    tiles: [
      {
        icon: Sparkles,
        title: 'AI / LLM (GPT-4o / Claude)',
        ref: '§16',
        status: 'future-integration',
      },
      { icon: Languages, title: 'Whisper STT', ref: '§16', status: 'future-integration' },
      { icon: Mail, title: 'SendGrid / Postmark / SES', ref: '§16', status: 'future-integration' },
      { icon: Video, title: 'YouTube Data API', ref: '§16', status: 'future-integration' },
      { icon: AtSign, title: 'X / Facebook / Instagram', ref: '§16', status: 'future-integration' },
      { icon: CalendarSearch, title: 'Eventbrite', ref: '§16', status: 'future-integration' },
      {
        icon: CircleDollarSign,
        title: 'Stripe / GoCardless',
        ref: '§16',
        status: 'future-integration',
      },
      { icon: Database, title: 'Democracy Club', ref: '§16', status: 'future-integration' },
      { icon: Mail, title: 'Activist Mailer (export)', ref: '§16', status: 'shipped' },
      { icon: Cloud, title: 'Activist Mailer (API)', ref: '§16', status: 'future-integration' },
    ],
  },
];

function StatusBadge({ status }: { status: Status }): ReactElement {
  return (
    <span
      className={`gps-chip gps-chip--static ${STATUS_CHIP_CLASS[status]}`}
      style={{ gap: 'var(--space-1)' }}
    >
      <StatusIcon status={status} size={12} aria-hidden />
      {STATUS_LABEL[status]}
    </span>
  );
}

function TileCard({ tile }: { tile: Tile }): ReactElement {
  const Icon = tile.icon;
  return (
    <article
      className="gps-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-3)',
        padding: 'var(--space-4)',
        minHeight: 132,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--colour-primary-subtle)',
            color: 'var(--colour-primary)',
            flexShrink: 0,
          }}
        >
          <Icon size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            className="gps-subtitle"
            style={{ fontSize: 'var(--text-md)', lineHeight: 'var(--line-snug)' }}
          >
            {tile.title}
          </div>
          <div className="gps-meta" style={{ marginTop: 2 }}>
            {tile.ref}
            {tile.note ? ` · ${tile.note}` : ''}
          </div>
        </div>
      </div>
      <div style={{ marginTop: 'auto' }}>
        <StatusBadge status={tile.status} />
      </div>
    </article>
  );
}

function SectionBlock({ section }: { section: Section }): ReactElement {
  return (
    <section
      style={{
        padding: 'var(--space-8) 0',
        borderTop: '1px solid var(--colour-border-subtle)',
      }}
    >
      <header style={{ marginBottom: 'var(--space-5)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
          }}
        >
          <span className="gps-kicker">{section.kicker}</span>
          <span className="gps-meta">{section.ref}</span>
          {section.urgent ? <span className="gps-badge gps-badge--urgent">URGENT</span> : null}
        </div>
        <h2 className="gps-title" style={{ marginBottom: 'var(--space-2)' }}>
          {section.title}
        </h2>
        <p
          className="gps-caption"
          style={{ maxWidth: '60ch', color: 'var(--colour-text-secondary)' }}
        >
          {section.blurb}
        </p>
      </header>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {section.tiles.map((tile) => (
          <TileCard key={`${section.ref}-${tile.title}`} tile={tile} />
        ))}
      </div>
    </section>
  );
}

function StatusLegend(): ReactElement {
  const items: Status[] = ['shipped', 'partial', 'future-build', 'future-integration', 'not-done'];
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-2)',
        marginTop: 'var(--space-5)',
      }}
    >
      {items.map((s) => (
        <StatusBadge key={s} status={s} />
      ))}
    </div>
  );
}

export default function CapabilitiesPage(): ReactElement {
  const totalTiles = SECTIONS.reduce((acc, s) => acc + s.tiles.length, 0);
  const shippedTiles = SECTIONS.reduce(
    (acc, s) => acc + s.tiles.filter((t) => t.status === 'shipped').length,
    0,
  );

  return (
    <main
      style={{
        padding: 'var(--space-8) var(--space-5)',
        maxWidth: 1180,
        margin: '0 auto',
      }}
      data-testid="capabilities-mockup-main"
    >
      {/* Hero */}
      <section style={{ paddingBottom: 'var(--space-8)' }}>
        <span className="gps-kicker">GPS Software Requirements · v1.1</span>
        <h1
          className="gps-title-lg"
          style={{ marginTop: 'var(--space-2)', marginBottom: 'var(--space-3)' }}
        >
          GPS Action — every capability, on one page
        </h1>
        <p
          className="gps-body"
          style={{
            maxWidth: '64ch',
            color: 'var(--colour-text-secondary)',
            marginBottom: 'var(--space-5)',
          }}
        >
          National + granular regional coordination, with AI assistance throughout. Eleven modules
          in the SRS, plus the Network of Networks addendum. Each tile names a requirement in the
          spec&apos;s own words and shows where it sits in the build today.
        </p>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-3)',
            alignItems: 'center',
          }}
        >
          <a
            href="/feed"
            className="gps-btn gps-btn--primary gps-btn--lg"
            data-testid="capabilities-mockup-open-app"
          >
            Open the App
            <ArrowRight size={18} aria-hidden />
          </a>
          <span className="gps-caption">
            {shippedTiles} of {totalTiles} tiles shipped today.
          </span>
        </div>
        <StatusLegend />
      </section>

      {SECTIONS.map((section) => (
        <SectionBlock key={section.ref + section.title} section={section} />
      ))}

      <footer
        style={{
          padding: 'var(--space-8) 0 var(--space-12)',
          borderTop: '1px solid var(--colour-border-subtle)',
          marginTop: 'var(--space-6)',
        }}
      >
        <p className="gps-meta">
          Source: <code>docs/feature-spec/GPS_Software_Requirements_v1.1.docx</code> · mapped
          against <code>docs/build/srs-coverage.md</code>. This is a static mockup — every tile
          other than the &ldquo;Open the App&rdquo; CTA is non-interactive.
        </p>
      </footer>
    </main>
  );
}
