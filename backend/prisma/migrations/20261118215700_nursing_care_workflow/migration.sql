CREATE TYPE "MedicationAdministrationStatus" AS ENUM ('ADMINISTERED', 'MISSED', 'WITHHELD');

CREATE TABLE "MedicationAdministration" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "prescriptionId" INTEGER NOT NULL,
    "nurseUserId" INTEGER NOT NULL,
    "nurseEmployeeId" INTEGER,
    "status" "MedicationAdministrationStatus" NOT NULL,
    "administeredAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MedicationAdministration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShiftHandover" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "admissionId" INTEGER,
    "outgoingNurseUserId" INTEGER NOT NULL,
    "incomingNurseUserId" INTEGER NOT NULL,
    "patientSummary" TEXT NOT NULL,
    "currentCondition" TEXT NOT NULL,
    "pendingMedications" TEXT,
    "pendingInvestigations" TEXT,
    "importantObservations" TEXT,
    "escalationNotes" TEXT,
    "handedOverAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShiftHandover_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NursingDischargeClearance" (
    "id" SERIAL NOT NULL,
    "patientId" INTEGER NOT NULL,
    "admissionId" INTEGER NOT NULL,
    "nurseUserId" INTEGER NOT NULL,
    "nursingDischargeNotes" TEXT,
    "patientEducation" TEXT,
    "nursingClearance" BOOLEAN NOT NULL DEFAULT false,
    "documentationComplete" BOOLEAN NOT NULL DEFAULT false,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NursingDischargeClearance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MedicationAdministration_patientId_administeredAt_idx" ON "MedicationAdministration"("patientId", "administeredAt");
CREATE INDEX "MedicationAdministration_prescriptionId_administeredAt_idx" ON "MedicationAdministration"("prescriptionId", "administeredAt");
CREATE INDEX "ShiftHandover_patientId_handedOverAt_idx" ON "ShiftHandover"("patientId", "handedOverAt");
CREATE INDEX "ShiftHandover_admissionId_handedOverAt_idx" ON "ShiftHandover"("admissionId", "handedOverAt");
CREATE INDEX "NursingDischargeClearance_patientId_createdAt_idx" ON "NursingDischargeClearance"("patientId", "createdAt");
CREATE UNIQUE INDEX "NursingDischargeClearance_admissionId_key" ON "NursingDischargeClearance"("admissionId");

ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_prescriptionId_fkey" FOREIGN KEY ("prescriptionId") REFERENCES "Prescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_nurseUserId_fkey" FOREIGN KEY ("nurseUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MedicationAdministration" ADD CONSTRAINT "MedicationAdministration_nurseEmployeeId_fkey" FOREIGN KEY ("nurseEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_outgoingNurseUserId_fkey" FOREIGN KEY ("outgoingNurseUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShiftHandover" ADD CONSTRAINT "ShiftHandover_incomingNurseUserId_fkey" FOREIGN KEY ("incomingNurseUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "NursingDischargeClearance" ADD CONSTRAINT "NursingDischargeClearance_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NursingDischargeClearance" ADD CONSTRAINT "NursingDischargeClearance_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NursingDischargeClearance" ADD CONSTRAINT "NursingDischargeClearance_nurseUserId_fkey" FOREIGN KEY ("nurseUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
