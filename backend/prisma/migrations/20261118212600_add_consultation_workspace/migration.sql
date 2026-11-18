ALTER TABLE "MedicalRecord"
ADD COLUMN "appointmentId" INTEGER,
ADD COLUMN "chiefComplaint" TEXT,
ADD COLUMN "historyPresentIllness" TEXT,
ADD COLUMN "previousMedicalHistory" TEXT,
ADD COLUMN "currentMedications" TEXT,
ADD COLUMN "allergies" TEXT,
ADD COLUMN "bloodPressure" TEXT,
ADD COLUMN "pulse" TEXT,
ADD COLUMN "temperature" TEXT,
ADD COLUMN "respiratoryRate" TEXT,
ADD COLUMN "oxygenSaturation" TEXT,
ADD COLUMN "weight" TEXT,
ADD COLUMN "height" TEXT,
ADD COLUMN "physicalExamination" TEXT,
ADD COLUMN "followUpRecommendations" TEXT;

CREATE UNIQUE INDEX "MedicalRecord_appointmentId_key"
ON "MedicalRecord"("appointmentId");

ALTER TABLE "MedicalRecord"
ADD CONSTRAINT "MedicalRecord_appointmentId_fkey"
FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
