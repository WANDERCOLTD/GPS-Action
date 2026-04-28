'use client';

/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Pattern A publish-time modal (D072 §5). One component, every
 * PostKind. Renders cards in this order:
 *
 *   1. Kind-specific primary action — when the post's kind has an
 *      `actionSlugs` entry that resolves in the registry. Unknown
 *      slugs render as disabled "Coming soon" cards.
 *   2. "Post to feed only" — base action, hidden when the kind's
 *      `canSelfPublish` is false (e.g. cultural posts route through
 *      review).
 *   3. "Send to reviewers" with an inline checkbox `Also post to feed`.
 *      Default-checked state per kind's `reviewMode`:
 *         - review_after_publish              → checked
 *         - either_with_default_review_first  → unchecked
 *         - either_with_default_publish       → unchecked
 *         - review_first                      → checkbox hidden (only
 *           card visible)
 *   4. "Save as draft" — base action.
 *   5. "Discard" — small destructive button at top-right; the parent
 *      owns the confirm sheet + undo snackbar plumbing.
 *
 * The kind-specific primary card combines publish + handler — tapping
 * it fires `onPublish` first (server-side), then runs the registry
 * handler (client-side: clipboard, open URL, etc.). The "Did you send
 * it?" follow-up is rendered as a second-step prompt inside this
 * modal via `ctx.onConfirmStep` (handlers stay UI-free).
 */

import { useState, type CSSProperties, type ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Send, Inbox, FileEdit, X } from 'lucide-react';
import {
  getPostKindAction,
  type ActionContext,
  type PostForAction,
} from '@/shared/post-kind-actions';

export type PublishModalReviewMode =
  | 'review_first'
  | 'review_after_publish'
  | 'either_with_default_review_first'
  | 'either_with_default_publish';

export interface PublishModalKindConfig {
  readonly actionSlugs: readonly string[];
  readonly reviewMode: PublishModalReviewMode;
  readonly canSelfPublish: boolean;
}

interface PostPublishModalProps {
  readonly post: PostForAction & { kindSlug: string | null };
  readonly kindConfig: PublishModalKindConfig;
  readonly actionContext: ActionContext;
  readonly onPublish: () => void | Promise<void>;
  readonly onSendForReview: (alsoPublishToFeed: boolean) => void | Promise<void>;
  readonly onSaveDraft: () => void | Promise<void>;
  readonly onDiscard: () => void;
  readonly onClose: () => void;
}

interface PendingConfirm {
  prompt: string;
  onYes: () => Promise<void>;
}

export function PostPublishModal({
  post,
  kindConfig,
  actionContext,
  onPublish,
  onSendForReview,
  onSaveDraft,
  onDiscard,
  onClose,
}: PostPublishModalProps): ReactElement {
  const showSelfPublish = kindConfig.canSelfPublish && kindConfig.reviewMode !== 'review_first';
  const showAlsoPublishCheckbox = kindConfig.reviewMode !== 'review_first';
  const defaultAlsoPublish = kindConfig.reviewMode === 'review_after_publish';

  const [alsoPublish, setAlsoPublish] = useState(defaultAlsoPublish);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  const kindActionSlug = kindConfig.actionSlugs[0] ?? null;
  const kindAction = kindActionSlug ? getPostKindAction(kindActionSlug) : null;

  async function runWithLock(label: string, fn: () => Promise<void>): Promise<void> {
    if (working) return;
    setWorking(label);
    try {
      await fn();
    } finally {
      setWorking(null);
    }
  }

  async function handleKindAction(): Promise<void> {
    if (!kindAction) return;
    await runWithLock(`action-${kindAction.slug}`, async () => {
      await Promise.resolve(onPublish());
      const ctx: ActionContext = {
        ...actionContext,
        onConfirmStep: (prompt, onYes) => setPendingConfirm({ prompt, onYes }),
      };
      await kindAction.handler(post, ctx);
    });
  }

  async function handlePublishOnly(): Promise<void> {
    await runWithLock('publish', async () => {
      await Promise.resolve(onPublish());
      onClose();
    });
  }

  async function handleSendForReview(): Promise<void> {
    await runWithLock('send-for-review', async () => {
      await Promise.resolve(onSendForReview(alsoPublish));
      onClose();
    });
  }

  async function handleSaveDraft(): Promise<void> {
    await runWithLock('save-draft', async () => {
      await Promise.resolve(onSaveDraft());
      onClose();
    });
  }

  async function resolveConfirm(): Promise<void> {
    if (!pendingConfirm) return;
    const { onYes } = pendingConfirm;
    setPendingConfirm(null);
    await onYes();
    onClose();
  }

  function declineConfirm(): void {
    setPendingConfirm(null);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-modal-heading"
      data-testid="compose-publish-modal"
      data-kind-slug={post.kindSlug ?? ''}
      style={overlayStyle}
    >
      <div data-testid="compose-publish-modal-sheet" style={sheetStyle}>
        <div style={topRowStyle}>
          <h2 id="publish-modal-heading" style={headingStyle}>
            {pendingConfirm ? pendingConfirm.prompt : 'Ready to share?'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            data-testid="compose-publish-modal-close"
            aria-label="Close"
            className="gps-btn gps-btn--ghost"
            style={closeButtonStyle}
          >
            <X size={18} />
          </button>
        </div>

        {pendingConfirm ? (
          <div style={confirmRowStyle}>
            <button
              type="button"
              onClick={() => void resolveConfirm()}
              data-testid="compose-publish-modal-confirm-yes"
              className="gps-btn gps-btn--primary"
            >
              I sent it
            </button>
            <button
              type="button"
              onClick={declineConfirm}
              data-testid="compose-publish-modal-confirm-no"
              className="gps-btn gps-btn--secondary"
            >
              Not yet
            </button>
          </div>
        ) : (
          <div style={cardStackStyle}>
            {kindAction ? (
              <button
                type="button"
                onClick={() => void handleKindAction()}
                disabled={working !== null}
                data-testid="compose-publish-modal-action"
                data-action-slug={kindAction.slug}
                data-card-primary="true"
                style={cardStyle(true, working !== null)}
              >
                <ActionCardBody icon={kindAction.icon} label={kindAction.label(post)} />
              </button>
            ) : kindActionSlug ? (
              <button
                type="button"
                onClick={() => undefined}
                disabled
                data-testid="compose-publish-modal-action"
                data-action-slug={kindActionSlug}
                data-card-primary="false"
                style={cardStyle(false, true)}
              >
                <ActionCardBody
                  icon={Send}
                  label={`${humanize(kindActionSlug)} (coming soon)`}
                  hint="This action isn't available yet."
                />
              </button>
            ) : null}

            {showSelfPublish ? (
              <button
                type="button"
                onClick={() => void handlePublishOnly()}
                disabled={working !== null}
                data-testid="compose-publish-modal-publish"
                data-card-primary={!kindAction ? 'true' : 'false'}
                style={cardStyle(!kindAction, working !== null)}
              >
                <ActionCardBody icon={Send} label="Post to feed only" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => void handleSendForReview()}
              disabled={working !== null}
              data-testid="compose-publish-modal-send-for-review"
              data-card-primary={!showSelfPublish ? 'true' : 'false'}
              style={cardStyle(!showSelfPublish, working !== null)}
            >
              <ActionCardBody icon={Inbox} label="Send to reviewers" />
              {showAlsoPublishCheckbox ? (
                <label
                  data-testid="compose-publish-modal-also-publish-label"
                  style={checkboxLabelStyle}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={alsoPublish}
                    onChange={(e) => setAlsoPublish(e.target.checked)}
                    data-testid="compose-publish-modal-also-publish"
                  />
                  Also post to feed
                </label>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={working !== null}
              data-testid="compose-publish-modal-save-draft"
              data-card-primary="false"
              style={cardStyle(false, working !== null)}
            >
              <ActionCardBody icon={FileEdit} label="Save as draft" />
            </button>

            <button
              type="button"
              onClick={onDiscard}
              data-testid="compose-publish-modal-discard"
              disabled={working !== null}
              className="gps-btn gps-btn--ghost"
              style={discardStyle}
            >
              Discard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ActionCardBodyProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly hint?: string;
}

function ActionCardBody({ icon: Icon, label, hint }: ActionCardBodyProps): ReactElement {
  return (
    <>
      <Icon size={18} aria-hidden="true" />
      <span style={cardLabelStyle}>{label}</span>
      {hint ? <span style={cardHintStyle}>{hint}</span> : null}
    </>
  );
}

function humanize(slug: string): string {
  return slug
    .split('_')
    .map((part, i) => (i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'color-mix(in srgb, var(--colour-text-primary) 50%, transparent)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 'var(--space-4)',
  zIndex: 'var(--z-modal)' as unknown as number,
};

const sheetStyle: CSSProperties = {
  background: 'var(--colour-surface-raised)',
  borderRadius: 'var(--radius-lg)',
  padding: 'var(--space-5) var(--space-6)',
  maxWidth: '32rem',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3)',
  fontFamily: 'var(--font-ui)',
};

const topRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-lg)',
  fontWeight: 600,
  color: 'var(--colour-text-primary)',
};

const closeButtonStyle: CSSProperties = {
  padding: 'var(--space-1)',
};

const cardStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

function cardStyle(primary: boolean, disabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    padding: 'var(--space-3) var(--space-4)',
    border: '1px solid var(--colour-border-subtle)',
    borderRadius: 'var(--radius-md)',
    background: primary
      ? 'color-mix(in srgb, var(--colour-primary-bright) 8%, var(--colour-surface-raised))'
      : 'var(--colour-surface-raised)',
    color: 'var(--colour-text-primary)',
    fontSize: 'var(--text-sm)',
    fontWeight: primary ? 600 : 500,
    fontFamily: 'inherit',
    textAlign: 'left',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
  };
}

const cardLabelStyle: CSSProperties = {
  flex: 1,
};

const cardHintStyle: CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-tertiary, var(--colour-text-secondary))',
  width: '100%',
  marginLeft: 'calc(18px + var(--space-3))',
};

const checkboxLabelStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
  fontSize: 'var(--text-xs)',
  color: 'var(--colour-text-secondary)',
  fontWeight: 500,
  marginLeft: 'auto',
  cursor: 'pointer',
};

const discardStyle: CSSProperties = {
  alignSelf: 'flex-end',
  fontSize: 'var(--text-sm)',
  color: 'var(--colour-danger)',
  fontWeight: 500,
  padding: 'var(--space-1) var(--space-2)',
};

const confirmRowStyle: CSSProperties = {
  display: 'flex',
  gap: 'var(--space-3)',
  marginTop: 'var(--space-2)',
};
