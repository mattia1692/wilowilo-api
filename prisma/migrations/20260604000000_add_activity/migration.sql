-- CreateTable
CREATE TABLE "Activity" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "date"        TEXT NOT NULL,
    "time"        TEXT,
    "type"        TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "icon"        TEXT NOT NULL,
    "color"       TEXT NOT NULL,
    "duration"    INTEGER NOT NULL,
    "intensity"   TEXT NOT NULL,
    "distance"    DOUBLE PRECISION,
    "kcal"        INTEGER NOT NULL,
    "addToBudget" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "Activity"("userId");

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
