import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAsistenteDto {
  @IsNotEmpty()
  @IsString()
  cedula: string;

  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsString()
  curso: string; // ID del curso al que pertenece
}
