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
    diasCurso?: number;    // plan
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
  @Cron('0 22 * * *', { timeZone: 'America/Guayaquil', name: 'validarFaltas22' })
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
async reportePorCedulaTotal(cedula: string) {
  // 1) Asistente
  const asistente = await this.asistentesModel.findOne({ cedula }).lean().exec();
  if (!asistente) {
    throw new NotFoundException(`No existe asistente con cédula ${cedula}`);
  }

  // 2) Curso (acepta ObjectId o nombre string)
  let cursoDoc: any = null;
  const cursoField = asistente.curso;

  if (cursoField && Types.ObjectId.isValid(String(cursoField))) {
    cursoDoc = await this.cursosModel.findById(cursoField).lean().exec();
  } else if (typeof cursoField === 'string') {
    cursoDoc = await this.cursosModel.findOne({ nombre: cursoField }).lean().exec();
  }

  const curso: any = cursoDoc
    ? {
        id: String(cursoDoc._id),
        nombre: cursoDoc.nombre ?? null,
        estado: cursoDoc.estado ?? null,
        diasActuales: typeof cursoDoc.diasActuales === 'number' ? cursoDoc.diasActuales : null,
        diasCurso: typeof cursoDoc.diasCurso === 'number' ? cursoDoc.diasCurso : null,
        updatedAt: cursoDoc.updatedAt ?? null,
        imagen: cursoDoc.imagen ?? null,
      }
    : {
        id: cursoField && Types.ObjectId.isValid(String(cursoField)) ? String(cursoField) : null,
        nombre: typeof cursoField === 'string' ? cursoField : null,
        estado: null,
        diasActuales: null,
        diasCurso: null,
        updatedAt: null,
        imagen: null,
      };

  // 3) Agregación: registros por fecha + resumen total
  const [aggr] = await this.asistenciaModel.aggregate([
    { $match: { cedula } },
    { $sort: { fecha: -1, createdAt: 1 } },
    {
      $facet: {
        registros: [
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
      },
    },
  ]).exec();

  // 4) Porcentaje de asistencia estimado (si hay datos de curso y del asistente)
  const asistenciasActivas = Number(asistente.asistencias ?? 0);
  const asistenciasInactivas = Number(asistente.asistenciasInactivas ?? 0);
  const asistenciasAdicionales = Number(asistente.asistenciasAdicionales ?? 0);
  const totalAsistenciasAcumuladas = asistenciasActivas + asistenciasInactivas + asistenciasAdicionales;

  const diasActuales = typeof curso.diasActuales === 'number' ? curso.diasActuales! : 0;
  const porcentajeAsistencia =
    diasActuales > 0
      ? Math.min(100, Math.round((totalAsistenciasAcumuladas / diasActuales) * 100))
      : 0;

  return {
    cedula,
    asistente: {
      id: String(asistente._id),
      nombre: asistente.nombre ?? null,
    },
    curso, // incluye: id, nombre, estado, diasActuales, diasCurso, updatedAt, imagen
    resumen: {
      ...(aggr?.resumen ?? { totalRegistros: 0, ultimaFecha: null, diasConAsistencia: 0 }),
      porcentajeAsistencia, // 👈 agregado para UI
      totalAsistenciasAcumuladas,
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
  doc.roundedRect(x - 6, y - 6, w + 12, h + 12, 10)
     .fillOpacity(0.6).fill('#ffffff').fillOpacity(1);
  doc.restore();

  // Tarjeta
  doc.save();
  doc.roundedRect(x, y, w, h, 12)
     .fill('#1a1d29') // base casi negra
     .strokeColor('#2b2f41').lineWidth(1).stroke();
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
    width: (w / 2) - pad,
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
  doc.text(`Asistidos: ${asistidos}`, right, rTop, { width: w/2 - pad });
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
  doc.text(`Generado: ${ts}`, 40, doc.page.height - 40, { align: 'left', width: doc.page.width / 2 - 40 });
  doc.text(`Página ${page} / ${total}`, doc.page.width / 2, doc.page.height - 40, {
    align: 'right',
    width: doc.page.width / 2 - 40,
  });
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
  doc.text('Fecha', marginX + 12, y + 5, { width: colFecha - 24, align: 'left' });
  doc.text('Horas', marginX + colFecha + 12, y + 5, { width: colHoras - 24, align: 'left' });
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
  doc.text('Horas', marginX + colFecha + 12, y + 5, { width: colHoras - 24 });
  doc.restore();
  y += 24;
};

for (let i = 0; i < rows.length; i++) {
  if (y + rowH > doc.page.height - 60) {
    doc.addPage();
    y = 40;
    drawHeaderAgain();
  }

  const isZebra = i % 2 === 0;       // true = fondo oscuro (zebra)
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
  doc.lineWidth(0.5).strokeColor('#25293a')
     .moveTo(marginX, y + rowH).lineTo(marginX + w, y + rowH).stroke();
  doc.restore();

  // Fecha
  doc.fillColor(dateColor);
  doc.text(rows[i].fecha ?? '—', marginX + 12, y + 4, { width: colFecha - 24 });

  // Horas
  const horasTxt = Array.isArray(rows[i].horas) && rows[i].horas.length
    ? rows[i].horas.join('  •  ')
    : '—';
  doc.fillColor(hoursColor);
  doc.text(horasTxt, marginX + colFecha + 12, y + 4, { width: colHoras - 24 });

  y += rowH;
}
}

async pdfPorCedula(cedula: string): Promise<{ buffer: Buffer; filename: string }> {
  // 🔧 URL de fondo (cámbiala si quieres usar otra)
  const BACKGROUND_URL = 'https://corpfourier.s3.us-east-2.amazonaws.com/marca_agua/marca-reportes.png';

  const data = await this.reportePorCedulaTotal(cedula);
  if (!data) throw new NotFoundException('Sin datos');

  const filename = `asistencia_${cedula}.pdf`;
  const bg = BACKGROUND_URL ? await this.fetchImageBuffer(BACKGROUND_URL) : null;

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];

  // Fondo en cada página nueva
  doc.on('pageAdded', () => {
    this.drawBackground(doc, bg);
    // (opcional) footer por página: this.drawFooter(doc, doc.page.number, 0);
  });

  const result = await new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Fondo en la primera página
    this.drawBackground(doc, bg);

    // Encabezado
    this.drawHeaderBlock(doc, data);

    // Título de tabla
    doc.moveDown(0.3);
 /*    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text('Registros por fecha'); */
    doc.moveDown(0.4);

    // Tabla
const gap = 45;                    // píxeles de aire
const startY = doc.y + gap;        // doc.y sigue en el valor previo
this.drawTable(doc, data.registros ?? [], { y: startY, marginX: 40 });

    // Footer simple (fecha de generación)
    doc.moveDown(1);
    doc.font('Helvetica').fontSize(9).fillColor('#9aa0ae');
    doc.text(`Generado: ${new Date().toLocaleString('es-EC')}`, { align: 'right' });

    doc.end();
  });

  return { buffer: result, filename };
}

}
