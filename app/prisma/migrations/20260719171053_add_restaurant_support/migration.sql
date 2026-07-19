-- AlterEnum
ALTER TYPE "UnitCategory" ADD VALUE 'TABLE';

-- AlterTable
ALTER TABLE "BrandProfile" ADD COLUMN     "assistantName" TEXT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "closedWeekdays" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "dinnerClose" TEXT,
ADD COLUMN     "dinnerOpen" TEXT,
ADD COLUMN     "lunchClose" TEXT,
ADD COLUMN     "lunchOpen" TEXT,
ADD COLUMN     "reservationDurationMinutes" INTEGER NOT NULL DEFAULT 120;
