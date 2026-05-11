-- bu-network-shares
--
-- Adds the 'network_card' value to the ShareTargetType enum so the
-- polymorphic ShareEvent table (ADR-0018 / bu-share-event-polymorphic)
-- can record shares of network cards.
--
-- Postgres requires ALTER TYPE ... ADD VALUE to be committed before
-- the new value can be referenced. Prisma wraps each migration file in
-- a transaction, so this enum extension ships in its own migration
-- file with no other DDL — same split the BU-network-reactions
-- migration used (see 20260511120000_reaction_target_network_card_enum).
--
-- The typed FK column `networkCardStateId` and the relation already
-- exist on ShareEvent (created in 20260511120000_create_share_event)
-- so this is genuinely a one-line enum extension.

-- AlterEnum
ALTER TYPE "ShareTargetType" ADD VALUE 'network_card';
