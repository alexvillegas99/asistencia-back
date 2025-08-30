import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAsistenciaDto } from './dto/create-asistencia.dto';
import {
  AsistenciaDocument,
  AsistenciaModelName,
} from './entities/asistencia.entity';
import {
  AsistentesDocument,
  AsistentesModelName,
} from '../asistentes/entities/asistente.entity';
import { CursoDocument, CursoModelName } from 'src/curso/entities/curso.entity';
import axios from 'axios';
import { cursorTo } from 'readline';
import { Cron } from '@nestjs/schedule';
@Injectable()
export class AsistenciasService {

    private readonly logger = new Logger(AsistenciasService.name);
  async todos() {
    try {
      return await this.asistenciaModel.find().exec();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener las asistencias',
        error.message,
      );
    }
  }
  constructor(
    @InjectModel(AsistenciaModelName)
    private readonly asistenciaModel: Model<AsistenciaDocument>,
    @InjectModel(AsistentesModelName)
    private readonly asistentesModel: Model<AsistentesDocument>,
    @InjectModel(CursoModelName)
    private readonly cursosModel: Model<CursoDocument>,
  ) {}

  // Crear una asistencia
  async create(
    createAsistenciaDto: CreateAsistenciaDto,
  ): Promise<AsistenciaDocument> {
    try {
      const newAsistencia = new this.asistenciaModel(createAsistenciaDto);
      return await newAsistencia.save();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al registrar la asistencia',
        error.message,
      );
    }
  }

  // Leer todas las asistencias agrupadas por fecha
  async generateAsistenciaReportDebug(cursoId: string) {
    try {
      // Paso 1: Obtener todos los asistentes que pertenecen al curso
      const asistentes = await this.asistentesModel
        .find({ curso: cursoId })
        .exec();
      console.log('Paso 1: Asistentes del curso:', asistentes);

      if (asistentes.length === 0) {
        throw new NotFoundException(
          'No se encontraron asistentes para el curso.',
        );
      }

      // Paso 2: Extraer los IDs de los asistentes
      const asistentesIds = asistentes.map((asistente) => asistente._id);
      console.log('Paso 2: IDs de los asistentes:', asistentesIds);

      // Paso 3: Buscar las asistencias asociadas a los IDs de los asistentes
      const asistencias = await this.asistenciaModel
        .find({ asistenteId: { $in: asistentesIds } })
        .exec();
      console.log('Paso 3: Asistencias encontradas:', asistencias);

      if (asistencias.length === 0) {
        throw new NotFoundException(
          'No se encontraron asistencias para los asistentes.',
        );
      }

      // Paso 4: Crear un mapa para relacionar los asistentes por su ID
      const asistentesMap = new Map(
        asistentes.map((asistente) => [asistente._id.toString(), asistente]),
      );
      console.log('Paso 4: Mapa de asistentes por ID:', asistentesMap);

      // Paso 5: Agrupar asistencias por fecha y por cedula
      const agrupadas = asistencias.reduce((result, asistencia) => {
        const fecha = asistencia.fecha.toString(); // Fecha en formato YYYY-MM-DD
        const asistenteId = asistencia.asistenteId.toString();

        if (!result[fecha]) {
          result[fecha] = {};
        }

        if (!result[fecha][asistenteId]) {
          result[fecha][asistenteId] = {
            cedula: asistentesMap.get(asistenteId)?.cedula || null,
            nombre: asistentesMap.get(asistenteId)?.nombre || null,
            entrada: null,
            salida: null,
          };
        }

        // Determinar si la hora es entrada o salida
        if (!result[fecha][asistenteId].entrada) {
          result[fecha][asistenteId].entrada = asistencia.hora;
        } else if (!result[fecha][asistenteId].salida) {
          result[fecha][asistenteId].salida = asistencia.hora;
        }

        return result;
      }, {});

      // Paso 6: Convertir a un array para el formato de salida
      const resultado = Object.entries(agrupadas).map(
        ([fecha, asistentesPorFecha]) => ({
          fecha,
          asistentes: Object.values(asistentesPorFecha),
        }),
      );
      console.log(
        'Paso 6: Asistencias agrupadas con entrada y salida:',
        resultado,
      );

      return resultado;
    } catch (error) {
      console.error('Error en generateAsistenciaReportDebug:', error);
      throw new InternalServerErrorException(
        'Error al generar el reporte de asistencias por curso',
        error.message,
      );
    }
  }

  async seedDatabase() {
    try {
      // Limpiar las colecciones existentes
      await this.asistentesModel.deleteMany({});
      await this.asistenciaModel.deleteMany({});

      // Datos para la colección 'asistentes'
      const asistentes = [
        {
          cedula: '1712269248',
          nombre: 'Juan Pérez',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1804502938',
          nombre: 'María López',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1102345890',
          nombre: 'Carlos Martínez',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1728394021',
          nombre: 'Ana García',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1839456273',
          nombre: 'Luis Hernández',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1123456789',
          nombre: 'Sofía Torres',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1789456123',
          nombre: 'Diego Gómez',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1823456780',
          nombre: 'Clara Ortiz',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1928374655',
          nombre: 'Ricardo Ramírez',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
        {
          cedula: '1876543210',
          nombre: 'Laura Villalba',
          createdAtEcuador: new Date(Date.now() - 5 * 60 * 60 * 1000),
        },
      ];

      // Insertar asistentes en la base de datos
      await this.asistentesModel.insertMany(asistentes);

      // Datos para la colección 'asistencias'
      const asistencias = [
        { cedula: '1712269248', fecha: new Date('2025-01-10T08:00:00.000Z') },
        { cedula: '1804502938', fecha: new Date('2025-01-10T09:00:00.000Z') },
        { cedula: '1102345890', fecha: new Date('2025-01-10T09:15:00.000Z') },
        { cedula: '1712269248', fecha: new Date('2025-01-11T10:00:00.000Z') },
        { cedula: '1728394021', fecha: new Date('2025-01-11T10:30:00.000Z') },
        { cedula: '1839456273', fecha: new Date('2025-01-11T11:00:00.000Z') },
        { cedula: '1123456789', fecha: new Date('2025-01-12T08:30:00.000Z') },
        { cedula: '1789456123', fecha: new Date('2025-01-12T09:00:00.000Z') },
        { cedula: '1823456780', fecha: new Date('2025-01-12T10:00:00.000Z') },
        { cedula: '1928374655', fecha: new Date('2025-01-12T10:30:00.000Z') },
      ];

      // Insertar asistencias en la base de datos
      await this.asistenciaModel.insertMany(asistencias);

      console.log('Base de datos inicializada con éxito');
    } catch (error) {
      console.error('Error al inicializar la base de datos:', error);
    }
  }

  // Verificar si el curso está activo
  async verificarCursoActivo(cursoId: string): Promise<any> {
    const curso = await this.cursosModel.findById(cursoId).exec();
    if (!curso) {
      throw new NotFoundException('Curso no encontrado.');
    }
    return curso.estado === 'Activo';
  }

  // Validar si el asistente pertenece al curso
  async validarAsistenteEnCurso(cedula: string): Promise<any> {
    const asistente = await this.asistentesModel.findOne({ cedula }).exec();

    if (!asistente) {
      return { valid: false, asistente: null };
    }

    // Buscar curso por _id (si el campo parece ObjectId) o por nombre
    let cursoDoc: any = null;
    const cursoField = asistente.curso;

    if (cursoField && Types.ObjectId.isValid(String(cursoField))) {
      cursoDoc = await this.cursosModel.findById(cursoField).lean().exec();
    } else if (typeof cursoField === 'string') {
      // si guardaste nombre directamente en `curso`
      cursoDoc = await this.cursosModel
        .findOne({ nombre: cursoField })
        .lean()
        .exec();
    }

    // nombre del curso (doc o lo que venga en el asistente)
    const cursoNombre =
      (cursoDoc && cursoDoc.nombre) ||
      (typeof cursoField === 'string' ? cursoField : null);

    // total de días de clase contados
    const diasActuales = Number(
      (cursoDoc && cursoDoc.diasActuales) ?? 30, // fallback como en el front
    );

    // total de asistencias (activas + inactivas + adicionales)
    asistente.asistencias = asistente.asistencias+1;
    const totalAsistencias =
      (asistente.asistencias ?? 0) +
      (asistente.asistenciasInactivas ?? 0) +
      (asistente.asistenciasAdicionales ?? 0);

    // porcentaje (redondeado, tope 100%). Si diasActuales=0 => 0
    const porcentaje =
      diasActuales > 0
        ? Math.min(100, Math.round((totalAsistencias / diasActuales) * 100))
        : 0;

    return {
      valid: true,
      asistente: {
        ...asistente.toObject(),
        cursoNombre,
        porcentaje, // 👈 agregado
      },
    };
  }

  // Registrar asistencia
  /*  async registrarAsistencia(
    cedula: string,
    cursoId: string,
  ): Promise<boolean> {
     const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Configurar la fecha actual sin tiempo
    hoy.setDate(hoy.getDate()); // Agregar un día para prueba
    
    // Formatear la fecha actual a 'YYYY-MM-DD'
    const fechaHoy = hoy.toISOString().split('T')[0];
    console.log(fechaHoy);
    // Verificar si ya existe la asistencia registrada para hoy
    const asistenciaExistente = await this.asistenciaModel
      .findOne({
        cedula,
        fecha: fechaHoy
      })
      .exec(); 


    if (asistenciaExistente) {
      return false; // Ya existe la asistencia
    }
    const asistenteID = await this.asistentesModel.findOne({ cedula, curso: cursoId }).lean().exec();
    // Registrar nueva asistencia
    const nuevaAsistencia = new this.asistenciaModel({
      cedula,
      curso: cursoId,
      fecha: hoy,
      asistenteId: asistenteID._id.toString(),
    });

    await nuevaAsistencia.save();
    return true;
  } */

  async registrarAsistencia(cedula: string, cursoId: string): Promise<string> {
    try {
      //Agregar Dias para probar
      const ahora = new Date(); // Fecha y hora actual
      const fechaHoy = ahora.toISOString().split('T')[0]; // Fecha actual en formato YYYY-MM-DD
      const horaActual = ahora.toTimeString().split(' ')[0]; // Hora actual en formato HH:mm:ss

      console.log(`Fecha actual: ${fechaHoy}, Hora actual: ${horaActual}`);

      // Verificar cuántos registros existen hoy para el usuario
      const registrosHoy = await this.asistenciaModel
        .find({ cedula, fecha: fechaHoy })
        .exec();

      // Obtener el último registro de asistencia del día
      const ultimoRegistro: any =
        registrosHoy.length > 0 ? registrosHoy[registrosHoy.length - 1] : null;

      if (ultimoRegistro) {
        // Calcular la diferencia en milisegundos entre el último registro y el actual
        const diferenciaEnMilisegundos =
          ahora.getTime() - new Date(ultimoRegistro.createdAt).getTime();
        const diferenciaEnMinutos = diferenciaEnMilisegundos / (1000 * 60); // Convertir a minutos

        console.log(`Diferencia en minutos: ${diferenciaEnMinutos}`);

        if (diferenciaEnMinutos < 30) {
          return 'espere'; // Intervalo de 30 minutos no cumplido
        }
      }

      // Verificar si el usuario está asociado al curso
      const asistenteID = await this.asistentesModel
        .findOne({ cedula })
        .lean()
        .exec();
      if (!asistenteID) {
        return 'El usuario no está registrado en el curso.';
      }

      // Registrar nueva asistencia
      const nuevaAsistencia = new this.asistenciaModel({
        cedula,
        curso: cursoId,
        fecha: fechaHoy,
        hora: horaActual, // Guardar la hora en formato HH:mm:ss
        asistenteId: asistenteID._id.toString(),
      });

      //validar si el curso no a sido actualizado en la fecha caso contrario agregar +1 en  diasActuales
      const hoyEc = new Date(Date.now() - 5 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
const result = await this.cursosModel.findOneAndUpdate(
  {
    _id: cursoId,
    $expr: {
      $or: [
        {
          $ne: [
            {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$updatedAt',
                timezone: 'America/Guayaquil',
              },
            },
            hoyEc,
          ],
        },
        { $eq: ['$diasActuales', 0] },
      ],
    },
  },
  {
    $inc: { diasActuales: 1 },
    $set: { updatedAt: new Date() },
  },
  { new: true } // <- devuelve el documento actualizado
);


      try {
        if (registrosHoy.length === 0) {
          const inc = asistenteID.estado
            ? { asistencias: 1 }
            : { asistenciasInactivas: 1 };

          await this.asistentesModel
            .updateOne({ _id: asistenteID._id }, { $inc: inc })
            .exec();
        }
        if (registrosHoy.length === 0 && asistenteID.negocio) {
          //Si no hay registros, se registra la entrada enviar mensaje de entrada registrada

          //Usar axios para llamar a una api de bitrix y mandar un mensaje de entrada registrada

          const ahora = new Date();
          const opciones: Intl.DateTimeFormatOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          };

          const formatoFecha = ahora
            .toLocaleString('es-ES', opciones)
            .replace(',', '');
          console.log(`Fecha y hora formateada: ${formatoFecha}`);

          const negocio = asistenteID.negocio;
          console.log(
            `https://nicpreu.bitrix24.es/rest/1/2dc3j6lin4etym89/crm.deal.update?ID=${negocio.trim()}&UF_CRM_1738432398938=${formatoFecha}`,
          );
          // Enviar la fecha en la URL
          const data = {
            ID: negocio.trim(),
            fields: {
              UF_CRM_1738432398938: formatoFecha,
            },
          };

          console.log('Consulta a enviar:', JSON.stringify(data, null, 2)); // Imprime la consulta en formato JSON

          axios
            .post(
              `https://nicpreu.bitrix24.es/rest/1/2dc3j6lin4etym89/crm.deal.update`,
              data,
              {
                headers: {
                  'Content-Type': 'application/json',
                },
              },
            )
            .then((response) => console.log('Respuesta:', response.data))
            .catch((error) => console.error('Error:', error));
        }
      } catch (error) {}
      await nuevaAsistencia.save();
      return 'exito';
    } catch (error) {
      console.error('Error al registrar la asistencia:', error);
      throw new InternalServerErrorException(
        'Error al registrar la asistencia',
        error.message,
      );
    }
  }


   // Corre todos los días a las 22:00 hora Ecuador
  @Cron('0 22 * * *', { timeZone: 'America/Guayaquil' })
  async validarFaltas() {
    const hoy = new Date();
    const hoyStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD (UTC, pero ya tienes control con tu campo fecha)

    this.logger.log(`Ejecutando validación de inasistencias para ${hoyStr}`);

    const cursos = await this.cursosModel.find().exec();

    for (const curso of cursos) {
      // 1. Verificar si hay al menos una asistencia en el curso hoy
      const existeAsistencia = await this.asistenciaModel.exists({
        curso: curso._id.toString(),
        fecha: hoyStr,
      });

      if (!existeAsistencia) {
        this.logger.log(`Curso ${curso.nombre} no tuvo ninguna asistencia registrada hoy.`);
        continue;
      }

      // 2. Obtener asistentes del curso
      const asistentes = await this.asistentesModel.find({ curso: curso._id }).exec();

      for (const asistente of asistentes) {
        // 3. Verificar si el asistente tiene asistencia hoy
        const yaAsistio = await this.asistenciaModel.exists({
          curso: curso._id.toString(),
          asistenteId: asistente._id.toString(),
          fecha: hoyStr,
        });

        if (!yaAsistio) {
          this.logger.warn(
            `Asistente ${asistente.cedula} (${asistente._id}) del curso ${curso.nombre} no registró asistencia hoy. Se incrementa inasistencias.`
          );

          // Incrementar inasistencias
          await this.asistentesModel.updateOne(
            { _id: asistente._id },
            { $inc: { inasistencias: 1 } }
          ).exec();
        }
      }
    }
  }
}
