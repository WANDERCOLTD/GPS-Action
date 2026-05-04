-- bu-coordination-board / Tier-2 default #8
--
-- Rename GroupMembershipRole enum value `lead` → `admin`. Hand-written
-- because Prisma can't safely auto-generate an enum value rename — the
-- default behaviour is DROP + CREATE, which loses any existing rows
-- carrying the old value.
--
-- ALTER TYPE ... RENAME VALUE preserves rows in place; existing
-- GroupMembership rows with role = 'lead' silently become role = 'admin'
-- without a separate UPDATE. Idempotent in spirit (re-running on a
-- DB where the value is already 'admin' fails — but Prisma's
-- _prisma_migrations table prevents re-runs).
--
-- Companion: scripts/seed.ts switches its 'lead' literal to 'admin'
-- in the same PR.

ALTER TYPE "GroupMembershipRole" RENAME VALUE 'lead' TO 'admin';
