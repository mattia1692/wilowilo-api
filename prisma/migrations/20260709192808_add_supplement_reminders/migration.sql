-- AlterTable
ALTER TABLE "Supplement" ADD COLUMN     "reminderId" TEXT;

-- CreateTable
CREATE TABLE "SupplementReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dosage" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'integratore',
    "note" TEXT,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplementReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplementReminder_userId_idx" ON "SupplementReminder"("userId");

-- CreateIndex
CREATE INDEX "SupplementReminder_userId_isActive_idx" ON "SupplementReminder"("userId", "isActive");

-- AddForeignKey
ALTER TABLE "SupplementReminder" ADD CONSTRAINT "SupplementReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
