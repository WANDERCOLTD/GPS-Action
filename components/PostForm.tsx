'use client';

/**
 * @build-unit BU-composer BU-link-share BU-fab-intent-picker BU-am-link-collapse BU-post-hero-demo
 * @spec product/design-philosophy.md
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060, D062, D064)
 * @spec product/scenarios.md (SCN-19)
 * @spec build/session-briefs/bu-am-link-collapse.md
 * @spec build/session-briefs/bu-post-hero-demo.md
 *
 * Post creation form. Client component — manages form state, calls
 * the createPostAction server action on submit.
 *
 * Per-intent shape comes from `INTENT_META` (see below): the form is
 * shared but the banner, accent colour, field order, and submit label
 * change per `?intent=<slug>`. Bespoke composers per intent are tracked
 * separately under BU-composer-bespoke-per-intent.
 *
 * BU-am-link-collapse: the dedicated <ActivistMailerField /> is gone.
 * Activist-Mailer URLs paste into the regular link-share field; the
 * preview card auto-detects AM domains at render time.
 *
 * BU-post-hero-demo: optional hero image picker between the body and
 * the link-share section, populated from the seeded set per D064.
 */

import { useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import {
  AlertTriangle,
  Link as LinkIcon,
  Megaphone,
  Feather,
  Pin,
  MessageCircle,
  CalendarDays,
  Users,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import type { CreatePostResult } from '@/app/compose/actions';
import { HeroImagePicker } from './HeroImagePicker';
import { KindPickerSheet, TILES, type Tile } from './KindPickerSheet';

export interface KindMapEntry {
  id: string;
  isAlertEligible: boolean;
  displayName: string;
}

interface PostFormProps {
  onSubmit: (formData: FormData) => Promise<CreatePostResult | void>;
  /** Intent label from the FAB picker (?intent=...). null = no preselection. */
  intent?: string | null;
  /** Active PostKind set keyed by slug (server-resolved at page render time). */
  kindMap: Record<string, KindMapEntry>;
}

interface IntentMeta {
  icon: ReactNode;
  accent: string;
  bannerHeading: string;
  bannerBody: string;
  submitLabel: string;
  /** Hide the Share-a-link toggle entirely (cultural). */
  hideLinkToggle?: boolean;
  /** Force urgency=true on submit (happening_now). */
  urgent?: boolean;
  /** Show a "fields coming soon" hint inside the form (event/meeting). */
  hint?: string;
  /** Title placeholder. */
  titlePlaceholder?: string;
  /** Body placeholder. */
  bodyPlaceholder?: string;
  /** Body label override. */
  bodyLabel?: string;
}

const INTENT_META: Record<string, IntentMeta> = {
  happening_now: {
    icon: <AlertTriangle size={20} />,
    accent: 'var(--colour-urgent)',
    bannerHeading: 'Posts as urgent',
    bannerBody: 'Reviewers see this instantly with a red flag. Use only for time-critical alerts.',
    submitLabel: 'Post urgent alert',
    urgent: true,
    titlePlaceholder: 'e.g. School-gate harassment — Cheddar Road, now',
    bodyPlaceholder: 'What is happening, where, what members can do right now.',
  },
  link_share: {
    icon: <LinkIcon size={20} />,
    accent: 'var(--colour-primary-bright)',
    bannerHeading: 'Share a link',
    bannerBody: 'News, op-ed, article — paste the URL and tell members why it matters.',
    submitLabel: 'Share link',
    titlePlaceholder: 'Worth reading — short summary',
    bodyPlaceholder: 'Why you think the network should see this.',
    bodyLabel: 'Why this matters',
  },
  call_to_action: {
    icon: <Megaphone size={20} />,
    accent: 'var(--colour-primary)',
    bannerHeading: 'Call to action',
    bannerBody:
      'What needs doing, why now. Paste the action link below — Activist Mailer URLs render with a "Send email" button automatically.',
    submitLabel: 'Post call to action',
    titlePlaceholder: 'e.g. Council motion — write to your councillor by Thursday',
    bodyPlaceholder: 'Background, context, the ask. Keep it tight.',
  },
  cultural: {
    icon: <Feather size={20} />,
    accent: 'var(--colour-cultural)',
    bannerHeading: 'Cultural moment',
    bannerBody: 'A quiet, dignified note. Shabbat, remembrance, celebration.',
    submitLabel: 'Post moment',
    hideLinkToggle: true,
    titlePlaceholder: 'e.g. Shabbat Shalom',
    bodyPlaceholder: 'A few warm words for the community.',
  },
  outcome: {
    icon: <Pin size={20} />,
    accent: 'var(--colour-success)',
    bannerHeading: 'Outcome — closing the loop',
    bannerBody: 'What happened. Numbers and outcomes, honestly stated.',
    submitLabel: 'Post outcome',
    titlePlaceholder: 'e.g. We sent 200 emails — the MP responded',
    bodyPlaceholder: 'Tell the team what happened. Honest, specific.',
  },
  thought: {
    icon: <MessageCircle size={20} />,
    accent: 'var(--colour-info)',
    bannerHeading: 'Just a thought',
    bannerBody: 'Discussion, observation, framing. No call to action needed.',
    submitLabel: 'Post',
  },
  event: {
    icon: <CalendarDays size={20} />,
    accent: 'var(--colour-info)',
    bannerHeading: 'Event',
    bannerBody: 'When, where, who is hosting.',
    submitLabel: 'Post event',
    hint: 'Date and time fields are coming. For now, write date / time / location in the body.',
    titlePlaceholder: 'e.g. Saturday morning vigil — Cheddar Road',
    bodyPlaceholder: 'When, where, who is hosting.',
  },
  meeting: {
    icon: <Users size={20} />,
    accent: 'var(--colour-info)',
    bannerHeading: 'Meeting',
    bannerBody: 'Group meeting — who, when, what we will cover.',
    submitLabel: 'Post meeting',
    hint: 'Date and join-link fields are coming. For now, write date / time / link in the body.',
    titlePlaceholder: 'e.g. Writers group — Sunday 19:00',
    bodyPlaceholder: 'Who, when, what we will cover.',
  },
  undecided: {
    icon: <HelpCircle size={20} />,
    accent: 'var(--colour-text-secondary)',
    bannerHeading: 'New post',
    bannerBody: 'Pick a kind below. The form adjusts to match.',
    submitLabel: 'Post',
  },
};

const FALLBACK_META: IntentMeta = {
  icon: <HelpCircle size={20} />,
  accent: 'var(--colour-text-secondary)',
  bannerHeading: 'New post',
  bannerBody: 'Pick a kind below.',
  submitLabel: 'Post',
};

function getMeta(intent: string | null | undefined): IntentMeta {
  return INTENT_META[intent ?? 'undecided'] ?? FALLBACK_META;
}

export function PostForm({ onSubmit, intent = null, kindMap }: PostFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  // currentIntent is initialised from the prop but mutable — tapping the
  // banner opens KindPickerSheet which calls setCurrentIntent.
  const [currentIntent, setCurrentIntent] = useState<string | null>(intent);
  // For "undecided", the user picks from the selector. Otherwise currentIntent IS the kind.
  const [selectedKind, setSelectedKind] = useState(
    intent === 'undecided' ? 'thought' : (intent ?? ''),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const isUndecided = currentIntent === 'undecided';
  const meta = getMeta(isUndecided ? selectedKind : currentIntent);
  // Open the link-share field by default for intents that historically
  // asked for an Activist Mailer URL above-the-fold (call_to_action) or
  // explicitly share-a-link.
  const [shareLinkOpen, setShareLinkOpen] = useState(
    currentIntent === 'link_share' || currentIntent === 'call_to_action',
  );
  // BU-post-hero-demo (D064): optional member-picked hero from the
  // seeded set. null = no hero. Submitted via a hidden input below.
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);

  const resolvedKindId = selectedKind ? kindMap[selectedKind]?.id : undefined;

  function handleIntentSwitch(slug: string): void {
    setCurrentIntent(slug);
    if (slug === 'undecided') {
      if (!selectedKind || selectedKind === '') setSelectedKind('thought');
    } else {
      setSelectedKind(slug);
    }
    if (slug === 'link_share' || slug === 'call_to_action') setShareLinkOpen(true);
    if (slug === 'cultural') setShareLinkOpen(false);
  }

  function handleSubmit(formData: FormData): void {
    if (resolvedKindId) formData.set('kindId', resolvedKindId);
    if (meta.urgent && resolvedKindId && kindMap[selectedKind]?.isAlertEligible) {
      formData.set('urgency', 'true');
    }
    startTransition(async () => {
      const result = await onSubmit(formData);
      if (result?.errors) {
        setErrors(result.errors);
      }
      // On success the server action redirects — no client handling needed
    });
  }

  return (
    <form
      action={handleSubmit}
      data-testid="compose-newpost-form"
      data-intent={currentIntent ?? 'none'}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
      {/* Intent banner — visual differentiation per FAB tile, also a
          tappable trigger to switch kinds without losing typed content. */}
      {currentIntent && (
        <>
          <IntentBanner
            meta={meta}
            testIdSuffix={isUndecided ? selectedKind : currentIntent}
            onClick={() => setPickerOpen(true)}
          />
          <KindPickerSheet
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onPick={handleIntentSwitch}
            excludeKeys={['flag', 'edit_request']}
            title="Change post kind"
          />
        </>
      )}

      {/* Form-level error */}
      {errors._form && (
        <p
          style={{
            color: 'var(--colour-danger)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-ui)',
          }}
          role="alert"
        >
          {errors._form[0]}
        </p>
      )}

      {/* Kind chip grid — visible when intent=undecided. Tap a chip to
          commit the form to that kind (banner + fields update; grid hides). */}
      {isUndecided && <KindChipGrid onPick={handleIntentSwitch} />}

      {/* Inline hint banner for event / meeting (date/time fields coming) */}
      {meta.hint && (
        <p
          data-testid="compose-intent-hint"
          style={{
            margin: 0,
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--colour-surface-sunken)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {meta.hint}
        </p>
      )}

      {/* Title */}
      <div>
        <label
          htmlFor="title"
          data-testid="compose-title-label"
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            marginBottom: 'var(--space-1)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          data-testid="compose-title-input"
          required
          minLength={3}
          maxLength={200}
          placeholder={meta.titlePlaceholder || undefined}
          className="gps-input"
          style={{
            width: '100%',
            borderColor: errors.title ? 'var(--colour-danger)' : undefined,
          }}
        />
        {errors.title && (
          <p
            style={{
              color: 'var(--colour-danger)',
              fontSize: 'var(--text-xs)',
              marginTop: 'var(--space-1)',
              fontFamily: 'var(--font-ui)',
            }}
            role="alert"
          >
            {errors.title[0]}
          </p>
        )}
      </div>

      {/* Body */}
      <div>
        <label
          htmlFor="body"
          data-testid="compose-body-label"
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            marginBottom: 'var(--space-1)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {meta.bodyLabel ?? 'Body'}
        </label>
        <textarea
          id="body"
          name="body"
          data-testid="compose-body-input"
          required
          minLength={10}
          maxLength={10000}
          rows={10}
          placeholder={meta.bodyPlaceholder || undefined}
          className="gps-input"
          style={{
            width: '100%',
            resize: 'vertical',
            borderColor: errors.body ? 'var(--colour-danger)' : undefined,
          }}
        />
        {errors.body && (
          <p
            style={{
              color: 'var(--colour-danger)',
              fontSize: 'var(--text-xs)',
              marginTop: 'var(--space-1)',
              fontFamily: 'var(--font-ui)',
            }}
            role="alert"
          >
            {errors.body[0]}
          </p>
        )}
      </div>

      {/* Hero image picker (BU-post-hero-demo / D064) — demo-only path,
          seeded URLs only. Hidden input passes the value to FormData. */}
      <HeroImagePicker value={heroImageUrl} onChange={setHeroImageUrl} disabled={isPending} />
      <input
        type="hidden"
        name="heroImageUrl"
        value={heroImageUrl ?? ''}
        data-testid="compose-hero-image-input"
      />

      {/* Share a link? (BU-link-share / D060 / SCN-19) */}
      {!meta.hideLinkToggle && (
        <div>
          <button
            type="button"
            data-testid="compose-sharelink-toggle"
            onClick={() => setShareLinkOpen((v) => !v)}
            aria-expanded={shareLinkOpen}
            aria-controls="compose-sharelink-fields"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--colour-text-link)',
              fontFamily: 'var(--font-ui)',
              fontSize: 'var(--text-sm)',
              cursor: 'pointer',
            }}
          >
            <span>{shareLinkOpen ? '▾' : '▸'}</span>
            Share a link?
          </button>

          {shareLinkOpen && (
            <div
              id="compose-sharelink-fields"
              style={{
                marginTop: 'var(--space-3)',
                padding: 'var(--space-4)',
                background: 'var(--colour-surface-sunken)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <label
                  htmlFor="linkUrl"
                  data-testid="compose-link-url-label"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Link URL
                </label>
                <input
                  id="linkUrl"
                  name="linkUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://..."
                  data-testid="compose-link-url-input"
                  className="gps-input"
                  style={{
                    width: '100%',
                    borderColor: errors.linkUrl ? 'var(--colour-danger)' : undefined,
                  }}
                />
                {errors.linkUrl && (
                  <p
                    style={{
                      color: 'var(--colour-danger)',
                      fontSize: 'var(--text-xs)',
                      marginTop: 'var(--space-1)',
                      fontFamily: 'var(--font-ui)',
                    }}
                    role="alert"
                  >
                    {errors.linkUrl[0]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="linkTitle"
                  data-testid="compose-link-title-label"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Title
                </label>
                <input
                  id="linkTitle"
                  name="linkTitle"
                  type="text"
                  maxLength={200}
                  data-testid="compose-link-title-input"
                  className="gps-input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label
                  htmlFor="linkDescription"
                  data-testid="compose-link-description-label"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Description
                </label>
                <textarea
                  id="linkDescription"
                  name="linkDescription"
                  rows={2}
                  maxLength={500}
                  data-testid="compose-link-description-input"
                  className="gps-input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div>
                <label
                  htmlFor="linkImageUrl"
                  data-testid="compose-link-imageurl-label"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Image URL
                </label>
                <input
                  id="linkImageUrl"
                  name="linkImageUrl"
                  type="url"
                  inputMode="url"
                  placeholder="https://..."
                  data-testid="compose-link-imageurl-input"
                  className="gps-input"
                  style={{
                    width: '100%',
                    borderColor: errors.linkImageUrl ? 'var(--colour-danger)' : undefined,
                  }}
                />
                {errors.linkImageUrl && (
                  <p
                    style={{
                      color: 'var(--colour-danger)',
                      fontSize: 'var(--text-xs)',
                      marginTop: 'var(--space-1)',
                      fontFamily: 'var(--font-ui)',
                    }}
                    role="alert"
                  >
                    {errors.linkImageUrl[0]}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="linkSiteName"
                  data-testid="compose-link-sitename-label"
                  style={{
                    display: 'block',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 500,
                    marginBottom: 'var(--space-1)',
                    fontFamily: 'var(--font-ui)',
                  }}
                >
                  Site name
                </label>
                <input
                  id="linkSiteName"
                  name="linkSiteName"
                  type="text"
                  maxLength={100}
                  placeholder="e.g. The Guardian"
                  data-testid="compose-link-sitename-input"
                  className="gps-input"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visibility */}
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            marginBottom: 'var(--space-2)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Visibility
        </legend>
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <label
            data-testid="compose-visibility-public-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="visibility"
              value="public"
              data-testid="compose-visibility-public-input"
              defaultChecked
            />
            Public
          </label>
          <label
            data-testid="compose-visibility-authed-label"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'var(--font-ui)',
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name="visibility"
              value="authenticated_only"
              data-testid="compose-visibility-authed-input"
            />
            Logged-in only
          </label>
        </div>
        {errors.visibility && (
          <p
            style={{
              color: 'var(--colour-danger)',
              fontSize: 'var(--text-xs)',
              marginTop: 'var(--space-1)',
              fontFamily: 'var(--font-ui)',
            }}
            role="alert"
          >
            {errors.visibility[0]}
          </p>
        )}
      </fieldset>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={isPending}
          data-testid="compose-newpost-submit"
          className="gps-btn gps-btn--primary"
          style={
            meta.urgent
              ? {
                  background: 'var(--colour-urgent)',
                  borderColor: 'var(--colour-urgent)',
                  color: 'var(--colour-urgent-contrast)',
                }
              : undefined
          }
        >
          {isPending ? 'Posting…' : meta.submitLabel}
        </button>
        <a
          href="/feed"
          data-testid="compose-newpost-cancel"
          className="gps-btn gps-btn--secondary"
          style={{ textDecoration: 'none' }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

interface IntentBannerProps {
  meta: IntentMeta;
  testIdSuffix: string;
  onClick: () => void;
}

function IntentBanner({ meta, testIdSuffix, onClick }: IntentBannerProps) {
  const bannerStyle: CSSProperties = {
    display: 'flex',
    gap: 'var(--space-3)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--colour-surface-raised)',
    borderTop: '1px solid var(--colour-border-subtle)',
    borderRight: '1px solid var(--colour-border-subtle)',
    borderBottom: '1px solid var(--colour-border-subtle)',
    borderLeft: `4px solid ${meta.accent}`,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    fontFamily: 'inherit',
    color: 'inherit',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      style={bannerStyle}
      data-testid="compose-intent-banner"
      data-intent-key={testIdSuffix}
      aria-label={`${meta.bannerHeading} — tap to change kind`}
    >
      <div
        style={{
          color: meta.accent,
          display: 'flex',
          alignItems: 'flex-start',
          paddingTop: '2px',
        }}
        aria-hidden="true"
      >
        {meta.icon}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-1)',
          flex: 1,
          minWidth: 0,
        }}
      >
        <strong
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-primary)',
          }}
        >
          {meta.bannerHeading}
        </strong>
        <p
          style={{
            margin: 0,
            fontFamily: 'var(--font-ui)',
            fontSize: 'var(--text-xs)',
            color: 'var(--colour-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          {meta.bannerBody}
        </p>
      </div>
      <ChevronDown
        size={18}
        aria-hidden="true"
        style={{ color: 'var(--colour-text-tertiary)', alignSelf: 'center' }}
      />
    </button>
  );
}

interface KindChipGridProps {
  onPick: (slug: string) => void;
}

const CHIP_EXCLUDE = new Set(['undecided', 'flag', 'edit_request']);

function KindChipGrid({ onPick }: KindChipGridProps) {
  const tiles = TILES.filter((t) => !CHIP_EXCLUDE.has(t.key) && !t.disabled);
  return (
    <div data-testid="compose-kind-chip-grid">
      <p
        style={{
          margin: 0,
          marginBottom: 'var(--space-2)',
          fontFamily: 'var(--font-ui)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--colour-text-primary)',
        }}
      >
        What kind of post is this?
      </p>
      <ul
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 'var(--space-3)',
        }}
      >
        {tiles.map((tile) => (
          <li key={tile.key}>
            <button
              type="button"
              onClick={() => onPick(tile.key)}
              data-testid="compose-kind-chip"
              data-intent-key={tile.key}
              style={chipStyle(tile)}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  color: tile.accent,
                }}
              >
                {tile.icon}
                <strong
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--colour-text-primary)',
                  }}
                >
                  {tile.label}
                </strong>
              </div>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-ui)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--colour-text-secondary)',
                }}
              >
                {tile.hint}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function chipStyle(tile: Tile): CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    padding: 'var(--space-3) var(--space-4)',
    borderRadius: 'var(--radius-md)',
    background: 'var(--colour-surface-raised)',
    borderTop: '1px solid var(--colour-border-subtle)',
    borderRight: '1px solid var(--colour-border-subtle)',
    borderBottom: '1px solid var(--colour-border-subtle)',
    borderLeft: `4px solid ${tile.accent}`,
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
    color: 'inherit',
  };
}
