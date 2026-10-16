-- AlterTable
ALTER TABLE "creatives" ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageSource" TEXT,
ADD COLUMN     "imageType" TEXT,
ADD COLUMN     "mediaRef" TEXT,
ADD COLUMN     "permalink" TEXT;
