import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateCampanaDto } from './dto/create-campana.dto';
import { UpdateCampanaDto } from './dto/update-campana.dto';
import { InjectModel } from '@nestjs/mongoose';
import { Campaña, CampañaDocument } from './entities/campana.entity';
import { Model } from 'mongoose';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
@Injectable()
export class CampanasService {
  constructor(
    @InjectModel(Campaña.name) private campañaModel: Model<CampañaDocument>,
    private readonly amazons3Service: AmazonS3Service
  ) {}

  async crear(dto: any): Promise<Campaña> {


    // Si se subió una imagen, la guardamos en Amazon S3

    if (dto.imagen) {
      const url =  (await this.amazons3Service.uploadBase64({
        image: dto.imagen,
        route: 'nic/campanas',
      })).imageUrl;
      dto.imagen = url;
    }

    const nuevaCampaña = new this.campañaModel(dto);
    return nuevaCampaña.save();
  }

  async editar(id: string, dto: any): Promise<Campaña> {


    console.log('dto', dto);

    //si la imagen es base64 la subimos a s3 validando que sea base64

    if (dto.imagen && dto.imagen.includes('data:image')) {
      const url =  (await this.amazons3Service.uploadBase64({
        image: dto.imagen,
        route: 'nic/campanas',
      })).imageUrl;
      dto.imagen = url;
    }

    const campaña = await this.campañaModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!campaña) throw new NotFoundException('Campaña no encontrada');
    return campaña;
  }

  async obtenerTodas(): Promise<Campaña[]> {
    return this.campañaModel.find();
  }

  async obtenerActivas(): Promise<Campaña[]> {
    const ahora = new Date();
    return this.campañaModel.find({
      estado: true,
      fechaInicio: { $lte: ahora }, // La fecha de inicio debe haber pasado o ser hoy
      fechaFin: { $gte: ahora } // La fecha de fin aún no debe haber pasado
    });
}

async obtenerInactivas(): Promise<Campaña[]> {
    const ahora = new Date();
    return this.campañaModel.find({
      estado: false,
      fechaFin: { $gte: ahora } // Solo campañas cuya fecha de fin aún esté vigente
    });
}
}
