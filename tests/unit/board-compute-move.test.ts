/**
 * Unit tests for `computeMove` — the pure drag-end helper that powers
 * `BoardGrid`'s optimistic update.
 */

import { describe, it, expect } from 'vitest';
import { computeMove, type CardsByColumn } from '@/components/board/computeMove';
import type { CardProps } from '@/components/board/Card';

const NOW = new Date('2026-05-05T12:00:00Z');

const card = (id: string): CardProps['ticket'] => ({
  id,
  title: `Card ${id}`,
  kindSlug: null,
  kindDisplayName: null,
  isUrgent: false,
  assignees: [],
  updatedAt: NOW,
});

describe('computeMove', () => {
  it('returns null when the request id is not in any column', () => {
    const map: CardsByColumn = { a: [card('1')], b: [] };
    expect(computeMove(map, 'unknown', 'b')).toBeNull();
  });

  it('returns null when the source and target columns are the same', () => {
    const map: CardsByColumn = { a: [card('1')] };
    expect(computeMove(map, '1', 'a')).toBeNull();
  });

  it('moves the card out of the source column', () => {
    const map: CardsByColumn = { a: [card('1'), card('2')], b: [] };
    const result = computeMove(map, '1', 'b');
    expect(result).not.toBeNull();
    expect(result!.next.a!.map((c) => c.id)).toEqual(['2']);
  });

  it('appends the card to the END of the target column', () => {
    const map: CardsByColumn = { a: [card('1')], b: [card('3'), card('4')] };
    const result = computeMove(map, '1', 'b');
    expect(result!.next.b!.map((c) => c.id)).toEqual(['3', '4', '1']);
  });

  it('uses the previous-end card as beforeRequestId', () => {
    const map: CardsByColumn = { a: [card('1')], b: [card('3'), card('4')] };
    const result = computeMove(map, '1', 'b');
    expect(result?.beforeRequestId).toBe('4');
    expect(result?.afterRequestId).toBeNull();
  });

  it('returns null beforeRequestId when target column was empty', () => {
    const map: CardsByColumn = { a: [card('1')], b: [] };
    const result = computeMove(map, '1', 'b');
    expect(result?.beforeRequestId).toBeNull();
  });

  it('returns null beforeRequestId when target key is missing entirely', () => {
    const map: CardsByColumn = { a: [card('1')] };
    const result = computeMove(map, '1', 'fresh');
    expect(result?.beforeRequestId).toBeNull();
    expect(result!.next.fresh!.map((c) => c.id)).toEqual(['1']);
  });

  it('does not mutate the input map', () => {
    const map: CardsByColumn = { a: [card('1')], b: [card('2')] };
    const before = JSON.stringify(map);
    computeMove(map, '1', 'b');
    expect(JSON.stringify(map)).toBe(before);
  });

  it('preserves card identity when moving (does not clone the ticket)', () => {
    const original = card('1');
    const map: CardsByColumn = { a: [original], b: [] };
    const result = computeMove(map, '1', 'b');
    expect(result!.next.b![0]).toBe(original);
  });
});
