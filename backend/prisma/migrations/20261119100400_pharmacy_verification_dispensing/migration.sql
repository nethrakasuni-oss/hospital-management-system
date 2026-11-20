CREATE TYPE "PrescriptionVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

ALTER TABLE "Prescription"
ADD COLUMN "verificationStatus" "PrescriptionVerificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "verificationReason" TEXT,
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedById" INTEGER;

ALTER TABLE "PrescriptionItem"
ADD COLUMN "dispensedQuantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Prescription"
ADD CONSTRAINT "Prescription_verifiedById_fkey"
FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Prescription"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TYPE "PrescriptionStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_DISPENSED';

ALTER TABLE "Prescription"
ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
