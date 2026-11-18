import { Injectable } from '@nestjs/common';
import { InsuranceProviderService } from './services/insurance-provider.service.js';
import { PatientInsuranceService } from './services/patient-insurance.service.js';
import { InsuranceClaimService } from './services/insurance-claim.service.js';
import { CreateInsuranceProviderDto } from './dto/create-insurance-provider.dto.js';
import { UpdateInsuranceProviderDto } from './dto/update-insurance-provider.dto.js';
import { CreatePatientInsuranceDto } from './dto/create-patient-insurance.dto.js';
import { UpdatePatientInsuranceDto } from './dto/update-patient-insurance.dto.js';
import { CreateInsuranceClaimDto } from './dto/create-insurance-claim.dto.js';
import { ReviewInsuranceClaimDto } from './dto/review-insurance-claim.dto.js';
import { RecordInsuranceClaimPaymentDto } from './dto/record-insurance-claim-payment.dto.js';

@Injectable()
export class InsuranceService {
  constructor(
    private readonly providers: InsuranceProviderService,
    private readonly policies: PatientInsuranceService,
    private readonly claims: InsuranceClaimService,
  ) {}

  createProvider(dto: CreateInsuranceProviderDto, userId: number) {
    return this.providers.create(dto, userId);
  }
  findProviders(includeInactive = false) { return this.providers.findAll(includeInactive); }
  findProvider(id: number) { return this.providers.findOne(id); }
  updateProvider(id: number, dto: UpdateInsuranceProviderDto, userId: number) {
    return this.providers.update(id, dto, userId);
  }

  createPolicy(dto: CreatePatientInsuranceDto, userId: number) {
    return this.policies.create(dto, userId);
  }
  findPolicies(filters: { patientId?: number; providerId?: number; active?: boolean }) {
    return this.policies.findAll(filters);
  }
  findPolicy(id: number) { return this.policies.findOne(id); }
  updatePolicy(id: number, dto: UpdatePatientInsuranceDto, userId: number) {
    return this.policies.update(id, dto, userId);
  }

  createClaim(dto: CreateInsuranceClaimDto, userId: number) {
    return this.claims.create(dto, userId);
  }
  findClaims(filters: { patientId?: number; providerId?: number; status?: string }) {
    return this.claims.findAll(filters);
  }
  findClaim(id: number) { return this.claims.findOne(id); }
  submitClaim(id: number, userId: number) { return this.claims.submit(id, userId); }
  reviewClaim(id: number, reviewerId: number, dto: ReviewInsuranceClaimDto) {
    return this.claims.review(id, reviewerId, dto);
  }
  recordClaimPayment(id: number, dto: RecordInsuranceClaimPaymentDto, userId: number) {
    return this.claims.recordPayment(id, dto, userId);
  }
  statistics() { return this.claims.statistics(); }
}
