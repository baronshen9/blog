-- CreateEnum
CREATE TYPE "Language" AS ENUM ('zh', 'en');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'published');

-- CreateTable
CREATE TABLE "Post" (
    "id" UUID NOT NULL,
    "translationGroupId" UUID NOT NULL,
    "language" "Language" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Post_language_slug_key" ON "Post"("language", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Post_translationGroupId_language_key" ON "Post"("translationGroupId", "language");
