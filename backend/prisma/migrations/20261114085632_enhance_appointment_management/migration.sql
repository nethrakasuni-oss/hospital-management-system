/*
  Warnings:

  - A unique constraint covering the columns `[appointmentNo]` on the table `Appointment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `appointmentNo` to the `Appointment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AppointmentType" AS ENUM ('IN_PERSON', 'ONLINE');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "appointmentNo" TEXT NOT NULL,
ADD COLUMN     "appointmentType" "AppointmentType" NOT NULL DEFAULT 'IN_PERSON',
ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "consultationFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "departmentId" INTEGER,
ADD COLUMN     "duration" INTEGER NOT NULL DEFAULT 30;

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_appointmentNo_key" ON "Appointment"("appointmentNo");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_idx" ON "Appointment"("doctorId");

-- CreateIndex
CREATE INDEX "Appointment_departmentId_idx" ON "Appointment"("departmentId");

-- CreateIndex
CREATE INDEX "Appointment_scheduledAt_idx" ON "Appointment"("scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
