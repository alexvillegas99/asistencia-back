import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRatingDto } from './dto/create-rating.dto';
import { Rating } from './schemas/rating.schema';

@Injectable()
export class RatingsService {
  constructor(
    @InjectModel(Rating.name)
    private readonly model: Model<Rating>,
  ) {}

  // Guardar
  create(dto: CreateRatingDto) {
    return this.model.create(dto);
  }

  // Obtener todas
  findAll() {
    return this.model.find().sort({ createdAt: -1 }).lean();
  }

  // 🔴 OBTENER POR RANGO DE FECHAS
  findByDates(from: string, to: string) {
    const start = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T23:59:59.999Z`);

    return this.model.find({
      createdAt: { $gte: start, $lte: end },
    }).sort({ createdAt: -1 }).lean();
  }
}
