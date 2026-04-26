-- BU-post-hero-demo (D064): member-picked hero image, distinct from
-- linkImageUrl. Allow-list enforced at the application layer; the column
-- itself is just a nullable URL.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "heroImageUrl" TEXT;
