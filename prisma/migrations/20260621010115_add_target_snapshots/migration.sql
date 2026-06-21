-- CreateTable
CREATE TABLE "TargetSnapshot" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "effectiveDate" TEXT NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "satfat" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TargetSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TargetSnapshot_userId_idx" ON "TargetSnapshot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetSnapshot_userId_effectiveDate_key" ON "TargetSnapshot"("userId", "effectiveDate");

-- AddForeignKey
ALTER TABLE "TargetSnapshot" ADD CONSTRAINT "TargetSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
