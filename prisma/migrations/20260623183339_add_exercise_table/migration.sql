-- CreateTable
CREATE TABLE "Exercise" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryMuscles" TEXT[],
    "secondaryMuscles" TEXT[],
    "equipment" TEXT[],
    "movementPattern" TEXT[],
    "difficulty" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION NOT NULL,
    "tags" TEXT[],
    "translations" JSONB NOT NULL DEFAULT '{}',
    "posterUrl" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_slug_idx" ON "Exercise"("slug");
