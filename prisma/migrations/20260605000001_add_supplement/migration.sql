-- CreateTable
CREATE TABLE "Supplement" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      TEXT NOT NULL,
    "time"      TEXT,
    "kind"      TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "quantity"  DOUBLE PRECISION NOT NULL,
    "unit"      TEXT NOT NULL,
    "kcal"      DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");

-- AddForeignKey
ALTER TABLE "Supplement" ADD CONSTRAINT "Supplement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
