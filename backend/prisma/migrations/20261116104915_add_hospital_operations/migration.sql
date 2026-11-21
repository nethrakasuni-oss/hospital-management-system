-- CreateEnum
CREATE TYPE "EmergencyTriageLevel" AS ENUM ('RESUSCITATION', 'EMERGENCY', 'URGENT', 'LESS_URGENT', 'NON_URGENT');

-- CreateEnum
CREATE TYPE "EmergencyVisitStatus" AS ENUM ('REGISTERED', 'TRIAGED', 'UNDER_TREATMENT', 'OBSERVATION', 'ADMITTED', 'DISCHARGED', 'TRANSFERRED', 'LEFT_WITHOUT_BEING_SEEN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TheatreStatus" AS ENUM ('AVAILABLE', 'IN_USE', 'MAINTENANCE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "SurgeryStatus" AS ENUM ('SCHEDULED', 'PREPARATION', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'POSTPONED');

-- CreateEnum
CREATE TYPE "PatientTransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EmergencyVisit" (
    "id" SERIAL NOT NULL,
    "visitNumber" TEXT NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triageLevel" "EmergencyTriageLevel" NOT NULL,
    "status" "EmergencyVisitStatus" NOT NULL DEFAULT 'REGISTERED',
    "chiefComplaint" TEXT NOT NULL,
    "clinicalNotes" TEXT,
    "vitalSigns" JSONB,
    "disposition" TEXT,
    "dischargedAt" TIMESTAMP(3),
    "patientId" INTEGER NOT NULL,
    "admissionId" INTEGER,
    "attendingDoctorId" INTEGER,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmergencyVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationTheatre" (
    "id" SERIAL NOT NULL,
    "theatreCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "status" "TheatreStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationTheatre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SurgeryBooking" (
    "id" SERIAL NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "procedureName" TEXT NOT NULL,
    "plannedStartAt" TIMESTAMP(3) NOT NULL,
    "plannedEndAt" TIMESTAMP(3) NOT NULL,
    "actualStartAt" TIMESTAMP(3),
    "actualEndAt" TIMESTAMP(3),
    "status" "SurgeryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "preOpNotes" TEXT,
    "postOpNotes" TEXT,
    "cancellationReason" TEXT,
    "patientId" INTEGER NOT NULL,
    "admissionId" INTEGER,
    "doctorId" INTEGER NOT NULL,
    "theatreId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SurgeryBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientTransfer" (
    "id" SERIAL NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "PatientTransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "patientId" INTEGER NOT NULL,
    "admissionId" INTEGER,
    "fromWardId" INTEGER,
    "toWardId" INTEGER NOT NULL,
    "fromBedId" INTEGER,
    "toBedId" INTEGER,
    "requestedById" INTEGER,
    "approvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DischargeSummary" (
    "id" SERIAL NOT NULL,
    "summaryNumber" TEXT NOT NULL,
    "admissionDate" TIMESTAMP(3) NOT NULL,
    "dischargeDate" TIMESTAMP(3) NOT NULL,
    "principalDiagnosis" TEXT NOT NULL,
    "secondaryDiagnoses" TEXT,
    "proceduresPerformed" TEXT,
    "treatmentSummary" TEXT NOT NULL,
    "dischargeMedication" TEXT,
    "followUpInstructions" TEXT,
    "conditionAtDischarge" TEXT,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "patientId" INTEGER NOT NULL,
    "admissionId" INTEGER NOT NULL,
    "preparedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DischargeSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyVisit_visitNumber_key" ON "EmergencyVisit"("visitNumber");

-- CreateIndex
CREATE INDEX "EmergencyVisit_arrivalAt_status_idx" ON "EmergencyVisit"("arrivalAt", "status");

-- CreateIndex
CREATE INDEX "EmergencyVisit_patientId_arrivalAt_idx" ON "EmergencyVisit"("patientId", "arrivalAt");

-- CreateIndex
CREATE INDEX "EmergencyVisit_triageLevel_status_idx" ON "EmergencyVisit"("triageLevel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OperationTheatre_theatreCode_key" ON "OperationTheatre"("theatreCode");

-- CreateIndex
CREATE INDEX "OperationTheatre_status_isActive_idx" ON "OperationTheatre"("status", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SurgeryBooking_bookingNumber_key" ON "SurgeryBooking"("bookingNumber");

-- CreateIndex
CREATE INDEX "SurgeryBooking_plannedStartAt_status_idx" ON "SurgeryBooking"("plannedStartAt", "status");

-- CreateIndex
CREATE INDEX "SurgeryBooking_patientId_plannedStartAt_idx" ON "SurgeryBooking"("patientId", "plannedStartAt");

-- CreateIndex
CREATE INDEX "SurgeryBooking_doctorId_plannedStartAt_idx" ON "SurgeryBooking"("doctorId", "plannedStartAt");

-- CreateIndex
CREATE INDEX "SurgeryBooking_theatreId_plannedStartAt_idx" ON "SurgeryBooking"("theatreId", "plannedStartAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatientTransfer_transferNumber_key" ON "PatientTransfer"("transferNumber");

-- CreateIndex
CREATE INDEX "PatientTransfer_patientId_status_idx" ON "PatientTransfer"("patientId", "status");

-- CreateIndex
CREATE INDEX "PatientTransfer_toWardId_status_idx" ON "PatientTransfer"("toWardId", "status");

-- CreateIndex
CREATE INDEX "PatientTransfer_requestedAt_status_idx" ON "PatientTransfer"("requestedAt", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeSummary_summaryNumber_key" ON "DischargeSummary"("summaryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "DischargeSummary_admissionId_key" ON "DischargeSummary"("admissionId");

-- CreateIndex
CREATE INDEX "DischargeSummary_patientId_dischargeDate_idx" ON "DischargeSummary"("patientId", "dischargeDate");

-- AddForeignKey
ALTER TABLE "EmergencyVisit" ADD CONSTRAINT "EmergencyVisit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyVisit" ADD CONSTRAINT "EmergencyVisit_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyVisit" ADD CONSTRAINT "EmergencyVisit_attendingDoctorId_fkey" FOREIGN KEY ("attendingDoctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyVisit" ADD CONSTRAINT "EmergencyVisit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryBooking" ADD CONSTRAINT "SurgeryBooking_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryBooking" ADD CONSTRAINT "SurgeryBooking_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryBooking" ADD CONSTRAINT "SurgeryBooking_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SurgeryBooking" ADD CONSTRAINT "SurgeryBooking_theatreId_fkey" FOREIGN KEY ("theatreId") REFERENCES "OperationTheatre"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_fromWardId_fkey" FOREIGN KEY ("fromWardId") REFERENCES "Ward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_toWardId_fkey" FOREIGN KEY ("toWardId") REFERENCES "Ward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_fromBedId_fkey" FOREIGN KEY ("fromBedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_toBedId_fkey" FOREIGN KEY ("toBedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientTransfer" ADD CONSTRAINT "PatientTransfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DischargeSummary" ADD CONSTRAINT "DischargeSummary_preparedById_fkey" FOREIGN KEY ("preparedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
