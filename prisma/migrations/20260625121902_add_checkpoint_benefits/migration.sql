-- AlterTable
ALTER TABLE "WeightCheckpoint" ADD COLUMN     "benefits" TEXT[] DEFAULT ARRAY[]::TEXT[];
