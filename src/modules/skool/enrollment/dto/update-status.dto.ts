import { IsIn } from 'class-validator';

export class UpdateStatusDto {
  @IsIn(['active','completed','cancelled'])
  status: 'active' | 'completed' | 'cancelled';
}