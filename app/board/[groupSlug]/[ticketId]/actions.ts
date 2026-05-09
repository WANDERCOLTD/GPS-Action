'use server';

/**
 * @build-unit bu-coordination-board (build seq #5 — Surface 2, PR #5b)
 * @spec docs/build/session-briefs/bu-coordination-board.md
 *
 * Server actions for the BoardActionPair on Surface 2. Wraps the four
 * existing tRPC mutations:
 *
 *   - assignment.assignSelf      — auto-subscribes (Tier-2 default #4).
 *   - assignment.unassignSelf    — leaves any existing subscription in place.
 *   - subscription.followSelf    — manual gesture, source = 'explicit'.
 *   - subscription.unfollowSelf  — soft-deletes the subscription row.
 *
 * Each action returns `{ ok, error? }` so the client can render an
 * inline error without interpreting a TRPCError. All four
 * `revalidatePath` the ticket-detail route on success so the page
 * server-fetches the updated assignees / subscribers list.
 */

import { revalidatePath } from 'next/cache';
import { TRPCError } from '@trpc/server';
import { createCaller } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/routers/context';

export interface BoardActionResult {
  ok: boolean;
  error?: string;
}

interface BoardActionInput {
  requestId: string;
  /** Used to revalidate the precise ticket-detail route on success. */
  groupSlug: string;
}

function ticketPath(input: BoardActionInput): string {
  return `/board/${input.groupSlug}/${input.requestId}`;
}

export async function assignSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.assignment.assignSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not assign — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function unassignSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.assignment.unassignSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not unassign — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function followSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.subscription.followSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not follow — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function unfollowSelfAction(input: BoardActionInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.subscription.unfollowSelf({ requestId: input.requestId });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not unfollow — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

interface EditTitleInput extends BoardActionInput {
  /** The group whose board the editor is acting on (drives the gate). */
  groupId: string;
  title: string;
}

interface EditBodyInput extends BoardActionInput {
  groupId: string;
  /** null clears the description. */
  body: string | null;
}

export async function editTitleAction(input: EditTitleInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.board.editTitle({
      requestId: input.requestId,
      groupId: input.groupId,
      title: input.title,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not save — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function editBodyAction(input: EditBodyInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.board.editBody({
      requestId: input.requestId,
      groupId: input.groupId,
      body: input.body,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not save — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

// ── Comment / Note compose (atom 5d-2) ───────────────────────────────────

interface ComposeInput extends BoardActionInput {
  body: string;
}

export async function postCommentAction(input: ComposeInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.commentThread.postComment({
      requestId: input.requestId,
      body: input.body,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not post — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

export async function postNoteAction(input: ComposeInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.commentThread.postNote({
      requestId: input.requestId,
      body: input.body,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not post — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

// ── Urgent flip ──────────────────────────────────────────────────────────

interface SetUrgentInput extends BoardActionInput {
  /** The group whose board the editor is acting on (drives the gate). */
  groupId: string;
  urgent: boolean;
}

export async function setUrgentAction(input: SetUrgentInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.board.setUrgent({
      requestId: input.requestId,
      groupId: input.groupId,
      urgent: input.urgent,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not update — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

// ── Share with team (atom 5e) ────────────────────────────────────────────

interface ShareWithTeamInput extends BoardActionInput {
  /** Caller's current group context (drives the workflow lookup). */
  sourceGroupId: string;
  targetGroupId: string;
}

export async function shareWithTeamAction(input: ShareWithTeamInput): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.share.toGroup({
      requestId: input.requestId,
      sourceGroupId: input.sourceGroupId,
      targetGroupId: input.targetGroupId,
      mode: 'workflow',
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not share — try again.' };
  }
  revalidatePath(ticketPath(input));
  return { ok: true };
}

// ── Unshare from team (Item 4 — bu-ticket-view-fixes Sub-build B) ────────

interface UnshareFromTeamInput extends BoardActionInput {
  /** The group the share is being removed from (target side). */
  targetGroupId: string;
}

/**
 * Remove a share. Permission is enforced server-side per Q1 of the
 * brief: members of the originating team, members of the receiving
 * team, and admins may all unshare. The mutation is idempotent — a
 * second call with the share already gone returns ok=true so the UI
 * doesn't error on a no-op.
 *
 * After success the page revalidates so the receiving-team member's
 * next render either drops the pill (if they're still on the
 * originating board) or detects access loss + redirects to the
 * lifecycle list (handled by the page's access check). The server
 * action does not navigate — that decision lives at the page layer.
 */
export async function unshareFromTeamAction(
  input: UnshareFromTeamInput,
): Promise<BoardActionResult> {
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    await caller.share.fromGroup({
      requestId: input.requestId,
      groupId: input.targetGroupId,
    });
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not unshare — try again.' };
  }
  // Revalidate the parent group's board too — its shared list shrinks.
  revalidatePath(ticketPath(input));
  revalidatePath(`/board/${input.groupSlug}`);
  return { ok: true };
}

// ── Delete ticket (Item 13 — bu-ticket-view-fixes Sub-build B) ───────────

export interface DeleteRequestActionResult extends BoardActionResult {
  /**
   * Where the deleter should be navigated next — drives the post-delete
   * `router.push` on the client. Set on success only.
   */
  redirectTo?: string;
}

/**
 * Hard-delete the ticket. Permission (originator OR sysadmin) is
 * enforced server-side; the UI gates the affordance to those roles
 * but a third-party who somehow triggered the action would still get
 * `forbidden` from the server.
 *
 * On success returns `redirectTo` — a path to the originating group's
 * lifecycle list matching the request's last status. The client
 * navigates there after closing the confirmation modal. The
 * originating group's slug is needed for the path; the action looks
 * it up via a fresh lookup before the delete, since the row is gone
 * after.
 */
export async function deleteRequestAction(
  input: BoardActionInput,
): Promise<DeleteRequestActionResult> {
  let redirectTo: string;
  try {
    const ctx = await createTRPCContext();
    const caller = createCaller(ctx);
    const result = await caller.board.delete({ requestId: input.requestId });

    // Resolve the originating group's slug for the redirect path.
    // Fallback: the page's groupSlug if for some reason the
    // originating group can't be resolved (defensive — every Request
    // has exactly one originating row by construction).
    let originatingSlug = input.groupSlug;
    if (result.originatingGroupId) {
      const groups = await caller.groupKanban.listMine();
      const match = groups.find((g) => g.group.id === result.originatingGroupId);
      if (match) originatingSlug = match.group.slug;
    }

    const lane = result.status === 'backlog' ? '/backlog' : result.status === 'done' ? '/done' : '';
    redirectTo = `/board/${originatingSlug}${lane}`;
  } catch (err) {
    if (err instanceof TRPCError) return { ok: false, error: err.message };
    return { ok: false, error: 'Could not delete — try again.' };
  }
  // The whole originating board changes, plus this ticket's detail
  // surface. Revalidate both so cached renders elsewhere don't show
  // the deleted card.
  revalidatePath(`/board/${input.groupSlug}`);
  revalidatePath(ticketPath(input));
  return { ok: true, redirectTo };
}
