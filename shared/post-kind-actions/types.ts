/**
 * @build-unit BU-publish-router
 * @spec build/session-briefs/bu-publish-router.md
 * @spec architecture/decision-log.md (D072)
 *
 * Type-only contract for the per-kind action registry. Lives in its
 * own module so handler files and the registry barrel can both import
 * without a runtime cycle.
 *
 * D072 §4 sketches the handler signature as
 * `(post: PostId, ctx: ActionContext) => Promise<void>`. We carry a
 * structured `PostForAction` instead of a bare id so handlers don't
 * need an async re-fetch to format their message — the modal already
 * has the post's title/body/signal in scope when it dispatches.
 */

import type { Signal } from '@prisma/client';
import type { LucideIcon } from 'lucide-react';

export interface PostForAction {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly signal: Signal | null;
}

/**
 * Per-call dependencies the modal injects when invoking a handler.
 * Each handler reads only the keys it needs and surfaces a clear
 * error if a required dependency is missing — keeps the registry
 * extensible without forcing every kind to share the same context.
 */
export interface ActionContext {
  readonly originUrl: string;
  readonly channelUrl?: string;
  readonly onMarkSharedToNetwork?: (postId: string) => Promise<void>;
  /**
   * Hands a follow-up confirmation step (e.g. "Did you send it?") back
   * to the modal so the handler doesn't render UI of its own. The
   * modal renders the prompt, and `onYes` runs only if the user
   * confirms.
   */
  readonly onConfirmStep?: (prompt: string, onYes: () => Promise<void>) => void;
}

export interface PostKindAction {
  readonly slug: string;
  readonly label: (post: PostForAction) => string;
  readonly icon: LucideIcon;
  readonly primary?: boolean;
  readonly handler: (post: PostForAction, ctx: ActionContext) => Promise<void>;
}
