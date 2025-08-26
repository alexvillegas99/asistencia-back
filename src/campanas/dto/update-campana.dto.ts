import { PartialType } from '@nestjs/swagger';
import { CreateCampanaDto } from './create-campana.dto';

export class UpdateCampanaDto extends PartialType(CreateCampanaDto) {}
