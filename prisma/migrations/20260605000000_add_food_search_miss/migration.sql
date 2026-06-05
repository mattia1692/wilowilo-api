-- CreateTable
CREATE TABLE "FoodSearchMiss" (
    "id"          SERIAL NOT NULL,
    "query"       TEXT NOT NULL,
    "commonCount" INTEGER NOT NULL DEFAULT 0,
    "remoteCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodSearchMiss_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodSearchMiss_query_idx" ON "FoodSearchMiss"("query");

-- CreateIndex
CREATE INDEX "FoodSearchMiss_createdAt_idx" ON "FoodSearchMiss"("createdAt");
