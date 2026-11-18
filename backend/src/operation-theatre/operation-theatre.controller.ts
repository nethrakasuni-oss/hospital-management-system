import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { OperationTheatreService } from './operation-theatre.service.js';
import { CreateOperationTheatreDto } from './dto/create-operation-theatre.dto.js';
import { UpdateOperationTheatreDto } from './dto/update-operation-theatre.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { RolesGuard } from '../auth/roles/roles.guard.js';
import { Roles } from '../auth/roles/roles.decorator.js';

@Controller('operation-theatres')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OperationTheatreController {
  constructor(private readonly service: OperationTheatreService) {}
  @Post() @Roles('ADMIN', 'HR_MANAGER') create(@Body() dto: CreateOperationTheatreDto) { return this.service.create(dto); }
  @Get() @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE') findAll(@Query('active') active?: string, @Query('status') status?: string) {
    if (active !== undefined && !['true', 'false'].includes(active)) throw new BadRequestException('active must be true or false');
    return this.service.findAll(active === undefined ? undefined : active === 'true', status);
  }
  @Get(':id') @Roles('ADMIN', 'HR_MANAGER', 'DOCTOR', 'NURSE') findOne(@Param('id', ParseIntPipe) id: number) { return this.service.findOne(id); }
  @Patch(':id') @Roles('ADMIN', 'HR_MANAGER') update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateOperationTheatreDto) { return this.service.update(id, dto); }
  @Patch(':id/deactivate') @Roles('ADMIN', 'HR_MANAGER') deactivate(@Param('id', ParseIntPipe) id: number) { return this.service.deactivate(id); }
}
