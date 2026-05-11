-- BU-network-reactions (Part 2 of 2)
--
-- Adds a nullable networkCardStateId FK on Reaction and the cross-FK
-- CHECK constraint that ties (targetType ⇔ FK column non-null). The
-- enum value 'network_card' itself was added in the sibling migration
-- 20260511120000_reaction_target_network_card_enum so that this file
-- can reference it inside the CHECK constraint (Postgres requires the
-- enum value's transaction to commit before reuse).
--
-- Forward-only. No backfill — new rows only. Existing rows all have
-- networkCardStateId IS NULL by virtue of column addition, so the CHECK
-- holds for legacy data.

-- AlterTable
ALTER TABLE "Reaction" ADD COLUMN "networkCardStateId" BIGINT;

-- CreateIndex
CREATE INDEX "Reaction_networkCardStateId_emoji_idx" ON "Reaction"("networkCardStateId", "emoji");

-- AddForeignKey
ALTER TABLE "Reaction"
  ADD CONSTRAINT "Reaction_networkCardStateId_fkey"
  FOREIGN KEY ("networkCardStateId")
  REFERENCES "NetworkCardState"("messageId")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

-- CHECK constraint — enforces the cross-FK invariant across the three
-- target types. Exactly one FK column matches the declared targetType.
ALTER TABLE "Reaction"
  ADD CONSTRAINT "Reaction_target_fk_alignment_check"
  CHECK (
    (
      "targetType" = 'post'
      AND "postId" IS NOT NULL
      AND "commentId" IS NULL
      AND "networkCardStateId" IS NULL
    )
    OR (
      "targetType" = 'comment'
      AND "commentId" IS NOT NULL
      AND "postId" IS NULL
      AND "networkCardStateId" IS NULL
    )
    OR (
      "targetType" = 'network_card'
      AND "networkCardStateId" IS NOT NULL
      AND "postId" IS NULL
      AND "commentId" IS NULL
    )
  );
