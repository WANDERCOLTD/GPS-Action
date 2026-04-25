-- CreateEnum
CREATE TYPE "ReactionEmoji" AS ENUM ('candle', 'pray', 'heart', 'strong', 'target', 'sparkle', 'thumbsup', 'sad');

-- CreateEnum
CREATE TYPE "ReactionTargetType" AS ENUM ('post');

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "ReactionTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "postId" TEXT,
    "emoji" "ReactionEmoji" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reaction_targetType_targetId_idx" ON "Reaction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Reaction_postId_emoji_idx" ON "Reaction"("postId", "emoji");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_targetType_targetId_emoji_key" ON "Reaction"("userId", "targetType", "targetId", "emoji");

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
