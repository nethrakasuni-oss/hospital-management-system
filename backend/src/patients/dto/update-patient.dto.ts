export class UpdatePatientDto {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  emergencyName?: string;
  emergencyPhone?: string;
}