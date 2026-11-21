ALTER TYPE "LabRequestStatus" ADD VALUE IF NOT EXISTS 'SAMPLE_PENDING';
ALTER TYPE "LabRequestStatus" ADD VALUE IF NOT EXISTS 'RECEIVED';
ALTER TYPE "LabRequestStatus" ADD VALUE IF NOT EXISTS 'RESULT_ENTERED';
ALTER TYPE "LabRequestStatus" ADD VALUE IF NOT EXISTS 'VERIFIED';
ALTER TYPE "LabRequestStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

ALTER TABLE "LabTest"
ADD COLUMN "category" TEXT,
ADD COLUMN "sampleType" TEXT,
ADD COLUMN "referenceRange" TEXT,
ADD COLUMN "unit" TEXT;

ALTER TABLE "LabRequest"
ADD COLUMN "requestNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "sampleIdentifier" TEXT,
ADD COLUMN "barcode" TEXT,
ADD COLUMN "collectedAt" TIMESTAMP(3),
ADD COLUMN "collectedById" INTEGER,
ADD COLUMN "sampleRejected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "rejectionReason" TEXT;

CREATE UNIQUE INDEX "LabRequest_requestNumber_key" ON "LabRequest"("requestNumber");

ALTER TABLE "LabResult"
ADD COLUMN "unit" TEXT,
ADD COLUMN "abnormalFlag" TEXT,
ADD COLUMN "critical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "comments" TEXT,
ADD COLUMN "amendmentReason" TEXT;

CREATE TABLE "LabResultHistory" (
    "id" SERIAL NOT NULL,
    "labResultId" INTEGER NOT NULL,
    "resultValue" TEXT,
    "referenceRange" TEXT,
    "unit" TEXT,
    "abnormalFlag" TEXT,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "comments" TEXT,
    "amendmentReason" TEXT,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LabResultHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabResultHistory_labResultId_changedAt_idx" ON "LabResultHistory"("labResultId", "changedAt");

ALTER TABLE "LabResultHistory"
ADD CONSTRAINT "LabResultHistory_labResultId_fkey"
FOREIGN KEY ("labResultId") REFERENCES "LabResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LabResultHistory"
ADD CONSTRAINT "LabResultHistory_changedById_fkey"
FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
