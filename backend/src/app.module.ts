import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PatientsModule } from './patients/patients.module.js';
import { DoctorsModule } from './doctors/doctors.module.js';
import { DepartmentsModule } from './departments/departments.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { NursingModule } from './nursing/nursing.module.js';
import { InsuranceModule } from './insurance/insurance.module.js';
import { PharmacyProcurementModule } from './pharmacy-procurement/pharmacy-procurement.module.js';
import { MedicalRecordsModule } from './medical-records/medical-records.module.js';
import { LaboratoryModule } from './laboratory/laboratory.module.js';
import { PharmacyModule } from './pharmacy/pharmacy.module.js';
import { BillingModule } from './billing/billing.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { AdministrationModule } from './administration/administration.module.js';
import { EmergencyModule } from './emergency/emergency.module.js';
import { OperationTheatreModule } from './operation-theatre/operation-theatre.module.js';
import { SurgeryModule } from './surgery/surgery.module.js';
import { PatientTransfersModule } from './patient-transfers/patient-transfers.module.js';
import { DischargeModule } from './discharge/discharge.module.js';
import { InpatientModule } from './inpatient/inpatient.module.js';

@Module({
  imports: [EmergencyModule, OperationTheatreModule, SurgeryModule, PatientTransfersModule, DischargeModule, PrismaModule, AuthModule, UsersModule, PatientsModule,DoctorsModule, DepartmentsModule, EmployeesModule, AppointmentsModule, AttendanceModule, NursingModule, InsuranceModule, PharmacyProcurementModule, MedicalRecordsModule, LaboratoryModule, PharmacyModule, BillingModule, NotificationsModule, AdministrationModule ,InpatientModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
