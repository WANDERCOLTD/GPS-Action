'use client';

/**
 * @build-unit BU-post-hero-demo
 * @spec build/session-briefs/bu-post-hero-demo.md
 * @adr D064
 *
 * Demo picker — grid of seeded hero images. Click selects; click the
 * same image again deselects. Phase 2 BU-image swaps the underlying
 * source set (real upload + S3 + moderation) without changing the
 * controlled-component contract here.
 */

import type { CSSProperties } from 'react';
import { SEED_HERO_IMAGES } from '@/shared/seed-images';

export interface HeroImagePickerProps {
  /** Selected URL, or null when no hero is chosen. */
  value: string | null;
  /** Called with the next URL, or null when toggled off. */
  onChange: (next: string | null) => void;
  /** Optional label override. Defaults to "Add a hero image (optional)". */
  label?: string;
  /** Disable interaction (e.g. while submitting). */
  disabled?: boolean;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-2)',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 'var(--text-sm)',
  fontWeight: 500,
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-primary)',
};

const helperStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xs)',
  fontFamily: 'var(--font-ui)',
  color: 'var(--colour-text-secondary)',
};

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 'var(--space-2)',
};

function tileStyle(isSelected: boolean, isDimmed: boolean, disabled: boolean): CSSProperties {
  return {
    position: 'relative',
    aspectRatio: '16 / 9',
    padding: 0,
    border: isSelected
      ? '3px solid var(--colour-primary)'
      : '1px solid var(--colour-border-subtle)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    cursor: disabled ? 'not-allowed' : 'pointer',
    background: 'var(--colour-surface-sunken)',
    opacity: isDimmed ? 0.55 : 1,
    transition: 'opacity 120ms ease, border-color 120ms ease',
  };
}

const imgStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
};

export function HeroImagePicker({
  value,
  onChange,
  label = 'Add a hero image (optional)',
  disabled = false,
}: HeroImagePickerProps) {
  const hasSelection = value !== null;

  return (
    <div data-testid="compose-hero-picker" style={containerStyle}>
      <span style={labelStyle}>{label}</span>
      <p style={helperStyle}>Pick one to show at the top of your post — tap again to clear.</p>
      <div role="radiogroup" aria-label={label} style={gridStyle}>
        {SEED_HERO_IMAGES.map((img, index) => {
          const isSelected = value === img.url;
          // Dim non-selected tiles only when something else is selected.
          const isDimmed = hasSelection && !isSelected;
          return (
            <button
              key={img.url}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={img.alt}
              data-testid="compose-hero-option"
              data-index={index}
              data-selected={isSelected ? 'true' : 'false'}
              disabled={disabled}
              onClick={() => onChange(isSelected ? null : img.url)}
              style={tileStyle(isSelected, isDimmed, disabled)}
            >
              <img src={img.url} alt={img.alt} loading="lazy" style={imgStyle} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
