-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "deviceType" TEXT;
ALTER TABLE "Booking" ADD COLUMN "paymentMethod" TEXT DEFAULT 'QRIS';
ALTER TABLE "Booking" ADD COLUMN "personCount" INTEGER DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN "preferredSlotId" TEXT;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "dateOfBirth" DATETIME;
ALTER TABLE "Profile" ADD COLUMN "email" TEXT;
ALTER TABLE "Profile" ADD COLUMN "ktpNumber" TEXT;
ALTER TABLE "Profile" ADD COLUMN "placeOfBirth" TEXT;
