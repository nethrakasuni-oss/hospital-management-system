import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe,
  Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';
import { PharmacyService } from './services/pharmacy.service.js';
import { CreateMedicineCategoryDto } from './dto/create-medicine-category.dto.js';
import { CreateMedicineDto } from './dto/create-medicine.dto.js';
import { UpdateMedicineDto } from './dto/update-medicine.dto.js';
import { CreateStockBatchDto } from './dto/create-stock-batch.dto.js';
import { AdjustStockDto } from './dto/adjust-stock.dto.js';
import { CreatePrescriptionDto } from './dto/create-prescription.dto.js';
import { PermissionsGuard } from '../auth/permissions/permissions.guard.js';
import { Permissions } from '../auth/permissions/permissions.decorator.js';
import { VerifyPrescriptionDto } from './dto/verify-prescription.dto.js';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto.js';
import { CorrectPrescriptionItemDto } from './dto/correct-prescription-item.dto.js';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class PharmacyController {
  constructor(private readonly pharmacy: PharmacyService) {}

  @Post('categories') @Roles('ADMIN','PHARMACIST')
  createCategory(@Body() d: CreateMedicineCategoryDto) { return this.pharmacy.createCategory(d); }
  @Get('categories') @Roles('ADMIN','PHARMACIST','DOCTOR','NURSE')
  categories() { return this.pharmacy.findCategories(); }

  @Post('medicines') @Roles('ADMIN','PHARMACIST')
  createMedicine(@Body() d: CreateMedicineDto) { return this.pharmacy.createMedicine(d); }
  @Get('medicines') @Roles('ADMIN','PHARMACIST','DOCTOR','NURSE')
  medicines(
    @Query('search') search?: string,
    @Query('categoryId') category?: string,
    @Query('includeInactive') inactive?: string,
  ) {
    const categoryId = category === undefined ? undefined : Number(category);
    if (categoryId !== undefined && (!Number.isInteger(categoryId) || categoryId < 1)) throw new BadRequestException('categoryId must be a positive integer');
    if (inactive !== undefined && !['true','false'].includes(inactive)) throw new BadRequestException('includeInactive must be true or false');
    return this.pharmacy.findMedicines(search, categoryId, inactive === 'true');
  }
  @Get('medicines/:id') @Roles('ADMIN','PHARMACIST','DOCTOR','NURSE')
  medicine(@Param('id',ParseIntPipe) id: number) { return this.pharmacy.findMedicine(id); }
  @Patch('medicines/:id') @Roles('ADMIN','PHARMACIST')
  updateMedicine(@Param('id',ParseIntPipe) id: number,@Body() d: UpdateMedicineDto) { return this.pharmacy.updateMedicine(id,d); }

  @Post('batches') @Roles('ADMIN','PHARMACIST')
  createBatch(@Body() d: CreateStockBatchDto,@Req() r: any) { return this.pharmacy.createBatch(d,r.user.userId); }
  @Post('stock/adjustments') @Roles('ADMIN','PHARMACIST')
  adjustStock(@Body() d: AdjustStockDto,@Req() r: any) { return this.pharmacy.adjustStock(d,r.user.userId); }
  @Get('stock/overview') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  stockOverview(@Query('lowStockThreshold') low?: string,@Query('expiryWithinDays') days?: string) {
    const threshold = low === undefined ? 10 : Number(low);
    const expiryDays = days === undefined ? 90 : Number(days);
    return this.pharmacy.stockOverview(threshold,expiryDays);
  }
  @Get('stock/transactions') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  transactions(@Query('medicineId') medicine?: string,@Query('type') type?: string) {
    const id = medicine === undefined ? undefined : Number(medicine);
    if (id !== undefined && (!Number.isInteger(id) || id < 1)) throw new BadRequestException('medicineId must be a positive integer');
    const allowed = ['PURCHASE','SALE','ADJUSTMENT','RETURN','EXPIRED'];
    if (type && !allowed.includes(type)) throw new BadRequestException('Invalid transaction type');
    return this.pharmacy.transactions(id,type);
  }

  @Get('dashboard') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  @Permissions('DASHBOARD_VIEW')
  dashboard() { return this.pharmacy.dashboard(); }

  @Get('reports/dispensing/daily') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  dailyDispensing(@Query('date') date?: string) { return this.pharmacy.dailyDispensingReport(date); }

  @Get('reports/medicine-usage') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  medicineUsage(@Query('from') from?: string, @Query('to') to?: string) {
    return this.pharmacy.medicineUsageReport(from, to);
  }

  @Get('reports/stock-movement') @Roles('ADMIN','PHARMACIST','ACCOUNTANT')
  @Permissions('REPORT_VIEW')
  stockMovement(@Query('medicineId') medicineId?: string, @Query('from') from?: string, @Query('to') to?: string) {
    const id = medicineId === undefined ? undefined : Number(medicineId);
    if (id !== undefined && (!Number.isInteger(id) || id < 1)) throw new BadRequestException('medicineId must be a positive integer');
    return this.pharmacy.stockMovementReport(id, from, to);
  }

  @Get('prescriptions/unlinked-items') @Roles('ADMIN')
  @Permissions('PRESCRIPTION_UPDATE')
  unlinkedPrescriptionItems() {
    return this.pharmacy.findUnlinkedPrescriptionItems();
  }

  @Get('prescriptions/:id') @Roles('ADMIN','PHARMACIST','DOCTOR','NURSE')
  @Permissions('PRESCRIPTION_VIEW')
  prescription(@Param('id',ParseIntPipe) id: number, @Req() req: any) {
    return this.pharmacy.prescription(id, req.user.userId, req.user.role);
  }
  @Get('prescriptions') @Roles('ADMIN','PHARMACIST','DOCTOR','NURSE')
  @Permissions('PRESCRIPTION_VIEW')
  prescriptions(@Query('patientId') patientId: string | undefined, @Req() req: any) {
    const parsedPatientId = patientId === undefined ? undefined : Number(patientId);
    if (parsedPatientId !== undefined && (!Number.isInteger(parsedPatientId) || parsedPatientId < 1)) {
      throw new BadRequestException('patientId must be a positive integer');
    }
    return this.pharmacy.prescriptions(parsedPatientId, req.user.userId, req.user.role);
  }
  @Post('prescriptions') @Roles('ADMIN','DOCTOR','PHARMACIST')
  @Permissions('PRESCRIPTION_CREATE')
  createPrescription(@Body() dto: CreatePrescriptionDto, @Req() req: any) {
    return this.pharmacy.createPrescription(dto, req.user.userId, req.user.role);
  }

  @Patch('prescription-items/:itemId/correct-medicine') @Roles('ADMIN')
  @Permissions('PRESCRIPTION_UPDATE')
  correctPrescriptionItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: CorrectPrescriptionItemDto,
  ) {
    return this.pharmacy.correctPrescriptionItem(itemId, dto);
  }
  @Patch('prescriptions/:id/verify') @Roles('ADMIN','PHARMACIST')
  @Permissions('PRESCRIPTION_UPDATE')
  verifyPrescription(@Param('id', ParseIntPipe) id: number, @Body() dto: VerifyPrescriptionDto, @Req() r: any) {
    return this.pharmacy.verifyPrescription(id, dto, r.user.userId);
  }

  @Post('prescriptions/:id/dispense') @Roles('ADMIN','PHARMACIST')
  @Permissions('PRESCRIPTION_UPDATE')
  dispense(@Param('id',ParseIntPipe) id: number, @Body() dto: DispensePrescriptionDto, @Req() r: any) {
    return this.pharmacy.dispensePrescription(id, r.user.userId, dto);
  }
}
