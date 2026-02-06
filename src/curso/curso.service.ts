import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CursoDocument, CursoModelName } from './entities/curso.entity';
import { CreateCursoDto } from './dto/create-curso.dto';
import { UpdateCursoDto } from './dto/update-curso.dto';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';

@Injectable()
export class CursoService {
  reseteDatos(_id: string) {
    console.log(_id);
    const data = this.cursoModel
      .updateOne(
        { _id },
        {
          diasCurso: 24,
          diasActuales: 0,
        },
      )
      .exec();
    console.log('log actualziacion', data);
    // this.cursoModel.deleteOne(arg0).exec();
  }
  // Opcional: “ayer” alineado a Ecuador (00:00:00 de ayer en America/Guayaquil)
  ayerEC(): Date {
    // Hoy en EC como "YYYY-MM-DD"
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guayaquil',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const [y, m, d] = fmt.format(new Date()).split('-'); // "YYYY-MM-DD"
    // Hoy 00:00 EC → restamos 1 día
    const hoyCeroEC = new Date(`${y}-${m}-${d}T00:00:00-05:00`);
    return new Date(hoyCeroEC.getTime() - 24 * 60 * 60 * 1000);
  }

  async buscarOCrear(curso: string, categoria?: string) {
    try {
      const set: any = {
        updatedAt: new Date(),
      };

      if (categoria !== undefined) {
        set.categoria = categoria;
      }

    
      const doc = await this.cursoModel
        .findOneAndUpdate(
          { nombre: curso }, // 🔑 búsqueda SOLO por nombre
          {
            $set: set, // solo actualiza lo que venga
            $setOnInsert: {
              nombre: curso,
              createdAt: new Date(),
              diasActuales: 0,
            },
          },
          {
            upsert: true,
            new: true,
            timestamps: false,
          },
        )
        .lean()
        .exec();

      return doc;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al crear o actualizar el curso',
        error.message,
      );
    }
  }

  constructor(
    @InjectModel(CursoModelName)
    private readonly cursoModel: Model<CursoDocument>,
    private readonly s3Service: AmazonS3Service,
  ) {}

  async create(createCursoDto: CreateCursoDto): Promise<CursoDocument> {
    try {
      const newCurso = new this.cursoModel(createCursoDto);
      return await newCurso.save();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al crear el curso',
        error.message,
      );
    }
  }

  async findAll(): Promise<any[]> {
    try {
      return this.cursoModel.aggregate([
        {
          $addFields: {
            idAsString: { $toString: '$_id' },
          },
        },
        {
          $lookup: {
            from: 'asistentes',
            let: { cursoIdStr: '$idAsString' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      // legacy: curso == id string
                      { $eq: ['$curso', '$$cursoIdStr'] },

                      // nuevo: cursos array contiene id string
                      {
                        $and: [
                          { $isArray: '$cursos' },
                          { $in: ['$$cursoIdStr', '$cursos'] },
                        ],
                      },
                    ],
                  },
                },
              },
              { $project: { _id: 1 } }, // liviano: solo para contar
            ],
            as: 'asistentes',
          },
        },
        {
          $project: {
            nombre: 1,
            estado: 1,
            diasCurso: 1,
            diasActuales: 1,
            createdAt: 1,
            totalAsistentes: { $size: '$asistentes' },
            horario:1
          },
        },
        { $sort: { createdAt: -1 } },
      ]);
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener los cursos',
        error.message,
      );
    }
  }

  async findOne(id: string): Promise<CursoDocument> {
    try {
      console.log(id);
      const curso = await this.cursoModel.findById(id).exec();
      console.log(curso);
      if (!curso) {
        throw new NotFoundException(`Curso con ID "${id}" no encontrado`);
      }
      return curso;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al buscar el curso',
        error.message,
      );
    }
  }

  async findOne2(nombre: string) {
    try {
      console.log('Nombre del curso:', nombre);
      const cursos = await this.cursoModel.find();
      const cursoBuscado = cursos.find((curso) => {
        console.log(curso.nombre);
        if (curso.nombre == nombre) {
          console.log('Curso encontrado:', curso);
          return curso;
        }
      });
      console.log('Curso buscado:', cursoBuscado);
      return cursoBuscado;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al buscar el curso',
        error.message,
      );
    }
  }

  async update(id: string, updateCursoDto: any) {
    try {
      if (
        updateCursoDto.imagen &&
        updateCursoDto.imagen.includes('data:image')
      ) {
        const url = (
          await this.s3Service.uploadBase64({
            image: updateCursoDto.imagen,
            route: 'nic/campanas',
          })
        ).imageUrl;
        updateCursoDto.imagen = url;
      }
      console.log('Datos a actualizar:', updateCursoDto);

      const updatedCurso = await this.cursoModel
        .findByIdAndUpdate(id, updateCursoDto, { new: true })
        .exec();
      if (!updatedCurso) {
        throw new NotFoundException(`Curso con ID "${id}" no encontrado`);
      }
      return updatedCurso;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al actualizar el curso',
        error.message,
      );
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const result = await this.cursoModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new NotFoundException(`Curso con ID "${id}" no encontrado`);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al eliminar el curso',
        error.message,
      );
    }
  }
}
