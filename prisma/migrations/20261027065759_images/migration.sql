-- CreateEnum
CREATE TYPE "ImageType" AS ENUM ('png', 'jpeg', 'gif', 'webp');

-- CreateTable
CREATE TABLE "Image" (
    "id" UUID NOT NULL,
    "type" "ImageType" NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);
