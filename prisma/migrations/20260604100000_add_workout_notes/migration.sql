-- CreateTable
CREATE TABLE "WorkoutNote" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "date"      TEXT NOT NULL,
    "title"     TEXT,
    "exercises" JSONB NOT NULL,
    "notes"     TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutNote_userId_idx" ON "WorkoutNote"("userId");

-- AddForeignKey
ALTER TABLE "WorkoutNote" ADD CONSTRAINT "WorkoutNote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
