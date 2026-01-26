import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';

@Controller('ratings')
export class RatingsController {
  constructor(private readonly service: RatingsService) {}

  // Guardar calificación
  @Post()
  create(@Body() dto: CreateRatingDto) {
    return this.service.create(dto);
  }

  // Obtener todas
  @Get()
  findAll() {
    return this.service.findAll();
  }

  // 🔴 Obtener por fechas
  // /ratings/by-date?from=2026-01-01&to=2026-01-31
  @Get('by-date')
  findByDate(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.service.findByDates(from, to);
  }
}
 