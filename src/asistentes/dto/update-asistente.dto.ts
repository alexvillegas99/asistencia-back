import { PartialType } from '@nestjs/swagger';
import { CreateAsistenteDto } from './create-asistente.dto';

export class UpdateAsistenteDto extends PartialType(CreateAsistenteDto) {}
