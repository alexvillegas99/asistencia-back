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

  async buscarOCrear(curso: string) {
    try {
      const doc = await this.cursoModel
        .findOneAndUpdate(
          { nombre: curso },
          {
            // Solo si NO existe: crear con estas propiedades
            $setOnInsert: {
              nombre: curso,
              // si quieres forzar también createdAt inicial:
              createdAt: new Date(),
              // clave: setear updatedAt a AYER para que tu lógica de +1 dispare hoy
              updatedAt: this.ayerEC(),
              // si manejas este campo:
              diasActuales: 0,
            },
          },
          {
            upsert: true,
            new: true,
            // desactiva timestamps SOLO en esta operación para respetar nuestro updatedAt
            timestamps: false,
            setDefaultsOnInsert: true,
          },
        )
        .exec();

      return doc;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al crear el curso',
        error.message,
      );
    }
  }

  constructor(
    @InjectModel(CursoModelName)
    private readonly cursoModel: Model<CursoDocument>,
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
            localField: 'idAsString',
            foreignField: 'curso',
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

  async update(
    id: string,
    updateCursoDto: UpdateCursoDto,
  ): Promise<CursoDocument> {
    try {
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
