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
import PDFDocument = require('pdfkit');
type RegistroDia = { fecha: string; horas: string[] };
type ReportePorCedula = {
  cedula: string;
  asistente?: { id?: string; nombre?: string };
  curso: {
    id?: string;
    nombre?: string;
    estado?: string;
    diasActuales?: number; // clases dictadas
    diasCurso?: number; // plan
    updatedAt?: string;
    imagen?: string;
  };
  resumen: {
    totalRegistros: number;
    ultimaFecha?: string;
    diasConAsistencia: number;
    porcentajeAsistencia: number;
    totalAsistenciasAcumuladas: number;
  };
  registros: RegistroDia[];
};
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
// Leer todas las asistencias agrupadas por fecha
// pero separando por curso (si un alumno está en 2 cursos → 2 registros)
async generateAsistenciaReportDebug(cursoId: string) {
  try {
    // Paso 1: Obtener todos los asistentes que pertenecen al curso (match inicial por cursoId)
    const asistentes = await this.asistentesModel
      .find({ $or: [{ cursos: cursoId }, { curso: cursoId }] })
      .exec();

    console.log('Paso 1: Asistentes del curso:', asistentes);

    if (asistentes.length === 0) {
      throw new NotFoundException('No se encontraron asistentes para el curso.');
    }

    // Paso 2: Extraer los IDs de los asistentes
    const asistentesIds = asistentes.map((asistente) => asistente._id);
    console.log('Paso 2: IDs de los asistentes:', asistentesIds);

    // Paso 3: Buscar las asistencias asociadas a los IDs de los asistentes
    // ✅ IMPORTANTE: NO filtramos por curso aquí, porque quieres traerlas de todos los cursos del alumno
    const asistencias = await this.asistenciaModel
      .find({
        asistenteId: { $in: asistentesIds },
        // curso: cursoId,  ❌ ya no, porque si no solo traerías 1 curso
      })
      .sort({ fecha: 1, hora: 1 })
      .exec();

    console.log('Paso 3: Asistencias encontradas:', asistencias);

    if (asistencias.length === 0) {
      throw new NotFoundException('No se encontraron asistencias para los asistentes.');
    }

    // Paso 4: Crear un mapa para relacionar los asistentes por su ID
    const asistentesMap = new Map(
      asistentes.map((asistente) => [asistente._id.toString(), asistente]),
    );
    console.log('Paso 4: Mapa de asistentes por ID:', asistentesMap);

    // Paso 5: Agrupar asistencias por fecha y por (asistenteId + curso)
    const agrupadas = asistencias.reduce((result, asistencia) => {
      const fecha = asistencia.fecha.toString();
      const asistenteId = asistencia.asistenteId.toString();
      const curso = (asistencia.curso || '').toString();

      if (!result[fecha]) result[fecha] = {};

      // ✅ clave por curso para que salga 1 registro por curso
      const key = `${asistenteId}|${curso}`;

      if (!result[fecha][key]) {
        result[fecha][key] = {
          cedula: asistentesMap.get(asistenteId)?.cedula || asistencia.cedula || null,
          nombre: asistentesMap.get(asistenteId)?.nombre || null,
          curso, // ✅ se especifica el curso
          entrada: null,
          salida: null,
        };
      }

      // entrada/salida (por orden ya que viene ordenado por hora)
      if (!result[fecha][key].entrada) {
        result[fecha][key].entrada = asistencia.hora;
      } else if (!result[fecha][key].salida) {
        result[fecha][key].salida = asistencia.hora;
      } else {
        // si hay más de 2 marcas, mantenemos la última como salida
        result[fecha][key].salida = asistencia.hora;
      }

      return result;
    }, {} as Record<string, Record<string, any>>);

    // Paso 6: Convertir a un array para el formato de salida
    const resultado = Object.entries(agrupadas).map(([fecha, asistentesPorFecha]) => ({
      fecha,
      asistentes: Object.values(asistentesPorFecha),
    }));

    console.log('Paso 6: Asistencias agrupadas con entrada y salida:', resultado);

    return resultado;
  } catch (error) {
    console.error('Error en generateAsistenciaReportDebug:', error);
    throw new InternalServerErrorException(
      'Error al generar el reporte de asistencias por curso',
      error.message,
    );
  }
}



 async generateAsistenciaReport(cursoId: string) {
    try {
      // 1. Obtener asistentes del curso
      const asistentes = await this.asistentesModel
        .find({ $or: [{ cursos: cursoId }, { curso: cursoId }] })
        .exec();

      if (!asistentes.length) {
        throw new NotFoundException(
          'No se encontraron asistentes para el curso',
        );
      }

      // 2. IDs de asistentes
      const asistentesIds = asistentes.map((a) => a._id);

      // 3. Buscar TODAS las asistencias de esos asistentes (todos los cursos)
      const asistencias = await this.asistenciaModel
        .find({
          asistenteId: { $in: asistentesIds },
        })
        .sort({ fecha: 1, hora: 1 })
        .exec();

      if (!asistencias.length) {
        throw new NotFoundException('No se encontraron asistencias');
      }

      // 4. Mapa asistentes
      const asistentesMap = new Map(
        asistentes.map((a) => [a._id.toString(), a]),
      );

      // 5. Agrupar: fecha → asistente + curso → TODAS las marcas
      const agrupadas = asistencias.reduce((acc, asistencia) => {
        const fecha = asistencia.fecha.toString();
        const asistenteId = asistencia.asistenteId.toString();
        const curso = (asistencia.curso || '').toString();
        const key = `${asistenteId}|${curso}`;

        if (!acc[fecha]) acc[fecha] = {};

        if (!acc[fecha][key]) {
          acc[fecha][key] = {
            cedula:
              asistentesMap.get(asistenteId)?.cedula ??
              asistencia.cedula ??
              null,
            nombre: asistentesMap.get(asistenteId)?.nombre ?? null,
            curso,
            marcas: [],
          };
        }

        acc[fecha][key].marcas.push(asistencia.hora);

        return acc;
      }, {} as Record<string, Record<string, any>>);

      // 6. Formato final
      const resultado = Object.entries(agrupadas).map(
        ([fecha, registros]) => ({
          fecha,
          asistentes: Object.values(registros).map((r: any) => ({
            ...r,
            entrada: r.marcas[0] || null,
            salida: r.marcas[r.marcas.length - 1] || null,
            intermedias: r.marcas.slice(1, -1),
            totalMarcas: r.marcas.length,
          })),
        }),
      );

      return resultado;
    } catch (error) {
      console.error('[ASISTENCIA][REPORT][ERROR]', error);
      throw new InternalServerErrorException(
        'Error al generar el reporte de asistencias',
        error.message,
      );
    }
  }

  
async generateAsistenciaPorCedula(cedula: string) {
  try {
    const ced = (cedula || '').trim();
    if (!ced) throw new NotFoundException('Cédula requerida.');

    const pipeline: any[] = [
      // 1) Filtrar asistencias por cédula
      { $match: { cedula: ced } },

      // 2) Ordenar para definir entrada/salida bien
      { $sort: { curso: 1, fecha: 1, hora: 1 } },

      // 3) Agrupar por (curso, fecha)
      {
        $group: {
          _id: { curso: '$curso', fecha: '$fecha' },
          cedula: { $first: '$cedula' },
          entrada: { $first: '$hora' },
          salida: { $last: '$hora' },
        },
      },

      // 4) (Opcional) traer nombre del curso si tienes colección "cursos"
      {
        $lookup: {
          from: 'cursos',
          localField: '_id.curso',
          foreignField: '_id',
          as: 'cursoDoc',
        },
      },
      { $unwind: { path: '$cursoDoc', preserveNullAndEmptyArrays: true } },

      // 5) Agrupar por curso: un bloque por curso
      {
        $group: {
          _id: '$_id.curso',
          cursoId: { $first: '$_id.curso' },
          cursoNombre: { $first: { $ifNull: ['$cursoDoc.nombre', '$_id.curso'] } },
          cedula: { $first: '$cedula' },
          asistencias: {
            $push: {
              fecha: '$_id.fecha',
              entrada: '$entrada',
              salida: '$salida',
            },
          },
        },
      },

      // 6) ordenar por curso (y dentro por fecha ya viene por sort previo)
      { $sort: { cursoNombre: 1 } },

      // 7) formato final
      {
        $project: {
          _id: 0,
          cursoId: 1,
          cursoNombre: 1,
          cedula: 1,
          asistencias: 1,
        },
      },
    ];

    const data = await this.asistenciaModel.aggregate(pipeline).exec();

    if (!data.length) {
      throw new NotFoundException('No se encontraron asistencias para la cédula.');
    }

    return data;
  } catch (error) {
    console.error('Error generateAsistenciaPorCedula:', error);
    throw new InternalServerErrorException(
      'Error al generar reporte por cédula',
      error?.message,
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
  async validarAsistenteEnCurso(cedula: string, cursoId: string): Promise<any> {
    const asistente: any = await this.asistentesModel
      .findOne({ cedula })
      .exec();

    if (!asistente) {
      return { valid: false, asistente: null };
    }

    // ✅ compat: array + legacy
    const cursosActuales = new Set<string>([
      ...(Array.isArray((asistente as any).cursos)
        ? (asistente as any).cursos
        : []),
      ...((asistente as any).curso ? [(asistente as any).curso] : []),
    ]);

    // ✅ validar que pertenezca al curso recibido
    if (!cursoId || !cursosActuales.has(String(cursoId))) {
      return { valid: false, asistente: null };
    }

    // ✅ curso correcto por ID
    const cursoDoc = await this.cursosModel.findById(cursoId).lean().exec();

    const cursoNombre = (cursoDoc && cursoDoc.nombre) || null;

    const diasActuales = Number((cursoDoc && cursoDoc.diasActuales) ?? 30);

    // OJO: aquí tú estás incrementando asistencias en la validación (no recomendado)
    // Lo dejo como estaba (sin tocar lógica), pero te sugiero moverlo al registrarAsistencia.
    asistente.asistencias = (asistente.asistencias ?? 0) + 1;

    const totalAsistencias =
      (asistente.asistencias ?? 0) +
      (asistente.asistenciasInactivas ?? 0) +
      (asistente.asistenciasAdicionales ?? 0);

    const porcentaje =
      diasActuales > 0
        ? Math.min(100, Math.round((totalAsistencias / diasActuales) * 100))
        : 0;

    return {
      valid: true,
      asistente: {
        ...asistente.toObject(),
        cursoNombre,
        porcentaje,
        cursoId, // ✅ útil devolverlo
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
  console.log('[ASISTENCIA][START]', { cedula, cursoId });

  try {
    // 0) Hora Ecuador
    const nowEc = new Date();

const fechaHoy = nowEc.toLocaleDateString('en-CA'); // YYYY-MM-DD
const horaActual = nowEc.toTimeString().slice(0, 8);


    console.log('[ASISTENCIA][0][FECHA]', { fechaHoy, horaActual });

    // 1) Validar asistente
    console.log('[ASISTENCIA][1][BUSCAR_ASISTENTE]');
    const asistente = await this.asistentesModel
      .findOne({
        cedula,
        $or: [{ cursos: cursoId }, { curso: cursoId }],
      })
      .lean()
      .exec();

    if (!asistente) {
      console.warn('[ASISTENCIA][1][NO_EXISTE]');
      return 'El usuario no está registrado en el curso.';
    }

    console.log('[ASISTENCIA][1][ASISTENTE_OK]', {
      asistenteId: asistente._id,
      negocio: asistente.negocio ?? null,
    });

    // 2) Buscar registros del día
    console.log('[ASISTENCIA][2][BUSCAR_REGISTROS_HOY]');
    const registrosHoy = await this.asistenciaModel
      .find({ cedula, curso: cursoId, fecha: fechaHoy })
      .sort({ createdAt: 1 })
      .lean()
      .exec();
 
    console.log('[ASISTENCIA][2][REGISTROS_HOY]', {
      total: registrosHoy.length,
    });

    const ultimoRegistro:any = registrosHoy.length
      ? registrosHoy[registrosHoy.length - 1]
      : null;
    console.log(ultimoRegistro); 
    // 3) Cooldown 30 min
    if (ultimoRegistro) {
      const diffMin =
        (nowEc.getTime() - new Date(ultimoRegistro.createdAt).getTime()) /
        (1000 * 60);

      console.log('[ASISTENCIA][3][COOLDOWN]', {
        diffMin,
        ultimoRegistro: ultimoRegistro.createdAt,
      });

      if (diffMin < 30) {
        console.warn('[ASISTENCIA][3][COOLDOWN_BLOQUEADO]');
        return 'espere';
      }
    } else {
      console.log('[ASISTENCIA][3][SIN_REGISTRO_PREVIO]');
    }

    // 4) Insertar asistencia
    console.log('[ASISTENCIA][4][CREANDO_ASISTENCIA]');
    await this.asistenciaModel.create({
      cedula,
      curso: cursoId,
      fecha: fechaHoy,
      hora: horaActual,
      asistenteId: asistente._id.toString(),
    });

    console.log('[ASISTENCIA][4][ASISTENCIA_OK]');

    // 5) Incrementar días del curso
    console.log('[ASISTENCIA][5][INCREMENTAR_DIAS]');
    await this.incrementarDiasActualesSiCorresponde(cursoId, fechaHoy);
    console.log('[ASISTENCIA][5][DIAS_OK]');

    // 6) Bitrix solo primera del día
    if (registrosHoy.length === 0 && asistente.negocio) {
      console.log('[ASISTENCIA][6][BITRIX_NOTIFICAR]');
      this.notificarBitrixEntradaRegistrada(asistente.negocio);
    } else {
      console.log('[ASISTENCIA][6][BITRIX_SKIP]', {
        registrosHoy: registrosHoy.length,
        negocio: !!asistente.negocio,
      });
    }

    console.log('[ASISTENCIA][END][EXITO]');
    return 'exito';
  } catch (error) {
    console.error('[ASISTENCIA][ERROR_FATAL]', error);
    throw new InternalServerErrorException(
      'Error al registrar la asistencia',
      error.message,
    );
  }
}


  // BITRIX_WEBHOOK_URL=https://nicpreu.bitrix24.es/rest/1/XXXX/crm.deal.update
  private readonly BITRIX_DEAL_UPDATE_URL =
    'https://nicpreu.bitrix24.es/rest/1/2dc3j6lin4etym89/crm.deal.update';

  // Campo Bitrix donde guardas "entrada registrada"
  private readonly BITRIX_FIELD_ENTRADA = 'UF_CRM_1760998213';
  private async notificarBitrixEntradaRegistrada(
    negocioId: string,
  ): Promise<void> {
    try {
      const dealId = (negocioId || '').trim();
      if (!dealId) return;

      // Fecha Ecuador (dd/mm/yyyy)
      const nowEc = new Date(Date.now() - 5 * 60 * 60 * 1000);
      const day = String(nowEc.getDate()).padStart(2, '0');
      const month = String(nowEc.getMonth() + 1).padStart(2, '0');
      const year = nowEc.getFullYear();
      const fecha = `${day}/${month}/${year}`;

      const payload = {
        ID: dealId,
        fields: {
          [this.BITRIX_FIELD_ENTRADA]: fecha,
        },
      };

      const resp = await axios.post(this.BITRIX_DEAL_UPDATE_URL, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000,
      });

      // Bitrix suele responder { result: true } o similar
      this.logger.log(
        `Bitrix deal.update OK. dealId=${dealId} resp=${JSON.stringify(resp.data)}`,
      );
    } catch (err: any) {
      // Importante: NO romper el flujo de asistencia
      const msg = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err?.message || String(err);

      this.logger.warn(`Bitrix deal.update FAIL: ${msg}`);
    }
  }

  private async incrementarDiasActualesSiCorresponde(
    cursoId: string,
    fechaHoyEc: string,
  ) {
    await this.cursosModel
      .updateOne(
        {
          _id: cursoId,
          $or: [
            { ultimaClaseFecha: { $ne: fechaHoyEc } },
            { ultimaClaseFecha: null },
          ],
        },
        { $inc: { diasActuales: 1 }, $set: { ultimaClaseFecha: fechaHoyEc } },
      )
      .exec();
  }

  // Corre todos los días a las 22:00 hora Ecuador
  //@Cron('0 22 * * *', { timeZone: 'America/Guayaquil', name: 'validarFaltas22' })
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
        this.logger.log(
          `Curso ${curso.nombre} no tuvo ninguna asistencia registrada hoy.`,
        );
        continue;
      }

      // 2. Obtener asistentes del curso
      const asistentes = await this.asistentesModel
        .find({ $or: [{ cursos: curso._id.toString() }, { curso: curso._id }] })
        .exec();

      for (const asistente of asistentes) {
        // 3. Verificar si el asistente tiene asistencia hoy
        const yaAsistio = await this.asistenciaModel.exists({
          curso: curso._id.toString(),
          asistenteId: asistente._id.toString(),
          fecha: hoyStr,
        });

        if (!yaAsistio) {
          this.logger.warn(
            `Asistente ${asistente.cedula} (${asistente._id}) del curso ${curso.nombre} no registró asistencia hoy. Se incrementa inasistencias.`,
          );

          // Incrementar inasistencias
          await this.asistentesModel
            .updateOne({ _id: asistente._id }, { $inc: { inasistencias: 1 } })
            .exec();
        }
      }
    }
  }
  async reportePorCedulaTotal(cedula: string, cursoId?: string) {
  // 1) Asistente
  const asistente: any = await this.asistentesModel.findOne({ cedula }).lean().exec();

  if (!asistente) {
    throw new NotFoundException(`No existe asistente con cédula ${cedula}`);
  }

  // 2) Resolver lista de cursos del asistente (compat: cursos[] + legacy curso)
  const cursosAsistente: string[] = [
    ...(Array.isArray(asistente.cursos) ? asistente.cursos : []),
    ...(asistente.curso ? [asistente.curso] : []),
  ]
    .filter(Boolean)
    .map((x) => String(x));

  // 3) Determinar curso objetivo (prioridad: cursoId recibido > legacy > primero del array)
  const cursoTarget =
    cursoId && String(cursoId).trim()
      ? String(cursoId).trim()
      : asistente.curso
        ? String(asistente.curso)
        : cursosAsistente[0] ?? null;

  if (!cursoTarget) {
    throw new NotFoundException(`El asistente ${cedula} no tiene cursos asociados.`);
  }

  // 4) Validar pertenencia si vino cursoId explícito
  if (cursoId) {
    const pertenece = cursosAsistente.includes(String(cursoId));
    if (!pertenece) {
      throw new NotFoundException(`El asistente ${cedula} no pertenece al curso indicado.`);
    }
  }

  // 5) Curso doc (si cursoTarget parece ObjectId, buscar por _id; si no, por nombre)
  let cursoDoc: any = null;

  if (Types.ObjectId.isValid(String(cursoTarget))) {
    cursoDoc = await this.cursosModel.findById(cursoTarget).lean().exec();
  } else {
    cursoDoc = await this.cursosModel.findOne({ nombre: String(cursoTarget) }).lean().exec();
  }

  const curso: any = cursoDoc
    ? {
        id: String(cursoDoc._id),
        nombre: cursoDoc.nombre ?? null,
        estado: cursoDoc.estado ?? null,
        diasActuales: typeof cursoDoc.diasActuales === 'number' ? cursoDoc.diasActuales : 0,
        diasCurso: typeof cursoDoc.diasCurso === 'number' ? cursoDoc.diasCurso : 0,
        updatedAt: cursoDoc.updatedAt ?? null,
        imagen: cursoDoc.imagen ?? null,
        fechasEsperadas: Array.isArray(cursoDoc.fechasEsperadas) ? cursoDoc.fechasEsperadas : [],
      }
    : {
        id: Types.ObjectId.isValid(String(cursoTarget)) ? String(cursoTarget) : null,
        nombre: Types.ObjectId.isValid(String(cursoTarget)) ? null : String(cursoTarget),
        estado: null,
        diasActuales: 0,
        diasCurso: 0,
        updatedAt: null,
        imagen: null,
        fechasEsperadas: [],
      };

  // ✅ Valor “real” del curso para filtrar asistencia (idealmente SIEMPRE ID)
  const cursoMatchValue = cursoDoc?._id ? String(cursoDoc._id) : String(cursoTarget);

  // 6) Obtener cédulas de compañeros del mismo curso (compat: curso legacy OR cursos[] contiene)
  const cursoOr: any[] = [];
  if (cursoDoc?._id) {
    const idStr = String(cursoDoc._id);
    cursoOr.push({ cursos: idStr });
    cursoOr.push({ curso: idStr });

    // por si algún registro guardó nombre en legacy
    if (cursoDoc.nombre) cursoOr.push({ curso: cursoDoc.nombre });
  } else {
    // si solo tenemos nombre
    cursoOr.push({ curso: String(cursoTarget) });
    cursoOr.push({ cursos: String(cursoTarget) });
  }

  const asistentesCurso = await this.asistentesModel
    .find({ $or: cursoOr }, { cedula: 1 })
    .lean()
    .exec();

  const cedulasCurso: string[] = (asistentesCurso ?? [])
    .map((a: any) => a.cedula)
    .filter((x: any) => typeof x === 'string' && x.length);

  // ✅ Filtro por curso para la asistencia del alumno
  const matchAsistenciaAlumno: any = {
    cedula,
    curso: cursoMatchValue,
  };

  // 7) Agregación: registros/resumen del alumno + top del curso (todo filtrado por curso)
  const [aggr] = await this.asistenciaModel
    .aggregate([
      {
        $facet: {
          registros: [
            { $match: matchAsistenciaAlumno },
            { $sort: { fecha: -1, createdAt: 1 } },
            {
              $group: {
                _id: '$fecha',
                horas: { $push: '$hora' },
                registrosEnElDia: { $sum: 1 },
              },
            },
            { $sort: { _id: -1 } },
            {
              $project: {
                _id: 0,
                fecha: '$_id',
                horas: 1,
                registrosEnElDia: 1,
              },
            },
          ],
          resumen: [
            { $match: matchAsistenciaAlumno },
            {
              $group: {
                _id: null,
                totalRegistros: { $sum: 1 },
                ultimaFecha: { $max: '$fecha' },
                diasConAsistenciaSet: { $addToSet: '$fecha' },
              },
            },
            {
              $project: {
                _id: 0,
                totalRegistros: 1,
                ultimaFecha: 1,
                diasConAsistencia: { $size: '$diasConAsistenciaSet' },
              },
            },
          ],
          topCurso: cedulasCurso.length
            ? [
                {
                  $match: {
                    cedula: { $in: cedulasCurso },
                    curso: cursoMatchValue,
                  },
                },
                {
                  $group: {
                    _id: '$cedula',
                    diasSet: { $addToSet: '$fecha' },
                    total: { $sum: 1 },
                  },
                },
                { $sort: { total: -1 } },
                { $limit: 1 },
                {
                  $project: {
                    _id: 0,
                    referenciaCedula: '$_id',
                    total: 1,
                    diasTop: '$diasSet',
                  },
                },
              ]
            : [{ $limit: 0 }],
        },
      },
      {
        $project: {
          registros: 1,
          resumen: {
            $ifNull: [
              { $arrayElemAt: ['$resumen', 0] },
              { totalRegistros: 0, ultimaFecha: null, diasConAsistencia: 0 },
            ],
          },
          topCurso: { $ifNull: ['$topCurso', []] },
        },
      },
    ])
    .exec();

  // 8) Porcentaje (✅ por curso)
  const totalAsistenciasAcumuladas = Number(aggr?.resumen?.totalRegistros ?? 0);

  const diasActuales = Number(curso.diasActuales ?? 0);
  const porcentajeAsistencia =
    diasActuales > 0
      ? Math.min(100, Math.round((totalAsistenciasAcumuladas / diasActuales) * 100))
      : 0;

  // 9) ✅ FALTAS: comparar contra "todos los días reales del curso"
  //    Regla: "Un día cuenta como esperado si al menos alguien del curso registró asistencia ese día"
  //    Así, evitamos depender del 'topCurso' o de un solo alumno.
  const diasCursoAgg = await this.asistenciaModel
    .aggregate([
      { $match: { curso: cursoMatchValue } },
      { $group: { _id: '$fecha' } },
      { $sort: { _id: 1 } },
    ])
    .exec();

  const fechasCurso: string[] = (diasCursoAgg ?? []).map((d: any) => String(d._id));

  const diasAsistidosSet = new Set<string>((aggr?.registros ?? []).map((r: any) => String(r.fecha)));

  const diasFaltados = fechasCurso.filter((fecha) => !diasAsistidosSet.has(fecha));
  const totalDiasEsperados = fechasCurso.length;
  const totalFaltas = diasFaltados.length;

  // Info top (opcional)
  const topInfo =
    Array.isArray(aggr?.topCurso) && aggr.topCurso.length ? aggr.topCurso[0] : null;

  // 10) Respuesta
  return {
    cedula,
    cursoId: cursoDoc?._id
      ? String(cursoDoc._id)
      : Types.ObjectId.isValid(String(cursoTarget))
        ? String(cursoTarget)
        : null,
    asistente: {
      id: String(asistente._id),
      nombre: asistente.nombre ?? null,
    },
    curso,
    resumen: {
      ...(aggr?.resumen ?? {
        totalRegistros: 0,
        ultimaFecha: null,
        diasConAsistencia: 0,
      }),
      porcentajeAsistencia,
      totalAsistenciasAcumuladas,
      totalDiasEsperados,
      totalFaltas,
    },
    faltas: {
      referencia: topInfo?.referenciaCedula ?? null,
      diasFaltados,
      fechasEsperadas: fechasCurso,
      fuente: 'union_todos_en_curso',
    },
    registros: aggr?.registros ?? [],
  };
}


  /* 
async pdfPorCedula(cedula: string): Promise<Buffer> {
  const data:any = await this.reportePorCedulaTotal(cedula);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  return await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Encabezado
    doc.fontSize(16).text('Reporte de Asistencia', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(11).text(`Cédula: ${data.cedula}`);
    doc.text(`Asistente: ${data.asistente.asistenteNombre ?? '-'}`);
    doc.text(`Curso: ${data.curso.nombre ?? '-'}`);
    doc.text(`Estado: ${data.curso.estado ?? '-'}`);
    doc.text(`Días curso: ${data.curso.diasActuales ?? 0}/${data.curso.diasCurso ?? 0}`);
    doc.text(`% Asistencia: ${data.resumen.porcentajeAsistencia}%`);
    doc.moveDown();

    // Registros
    doc.fontSize(13).text('Registros', { underline: true });
    doc.moveDown(0.3);

    data.registros.forEach((r) => {
      doc.fontSize(11).text(`${r.fecha}  —  ${r.horas.join(', ')}`);
    });

    doc.end();
  });
} */

  private async fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
      const { data } = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(data);
    } catch {
      return null;
    }
  }

  private drawBackground(doc: PDFKit.PDFDocument, bg?: Buffer | null) {
    if (!bg) return;
    doc.save();

    doc.image(bg, 0, 0, {
      fit: [doc.page.width, doc.page.height],
      align: 'center',
      valign: 'center',
    });
    doc.restore();
  }

  private drawHeaderBlock(doc: PDFKit.PDFDocument, data: ReportePorCedula) {
    const nombreCurso = (data.curso.nombre || '').replaceAll('_', ' ').trim();
    const clases = data.curso.diasActuales ?? 0;
    const asistidos = data.resumen.diasConAsistencia ?? 0;
    const porcentaje = data.resumen.porcentajeAsistencia ?? 0;

    // Dimensiones del bloque
    const x = 40;
    const w = doc.page.width - 80;
    const h = 110;
    const y = doc.y;

    // Capa blanca muy sutil bajo la tarjeta para “matar” el fondo
    doc.save();
    doc
      .roundedRect(x - 6, y - 6, w + 12, h + 12, 10)
      .fillOpacity(0.6)
      .fill('#ffffff')
      .fillOpacity(1);
    doc.restore();

    // Tarjeta
    doc.save();
    doc
      .roundedRect(x, y, w, h, 12)
      .fill('#1a1d29') // base casi negra
      .strokeColor('#2b2f41')
      .lineWidth(1)
      .stroke();
    doc.restore();

    const pad = 16;
    const left = x + pad;
    const right = x + w / 2 + 8; // “columna” derecha

    // Título
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#e9ecf4');
    doc.text('Reporte de Asistencia', left, y + pad, { width: w - pad * 2 });

    // Curso (2 líneas máx) + datos
    const topText = y + pad + 20;

    doc.font('Helvetica').fontSize(11).fillColor('#b8becc');
    // Curso (hasta 2 líneas, luego '…')
    doc.text(nombreCurso || '—', left, topText, {
      width: w / 2 - pad,
      height: 32,
      ellipsis: true,
    });

    // Cédula y Asistente debajo
    doc.moveDown(0.2);
    doc.text(`Cédula: ${data.cedula}`, left, doc.y);
    doc.text(`Asistente: ${data.asistente?.nombre ?? '—'}`, left, doc.y);
    doc.text(`Estado: ${data.curso.estado ?? '—'}`, left, doc.y);

    // Columna derecha: Asistidos/Clases y Porcentaje
    doc.font('Helvetica').fontSize(11).fillColor('#cdd2de');
    const rTop = topText;
    doc.text(`Asistidos: ${asistidos}`, right, rTop, { width: w / 2 - pad });
    doc.text(`Clases: ${clases}`, right, doc.y);
    doc.moveDown(0.3);

    /*   doc.font('Helvetica-Bold').fontSize(20).fillColor('#e9ecf4');
  doc.text(`${porcentaje}%`, right, doc.y + 2); */

    // Barra de progreso
    // Barra de progreso (opcional)
    /* const ratio = clases > 0 ? Math.max(0, Math.min(1, asistidos / clases)) : 0;
const barX = left;
const barY = y + h - pad - 12; // un poquito más arriba para evitar solape
const barW = w - pad * 2;
const barH = 8;

doc.save();
doc.roundedRect(barX, barY, barW, barH, 6).fill('#2a2e3f'); */
    /* if (ratio > 0) {
  // tramo coloreado
  const fillW = Math.max(10, barW * ratio); // mínimo 10px para que se vea
  doc.roundedRect(barX, barY, Math.min(fillW, barW), barH, 6).fill('#7C3AED');
} */
    doc.restore();

    // Porcentaje justo encima, centrado a la derecha
    /* doc.font('Helvetica-Bold').fontSize(14).fillColor('#e9ecf4');
doc.text(`${porcentaje}%`, barX + barW - 60, barY - 16, { width: 60, align: 'right' });
 */
  }
  private drawFooter(doc: PDFKit.PDFDocument, page: number, total: number) {
    doc.font('Helvetica').fontSize(9).fillColor('#9aa0ae');
    const ts = new Date().toLocaleString('es-EC');
    doc.text(`Generado: ${ts}`, 40, doc.page.height - 40, {
      align: 'left',
      width: doc.page.width / 2 - 40,
    });
    doc.text(
      `Página ${page} / ${total}`,
      doc.page.width / 2,
      doc.page.height - 40,
      {
        align: 'right',
        width: doc.page.width / 2 - 40,
      },
    );
  }
  private drawTable(
    doc: PDFKit.PDFDocument,
    rows: RegistroDia[],
    opts: { y: number; marginX?: number } = { y: 0 },
  ) {
    const marginX = opts.marginX ?? 40;
    let y = opts.y;

    const w = doc.page.width - marginX * 2;
    const colFecha = 120;
    const colHoras = w - colFecha;

    // Header
    doc.save();
    doc.roundedRect(marginX, y, w, 22, 8).fill('#1f2333');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10.5);
    doc.text('Fecha', marginX + 12, y + 5, {
      width: colFecha - 24,
      align: 'left',
    });
    doc.text('Horas', marginX + colFecha + 12, y + 5, {
      width: colHoras - 24,
      align: 'left',
    });
    doc.restore();
    y += 24;

    // Filas
    doc.font('Helvetica').fontSize(10);
    const rowH = 20;

    const drawHeaderAgain = () => {
      doc.save();
      doc.roundedRect(marginX, y, w, 22, 8).fill('#1f2333');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10.5);
      doc.text('Fecha', marginX + 12, y + 5, { width: colFecha - 24 });
      doc.text('Horas', marginX + colFecha + 12, y + 5, {
        width: colHoras - 24,
      });
      doc.restore();
      y += 24;
    };

    for (let i = 0; i < rows.length; i++) {
      if (y + rowH > doc.page.height - 60) {
        doc.addPage();
        y = 40;
        drawHeaderAgain();
      }

      const isZebra = i % 2 === 0; // true = fondo oscuro (zebra)
      const dateColor = isZebra ? '#cfd3df' : '#7C3AED';
      const hoursColor = isZebra ? '#cfd3df' : '#7C3AED'; // 👈 morado cuando NO hay fondo

      // Zebra sutil (solo en impares según tu preferencia)
      if (isZebra) {
        doc.save();
        doc.rect(marginX, y, w, rowH).fill('#151826');
        doc.restore();
      }

      // Borde inferior sutil
      doc.save();
      doc
        .lineWidth(0.5)
        .strokeColor('#25293a')
        .moveTo(marginX, y + rowH)
        .lineTo(marginX + w, y + rowH)
        .stroke();
      doc.restore();

      // Fecha
      doc.fillColor(dateColor);
      doc.text(rows[i].fecha ?? '—', marginX + 12, y + 4, {
        width: colFecha - 24,
      });

      // Horas
      const horasTxt =
        Array.isArray(rows[i].horas) && rows[i].horas.length
          ? rows[i].horas.join('  •  ')
          : '—';
      doc.fillColor(hoursColor);
      doc.text(horasTxt, marginX + colFecha + 12, y + 4, {
        width: colHoras - 24,
      });

      y += rowH;
    }
  }
async pdfPorCedula(
  cedula: string,
  cursoId?: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const BACKGROUND_URL =
    'https://corpfourier.s3.us-east-2.amazonaws.com/marca_agua/marca-reportes.png';

  // ✅ IMPORTANTE: pasar cursoId al reporte
  const data: any = await this.reportePorCedulaTotal(cedula, cursoId);
  if (!data) throw new NotFoundException('Sin datos');

  // ✅ filename incluye curso para evitar confusión
  const safeCurso = (data?.curso?.nombre ?? 'curso')
    .toString()
    .trim()
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  const filename = `asistencia_${cedula}_${safeCurso}.pdf`;

  const bg = BACKGROUND_URL
    ? await this.fetchImageBuffer(BACKGROUND_URL)
    : null;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];

  const HEADER_HEIGHT = 130;
  const PADDING_BELOW_HEADER = 6;

  doc.on('pageAdded', () => this.drawBackground(doc, bg));

  const result = await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Fondo + encabezado
    this.drawBackground(doc, bg);
    this.drawHeaderBlock(doc, data as any);

    // Posicionar cursor
    doc.x = doc.page.margins.left;
    doc.y = doc.page.margins.top + HEADER_HEIGHT + PADDING_BELOW_HEADER;

    // ===== TÍTULO TABLA =====
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor('#0f172a')
      .text('Registros por fecha');
    doc.moveDown(0.2);

    // ===== TABLA COMBINADA =====
    const startY = doc.y + 20;

    // (si tu buildCombinedRows ya usa data.faltas/fechasEsperadas, listo)
    const combined = this.buildCombinedRows(data);

    this.drawTableCombined(doc, combined, { y: startY, marginX: 40 });

    // ===== FOOTER =====
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(9).fillColor('#9aa0ae');
    doc.text(`Generado: ${this.formatDateTime(new Date().toISOString())}`, {
      align: 'right',
    });

    doc.end();
  });

  return { buffer: result, filename };
}

  /* ======================== HELPERS ======================== */

  // === 1) Parser robusto: trata 'YYYY-MM-DD' como fecha local (sin TZ) ===
  private parseISOAsLocal(iso: string): Date {
    if (!iso) return new Date(NaN);
    // Si viene con hora (contiene 'T'), deja que el Date nativo la resuelva
    if (iso.includes('T')) return new Date(iso);

    // Esperado: 'YYYY-MM-DD'
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]) - 1; // 0-based
      const d = Number(m[3]);
      return new Date(y, mo, d, 0, 0, 0, 0); // local time
    }
    // Si viene en otro formato, intenta parseo nativo
    return new Date(iso);
  }

  // === 2) Solo "día de mes de año" (sin weekday) ===
  private formatDate(iso: string): string {
    const d = this.parseISOAsLocal(iso);
    if (isNaN(d.getTime())) return '—';
    // Usamos formatToParts para asegurar el orden "d de mmmm de yyyy"
    const parts = new Intl.DateTimeFormat('es-EC', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).formatToParts(d);

    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    // Asegura "15 de julio de 2025"
    return `${map.day} de ${map.month} de ${map.year}`;
  }

  // === 3) "día de mes de año, HH:mm" (sin weekday) para el footer ===
  private formatDateTime(iso: string): string {
    const d = this.parseISOAsLocal(iso);
    if (isNaN(d.getTime())) return '—';

    const fecha = this.formatDate(iso); // reutiliza el de arriba
    const hora = new Intl.DateTimeFormat('es-EC', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);

    return `${fecha}, ${hora}`;
  }
  private formatHora(raw?: string[] | string | null): string {
    if (!raw) return '—';
    let first: string;
    if (Array.isArray(raw)) {
      if (!raw.length) return '—';
      first = raw[0] ?? '';
    } else {
      first = raw;
    }
    if (!first) return '—';
    const parts = first.split(':');
    if (parts.length >= 2) return `${parts[0]}:${parts[1]} m`;
    return `${first} m`;
  }

  private buildCombinedRows(data: any) {
    const registros = Array.isArray(data.registros) ? data.registros : [];
    const faltas = Array.isArray(data.faltas?.diasFaltados)
      ? data.faltas!.diasFaltados!
      : [];
    const regPorFecha = new Map<string, any>();
    for (const r of registros) regPorFecha.set(r.fecha, r);

    const rows: any[] = [];

    for (const r of registros) {
      const horas = r.horas ?? [];
      const horaTxt =
        horas.length === 0
          ? '—'
          : horas.length === 1
            ? this.formatHora(horas)
            : `${this.formatHora(horas)} (+${horas.length - 1})`;

      rows.push({
        fechaISO: r.fecha,
        fechaTxt: this.formatDate(r.fecha),
        horaTxt,
        asistio: horas.length > 0 || (r.registrosEnElDia ?? 0) > 0,
      });
    }

    for (const f of faltas) {
      if (!regPorFecha.has(f)) {
        rows.push({
          fechaISO: f,
          fechaTxt: this.formatDate(f),
          horaTxt: '—',
          asistio: false,
        });
      }
    }

    rows.sort(
      (a, b) =>
        this.parseISOAsLocal(b.fechaISO).getTime() -
        this.parseISOAsLocal(a.fechaISO).getTime(),
    );
    return rows;
  }

  private drawTableCombined(
    doc: PDFKit.PDFDocument,
    rows: any[],
    opts: { y: number; marginX: number },
  ) {
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const usableWidth = right - left;

    const colW1 = Math.floor(usableWidth * 0.5);
    const colW2 = Math.floor(usableWidth * 0.2);
    const colW3 = usableWidth - colW1 - colW2;

    const headerBg = '#F3F4F6';
    const zebra = '#FAFAFA';
    const border = '#E5E7EB';

    let y = opts.y;

    // Encabezado
    doc.save();
    doc.rect(left, y, usableWidth, 22).fill(headerBg);
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10);
    doc.text('Fecha', left + 8, y + 6, { width: colW1 - 8 });
    doc.text('Hora(s)', left + colW1 + 8, y + 6, {
      width: colW2 - 16,
      align: 'center',
    });
    doc.text('Estado', left + colW1 + colW2 + 8, y + 6, {
      width: colW3 - 16,
      align: 'right',
    });
    y += 22;
    doc.restore();

    const rowPadY = 8;
    const minRowH = 22;

    const drawEstado = (asistio: boolean): { text: string; color: string } => ({
      text: asistio ? 'Asistió' : 'Faltó',
      color: asistio ? '#22C55E' : '#EF4444',
    });

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const estado = drawEstado(r.asistio);
      const rowH = minRowH + rowPadY;

      if (y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
      }

      if (i % 2 === 0) {
        doc.save();
        doc.rect(left, y, usableWidth, rowH).fill(zebra);
        doc.restore();
      }

      doc.fillColor('#111827').font('Helvetica').fontSize(10);
      doc.text(r.fechaTxt, left + 8, y + 6, { width: colW1 - 16 });
      doc.text(r.horaTxt, left + colW1 + 8, y + 6, {
        width: colW2 - 16,
        align: 'center',
      });
      doc.fillColor(estado.color).font('Helvetica-Bold');
      doc.text(estado.text, left + colW1 + colW2 + 8, y + 6, {
        width: colW3 - 16,
        align: 'right',
      });

      y += rowH;

      // Línea inferior
      doc.save();
      doc
        .lineWidth(0.5)
        .strokeColor(border)
        .moveTo(left, y)
        .lineTo(right, y)
        .stroke();
      doc.restore();
    }

    if (rows.length === 0) {
      doc.fillColor('#6B7280').font('Helvetica-Oblique').fontSize(10);
      doc.text('Sin registros.', left + 8, y + 8, { width: usableWidth - 16 });
    }
  }

  async justificarFalta(dto: any): Promise<{ ok: boolean }> {
  const { cedula, cursoId, fecha, usuario } = dto;

  if (!cedula || !cursoId || !fecha || !usuario) {
    throw new ForbiddenException('Datos incompletos para justificar la falta');
  }

  // 1️⃣ Validar asistente
  const asistente = await this.asistentesModel
    .findOne({
      cedula,
      $or: [{ cursos: cursoId }, { curso: cursoId }],
    })
    .lean()
    .exec();

  if (!asistente) {
    throw new NotFoundException('El asistente no pertenece al curso');
  }

  // 2️⃣ Verificar si ya existe registro ese día
  const existe = await this.asistenciaModel.findOne({
    cedula,
    curso: cursoId,
    fecha,
  });

  // ⏱️ fecha/hora real de la justificación
  const justificacionAt = new Date();
const justificadaAt = new Date();

  if (existe) {
    await this.asistenciaModel.updateOne(
      { _id: existe._id },
      {
        $set: {
          justificada: true,
          observacion: 'FALTA JUSTIFICADA',
          justificadaPor: usuario,
          justificadaAt,
          tipo: 'JUSTIFICACION',

          // 🔥 CLAVE: actualizamos updatedAt
          updatedAt: justificacionAt,
        },
      },
    );

    return { ok: true };
  }

  // 3️⃣ Crear registro nuevo con createdAt = momento de justificación
  await this.asistenciaModel.create({
    cedula,
    curso: cursoId,
    fecha,                // día faltado
    hora: '00:00:00',
    asistenteId: asistente._id.toString(),

    // contexto Ecuador (opcional)
    fechaEcuador: new Date(`${fecha}T00:00:00-05:00`),

    // 🔥 timestamps manuales
    createdAt: justificacionAt,
    updatedAt: justificacionAt,

    // datos de negocio
    justificada: true,
    observacion: 'FALTA JUSTIFICADA',
    justificadaPor: usuario,
    justificadaAt,
    tipo: 'JUSTIFICACION',
  });

  return { ok: true };
}

}
