import { Module } from '@nestjs/common';
import { OperationTheatreController } from './operation-theatre.controller.js';
import { OperationTheatreService } from './operation-theatre.service.js';

@Module({ controllers: [OperationTheatreController], providers: [OperationTheatreService], exports: [OperationTheatreService] })
export class OperationTheatreModule {}
