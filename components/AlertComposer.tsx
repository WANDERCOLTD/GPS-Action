'use client';

/**
 * @build-unit BU-requests-urgent
 * @spec architecture/decision-log.md (D044, D058)
 *
 * Streamlined alert composer — category chip picker + title + body.
 * Client component because the chip-selection state is local. The
 * server action does the work; the client just collects the form.
 */

import { useState, useTransition } from 'react';
import type { CSSProperties } from 'react';
import type { CreateUrgentResult } from '@/app/alert/new/actions';
import type { AlertCategorySummary } from '@/server/services/alert-category';

interface AlertComposerProps {
  categories: AlertCategorySummary[];
  onSubmit: (formData: FormData) => Promise<CreateUrgentResult | void>;
}

export function AlertComposer({ categories, onSubmit }: AlertComposerProps) {
  const initialId = categories[0]?.id ?? '';
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialId);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData): void {
    formData.set('alertCategoryId', selectedCategoryId);
    startTransition(async () => {
      const result = await onSubmit(formData);
      if (result?.errors) {
        setErrors(result.errors);
      }
    });
  }

  const chipBase: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: 'var(--space-2) var(--space-3)',
    borderRadius: 'var(--radius-pill)',
    border: '1px solid var(--colour-border-subtle)',
    background: 'var(--colour-surface-raised)',
    fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
  };

  const chipActive: CSSProperties = {
    ...chipBase,
    background: 'var(--colour-urgent-subtle)',
    borderColor: 'var(--colour-urgent)',
    color: 'var(--colour-text-primary)',
    fontWeight: 600,
  };

  return (
    <form
      action={handleSubmit}
      data-testid="alert-composer-form"
      style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}
    >
      {errors._form && (
        <p style={{ color: 'var(--colour-danger)', fontSize: 'var(--text-sm)' }} role="alert">
          {errors._form[0]}
        </p>
      )}

      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            marginBottom: 'var(--space-2)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          Category
        </legend>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              data-testid="alert-composer-category-chip"
              data-category-slug={cat.slug}
              data-active={selectedCategoryId === cat.id || undefined}
              onClick={() => setSelectedCategoryId(cat.id)}
              style={selectedCategoryId === cat.id ? chipActive : chipBase}
            >
              {cat.displayName}
            </button>
          ))}
        </div>
      </fieldset>

      <div>
        <label
          htmlFor="alert-title"
          data-testid="alert-composer-title-label"
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            marginBottom: 'var(--space-1)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          What's happening
        </label>
        <input
          id="alert-title"
          name="title"
          type="text"
          required
          minLength={3}
          maxLength={200}
          placeholder="One-line summary"
          data-testid="alert-composer-title-input"
          className="gps-input"
          style={{ width: '100%', borderColor: errors.title ? 'var(--colour-danger)' : undefined }}
        />
        {errors.title && (
          <p
            style={{
              color: 'var(--colour-danger)',
              fontSize: 'var(--text-xs)',
              marginTop: 'var(--space-1)',
            }}
            role="alert"
          >
            {errors.title[0]}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="alert-body"
          data-testid="alert-composer-body-label"
          style={{
            display: 'block',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            marginBottom: 'var(--space-1)',
            fontFamily: 'var(--font-ui)',
          }}
        >
          What you've seen
        </label>
        <textarea
          id="alert-body"
          name="body"
          required
          minLength={10}
          maxLength={2000}
          rows={6}
          placeholder="Where, when, what — short paragraph the team can act on."
          data-testid="alert-composer-body-input"
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
            }}
            role="alert"
          >
            {errors.body[0]}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <button
          type="submit"
          disabled={isPending || !selectedCategoryId}
          data-testid="alert-composer-submit"
          className="gps-btn gps-btn--primary"
          style={{ background: 'var(--colour-urgent)' }}
        >
          {isPending ? 'Raising…' : 'Raise alert'}
        </button>
        <a
          href="/feed"
          data-testid="alert-composer-cancel"
          className="gps-btn gps-btn--secondary"
          style={{ textDecoration: 'none' }}
        >
          Cancel
        </a>
      </div>
    </form>
  );
}
