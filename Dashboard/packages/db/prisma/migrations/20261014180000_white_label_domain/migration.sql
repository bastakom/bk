-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "customDomain" TEXT,
ADD COLUMN     "domainVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "emailFrom" TEXT,
ADD COLUMN     "emailFromName" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_customDomain_key" ON "workspaces"("customDomain");

