ALTER TABLE "InvoiceItem"
ADD COLUMN "sourceType" TEXT,
ADD COLUMN "sourceId" INTEGER;

CREATE INDEX "InvoiceItem_sourceType_sourceId_idx"
ON "InvoiceItem"("sourceType", "sourceId");
