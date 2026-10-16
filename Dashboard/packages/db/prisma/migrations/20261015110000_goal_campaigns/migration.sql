-- AlterTable
ALTER TABLE "client_goals" ADD COLUMN     "endDate" DATE,
ADD COLUMN     "filters" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "group" TEXT,
ADD COLUMN     "startDate" DATE;

