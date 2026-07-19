-- AlterTable
ALTER TABLE "Property" ADD COLUMN "whatsappNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Property_whatsappNumber_key" ON "Property"("whatsappNumber");
