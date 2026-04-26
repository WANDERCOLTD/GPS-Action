'use client';

/**
 * @build-unit BU-composer BU-link-share
 * @spec product/design-philosophy.md
 * @spec architecture/api-contract.md
 * @spec architecture/decision-log.md (D060)
 * @spec product/scenarios.md (SCN-19)
 *
 * Post creation form. Client component — manages form state, calls
 * the createPostAction server action on submit.
 *
 * BU-link-share / D060: a "Share a link?" toggle reveals five extra
 * fields (linkUrl + 4 metadata) per SCN-19 manual-fill flow.
 */

import { useState, useTransition } from 'react';
import type { CreatePostResult } from '@/app/compose/actions';
import { ActivistMailerField } from './ActivistMailerField';

interface PostFormProps {
  onSubmit: (formData: FormData) => Promise<CreatePostResult | void>;
  /** Intent label from the FAB picker (?intent=...). null = no preselection. */
  intent?: string | null;
}

const KIND_OPTIONS = [
  { value: 'thought', label: 'Just a thought' },
  { value: 'cultural', label: 'Cultural moment' },
  { value: 'outcome', label: 'Outcome — what happened' },
  { value: 'call_to_action', label: 'Call to action' },
  { value: 'link_share', label: 'Share a link' },
  { value: 'event', label: 'Event' },
  { value: 'meeting', label: 'Meeting' },
];

const INTENT_PLACEHOLDERS: Record<string, { title: string; body: string }> = {
  cultural: {
    title: 'e.g. Shabbat Shalom',
    body: 'A quiet, dignified note for the community.',
  },
  outcome: {
    title: 'e.g. We sent 200 emails — the MP responded',
    body: 'Tell the team what happened. Numbers and outcomes, honestly stated.',
  },
  call_to_action: {
    title: 'e.g. Council motion — write to your councillor by Thursday',
    body: 'What needs doing, why now, what the link below sends.',
  },
  link_share: {
    title: 'Worth reading — short summary',
    body: 'Why you think the network should see this.',
  },
  event: {
    title: 'e.g. Saturday morning vigil — Cheddar Road',
    body: "When, where, who's hosting. Time / RSVP fields coming in a follow-up.",
  },
  meeting: {
    title: 'e.g. Writers group — Sunday 19:00',
    body: 'Who, when, what we will cover. Time fields coming in a follow-up.',
  },
  thought: {
    title: '',
    body: '',
  },
  undecided: {
    title: '',
    body: '',
  },
};

export function PostForm({ onSubmit, intent = null }: PostFormProps) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  // For "undecided", the user picks from the selector. Otherwise the intent IS the kind.
  const [selectedKind, setSelectedKind] = useState(
    intent === 'undecided' ? 'thought' : (intent ?? ''),
  );
  const isUndecided = intent === 'undecided';
  const showLinkOpenByDefault = intent === 'link_share';
  const [shareLinkOpen, setShareLinkOpen] = useState(showLinkOpenByDefault);
  const placeholders = INTENT_PLACEHOLDERS[intent ?? 'undecided'] ?? { title: '', body: '' };

  function handleSubmit(formData: FormData): void {
    if (selectedKind) formData.set('kind', selectedKind);
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
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
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

      {/* Kind selector — visible when intent=undecided (BU-fab-intent-picker / D062) */}
      {isUndecided && (
        <div>
          <label
            htmlFor="post-kind"
            data-testid="intent-selector-label"
            style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
              marginBottom: 'var(--space-1)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            What kind of post is this?
          </label>
          <select
            id="post-kind"
            name="kind"
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value)}
            data-testid="intent-selector-select"
            className="gps-input"
            style={{ width: '100%' }}
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
          placeholder={placeholders.title || undefined}
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
          Body
        </label>
        <textarea
          id="body"
          name="body"
          data-testid="compose-body-input"
          required
          minLength={10}
          maxLength={10000}
          rows={10}
          placeholder={placeholders.body || undefined}
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

      {/* Activist Mailer URL */}
      <ActivistMailerField error={errors.activistMailerUrl?.[0]} />

      {/* Share a link? (BU-link-share / D060 / SCN-19) */}
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
        >
          {isPending ? 'Posting\u2026' : 'Post'}
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
