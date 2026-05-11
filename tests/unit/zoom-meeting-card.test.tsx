/**
 * Unit tests for ZoomMeetingCard.
 *
 * @build-unit bu-network-zoom-card
 *
 * Same tree-walk pattern as the other component tests — invokes
 * the component as a plain function (vitest env is `node`, no RTL)
 * and walks the ReactElement tree.
 */

import { describe, it, expect } from 'vitest';
import type { ReactElement } from 'react';
import { ZoomMeetingCard } from '@/components/ZoomMeetingCard';
import type { ZoomInvitation } from '@/shared/lib/parse-zoom-invitation';

type AnyElement = ReactElement<Record<string, unknown>>;

function flatChildren(el: AnyElement): AnyElement[] {
  const acc: AnyElement[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== 'object' || !('props' in node)) return;
    const e = node as AnyElement;
    acc.push(e);
    walk(e.props.children);
  };
  walk(el);
  return acc;
}

function findByTestId(el: AnyElement, testId: string): AnyElement | undefined {
  return flatChildren(el).find((e) => e.props['data-testid'] === testId);
}

const fullInvitation: ZoomInvitation = {
  joinUrl: 'https://us06web.zoom.us/j/85708336781?pwd=672045',
  topic: "NEWS WRITERS - GPS's Zoom Meeting",
  time: 'May 11, 2026 06:45 PM London',
  meetingId: '857 0833 6781',
  passcode: '672045',
  recurrence: 'Every week on Mon, 106 occurrences',
};

const baseProps = {
  linkUrl: 'https://us06web.zoom.us/j/85708336781',
  invitation: fullInvitation,
  rawBody: 'full invitation body…',
  messageId: '42',
};

describe('ZoomMeetingCard', () => {
  it('renders the meeting topic', () => {
    const tree = ZoomMeetingCard(baseProps) as AnyElement;
    const topic = findByTestId(tree, 'network-zoom-card-topic');
    expect(topic).toBeDefined();
    expect(topic?.props.children).toBe("NEWS WRITERS - GPS's Zoom Meeting");
  });

  it('renders time + recurrence concatenated on the meta line', () => {
    const tree = ZoomMeetingCard(baseProps) as AnyElement;
    const meta = findByTestId(tree, 'network-zoom-card-meta');
    expect(meta?.props.children).toBe(
      'May 11, 2026 06:45 PM London · Every week on Mon, 106 occurrences',
    );
  });

  it('renders the Join button pointing at the parsed joinUrl', () => {
    const tree = ZoomMeetingCard(baseProps) as AnyElement;
    const join = findByTestId(tree, 'network-zoom-card-join');
    expect(join).toBeDefined();
    expect(join?.props.href).toBe('https://us06web.zoom.us/j/85708336781?pwd=672045');
    expect(join?.props.target).toBe('_blank');
    expect(join?.props.rel).toBe('noopener noreferrer');
    expect(join?.props.children).toBe('Join meeting →');
  });

  it('falls back to linkUrl when invitation.joinUrl is null', () => {
    const tree = ZoomMeetingCard({
      ...baseProps,
      invitation: { ...fullInvitation, joinUrl: null },
    }) as AnyElement;
    const join = findByTestId(tree, 'network-zoom-card-join');
    expect(join?.props.href).toBe('https://us06web.zoom.us/j/85708336781');
  });

  it('renders a "Meeting details" expander with id + passcode + raw body', () => {
    const tree = ZoomMeetingCard(baseProps) as AnyElement;
    const details = findByTestId(tree, 'network-zoom-card-details');
    expect(details).toBeDefined();
    expect(findByTestId(tree, 'network-zoom-card-meeting-id')).toBeDefined();
    expect(findByTestId(tree, 'network-zoom-card-passcode')).toBeDefined();
    expect(findByTestId(tree, 'network-zoom-card-raw-body')).toBeDefined();
  });

  it('omits the details expander when nothing collapsible is present', () => {
    const tree = ZoomMeetingCard({
      ...baseProps,
      invitation: { ...fullInvitation, meetingId: null, passcode: null },
      rawBody: null,
    }) as AnyElement;
    expect(findByTestId(tree, 'network-zoom-card-details')).toBeUndefined();
  });

  it('renders without a topic when invitation.topic is null', () => {
    const tree = ZoomMeetingCard({
      ...baseProps,
      invitation: { ...fullInvitation, topic: null },
    }) as AnyElement;
    expect(findByTestId(tree, 'network-zoom-card-topic')).toBeUndefined();
    // Join button still renders — the join URL is the meaningful action.
    expect(findByTestId(tree, 'network-zoom-card-join')).toBeDefined();
  });

  it('omits the meta line when both time and recurrence are null', () => {
    const tree = ZoomMeetingCard({
      ...baseProps,
      invitation: { ...fullInvitation, time: null, recurrence: null },
    }) as AnyElement;
    expect(findByTestId(tree, 'network-zoom-card-meta')).toBeUndefined();
  });

  it('tags the article with the messageId for parent selectors', () => {
    const tree = ZoomMeetingCard(baseProps) as AnyElement;
    expect(tree.props['data-message-id']).toBe('42');
    expect(tree.props['data-testid']).toBe('network-zoom-card');
  });
});
