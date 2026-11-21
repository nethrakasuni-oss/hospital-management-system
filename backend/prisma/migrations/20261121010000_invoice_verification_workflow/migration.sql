-- Separate invoice approval workflow from payment lifecycle.
CREATE TYPE "InvoiceVerificationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED');
ALTER TABLE "Invoice"
  ADD COLUMN "verificationStatus" "InvoiceVerificationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedAt" TIMESTAMP(3),
  ADD COLUMN "verifiedById" INTEGER,
  ADD COLUMN "rejectedAt" TIMESTAMP(3),
  ADD COLUMN "rejectedById" INTEGER,
  ADD COLUMN "rejectionReason" TEXT;
-- Existing invoices are treated as previously approved to avoid blocking historical collections.
UPDATE "Invoice" SET "verificationStatus" = 'VERIFIED';
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Invoice_verificationStatus_createdAt_idx" ON "Invoice"("verificationStatus", "createdAt");
