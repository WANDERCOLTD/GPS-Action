-- BU-tick-or-cross (D069): adds Post.signal + Post.sharedToNetworkAt for
-- the "✅ or ❌" PostKind. Additive only — no breaking changes to
-- existing rows. Both columns are nullable; existing posts read NULL.

-- CreateEnum
CREATE TYPE "Signal" AS ENUM ('promote', 'remove');

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "signal" "Signal";
ALTER TABLE "Post" ADD COLUMN     "sharedToNetworkAt" TIMESTAMP(3);
