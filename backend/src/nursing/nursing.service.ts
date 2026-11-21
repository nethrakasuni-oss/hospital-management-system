import { Injectable } from '@nestjs/common';
import { NursingAssignmentService } from './services/nursing-assignment.service.js';
import { NursingNoteService } from './services/nursing-note.service.js';
import { NursingObservationService } from './services/nursing-observation.service.js';
import { CreateNursingAssignmentDto } from './dto/create-nursing-assignment.dto.js';
import { UpdateNursingAssignmentDto } from './dto/update-nursing-assignment.dto.js';
import { CreateNursingNoteDto } from './dto/create-nursing-note.dto.js';
import { UpdateNursingNoteDto } from './dto/update-nursing-note.dto.js';
import { CreateNursingObservationDto } from './dto/create-nursing-observation.dto.js';

@Injectable()
export class NursingService {
  constructor(
    private readonly assignments: NursingAssignmentService,
    private readonly notes: NursingNoteService,
    private readonly observations: NursingObservationService,
  ) {}
  createAssignment(employeeId: number, dto: CreateNursingAssignmentDto) { return this.assignments.create(employeeId, dto); }
  findAssignments(filters: { patientId?: number; employeeId?: number; admissionId?: number; active?: boolean }) { return this.assignments.findAll(filters); }
  findAssignment(id: number) { return this.assignments.findOne(id); }
  updateAssignment(id: number, dto: UpdateNursingAssignmentDto) { return this.assignments.update(id, dto); }
  endAssignment(id: number) { return this.assignments.end(id); }
  createNote(userId: number, employeeId: number | null, dto: CreateNursingNoteDto) { return this.notes.create(userId, employeeId, dto); }
  findPatientNotes(patientId: number) { return this.notes.findByPatient(patientId); }
  findNote(id: number) { return this.notes.findOne(id); }
  updateNote(id: number, dto: UpdateNursingNoteDto) { return this.notes.update(id, dto); }
  createObservation(employeeId: number | null, dto: CreateNursingObservationDto) { return this.observations.create(employeeId, dto); }
  findPatientObservations(patientId: number, from?: string, to?: string) { return this.observations.findByPatient(patientId, from, to); }
  findObservation(id: number) { return this.observations.findOne(id); }
}
