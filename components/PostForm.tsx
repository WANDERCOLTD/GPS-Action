'use client';

/**
 * @build-unit BU-composer BU-link-share BU-fab-intent-picker BU-am-link-collapse BU-post-hero-demo BU-tick-or-cross BU-event-time BU-publish-router
 * @spec product/design-philosophy.md
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060, D062, D064, D069, D072, D073)
 * @spec product/scenarios.md (SCN-19, SCN-26, SCN-27)
 * @spec build/session-briefs/bu-am-link-collapse.md
 * @spec build/session-briefs/bu-post-hero-demo.md
 * @spec build/session-briefs/bu-tick-or-cross.md
 * @spec build/session-briefs/bu-publish-router.md
 * @spec docs/adrs/0001-post-event-time-fields.md
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
 *
 * BU-tick-or-cross: when kind === 'tick_or_cross', a required ✅/❌
 * segmented toggle renders above the title and Publish stays disabled
 * until a choice is made. Submit appends `signal` to FormData.
 *
 * BU-event-time / D073: when the active kind is time-bearing per
 * `kindIsTimeBearing` (meeting / event / happening_now), an
 * <EventFieldsBlock /> renders between the body and the share-link
 * toggle, with start date+time, optional end date+time, and an
 * optional location. The composer's server action assembles UTC
 * Dates from the FormData strings via shared/format-event-time.
 *
 * BU-publish-router (D072): submit no longer redirects. It creates
 * the post as a draft via createPostAction and opens the universal
 * <PostPublishModal>; the modal owns publish / save / send-for-review
 * / discard from there. The legacy handoff branch + the inline
 * <SendToNetworkConfirm /> mount are gone — share_to_gps_whatsapp is
 * a registry handler the modal dispatches.
 */

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
  CheckSquare,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { CreatePostResult } from '@/app/compose/actions';
import { kindIsTimeBearing } from '@/shared/post-kinds';
import {
  publishPostAction,
  sendPostForReviewAction,
  saveDraftAction,
  discardPostAction,
  fetchLinkMetadataAction,
} from '@/app/compose/actions';
import { LinkPreviewCard } from './LinkPreviewCard';
import { HeroImagePicker } from './HeroImagePicker';
import { KindPickerSheet, TILES, type Tile } from './KindPickerSheet';
import { PostPublishModal, type PublishModalKindConfig } from './PostPublishModal';
import { DiscardConfirmSheet } from './DiscardConfirmSheet';
import { UndoSnackbar } from './UndoSnackbar';
import {
  EventFieldsBlock,
  EMPTY_EVENT_FIELDS_STATE,
  type EventFieldsState,
} from './EventFieldsBlock';
import { DraftSavedIndicator } from './DraftSavedIndicator';
import { useAutosaveDraft } from '@/shared/autosave/use-autosave-draft';

export interface KindMapEntry {
  id: string;
  isAlertEligible: boolean;
  displayName: string;
}

/**
 * D072 — publish-modal config keyed by PostKind.slug. Server-rendered
 * at page load time so the modal opens without an extra round-trip.
 */
export type PublishModalKindConfigBySlug = Record<string, PublishModalKindConfig>;

interface PostFormProps {
  onSubmit: (formData: FormData) => Promise<CreatePostResult>;
  /** Intent label from the FAB picker (?intent=...). null = no preselection. */
  intent?: string | null;
  /** Active PostKind set keyed by slug (server-resolved at page render time). */
  kindMap: Record<string, KindMapEntry>;
  /** D072 — publish-modal config per kind, server-rendered at page load. */
  kindConfigBySlug: PublishModalKindConfigBySlug;
  /** GPS Network channel URL (BU-tick-or-cross / D069). Null when unset. */
  networkChannelUrl?: string | null;
  /** Canonical origin for the post URL embedded in the handoff message. */
  siteOrigin?: string;
  /**
   * BU-link-first-composer: optional prefill from the FAB starter card or
   * a paste-and-go link. When set, the title input opens populated and the
   * caller picks the right intent (typically `thought` for text prefill).
   */
  prefilledTitle?: string;
  /**
   * BU-link-first-composer: optional prefill from the FAB starter card or
   * a paste-and-go link. When set, the link-share field opens by default
   * with linkUrl populated. Caller normalizes the URL before passing.
   */
  prefilledLinkUrl?: string;
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
    titlePlaceholder: 'e.g. Saturday morning vigil — Cheddar Road',
    bodyPlaceholder: 'When, where, who is hosting.',
  },
  meeting: {
    icon: <Users size={20} />,
    accent: 'var(--colour-info)',
    bannerHeading: 'Meeting',
    bannerBody: 'Group meeting — who, when, what we will cover.',
    submitLabel: 'Post meeting',
    titlePlaceholder: 'e.g. Writers group — Sunday 19:00',
    bodyPlaceholder: 'Who, when, what we will cover.',
  },
  // BU-tick-or-cross (D069). Author picks ✅ amplify or ❌ flag; on
  // publish the post saves and a confirm modal copies the formatted
  // message to the clipboard before opening the GPS Network channel.
  tick_or_cross: {
    icon: <CheckSquare size={20} />,
    accent: 'var(--colour-primary)',
    bannerHeading: '✅ or ❌',
    bannerBody:
      'Amplify or flag a target. On publish we copy the message and open the GPS Network channel — paste in WhatsApp, return, confirm.',
    submitLabel: 'Publish',
    hideLinkToggle: true,
    titlePlaceholder: 'e.g. Sky News bias — front-page hit piece',
    bodyPlaceholder: 'A line or two on what to amplify or flag, and why.',
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

export function PostForm({
  onSubmit,
  intent = null,
  kindMap,
  kindConfigBySlug,
  networkChannelUrl = null,
  siteOrigin = '',
  prefilledTitle = '',
  prefilledLinkUrl = '',
}: PostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [draft, setDraft] = useState<CreatePostResult['draft'] | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [undoState, setUndoState] = useState<{ postId: string } | null>(null);
  // BU-publish-router (D072 §8 stage 1) — controlled title + body so the
  // IndexedDB autosave can mirror them. The other text fields stay
  // uncontrolled in Phase 1; Phase 2's bu-drafts-inbox extends this.
  const [title, setTitle] = useState(prefilledTitle);
  const [body, setBody] = useState('');
  // BU-feed-card-affordances — link-first compose. linkUrl is the first
  // input the member sees; pasting it triggers a debounced server-side
  // metadata fetch which prefills the post title (unless the member has
  // already typed one) and the four link-card fields. Those four are
  // submitted as hidden inputs so the LinkPreviewCard renders correctly.
  const [linkUrl, setLinkUrl] = useState(prefilledLinkUrl);
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkImageUrl, setLinkImageUrl] = useState('');
  const [linkSiteName, setLinkSiteName] = useState('');
  const [linkMetaLoading, setLinkMetaLoading] = useState(false);
  const [titleEdited, setTitleEdited] = useState(prefilledTitle.length > 0);
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
  // BU-post-hero-demo (D064): optional member-picked hero from the
  // seeded set. null = no hero. Submitted via a hidden input below.
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(null);
  // BU-tick-or-cross (D069): author's ✅/❌ choice. Required iff the
  // active kind is `tick_or_cross`; cleared on intent switch.
  const [signal, setSignal] = useState<'promote' | 'remove' | null>(null);
  // BU-event-time (D073): event-field state lives here so values
  // survive kind toggles. The block renders only when the active
  // kind is time-bearing per kindIsTimeBearing.
  const [eventFields, setEventFields] = useState<EventFieldsState>(EMPTY_EVENT_FIELDS_STATE);

  const resolvedKindId = selectedKind ? kindMap[selectedKind]?.id : undefined;
  const activeKindSlug = isUndecided ? selectedKind : currentIntent;
  const isTickOrCross = activeKindSlug === 'tick_or_cross';
  const isTimeBearing = kindIsTimeBearing(activeKindSlug ?? null);
  const submitDisabled = isPending || (isTickOrCross && signal === null);

  // ── BU-publish-router (D072 §8 stage 1) — IndexedDB autosave ──────────
  // Phase 1 ships only the client-side layer: every change writes to
  // IndexedDB after a 500ms debounce; reload re-hydrates. Server-side
  // autosave + the /drafts recall surface land in bu-drafts-inbox.
  const draftSnapshot = useMemo(
    () => ({ title, body, signal, currentIntent, selectedKind }),
    [title, body, signal, currentIntent, selectedKind],
  );
  const autosave = useAutosaveDraft({
    key: 'compose-draft-current',
    value: draftSnapshot,
    enabled: draft === null, // suspend once a server-side post exists
  });

  // Hydrate cached draft on first load. Runs once; subsequent changes
  // come from the user, not the cache.
  useEffect(() => {
    if (!autosave.hasHydrated || !autosave.hydrated) return;
    const cached = autosave.hydrated as Partial<typeof draftSnapshot>;
    if (typeof cached.title === 'string' && cached.title.length > 0) {
      setTitle(cached.title);
      setTitleEdited(true);
    }
    if (typeof cached.body === 'string' && cached.body.length > 0) {
      setBody(cached.body);
    }
    if (cached.signal === 'promote' || cached.signal === 'remove') {
      setSignal(cached.signal);
    }
  }, [autosave.hasHydrated]);

  // BU-feed-card-affordances — link-first auto-fetch. When linkUrl
  // looks valid (after a 600ms debounce so we don't fire on every
  // keystroke), call the server action to pull og:title /
  // og:description / og:image / og:site_name. Populate the four link
  // fields unconditionally (always reflect the latest URL); populate
  // the post title only if the member hasn't typed their own.
  useEffect(() => {
    const trimmed = linkUrl.trim();
    if (!trimmed) {
      setLinkTitle('');
      setLinkDescription('');
      setLinkImageUrl('');
      setLinkSiteName('');
      setLinkMetaLoading(false);
      return;
    }
    let cancelled = false;
    setLinkMetaLoading(true);
    const t = setTimeout(async () => {
      const result = await fetchLinkMetadataAction({ url: trimmed });
      if (cancelled) return;
      setLinkMetaLoading(false);
      if (!result.ok) return;
      const { data } = result;
      setLinkTitle(data.title ?? '');
      setLinkDescription(data.description ?? '');
      setLinkImageUrl(data.imageUrl ?? '');
      setLinkSiteName(data.siteName ?? '');
      if (!titleEdited && data.title) {
        setTitle(data.title);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [linkUrl, titleEdited]);

  function handleIntentSwitch(slug: string): void {
    setCurrentIntent(slug);
    if (slug === 'undecided') {
      if (!selectedKind || selectedKind === '') setSelectedKind('thought');
    } else {
      setSelectedKind(slug);
    }
    if (slug !== 'tick_or_cross') setSignal(null);
  }

  function handleSubmit(formData: FormData): void {
    if (resolvedKindId) formData.set('kindId', resolvedKindId);
    if (meta.urgent && resolvedKindId && kindMap[selectedKind]?.isAlertEligible) {
      formData.set('urgency', 'true');
    }
    if (activeKindSlug) formData.set('kindSlug', activeKindSlug);
    if (isTickOrCross && signal) formData.set('signal', signal);
    startTransition(async () => {
      const result = await onSubmit(formData);
      if (result.errors) {
        setErrors(result.errors);
        return;
      }
      if (result.draft) {
        // D072 — every kind goes through the universal publish modal.
        // The IndexedDB cache is now stale (the post is a real DB row);
        // drop it so a refresh doesn't re-hydrate the typed text on top
        // of an already-saved draft.
        await autosave.clear();
        setDraft(result.draft);
        return;
      }
    });
  }

  function closeAndGoFeed(): void {
    setDraft(null);
    router.push('/feed');
  }

  async function handleModalPublish(): Promise<void> {
    if (!draft) return;
    const result = await publishPostAction({ postId: draft.postId });
    if (!result.ok) {
      setErrors({ _form: [`Couldn't publish: ${result.reason}`] });
    }
  }

  async function handleModalSendForReview(alsoPublishToFeed: boolean): Promise<void> {
    if (!draft) return;
    const result = await sendPostForReviewAction({
      postId: draft.postId,
      alsoPublishToFeed,
    });
    if (!result.ok) {
      setErrors({ _form: [`Couldn't send for review: ${result.reason}`] });
    }
  }

  async function handleModalSaveDraft(): Promise<void> {
    if (!draft) return;
    const result = await saveDraftAction({ postId: draft.postId });
    if (!result.ok) {
      setErrors({ _form: [`Couldn't save draft: ${result.reason}`] });
    }
  }

  function handleModalDiscard(): void {
    setDiscardOpen(true);
  }

  async function confirmDiscard(): Promise<void> {
    setDiscardOpen(false);
    // No server-side post yet → discarding only the in-progress IndexedDB
    // draft. Clear the cache and reset the controlled fields so the
    // form is empty.
    if (!draft) {
      await autosave.clear();
      setTitle('');
      setBody('');
      setSignal(null);
      return;
    }
    const result = await discardPostAction({ postId: draft.postId });
    if (!result.ok) {
      setErrors({ _form: [`Couldn't discard: ${result.reason}`] });
      return;
    }
    setDraft(null);
    setUndoState({ postId: result.postId });
  }

  async function handleUndo(): Promise<void> {
    if (!undoState) return;
    const { restorePostAction } = await import('@/app/compose/actions');
    await restorePostAction({ postId: undoState.postId });
    setUndoState(null);
    router.push(`/post/${undoState.postId}`);
  }

  function handleUndoTimeout(): void {
    setUndoState(null);
    router.push('/feed');
  }

  return (
    <form
      action={handleSubmit}
      data-testid="compose-newpost-form"
      data-intent={currentIntent ?? 'none'}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
      {/* BU-publish-router (D072 §8) — calm, honest autosave indicator
          in the form header. The "View all drafts" link stays disabled
          until bu-drafts-inbox lands. Discard menu item opens the same
          confirm sheet the publish modal uses. */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <DraftSavedIndicator
          state={
            autosave.status === 'editing'
              ? 'editing'
              : autosave.status === 'failed'
                ? 'failed'
                : 'saved'
          }
          lastSavedAt={autosave.lastSavedAt}
          onDiscardClick={() => setDiscardOpen(true)}
        />
      </div>

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

      {/* BU-tick-or-cross (D069): required ✅/❌ segmented toggle. Renders
          above the title so the choice is the first thing the author makes;
          Publish stays disabled until one is picked. */}
      {isTickOrCross && <SignalToggle value={signal} onChange={setSignal} />}

      {/* BU-feed-card-affordances — link-first compose. The link URL is
          the first input the member sees (hidden only for kinds that
          don't take a link: cultural, tick_or_cross). When a URL is
          pasted we debounce 600ms and call the metadata server action;
          the post title gets prefilled (only if the member hasn't typed
          their own) and a LinkPreviewCard appears so they can see the
          card their post will render. */}
      {!meta.hideLinkToggle && (
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
            Link{' '}
            <span style={{ color: 'var(--colour-text-secondary)', fontWeight: 400 }}>
              (optional)
            </span>
          </label>
          <input
            id="linkUrl"
            name="linkUrl"
            type="url"
            inputMode="url"
            placeholder="Paste a URL — we'll fill the rest"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
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
          {linkMetaLoading && (
            <p
              data-testid="compose-link-meta-loading"
              style={{
                margin: 'var(--space-2) 0 0',
                fontSize: 'var(--text-xs)',
                color: 'var(--colour-text-secondary)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              Fetching link details…
            </p>
          )}
          {!linkMetaLoading && linkUrl.trim() && (linkTitle || linkSiteName) && (
            <div style={{ marginTop: 'var(--space-3)' }} data-testid="compose-link-preview-wrapper">
              <LinkPreviewCard
                linkUrl={linkUrl}
                linkTitle={linkTitle || null}
                linkDescription={linkDescription || null}
                linkImageUrl={linkImageUrl || null}
                linkSiteName={linkSiteName || null}
                size="small"
              />
            </div>
          )}
        </div>
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
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setTitleEdited(true);
          }}
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
          value={body}
          onChange={(e) => setBody(e.target.value)}
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

      {/* BU-event-time / D073 — date+time + location pickers. Renders
          when the active kind is time-bearing (meeting / event /
          happening_now per shared/post-kinds.kindIsTimeBearing). State
          lives in PostForm so values survive kind toggles per
          Sharon-warmth. */}
      {isTimeBearing && (
        <EventFieldsBlock
          value={eventFields}
          onChange={setEventFields}
          errors={{
            eventAt: errors['eventAt'],
            eventEndsAt: errors['eventEndsAt'],
            locationText: errors['locationText'],
          }}
        />
      )}

      {/* Hero image picker (BU-post-hero-demo / D064) — demo-only path,
          seeded URLs only. Hidden input passes the value to FormData. */}
      <HeroImagePicker value={heroImageUrl} onChange={setHeroImageUrl} disabled={isPending} />
      <input
        type="hidden"
        name="heroImageUrl"
        value={heroImageUrl ?? ''}
        data-testid="compose-hero-image-input"
      />

      {/* Hidden inputs carry the fetched link metadata to FormData
          submit. They're populated by the link-first useEffect at the
          top of the form. The four fields are not user-visible — when
          a member needs to override them later, that lives in post
          edit (a separate BU). */}
      {!meta.hideLinkToggle && (
        <>
          <input
            type="hidden"
            name="linkTitle"
            value={linkTitle}
            data-testid="compose-link-title-input"
          />
          <input
            type="hidden"
            name="linkDescription"
            value={linkDescription}
            data-testid="compose-link-description-input"
          />
          <input
            type="hidden"
            name="linkImageUrl"
            value={linkImageUrl}
            data-testid="compose-link-imageurl-input"
          />
          <input
            type="hidden"
            name="linkSiteName"
            value={linkSiteName}
            data-testid="compose-link-sitename-input"
          />
        </>
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
          disabled={submitDisabled}
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

      {draft &&
        (() => {
          const kindConfig = draft.kindSlug ? kindConfigBySlug[draft.kindSlug] : undefined;
          if (!kindConfig) return null;
          return (
            <PostPublishModal
              post={{
                id: draft.postId,
                title: draft.title,
                body: draft.body,
                signal: draft.signal,
                kindSlug: draft.kindSlug,
              }}
              kindConfig={kindConfig}
              actionContext={{
                originUrl: siteOrigin,
                channelUrl: networkChannelUrl ?? undefined,
                onMarkSharedToNetwork: async (postId) => {
                  const { markPostSharedToNetworkAction } = await import('@/app/post/[id]/actions');
                  await markPostSharedToNetworkAction(postId);
                },
              }}
              onPublish={handleModalPublish}
              onSendForReview={handleModalSendForReview}
              onSaveDraft={handleModalSaveDraft}
              onDiscard={handleModalDiscard}
              onClose={closeAndGoFeed}
            />
          );
        })()}

      <DiscardConfirmSheet
        open={discardOpen}
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardOpen(false)}
      />

      {undoState && (
        <UndoSnackbar
          message="Draft discarded"
          durationMs={10000}
          onUndo={handleUndo}
          onTimeout={handleUndoTimeout}
          purpose="discard-draft"
        />
      )}
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

interface SignalToggleProps {
  value: 'promote' | 'remove' | null;
  onChange: (next: 'promote' | 'remove') => void;
}

function SignalToggle({ value, onChange }: SignalToggleProps) {
  return (
    <fieldset
      data-testid="compose-signal-toggle"
      style={{
        border: '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-3) var(--space-4)',
        margin: 0,
        background: 'var(--colour-surface-sunken)',
      }}
    >
      <legend
        style={{
          padding: '0 var(--space-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          fontFamily: 'var(--font-ui)',
          color: 'var(--colour-text-primary)',
        }}
      >
        Amplify or flag?
      </legend>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
        <SignalChoiceButton
          choice="promote"
          glyph="✅"
          label="Amplify"
          selected={value === 'promote'}
          onClick={() => onChange('promote')}
        />
        <SignalChoiceButton
          choice="remove"
          glyph="❌"
          label="Flag"
          selected={value === 'remove'}
          onClick={() => onChange('remove')}
        />
      </div>
    </fieldset>
  );
}

interface SignalChoiceButtonProps {
  choice: 'promote' | 'remove';
  glyph: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}

function SignalChoiceButton({ choice, glyph, label, selected, onClick }: SignalChoiceButtonProps) {
  // Static testid per F14 rule; choice surfaces via data-signal-choice
  // for tests / playwright that need to target a specific button.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={label}
      data-testid="compose-signal-choice"
      data-signal-choice={choice}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 'var(--space-1)',
        padding: 'var(--space-3) var(--space-4)',
        background: selected ? 'var(--colour-surface-raised)' : 'transparent',
        border: selected
          ? '2px solid var(--colour-primary)'
          : '1px solid var(--colour-border-subtle)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontFamily: 'var(--font-ui)',
        fontSize: 'var(--text-sm)',
        color: 'var(--colour-text-primary)',
      }}
    >
      <span style={{ fontSize: 'var(--text-2xl)' }} aria-hidden="true">
        {glyph}
      </span>
      <span style={{ fontWeight: selected ? 600 : 500 }}>{label}</span>
    </button>
  );
}
