-- BU-network-reactions (Part 1 of 2)
--
-- Adds the 'network_card' value to the ReactionTargetType enum.
--
-- Postgres requires ALTER TYPE ... ADD VALUE to be committed before
-- the new value can be referenced (e.g. in a CHECK constraint).
-- Prisma wraps each migration file in a transaction, so the FK + CHECK
-- additions land in a second migration file (sibling, runs next).

-- AlterEnum
ALTER TYPE "ReactionTargetType" ADD VALUE 'network_card';
