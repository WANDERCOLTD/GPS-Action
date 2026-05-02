'use client';

/**
 * @build-unit BU-event-time
 * @spec architecture/decision-log.md (D073)
 * @spec docs/adrs/0001-post-event-time-fields.md
 *
 * Edit form for an existing Post. Renders title / body / visibility /
 * link-share fields / hero / event-time fields (when the kind is
 * time-bearing per shared/post-kinds.kindIsTimeBearing). Mirrors the
 * compose form's structure but pre-fills every input from the
 * existing post values.
 *
 * The kind itself is not editable here — it's surfaced as a static
 * read-only display. Changing the kind of a post-after-the-fact has
 * audit + UX implications we don't take on in this BU; the existing
 * "delete and recreate" path covers the rare case.
 *
 * Layer boundary: components → components / shared / styles. The
 * server action `updatePostAction` is passed in as a prop from the
 * parent page (server component), keeping this client component
 * boundary-clean.
 */

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { kindIsTimeBearing } from '@/shared/post-kinds';
import { resolveLocation } from '@/shared/geo';
import { HeroImagePicker } from './HeroImagePicker';
import {
  EventFieldsBlock,
  EMPTY_EVENT_FIELDS_STATE,
  type EventFieldsState,
} from './EventFieldsBlock';
import { PostLocationFieldsBlock, type PostLocationFieldsState } from './PostLocationFieldsBlock';
import type { UpdatePostResult } from '@/app/post/[id]/edit/actions';

interface InitialPost {
  id: string;
  title: string;
  body: string;
  visibility: 'public' | 'authenticated_only';
  linkUrl: string | null;
  linkTitle: string | null;
  linkDescription: string | null;
  linkImageUrl: string | null;
  linkSiteName: string | null;
  heroImageUrl: string | null;
  kindSlug: string | null;
  kindDisplayName: string | null;
  /** BU-post-location-input. Pre-fill the isOnline toggle from the
   * existing Post; the postcode field always opens empty (we don't
   * reverse-geocode). */
  isOnline: boolean;
}

interface EditPostFormProps {
  post: InitialPost;
  /** Initial event-time fields, pre-formatted as Europe/London wall-clock. */
  initialEventFields: EventFieldsState;
  onSubmit: (formData: FormData) => Promise<UpdatePostResult | void>;
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  marginBottom: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
};

const errorStyle: CSSProperties = {
  color: 'var(--colour-danger)',
  fontSize: 'var(--text-xs)',
  marginTop: 'var(--space-1)',
  fontFamily: 'var(--font-ui)',
};

export function EditPostForm({ post, initialEventFields, onSubmit }: EditPostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [heroImageUrl, setHeroImageUrl] = useState<string | null>(post.heroImageUrl);
  const [shareLinkOpen, setShareLinkOpen] = useState(Boolean(post.linkUrl));
  const [eventFields, setEventFields] = useState<EventFieldsState>(
    initialEventFields ?? EMPTY_EVENT_FIELDS_STATE,
  );
  // BU-post-location-input. Postcode opens empty (no reverse-geocode);
  // isOnline pre-fills from the current Post value. Online wins at
  // submit if both are set — the server clears coords either way.
  const [locationFields, setLocationFields] = useState<PostLocationFieldsState>({
    postcode: '',
    isOnline: post.isOnline,
  });
  const [postcodeError, setPostcodeError] = useState<string | null>(null);

  const isTimeBearing = kindIsTimeBearing(post.kindSlug);

  function handleSubmit(formData: FormData): void {
    startTransition(async () => {
      // BU-post-location-input. Resolve the postcode → coords (or
      // honour isOnline) before the server action runs. Same rules
      // as the composer: a typed postcode AND ticked "online" → online
      // wins, coords cleared. An empty postcode preserves the
      // existing coords (server skips lat/lng when neither was set).
      if (isTimeBearing) {
        setPostcodeError(null);
        if (locationFields.isOnline) {
          formData.set('isOnline', 'true');
          formData.delete('postcode');
        } else {
          // Explicitly mark online=false so the server action distinguishes
          // "user untoggled it" from "field absent".
          formData.set('isOnline', 'false');
          const trimmed = locationFields.postcode.trim();
          if (trimmed) {
            const coords = await resolveLocation(trimmed);
            if (!coords) {
              setPostcodeError(
                "Couldn't find that location — try a UK postcode, town or city, or tick 'This is online'",
              );
              return;
            }
            formData.set('latitude', String(coords.lat));
            formData.set('longitude', String(coords.lng));
          }
        }
      } else {
        formData.delete('postcode');
        formData.delete('isOnline');
      }
      const result = await onSubmit(formData);
      if (result?.errors) {
        setErrors(result.errors);
        return;
      }
      // Server action redirected on success.
    });
  }

  function handleCancel(): void {
    router.push(`/post/${post.id}`);
  }

  return (
    <form
      action={handleSubmit}
      data-testid="post-edit-post-form"
      data-post-id={post.id}
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
      {/* Read-only kind chip */}
      {post.kindSlug && (
        <div
          data-testid="post-edit-post-kind-display"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--colour-surface-sunken)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--colour-text-secondary)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Kind: <strong>{post.kindDisplayName ?? post.kindSlug}</strong>{' '}
          <span style={{ color: 'var(--colour-text-tertiary)' }}>(not editable here)</span>
        </div>
      )}

      {/* Form-level error */}
      {errors._form && (
        <p
          role="alert"
          style={{
            color: 'var(--colour-danger)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          {errors._form[0]}
        </p>
      )}

      {/* Title */}
      <div>
        <label htmlFor="title" data-testid="post-edit-title-label" style={labelStyle}>
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          data-testid="post-edit-title-input"
          required
          minLength={3}
          maxLength={200}
          defaultValue={post.title}
          className="gps-input"
          style={{
            width: '100%',
            borderColor: errors['title'] ? 'var(--colour-danger)' : undefined,
          }}
        />
        {errors['title'] && (
          <p role="alert" style={errorStyle}>
            {errors['title'][0]}
          </p>
        )}
      </div>

      {/* Body */}
      <div>
        <label htmlFor="body" data-testid="post-edit-body-label" style={labelStyle}>
          Body
        </label>
        <textarea
          id="body"
          name="body"
          data-testid="post-edit-body-input"
          required
          minLength={10}
          maxLength={10000}
          rows={10}
          defaultValue={post.body}
          className="gps-input"
          style={{
            width: '100%',
            resize: 'vertical',
            borderColor: errors['body'] ? 'var(--colour-danger)' : undefined,
          }}
        />
        {errors['body'] && (
          <p role="alert" style={errorStyle}>
            {errors['body'][0]}
          </p>
        )}
      </div>

      {/* BU-event-time / D073 — date+time + location pickers, when
          the kind is time-bearing. */}
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

      {/* BU-post-location-input — postcode + "this is online" toggle.
          Postcode opens empty (we don't reverse-geocode existing
          coords); leaving it blank preserves the previously-saved
          coords. Online wins when both are set. */}
      {isTimeBearing && (
        <PostLocationFieldsBlock
          value={locationFields}
          onChange={(next) => {
            setLocationFields(next);
            if (postcodeError) setPostcodeError(null);
          }}
          geocodeError={postcodeError}
          disabled={isPending}
        />
      )}

      {/* Hero image picker */}
      <HeroImagePicker value={heroImageUrl} onChange={setHeroImageUrl} disabled={isPending} />
      <input
        type="hidden"
        name="heroImageUrl"
        value={heroImageUrl ?? ''}
        data-testid="post-edit-hero-image-input"
      />

      {/* Share a link? */}
      <div>
        <button
          type="button"
          data-testid="post-edit-sharelink-toggle"
          onClick={() => setShareLinkOpen((v) => !v)}
          aria-expanded={shareLinkOpen}
          aria-controls="edit-sharelink-fields"
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
            id="edit-sharelink-fields"
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
              <label htmlFor="linkUrl" data-testid="post-edit-link-url-label" style={labelStyle}>
                Link URL
              </label>
              <input
                id="linkUrl"
                name="linkUrl"
                type="url"
                inputMode="url"
                placeholder="https://..."
                defaultValue={post.linkUrl ?? ''}
                data-testid="post-edit-link-url-input"
                className="gps-input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label
                htmlFor="linkTitle"
                data-testid="post-edit-link-title-label"
                style={labelStyle}
              >
                Title
              </label>
              <input
                id="linkTitle"
                name="linkTitle"
                type="text"
                maxLength={200}
                defaultValue={post.linkTitle ?? ''}
                data-testid="post-edit-link-title-input"
                className="gps-input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label
                htmlFor="linkDescription"
                data-testid="post-edit-link-description-label"
                style={labelStyle}
              >
                Description
              </label>
              <textarea
                id="linkDescription"
                name="linkDescription"
                rows={2}
                maxLength={500}
                defaultValue={post.linkDescription ?? ''}
                data-testid="post-edit-link-description-input"
                className="gps-input"
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
            <div>
              <label
                htmlFor="linkImageUrl"
                data-testid="post-edit-link-imageurl-label"
                style={labelStyle}
              >
                Image URL
              </label>
              <input
                id="linkImageUrl"
                name="linkImageUrl"
                type="url"
                inputMode="url"
                placeholder="https://..."
                defaultValue={post.linkImageUrl ?? ''}
                data-testid="post-edit-link-imageurl-input"
                className="gps-input"
                style={{ width: '100%' }}
              />
            </div>
            <div>
              <label
                htmlFor="linkSiteName"
                data-testid="post-edit-link-sitename-label"
                style={labelStyle}
              >
                Site name
              </label>
              <input
                id="linkSiteName"
                name="linkSiteName"
                type="text"
                maxLength={100}
                defaultValue={post.linkSiteName ?? ''}
                data-testid="post-edit-link-sitename-input"
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
            data-testid="post-edit-visibility-public-label"
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
              data-testid="post-edit-visibility-public-input"
              defaultChecked={post.visibility === 'public'}
            />
            Public
          </label>
          <label
            data-testid="post-edit-visibility-authed-label"
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
              data-testid="post-edit-visibility-authed-input"
              defaultChecked={post.visibility === 'authenticated_only'}
            />
            Logged-in only
          </label>
        </div>
      </fieldset>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
        <button
          type="submit"
          disabled={isPending}
          data-testid="post-edit-post-submit"
          className="gps-btn gps-btn--primary"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          data-testid="post-edit-post-cancel"
          className="gps-btn gps-btn--secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
