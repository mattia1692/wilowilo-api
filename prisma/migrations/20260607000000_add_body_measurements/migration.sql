-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "value"     DOUBLE PRECISION NOT NULL,
    "unit"      TEXT NOT NULL,
    "note"      TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_idx" ON "BodyMeasurement"("userId");

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_date_idx" ON "BodyMeasurement"("userId", "date");

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
