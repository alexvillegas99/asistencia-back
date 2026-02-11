import { cursorTo } from 'readline';
import { AsistenciasService } from './../asistencias/asistencias.service';
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { CreateAsistenteDto } from './dto/create-asistente.dto';
import { UpdateAsistenteDto } from './dto/update-asistente.dto';
import {
  AsistentesDocument,
  AsistentesModelName,
} from './entities/asistente.entity';
import * as JSZip from 'jszip';
import * as QRCode from 'qrcode';
import { Response } from 'express';
import { createCanvas, loadImage } from 'canvas';
import { CursoService } from 'src/curso/curso.service';
import {
  AsistenteMigradoDocument,
  AsistentesMigradosModelName,
} from './entities/asistentes-migrados.entity';
import axios from 'axios';
import {
  Asistencia,
  AsistenciaDocument,
} from 'src/asistencias/entities/asistencia.entity';
import { IMG_DEFAULT } from 'src/config/config.env';
@Injectable()
export class AsistentesService {
  async cambiarCurso(body: { cedula: string; cursoId: string }) {
    const { cedula, cursoId } = body;

    if (!cedula || !cursoId) {
      throw new Error('Faltan parámetros: cedula o cursoId');
    }

    // Buscar asistente por cédula
    const asistente: any = await this.asistentesModel.findOne({ cedula });
    if (!asistente) {
      throw new NotFoundException('Asistente no encontrado');
    }

    // Normalizar cursos actuales (array primero, legacy después)
    const cursosActuales = new Set<string>([
      ...(Array.isArray(asistente.cursos) ? asistente.cursos : []),
      ...(asistente.curso ? [asistente.curso] : []),
    ]);

    // Si ya tiene el curso, no hacer nada
    if (cursosActuales.has(cursoId)) {
      return asistente; // idempotente
    }

    // Actualizar: agregar curso y migrar legacy si existe
    const update: any = {
      $addToSet: { cursos: cursoId },
    };

    if (asistente.curso) {
      update.$unset = { curso: '' };
    }

    const actualizado = await this.asistentesModel.findByIdAndUpdate(
      asistente._id,
      update,
      { new: true },
    );

    // --- Integración Bitrix (mantengo tu lógica) ---
    try {
      const curso = await this.cursoService.findOne(cursoId);
      if (curso) {
        const data = {
          ID: asistente.negocio?.trim(),
          fields: {
            UF_CRM_1756402575272: curso.nombre,
          },
        };

        await axios.post(
          `https://nicpreu.bitrix24.es/rest/1/2dc3j6lin4etym89/crm.deal.update`,
          data,
          { headers: { 'Content-Type': 'application/json' } },
        );
      }
    } catch (e) {
      console.error('Error actualizando Bitrix:', e.message);
    }

    return actualizado;
  }

  async todos() {
    try {
      return await this.asistentesModel.find().exec();
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al obtener todos los asistentes',
        error.message,
      );
    }
  }

  constructor(
    @InjectModel(AsistentesModelName)
    private readonly asistentesModel: Model<AsistentesDocument>,
    private readonly cursoService: CursoService,
    @InjectModel(AsistentesMigradosModelName)
    private readonly asistentesMigrados: Model<AsistenteMigradoDocument>,
    @InjectConnection() private readonly conn: Connection,
    @InjectModel(Asistencia.name)
    private readonly asistenciaModel: Model<AsistenciaDocument>,
  ) {}

  async buscarPorCedula(cedula: string, cursoId: string) {
    if (!cedula) {
      throw new Error('La cédula es requerida');
    }

    // Buscar asistente por cédula
    const asistente: any = await this.asistentesModel
      .findOne({ cedula })
      .populate('cursos')
      .lean()
      .exec();

    if (!asistente) {
      throw new NotFoundException('Asistente no encontrado');
    }

    // Resolver cursos actuales (array primero, legacy después)
    const cursosActuales: string[] = [
      ...(Array.isArray(asistente.cursos) ? asistente.cursos : []),
      ...(asistente.curso ? [asistente.curso] : []),
    ];

    // Si se envía cursoId, validar pertenencia
    if (cursoId && !cursosActuales.includes(cursoId)) {
      throw new NotFoundException(
        'El asistente no pertenece al curso indicado',
      );
    }

    // Determinar curso a usar (prioridad: cursoId > legacy > primero del array)
    const cursoUsado =
      cursoId ??
      asistente.curso ??
      (Array.isArray(asistente.cursos) ? asistente.cursos[0] : undefined);

    let cursoNombre = 'Curso no encontrado';
    if (cursoUsado) {
      try {
        const curso = await this.cursoService.findOne(cursoUsado);
        cursoNombre = curso?.nombre ?? cursoNombre;
      } catch {}
    }

    return {
      ...asistente,
      cursoNombre,
      cursoId: cursoUsado,
    };
  }

  async buscarSoloPorCedula(cedula: string) {
    if (!cedula) {
      throw new Error('La cédula es requerida');
    }
    // Buscar asistente por cédula
    const asistente: any = await this.asistentesModel

      .findOne({ cedula })
      .populate('cursos')
      .lean()
      .exec();
    if (!asistente) {
      throw new NotFoundException('Asistente no encontrado');
    }
    return asistente;
  }

  async create(dto: any): Promise<AsistentesDocument> {
    try {
      const cedula = (dto.cedula || '').trim();
      const cursoId = (dto.curso || dto.cursoId || '').toString().trim(); // según cómo te llegue

      if (!cedula || !cursoId) {
        throw new ConflictException(
          'Faltan datos: cedula y curso son requeridos',
        );
      }

      // 1) Buscar asistente SOLO por cédula (porque ahora es “1 persona = 1 documento”)
      const existente = await this.asistentesModel.findOne({ cedula });

      // 2) Si no existe -> crear nuevo con cursos:[cursoId]
      if (!existente) {
        const nuevo = new this.asistentesModel({
          ...dto,
          cedula,
          // guardamos el nuevo esquema
          cursos: [cursoId],
          // opcional: mantener legacy si quieres mientras migras
          // curso: cursoId,
        });
        return await nuevo.save();
      }

      // 3) Si existe -> validar si ya tiene ese curso (array primero, legacy después)
      const cursosActuales = new Set<string>([
        ...(Array.isArray((existente as any).cursos)
          ? (existente as any).cursos
          : []),
        ...((existente as any).curso ? [(existente as any).curso] : []),
      ]);

      if (cursosActuales.has(cursoId)) {
        throw new ConflictException(
          `El asistente con cédula "${cedula}" ya está registrado en ese curso.`,
        );
      }

      // 4) No lo tiene -> agregarlo (sin duplicar)
      const actualizado = await this.asistentesModel
        .findByIdAndUpdate(
          existente._id,
          {
            $addToSet: { cursos: cursoId },
            // opcional: podrías actualizar datos base si vienen
            $set: {
              nombre: dto.nombre ?? existente.nombre,
              telefono: dto.telefono ?? (existente as any).telefono,
              correo: dto.correo ?? (existente as any).correo,
              negocio: dto.negocio ?? (existente as any).negocio,
            },
            // opcional: si quieres “migrar en caliente” legacy -> array
            ...((existente as any).curso
              ? { $unset: { curso: '' } } // si ya pasaste curso a cursos
              : {}),
          },
          { new: true },
        )
        .exec();

      return actualizado!;
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException(
        'Error al crear el asistente',
        error?.message,
      );
    }
  }

  async createBatch(createAsistentesDto: any) {
    try {
      return await this.asistentesModel.insertMany(createAsistentesDto);
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al crear asistentes en lote',
        error.message,
      );
    }
  }

  async findAll(cursoId?: string): Promise<AsistentesDocument[]> {
    try {
      const filter = cursoId
        ? { $or: [{ cursos: cursoId }, { curso: cursoId }] }
        : {};

      return await this.asistentesModel.find(filter).populate('cursos').exec();
    } catch (error) {
      throw new Error(
        'Error al obtener la lista de asistentes: ' + error.message,
      );
    }
  }

  // asistentes.service.ts
  async findAllGlobal(param?: string) {
    const match: any = {};
    if (param?.trim()) {
      const rx = new RegExp(param.trim(), 'i');
      match.$or = [{ nombre: rx }, { cedula: rx }, { correo: rx }];
    }

    // ✅ fecha de hoy Ecuador para cortar conteos (opcional)
    const hoyEc = new Date(Date.now() - 5 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // ✅ nombre real de la colección de asistencias (evita errores por pluralización)
    const asistenciasCollection = this.asistenciaModel.collection.name;

    return this.asistentesModel
      .aggregate([
        { $match: match },

        // Normaliza legacy + array -> cursosJoinIds
        {
          $addFields: {
            cursoObjId: {
              $cond: [
                {
                  $regexMatch: { input: '$curso', regex: /^[0-9a-fA-F]{24}$/ },
                },
                { $toObjectId: '$curso' },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            cursosObjIds: {
              $map: {
                input: { $ifNull: ['$cursos', []] },
                as: 'cid',
                in: {
                  $cond: [
                    {
                      $regexMatch: {
                        input: '$$cid',
                        regex: /^[0-9a-fA-F]{24}$/,
                      },
                    },
                    { $toObjectId: '$$cid' },
                    null,
                  ],
                },
              },
            },
          },
        },
        {
          $addFields: {
            cursosJoinIds: {
              $setUnion: [
                {
                  $cond: [{ $ne: ['$cursoObjId', null] }, ['$cursoObjId'], []],
                },
                {
                  $filter: {
                    input: '$cursosObjIds',
                    as: 'x',
                    cond: { $ne: ['$$x', null] },
                  },
                },
              ],
            },
          },
        },

        // ✅ 1 fila por curso
        { $unwind: '$cursosJoinIds' },

        // Curso doc
        {
          $lookup: {
            from: 'cursos',
            localField: 'cursosJoinIds',
            foreignField: '_id',
            as: 'cursoDoc',
          },
        },
        { $unwind: { path: '$cursoDoc', preserveNullAndEmptyArrays: true } },

        // ✅ cursoId string para comparar con asistencia.curso (que es string)
        {
          $addFields: {
            cursoIdStr: { $toString: '$cursosJoinIds' },
          },
        },

        // ✅ Lookup a asistencias para conteo real
        {
          $lookup: {
            from: asistenciasCollection,
            let: { ced: '$cedula', cId: '$cursoIdStr' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ['$cedula', '$$ced'] },
                      { $eq: ['$curso', '$$cId'] },
                      // opcional: solo hasta hoy Ecuador
                      { $lte: ['$fecha', hoyEc] },
                    ],
                  },
                },
              },
              { $group: { _id: null, total: { $sum: 1 } } },
            ],
            as: 'asistStats',
          },
        },

        // ✅ asistenciasReales
        {
          $addFields: {
            asistenciasReales: {
              $ifNull: [{ $first: '$asistStats.total' }, 0],
            },
          },
        },

        // ✅ faltas y porcentaje (si hay diasActuales)
        {
          $addFields: {
            diasActuales: { $ifNull: ['$cursoDoc.diasActuales', 0] },
            faltas: {
              $max: [
                0,
                {
                  $subtract: [
                    { $ifNull: ['$cursoDoc.diasActuales', 0] },
                    '$asistenciasReales',
                  ],
                },
              ],
            },
            porcentaje: {
              $cond: [
                { $gt: [{ $ifNull: ['$cursoDoc.diasActuales', 0] }, 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            '$asistenciasReales',
                            { $ifNull: ['$cursoDoc.diasActuales', 0] },
                          ],
                        },
                        100,
                      ],
                    },
                    0,
                  ],
                },
                0,
              ],
            },
          },
        },

        // ✅ Proyección final para UI (1 fila por curso)
        {
          $project: {
            _id: 1,
            cedula: 1,
            nombre: 1,
            estado: 1,
            createdAt: 1,

            curso: {
              _id: '$cursoDoc._id',
              nombre: '$cursoDoc.nombre',
              diasActuales: '$cursoDoc.diasActuales',
            },

            // ✅ métricas reales (ya no campos del asistente)
            asistencias: '$asistenciasReales',
            faltas: 1,
            porcentaje: 1,

            // si quieres mantener legacy visibles:
            // asistenciasLegacy: '$asistencias',
            // inasistenciasLegacy: '$inasistencias',
          },
        },
      ])
      .exec();
  }

  async buscarAsistente(cedula: string, curso: string) {
    console.log(cedula, curso);
    return await this.asistentesModel.findOne({
      cedula,
      $or: [{ cursos: curso }, { curso: curso }],
    });
  }

  async findOne(cursoId: string): Promise<AsistentesDocument[]> {
    try {
      const filter = cursoId
        ? { $or: [{ cursos: cursoId }, { curso: cursoId }] }
        : {};

      return await this.asistentesModel.find(filter).sort({ nombre: 1 }).exec();
    } catch (error) {
      throw new Error(
        'Error al obtener la lista de asistentes: ' + error.message,
      );
    }
  }

  async findOne2(cursoId: string): Promise<AsistentesDocument[]> {
    try {
      const filter = cursoId
        ? { $or: [{ cursos: cursoId }, { curso: cursoId }] }
        : {};

      return await this.asistentesModel.find(filter).sort({ nombre: 1 }).exec();
    } catch (error) {
      throw new Error(
        'Error al obtener la lista de asistentes: ' + error.message,
      );
    }
  }

  async update(
    id: string,
    updateAsistenteDto: UpdateAsistenteDto,
  ): Promise<AsistentesDocument> {
    try {
      const updatedAsistente = await this.asistentesModel
        .findByIdAndUpdate(id, updateAsistenteDto, { new: true })
        .exec();
      if (!updatedAsistente) {
        throw new NotFoundException(`Asistente con ID "${id}" no encontrado`);
      }
      return updatedAsistente;
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al actualizar el asistente',
        error.message,
      );
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const result = await this.asistentesModel.findByIdAndDelete(id).exec();
      if (!result) {
        throw new NotFoundException(`Asistente con ID "${id}" no encontrado`);
      }
    } catch (error) {
      throw new InternalServerErrorException(
        'Error al eliminar el asistente',
        error.message,
      );
    }
  }

  async generateQrZip(
    asistentes: any[],
    res: Response,
    cursorId: string,
  ): Promise<void> {
    try {
      const zip = new JSZip();

      for (const asistente of asistentes) {
        const qrData = `${asistente.cedula},${asistente.nombre},${cursorId},${asistente.createdAtEcuador}`;

        // Obtener la información del curso, incluyendo su imagen
        const curso = await this.cursoService.findOne(cursorId);
        if (!curso || !curso.imagen) {
          curso.imagen = this.imagenDefecto;
        }

        // Cargar la imagen del curso desde la URL proporcionada
        const backgroundImage = await loadImage(curso.imagen);

        // Crear el canvas para el QR
        const qrCanvas = createCanvas(700, 700); // Tamaño inicial del QR
        const qrCtx = qrCanvas.getContext('2d');
        await QRCode.toCanvas(qrCanvas, qrData);

        // Crear el canvas principal
        const canvas = createCanvas(
          backgroundImage.width,
          backgroundImage.height,
        );
        const ctx = canvas.getContext('2d');

        // Dibujar la imagen del curso como fondo
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

        // Calcular las dimensiones del QR y posicionarlo
        const qrSize = Math.min(canvas.width, canvas.height) / 2; // Ajustar tamaño al 50% del fondo
        const qrX = (canvas.width - qrSize) / 2;
        const qrY = canvas.height / 2 - qrSize / 4; // Mover el QR hacia abajo ligeramente
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

        // Configurar el texto en la parte inferior
        ctx.font = 'bold 32px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        const text = `${asistente.nombre}`;
        ctx.fillText(text, canvas.width / 2, canvas.height - 50); // Texto 50px desde el borde inferior

        // Convertir el canvas a buffer PNG
        const finalImageBuffer = canvas.toBuffer('image/png');

        // Agregar la imagen al archivo ZIP
        const fileName = `${asistente.cedula}-${asistente.nombre}.png`;
        zip.file(fileName, finalImageBuffer);
      }

      // Generar el archivo ZIP
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

      // Configurar y enviar la respuesta HTTP
      res.set({
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="asistentes-qr.zip"',
      });
      res.end(zipBuffer);
    } catch (error) {
      console.error('Error generando ZIP:', error);
      throw new InternalServerErrorException(
        'Error al generar los QR y el archivo ZIP',
      );
    }
  }

  async actualizarOrientacionVocacional(id: string, body: any) {
    try {
      // Soportar tanto body.orientacionVocacional.etapas como el plano
      const ovIn = body?.orientacionVocacional ?? body;
      if (!ovIn) throw new Error('Falta "orientacionVocacional" en el body');

      const etapaActual = ovIn.etapaActual ?? 'SIN_CITA';
      const etapas = ovIn.etapas ?? ovIn; // si viene plano, ya tiene primera/segunda/...
      const def = {
        estado: null,
        fechaISO: null,
        comentario: null,
        logs: [] as any[],
      };

      const primera = { ...def, ...(etapas.primera ?? {}) };
      const segunda = { ...def, ...(etapas.segunda ?? {}) };
      const tercera = { ...def, ...(etapas.tercera ?? {}) };
      const cuarta = { ...def, ...(etapas.cuarta ?? {}) };

      // 👇 NUEVO: tomar la próxima cita global si llega (permitir null)
      const siguienteCitaISO: string | null =
        typeof ovIn.siguienteCitaISO === 'string' &&
        ovIn.siguienteCitaISO.length
          ? ovIn.siguienteCitaISO
          : null;

      const ovDoc = {
        etapaActual,
        primera,
        segunda,
        tercera,
        cuarta,
        // 👇 NUEVO: incluirla en el subdocumento que guardas
        siguienteCitaISO,
      };

      const actualizado = await this.asistentesModel.findByIdAndUpdate(
        id,
        { $set: { orientacionVocacional: ovDoc } },
        { new: true, runValidators: true },
      );

      return actualizado;
    } catch (error) {
      console.error('Error al actualizar la orientación vocacional:', error);
      throw new InternalServerErrorException(
        'Error al actualizar la orientación vocacional',
        (error as Error).message,
      );
    }
  }

  async generateQrForAsistente(asistente: any, res: Response): Promise<void> {
    try {
      const qrData = `${asistente.cedula},${asistente.nombre},${asistente.createdAtEcuador}`;

      const imagenDefecto = this.imagenDefecto;

      // Cargar la imagen del curso desde la URL proporcionada
      const backgroundImage = await loadImage(imagenDefecto);

      // Crear el canvas para el QR
      const qrCanvas = createCanvas(700, 700); // Tamaño inicial del QR
      const qrCtx = qrCanvas.getContext('2d');
      await QRCode.toCanvas(qrCanvas, qrData);

      // Crear el canvas principal
      const canvas = createCanvas(
        backgroundImage.width,
        backgroundImage.height,
      );
      const ctx = canvas.getContext('2d');

      // Dibujar la imagen del curso como fondo
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

      // Calcular las dimensiones del QR y posicionarlo
      const qrSize = Math.min(canvas.width, canvas.height) / 2; // Aumentar el tamaño al 50% del fondo
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = canvas.height / 2 - qrSize / 4; // Mover el QR hacia abajo ligeramente
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // Configurar el texto en la parte inferior
      ctx.font = 'bold 32px Arial';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      const text = `${asistente.nombre}`;
      ctx.fillText(text, canvas.width / 2, canvas.height - 50); // Texto 50px desde el borde inferior

      // Convertir el canvas a un buffer PNG
      const finalImageBuffer = canvas.toBuffer('image/png');
      console.log(finalImageBuffer);
      // Configurar la respuesta HTTP
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${asistente.cedula}-${asistente.nombre}.png"`,
      });

      // Enviar la imagen generada
      res.end(finalImageBuffer);
    } catch (error) {
      console.error('Error generando QR con fondo personalizado:', error);
      throw new Error('Error al generar QR con fondo personalizado');
    }
  }
  async generateQrForAsistenteApp(
    asistente: any,
    res: Response,
  ): Promise<void> {
    try {
      const qrData = `${asistente.cedula},${asistente.nombre},${asistente.createdAtEcuador}`;

      // Obtener la información del curso, incluyendo su imagen
      const imagenDefecto = this.imagenDefecto;

      // Cargar la imagen del curso desde la URL proporcionada
      const backgroundImage = await loadImage(imagenDefecto);

      // Crear el canvas para el QR
      const qrCanvas = createCanvas(700, 700);
      const qrCtx = qrCanvas.getContext('2d');
      await QRCode.toCanvas(qrCanvas, qrData);

      // Crear el canvas principal
      const canvas = createCanvas(
        backgroundImage.width,
        backgroundImage.height,
      );
      const ctx = canvas.getContext('2d');

      // Dibujar la imagen del curso como fondo
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

      // Calcular las dimensiones del QR y posicionarlo
      const qrSize = Math.min(canvas.width, canvas.height) / 2;
      const qrX = (canvas.width - qrSize) / 2;
      const qrY = canvas.height / 2 - qrSize / 4;
      ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

      // Configurar el texto en la parte inferior
      ctx.font = 'bold 32px Arial';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      const text = `${asistente.nombre}`;
      ctx.fillText(text, canvas.width / 2, canvas.height - 50);

      // Convertir el canvas a un buffer PNG
      const finalImageBuffer = canvas.toBuffer('image/png');

      // Convertir la imagen a Base64
      const imageBase64 = finalImageBuffer.toString('base64');

      // Responder con la imagen en Base64 dentro de un JSON
      res.json({
        success: true,
        imageBase64: `data:image/png;base64,${imageBase64}`, // Formato de imagen en Base64
      });
    } catch (error) {
      console.error('Error generando QR con fondo personalizado:', error);
      res.status(500).json({
        success: false,
        message: 'Error al generar QR con fondo personalizado',
      });
    }
  }

  async moverAsistente(arg0: {
    cedula: string;
    curso: string;
    negocio: string;
  }) {
    try {
      //Buscar si existe el curso por el nombre.
      const cursoSinEspacios = arg0.curso.replace(/ /g, '_');
      const curso = await this.cursoService.buscarOCrear(cursoSinEspacios);

      //Buscar si existe el asistente por la cedula
      console.log(curso._id.toString());
      const asistente = await this.asistentesModel.findOne({
        cedula: arg0.cedula,
        negocio: arg0.negocio,
      });

      if (!asistente) {
        throw new Error('No existe un asistente con esa cedula');
      }

      asistente.curso = curso._id.toString();
      //

      return await asistente.save();
    } catch (error) {
      console.log(error);
      throw new Error('Error al agregar');
    }
  }

  async addAsistente(arg0: {
    nombre: string;
    cedula: string;
    curso: string; // puede venir: "Curso A, Curso B"
    negocio: string;
    telefono?: string;
    correo?: string;
    periodo?: string;
    categoria?: string;
  }) {
    console.log(arg0);
    try {
      // 1) Normalizar inputs (IGUAL)
      const nombre = (arg0.nombre || '').trim();
      const cedula = (arg0.cedula || '').trim();
      const negocio = (arg0.negocio || '').trim();
      const telefono = arg0.telefono?.trim();
      const correo = arg0.correo?.trim();
      const categoria = arg0.categoria?.trim();
      const periodo = arg0.periodo?.trim();

      if (!nombre || !cedula || !arg0.curso || !negocio) {
        throw new Error('Faltan datos requeridos');
      }

      // 2) 👉 NUEVO: parsear cursos (sin romper el caso de 1 curso)
      const cursosNombres = arg0.curso
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => c.replace(/ /g, '_'));
      console.log('Cursos a procesar:', cursosNombres);
      // 3) Buscar o crear cursos (ANTES era 1, ahora N)
      const cursos = await Promise.all(
        cursosNombres.map((c) => this.cursoService.buscarOCrear(c,categoria)),
      );
      console.log('Cursos encontrados/creados:', cursos);
      const cursosIds = cursos.map((c) => c._id.toString());
      console.log('IDs de cursos:', cursosIds);
      // mantiene tu lógica actual
      const diasAsistenciasAdicionales = cursos[0]?.diasActuales || 0;

      // 4) Buscar asistente SOLO por cédula (IGUAL)
      const existente: any = await this.asistentesModel.findOne({ cedula });

      // 5) NO existe → crear (ANTES 1 curso, ahora varios)
      if (!existente) {
        const nuevo = new this.asistentesModel({
          nombre,
          cedula,
          cursos: cursosIds,
          negocio,
          telefono,
          correo,
          asistenciasAdicionales: diasAsistenciasAdicionales,
          periodo
        });

        return await nuevo.save();
      }

      // 6) Existe → validar cursos actuales (IGUAL + multi)
      const cursosActuales = new Set<string>([
        ...(Array.isArray(existente.cursos) ? existente.cursos : []),
        ...(existente.curso ? [existente.curso] : []), // legacy
      ]);
      console.log('Cursos actuales del asistente:', Array.from(cursosActuales));

      const nuevosCursos = cursosIds.filter((id) => !cursosActuales.has(id));
      console.log('Nuevos cursos a agregar:', nuevosCursos);

      // si TODOS los cursos ya existen → mismo comportamiento
      if (!nuevosCursos.length) {
        return existente;
      }

      // 7) Actualizar asistente (misma lógica + $each)
      const update: any = {
        $addToSet: { cursos: { $each: nuevosCursos } },
        $set: {
          nombre,
          negocio,
          ...(telefono ? { telefono } : {}),
          ...(correo ? { correo } : {}),
        },
      };
      console.log('Update a aplicar:', update);
      // legacy cleanup (IGUAL)
      if (existente.curso) {
        update.$unset = { curso: '' };
      }

      if (typeof existente.asistenciasAdicionales !== 'number') {
        update.$set.asistenciasAdicionales = diasAsistenciasAdicionales;
      }

      return await this.asistentesModel.findByIdAndUpdate(
        existente._id,
        update,
        { new: true },
      );
    } catch (error) {
      console.error(error);
      throw new Error('Error al agregar');
    }
  }

  async cambiarEstadoAsistente(arg0: { cedula: string; estado: string }) {
    //Buscar si existe el curso por el nombre.
    try {
      console.log(arg0.cedula);
      const asistente = await this.asistentesModel.findOne({
        cedula: arg0.cedula,
      });
      if (!asistente) {
        throw new Error('No existe un asistente con esa cedula');
      }

      if (arg0.estado === '1') {
        asistente.estado = true;
      } else {
        asistente.estado = false;
      }
      asistente.save();
      return true;
    } catch (error) {
      console.log(error);
      throw new Error('Error al agregar');
    }
  }

  async buscarCurso(nombre: any) {
    console.log(nombre);
    return await this.cursoService.findOne2(nombre);
  }
  /**
   * Copia TODOS los docs del curso (por _id) a 'asistentes_migrados' (mismo _id),
   * reemplazando el campo `curso` por el NOMBRE del curso.
   * Luego elimina los originales del curso y reinicia el curso (por _id).
   */
  async migrateCursoPorId(cursoId: string, batchSize = 5000) {
    if (!Types.ObjectId.isValid(cursoId)) {
      return { ok: false, message: 'cursoId inválido.' };
    }
    const _cursoId = new Types.ObjectId(cursoId);

    const session = await this.conn.startSession();
    let processed = 0;

    try {
      await session.withTransaction(async () => {
        // 0) Traer el curso por _id (con session)
        const curso = await this.cursoService.findOne(_cursoId.toString());
        if (!curso) {
          throw new Error('Curso no encontrado');
        }
        const cursoNombre = curso.nombre;

        // 1) Seleccionar asistentes del curso (soporta que estén guardados por id o por nombre)
        const filterAsistentes = {
          $or: [{ curso: cursoId }, { curso: cursoNombre }],
        };
        const ids = await this.asistentesModel
          .find(filterAsistentes)
          .distinct('_id')
          .session(session);
        const total = ids.length;
        if (total === 0) {
          // Reiniciar curso igual si quieres (opcional). Aquí lo hacemos:
          await this.cursoService.reseteDatos(_cursoId.toString());
          // Y salimos temprano
          throw new Error('NO_ASISTENTES'); // para volver con mensaje limpio
        }

        // 2) Copiar (replace/upsert) por lotes, reemplazando `curso` => nombre
        const cursor = this.asistentesModel
          .find({ _id: { $in: ids as Types.ObjectId[] } }, null, { lean: true })
          .cursor();

        const ops: any[] = [];
        for await (const doc of cursor) {
          const replacement = { ...doc, curso: cursoNombre };
          ops.push({
            replaceOne: {
              filter: { _id: doc._id },
              replacement,
              upsert: true,
            },
          });

          if (ops.length >= batchSize) {
            await this.asistentesMigrados.bulkWrite(ops, {
              session,
              ordered: false,
            });
            processed += ops.length;
            ops.length = 0;
          }
        }
        if (ops.length) {
          await this.asistentesMigrados.bulkWrite(ops, {
            session,
            ordered: false,
          });
          processed += ops.length;
        }

        // 3) Verificación
        const migratedCount = await this.asistentesMigrados.countDocuments(
          { _id: { $in: ids as Types.ObjectId[] } },
          { session },
        );
        if (migratedCount !== total) {
          throw new Error(
            `Verificación fallida: esperados ${total}, migrados ${migratedCount}`,
          );
        }

        // 4) Eliminar originales SOLO de este curso (por id o nombre)
        await this.asistentesModel.deleteMany(
          { _id: { $in: ids as Types.ObjectId[] } },
          { session },
        );

        // 5) Reiniciar el curso por _id
        await this.cursoService.reseteDatos(_cursoId.toString());

        // Resultado OK
        (session as any)._result = {
          ok: true,
          scope: 'curso',
          cursoId,
          cursoNombre,
          total,
          processed,
        };
      });

      // si marcamos un error controlado por NO_ASISTENTES
      // la transacción cae al catch, pero no es un error real de sistema
      const res = (session as any)._result;
      if (res) {
        return {
          ...res,
          message: `Copiados a 'asistentes_migrados' y eliminados de 'asistentes' (curso='${res.cursoNombre}'). Curso reiniciado.`,
        };
      } else {
        // No hubo asistentes
        return {
          ok: true,
          scope: 'curso',
          cursoId,
          total: 0,
          processed: 0,
          message: 'No hay asistentes en ese curso. Curso reiniciado.',
        };
      }
    } catch (err: any) {
      if (err?.message === 'NO_ASISTENTES') {
        return {
          ok: true,
          scope: 'curso',
          cursoId,
          total: 0,
          processed: 0,
          message: 'No hay asistentes en ese curso. Curso reiniciado.',
        };
      }
      return { ok: false, message: String(err) };
    } finally {
      await session.endSession();
    }
  }

  async migrateTodo(batchSize = 5000) {
    const session = await this.conn.startSession();
    let processed = 0;

    // 0) Traer todos los cursos para mapear id -> nombre
    const cursos = await this.cursoService.findAll();
    const idToName = new Map<string, string>();
    const nameSet = new Set<string>();
    for (const c of cursos) {
      idToName.set(String(c._id), c.nombre);
      nameSet.add(c.nombre);
    }

    const ids = await this.asistentesModel.find({}).distinct('_id');
    const total = ids.length;

    // Si no hay asistentes, reinicia cursos y termina
    if (total === 0) {
      await this.conn
        .collection('cursos')
        .updateMany({}, { $set: { diasCurso: 24, diasActuales: 0 } });

      // await this.conn.collection('cursos').deleteMany({});
      return {
        ok: true,
        scope: 'all',
        total: 0,
        processed: 0,
        message: 'No hay asistentes para migrar. Cursos reiniciados.',
      };
    }

    const FALLBACK = 'curso no registrado';

    try {
      await session.withTransaction(async () => {
        const cursor = this.asistentesModel
          .find({ _id: { $in: ids as Types.ObjectId[] } }, null, { lean: true })
          .cursor();

        const ops: any[] = [];
        for await (const doc of cursor) {
          // --- Normalización del campo `curso` a NOMBRE ---
          let cursoNormalizado = doc.curso;

          if (
            cursoNormalizado &&
            Types.ObjectId.isValid(String(cursoNormalizado))
          ) {
            // venía como ObjectId (o string con forma de ObjectId)
            const nombre = idToName.get(String(cursoNormalizado));
            cursoNormalizado = nombre ?? FALLBACK;
          } else if (typeof cursoNormalizado === 'string') {
            // si ya es un nombre conocido, lo dejamos; si no, probamos mapa; si no existe, fallback
            const mapeado = idToName.get(cursoNormalizado);
            if (mapeado) {
              cursoNormalizado = mapeado;
            } else if (!nameSet.has(cursoNormalizado)) {
              cursoNormalizado = FALLBACK;
            }
          } else {
            // cualquier otro caso raro → fallback
            cursoNormalizado = FALLBACK;
          }

          const replacement = { ...doc, curso: cursoNormalizado };

          ops.push({
            replaceOne: {
              filter: { _id: doc._id },
              replacement,
              upsert: true,
            },
          });

          if (ops.length >= batchSize) {
            await this.asistentesMigrados.bulkWrite(ops, {
              session,
              ordered: false,
            });
            processed += ops.length;
            ops.length = 0;
          }
        }

        if (ops.length) {
          await this.asistentesMigrados.bulkWrite(ops, {
            session,
            ordered: false,
          });
          processed += ops.length;
        }

        // Verificación
        const migratedCount = await this.asistentesMigrados.countDocuments(
          { _id: { $in: ids as Types.ObjectId[] } },
          { session },
        );
        if (migratedCount !== total) {
          throw new Error(
            `Verificación fallida: esperados ${total}, migrados ${migratedCount}`,
          );
        }

        // Eliminar TODOS los asistentes
        await this.asistentesModel.deleteMany({}, { session });

        // Si ya no quedan asistentes → reiniciar TODOS los cursos (dentro de la misma transacción)
        const remaining = await this.asistentesModel.countDocuments(
          {},
          { session },
        );
        if (remaining === 0) {
          await this.conn
            .collection('cursos')
            .updateMany(
              {},
              { $set: { diasCurso: 24, diasActuales: 0 } },
              { session },
            );
          // await this.conn.collection('cursos').deleteMany({});
        }
      });

      return {
        ok: true,
        scope: 'all',
        total,
        processed,
        message:
          `Copiados TODOS (curso normalizado a nombre, con fallback '${FALLBACK}'), ` +
          `eliminados de 'asistentes' y cursos reiniciados.`,
      };
    } finally {
      await session.endSession();
    }
  }

  async findPaginatedMigrados(datos: any) {
    const filter: FilterQuery<AsistenteMigradoDocument> = {};
    const { search, page, limit } = datos;
    console.log(search);
    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { cedula: new RegExp(q, 'i') },
        { nombre: new RegExp(q, 'i') },
        { curso: new RegExp(q, 'i') },
      ];
    }
    const projection = {
      cedula: 1,
      nombre: 1,
      curso: 1, // ya normalizado a nombre
      asistencias: 1,
      inasistencias: 1,
      asistenciasInactivas: 1,
      asistenciasAdicionales: 1,
      createdAtEcuador: 1,
      _id: 1,
    };

    const [total, data] = await Promise.all([
      this.asistentesMigrados.countDocuments(filter),
      this.asistentesMigrados
        .find(filter, projection, { lean: true })
        .sort({ _id: -1 }) // sin timestamps en migrados, orden por _id
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
    ]);

    return {
      ok: true,
      data,
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  async findAllForExport(search?: string) {
    const filter: FilterQuery<AsistenteMigradoDocument> = {};
    if (search?.trim()) {
      const q = search.trim();
      filter.$or = [
        { cedula: new RegExp(q, 'i') },
        { nombre: new RegExp(q, 'i') },
      ];
    }

    const projection = {
      cedula: 1,
      nombre: 1,
      curso: 1,
      estado: 1,
      asistencias: 1,
      inasistencias: 1,
      asistenciasInactivas: 1,
      asistenciasAdicionales: 1,
      createdAtEcuador: 1,
      _id: 1,
    };

    return this.asistentesMigrados
      .find(filter, projection, { lean: true })
      .sort({ _id: -1 })
      .exec();
  }

  async actualizarCursosString(body: { cedula: string; cursos: string[] }) {
    const cedula = (body?.cedula || '').trim();
    const cursosIn = Array.isArray(body?.cursos) ? body.cursos : [];
    console.log('Actualizar cursos string:', { cedula, cursosIn });
    if (!cedula) throw new BadRequestException('La cédula es requerida');
    if (!cursosIn.length)
      throw new BadRequestException(
        'Debes enviar al menos un curso en el array cursos',
      );

    // ✅ Normalizar: strings, trim, sin vacíos, sin duplicados
    const cursos = Array.from(
      new Set(
        cursosIn.map((x) => (x ?? '').toString().trim()).filter((x) => !!x),
      ),
    );

    if (!cursos.length) {
      throw new BadRequestException('Los cursos enviados están vacíos');
    }

    // Buscar asistente por cédula (tu regla actual)
    const asistente: any = await this.asistentesModel.findOne({ cedula });
    if (!asistente) throw new NotFoundException('Asistente no encontrado');

    // ✅ Guardar cursos como strings y eliminar legacy "curso"
    const actualizado = await this.asistentesModel.findByIdAndUpdate(
      asistente._id,
      {
        $set: { cursos },
        $unset: { curso: '' }, // elimina el curso legacy
      },
      { new: true },
    );

    // ✅ (Opcional) Bitrix: guardar nombres de cursos (string) en UF...
    // Aquí depende: si "cursos" son IDs, toca resolver nombre con cursoService.findOne(id)
    try {
      if (asistente?.negocio) {
        const cursosDocs = await Promise.all(
          cursos.map((id) => this.cursoService.findOne(id).catch(() => null)),
        );

        const nombres = cursosDocs
          .filter(Boolean)
          .map((c: any) => c.nombre)
          .join(', ');

        if (nombres) {
          await axios.post(
            `https://nicpreu.bitrix24.es/rest/1/2dc3j6lin4etym89/crm.deal.update`,
            {
              ID: asistente.negocio?.trim(),
              fields: {
                UF_CRM_1756402575272: nombres,
              },
            },
            { headers: { 'Content-Type': 'application/json' } },
          );
        }
      }
    } catch (e: any) {
      console.error('Error actualizando Bitrix:', e?.message);
    }

    return actualizado;
  }

  getInfoPorCedula(cedula: string) {
    return this.asistentesModel.findOne({ cedula }).populate('cursos').exec();
  }

async getCursosPorCedula(cedula: string) {
  const asistente = await this.asistentesModel
    .findOne({ cedula })
    .select('cursos')        // 🔹 solo trae cursos
    .populate('cursos')
    .lean()
    .exec();

  return asistente?.cursos ?? [];
}



async buscarEstudianteGeneral(param: string) {
  const q = (param || '').trim();
  if (!q) return [];

  const regex = new RegExp(q, 'i');

  return this.asistentesModel
    .find(
      {
        $or: [
          { cedula: regex },
          { nombre: regex },
          { telefono: regex },
          { correo: regex },
        ],
      },
      {
        cedula: 1,
        nombre: 1,
        telefono: 1,
        correo: 1,
        estado: 1,
        cursos: 1,
      },
    )
    .populate('cursos')
    .sort({ _id: -1 })
    .lean()
    .exec();
}


  


  imagenDefecto =
    'data:image/jpeg;base64,/9j/4AAQSkZJRgABAgEBLAEsAAD/7QAsUGhvdG9zaG9wIDMuMAA4QklNA+0AAAAAABABLAAAAAEAAQEsAAAAAQAB/+FwaGh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8APD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iQWRvYmUgWE1QIENvcmUgOS4xLWMwMDIgNzkuYTZhNjM5NiwgMjAyNC8wMy8xMi0wNzo0ODoyMyAgICAgICAgIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIgogICAgICAgICAgICB4bWxuczp4bXA9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOnhtcEdJbWc9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9nL2ltZy8iCiAgICAgICAgICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgICAgICAgICB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIKICAgICAgICAgICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgICAgICAgICAgeG1sbnM6c3RNZnM9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9NYW5pZmVzdEl0ZW0jIgogICAgICAgICAgICB4bWxuczppbGx1c3RyYXRvcj0iaHR0cDovL25zLmFkb2JlLmNvbS9pbGx1c3RyYXRvci8xLjAvIgogICAgICAgICAgICB4bWxuczpwZGY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGRmLzEuMy8iPgogICAgICAgICA8ZGM6Zm9ybWF0PmltYWdlL2pwZWc8L2RjOmZvcm1hdD4KICAgICAgICAgPGRjOnRpdGxlPgogICAgICAgICAgICA8cmRmOkFsdD4KICAgICAgICAgICAgICAgPHJkZjpsaSB4bWw6bGFuZz0ieC1kZWZhdWx0Ij5QcmludDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpBbHQ+CiAgICAgICAgIDwvZGM6dGl0bGU+CiAgICAgICAgIDx4bXA6TWV0YWRhdGFEYXRlPjIwMjUtMDEtMTJUMTY6NDI6NDItMDU6MDA8L3htcDpNZXRhZGF0YURhdGU+CiAgICAgICAgIDx4bXA6TW9kaWZ5RGF0ZT4yMDI1LTAxLTEyVDIxOjQyOjQ1WjwveG1wOk1vZGlmeURhdGU+CiAgICAgICAgIDx4bXA6Q3JlYXRlRGF0ZT4yMDI1LTAxLTEyVDE2OjQyOjQyLTA1OjAwPC94bXA6Q3JlYXRlRGF0ZT4KICAgICAgICAgPHhtcDpDcmVhdG9yVG9vbD5BZG9iZSBJbGx1c3RyYXRvciAyOC43IChXaW5kb3dzKTwveG1wOkNyZWF0b3JUb29sPgogICAgICAgICA8eG1wOlRodW1ibmFpbHM+CiAgICAgICAgICAgIDxyZGY6QWx0PgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHhtcEdJbWc6d2lkdGg+MjU2PC94bXBHSW1nOndpZHRoPgogICAgICAgICAgICAgICAgICA8eG1wR0ltZzpoZWlnaHQ+MjEyPC94bXBHSW1nOmhlaWdodD4KICAgICAgICAgICAgICAgICAgPHhtcEdJbWc6Zm9ybWF0PkpQRUc8L3htcEdJbWc6Zm9ybWF0PgogICAgICAgICAgICAgICAgICA8eG1wR0ltZzppbWFnZT4vOWovNEFBUVNrWkpSZ0FCQWdFQkxBRXNBQUQvN1FBc1VHaHZkRzl6YUc5d0lETXVNQUE0UWtsTkErMEFBQUFBQUJBQkxBQUFBQUVBJiN4QTtBUUVzQUFBQUFRQUIvKzRBRGtGa2IySmxBR1RBQUFBQUFmL2JBSVFBQmdRRUJBVUVCZ1VGQmdrR0JRWUpDd2dHQmdnTERBb0tDd29LJiN4QTtEQkFNREF3TURBd1FEQTRQRUE4T0RCTVRGQlFURXh3Ykd4c2NIeDhmSHg4Zkh4OGZId0VIQndjTkRBMFlFQkFZR2hVUkZSb2ZIeDhmJiN4QTtIeDhmSHg4Zkh4OGZIeDhmSHg4Zkh4OGZIeDhmSHg4Zkh4OGZIeDhmSHg4Zkh4OGZIeDhmSHg4Zkh4OGYvOEFBRVFnQTFBRUFBd0VSJiN4QTtBQUlSQVFNUkFmL0VBYUlBQUFBSEFRRUJBUUVBQUFBQUFBQUFBQVFGQXdJR0FRQUhDQWtLQ3dFQUFnSURBUUVCQVFFQUFBQUFBQUFBJiN4QTtBUUFDQXdRRkJnY0lDUW9MRUFBQ0FRTURBZ1FDQmdjREJBSUdBbk1CQWdNUkJBQUZJUkl4UVZFR0UyRWljWUVVTXBHaEJ4V3hRaVBCJiN4QTtVdEhoTXhaaThDUnlndkVsUXpSVGtxS3lZM1BDTlVRbms2T3pOaGRVWkhURDB1SUlKb01KQ2hnWmhKUkZScVMwVnROVktCcnk0L1BFJiN4QTsxT1QwWlhXRmxhVzF4ZFhsOVdaMmhwYW10c2JXNXZZM1IxZG5kNGVYcDdmSDErZjNPRWhZYUhpSW1LaTR5TmpvK0NrNVNWbHBlWW1aJiN4QTtxYm5KMmVuNUtqcEtXbXA2aXBxcXVzcmE2dm9SQUFJQ0FRSURCUVVFQlFZRUNBTURiUUVBQWhFREJDRVNNVUVGVVJOaElnWnhnWkV5JiN4QTtvYkh3Rk1IUjRTTkNGVkppY3ZFekpEUkRnaGFTVXlXaVk3TENCM1BTTmVKRWd4ZFVrd2dKQ2hnWkpqWkZHaWRrZEZVMzhxT3p3eWdwJiN4QTswK1B6aEpTa3RNVFU1UFJsZFlXVnBiWEYxZVgxUmxabWRvYVdwcmJHMXViMlIxZG5kNGVYcDdmSDErZjNPRWhZYUhpSW1LaTR5TmpvJiN4QTsrRGxKV1dsNWlabXB1Y25aNmZrcU9rcGFhbnFLbXFxNnl0cnErdi9hQUF3REFRQUNFUU1SQUQ4QTlJM1Z3OHNqYi9BRFJWN1lxbzRxJiN4QTs3RlhZcTdGWFlxN0ZXNDFhVUV4QXVGUEZpdTlDT3hwM3hWekt5bWpBZytCMnhWaVhuM3pmZTZIYlc5bm8wTU4xcjk4V05yQmNGeERIJiN4QTtGSFF5elRGUGlDQ29RVTZzdzdWekcxZXJoZ2h4ejVOMkRCTExMaGl4N3luK2IxelA1amk4cCtiTk5HbmVZSkF2cFMyamV0YlNGd1hVJiN4QTtNb0xTUWtvVk81WmR4eVpTUXVXWXNvbUxIVmpreG1Kb3ZUY3RhM1lxN0ZWMGNza2Jja05EaXFkUlNlcEdyL3pDdE1WZExKNmNiUDhBJiN4QTt5aXRNVlNXU1dTUnVUbXB4VmJpcnNWZGlyc1ZkaXJYSWNsU3Z4dWFJdmNtbGFBZDhWWHRGS29xeU1vOFNDTVZVTHE1dDdXMmx1cm1SJiN4QTtZYmVCR2xtbGMwVkVRY21aaWVnQUZUaXJ5UzkvT0x6ZllHVFhialE3YVR5ZnpVSVJNWUw1STVaT01MeUNVK256ZGZpOU9nQy90T3REJiN4QTttRGg3UXg1SnlqR3p3dVZrMGs0UkJQVjZYNVg4eWFaNWwwQ3kxM1MyZHJHK1RuRjZxR054UmlyS3ludXJLUnRVSHFDUlE1bk9LbXVLJiN4QTt1eFYyS3ExcmNQRkl1L3dFMFplMktxVGZhUHp4VnJGWFlxN0ZYWXE2V1pJb3dyUmt5U01vanA5b2x1Z0EvR3ZRRGM3WXE4ZDg5Zm5KJiN4QTtMRGNTNmQ1ZU1VeFNxVGFpUjZrWExjTUlFYjRYQXJUbTRJTktxbzZuYjZiczhWYy9rMXluM1BPcC9Qbm5lV1F5UHIrb0Fuc2wxTWlqJiN4QTs1S3JCUjlBellEVDR4L0NQa29LWmFIK2JYblRUSmtOemV2cWx1RDhVTjZ6U05Ra0U4WnErcXZUK2FuaURsT1hSWTVEbFh1YlViNW04JiN4QTsyenkydXFlYVlidVVwZUMzaHM3bFY1WE50TWdKR25zcURpblBpN3h6THg1Y3lWK05hRGplMXV6TXY1akdmcWlQbC9XKzdieTduWWFYJiN4QTtQR0dPUU94UDIrVEx2K2NmL0sxdGJhRmRhOWQ2YkpIcXQvZFN2QnFONFE5eExhdHZHMytRU1hldFB0ZGVoNHJud0JBQVBOd0pFRTdjJiN4QTtucldTWXV4VjJLdXhWT2JQL2VhUDVZcTY4LzNtaytXS3BOaXJzVmRpcnNWWEpzd1lyeVZhRmg3WXF4WHpyNSswenkzWW01a0FrbmtkJiN4QTtrdExOR0hPVXg3T2E3aEkxZjRXWTFOUVFCM0dUcHROTEtmSmpLVlBEOVkvTkh6cnFNek9tb3lhZkUxS1EyTE5BS0FVSEoxUHF2ODNjJiN4QTtuTjFqMGVPSTVYNzJIR1NnTGY4QU1IenpiU2lTUFhyOWlQMlpiaVNWRDgwa0xJZnBHVE9ueG4rRU5rU3lvL21QcWZtclJQMEZkaEYxJiN4QTtJeVJ5UlFLUkhiNmdJMjVmVkpDMzl5MGpVNDBQcG1uRXFBZDlOMmoyYVRqbDRacXg4bTdGSVJrQ1JkSkhwMXVQT0g1bjJ1bVRRWFdzJiN4QTs2UnA5MDYzbHJKeXQ3ZUNQZ1EreEtFTkRQSHZ0Vitob1VqSjUzc25TNU1XTUNVUkhiNDMrMGZLdk0xbGE3TkdjalJ2OGZqOERmMHJiJiN4QTsyOEZ2QkhiMjhhd3dSS0VpaWpVS2lxb29GVlJRQUFkczJyZ0ttS3V4VjJLdHI5b2ZQRlhOOW8vUEZXc1ZkaXJzVmRpcno3ODJ2TWQzJiN4QTtwZWgzc2NMVWt1VmdzN2VSVHZHWnZXYTVQV25MMG8wVWJWQWMwNjVuYURFSlpMUFRkaE0wR1Jwb1A1Y1c5aG9ObHFPaDJJdU5aaVNLJiN4QTtDUVdrUUxTaUVPZVVpcUdVdDQrT0E1TXBNaUpIMCthYURIZkovd0NXZmxheS9NZnpGWlQyVVY5WldzRnZOWVFYU2laSTF1ZVJaU3IxJiN4QTtERlNsRkpxYWUrWFo5Vk00b202SlVEZGd2a3p6ZCtYZHJFdWllWS9MVU54SjlZa2kvU2lJclA2Y2toS2x4czN3Y3FmQ2ZzZ1VHWmVmJiN4QTtEbFBxakw0TTBaNWg4cDZmNVQvTXVEeS9iTWYwRjVtaWpqRUVsWEVUeXlsWWVwcTNvM0VhT0NkK08xZXVVREljdUhpUDFSL1FtdUtKJiN4QTtUYnlCZTZsWitaaHBwMlZwTG1DOGdFaGNLOERNRzdjYW80cFVISWFrUmxqNHZkMEhjNjNBWkNkZS9xZTk2eG1yZGc3RlhZcTdGVTVzJiN4QTsvd0RlYVA1WXE2OC8zbWsrV0twTmlyc1ZkaXJzVlF1cFR2RGJLRVlvMDgwRnNIRkNWK3NUSkR5QU8xVjlTb3hWZzM1WVBvdm5Qekw1JiN4QTtydnRTMCsydnJXQnJTSFM0N21HT1lRMnlldWtheGlRTnhxcUtXcDFPYlBWQ1dHRUJFa2M3K3hyanVTZ3Z6RDhvK1J0WjhpMi9uSHk1JiN4QTthcFpJSkl1UWdqRUt5UnlUaTNkR2lId2gwa1BVZUI2N1pQVFpza2NuaHpOL2kwa0NyQ2wrYWR0NVE4bStZZkxVcWVYN1M0MHdRWEVkJiN4QTsxWmlOVk1pajAxVjJhaDV1dlVGNi9qWEhTR2VXTXZVYlpoQjY3b0hrTHpoK1h0LzVwOHM2Y2RHMURTQ1RQQ29DS3dqQ3M2bFZKUS9BJiN4QTsxVllVTmNsREpreDVCQ1o0Z1dRNXBIRmVOZGFacHV2bzNHOTFHcVhiSS9wc2J1emtTT1NUNEI5cVJKSW5ZbmNzVGhpQkdSaFhlZVY4JiN4QTt3NE9zaHduaTc2NmtkWHRYbHU5dWIzUXJPNnVmNytTUDk0UjNJSkhMdDFwWE5YbWlJeklEazRwRXhCS1o1VXpkaXJzVmJYN1ErZUt1JiN4QTtiN1IrZUt0WXE3RlhZcXBYTnhIYlcwdHhMVVJ3bzBqMDNQRlJVL3F3Z1dhUVRUd2Y4d3ZNRSt0YUxOSkpINlJpMVFUQ01jcUxGY1dpJiN4QTt4UkE4djJ1Vm5KbTUwV1BnbVI1T09NbkhHL05OZFcvTjdTNysvd0RLWnN0UHVuZzBCMGx2T1FRU09RZ2pZUnFyT0tBYjFKRmZiRERSJiN4QTtrQ2RrZXBzNHJUVzIvT1BSN1R6YnJldXg2VnFNa2QvYVcwTnBDMFNLZlV0dzlmVUlkdUtrc054eStXVm5SU01JeHNiRXN3V08rVHZOJiN4QTt2NVo2RnBjTnpyZmx5N3V0ZldhU2Q3b3hJMFFrTWpORUVNa3EwNHJ4L1k2MU9XNXNXV1pxTWdJczBrdnZPR29lZGZ6UTBmVVpZeENHJiN4QTt2YlMzczdZSGw2Y1N6Z3FDMU56Vml4T1NHSVlzUkhrVzJJMlgrUlB6Tm51dnpTdDlJc05NRnpjYWxmWFJudlo1YWNZWkhsdUo1RWlXJiN4QTtpaHlxVkJMZEtpbnhacXNtVzRpSTViT0hERlV1SStiNk56R2JuWXE3RlhZcW5Obi9BTHpSL0xGWFhuKzgwbnl4VkpzVmRpcnNWZGlyJiN4QTtEL05ubTVMTFhOTTBoWTBkSkx1eWE3bGNzQkdyWFVmRWdnVStHbkk3OU15SVlMZ1pmanphWlpxbUkvanllWWZsYitZdW4rUjR0ZFc5JiN4QTt0SjdpOHZCQ0xXS01LRUVrSHFnaVZtWUZSV1FkRk9ialY2WTVlR2pzRVJsU0t0UHpBc1UvS1ZQS0QyRjcra0VkV1M0U05XZ1pSZWk2JiN4QTtyeTVCZ2VOUjlrNzVDV21QamNkaXYyVXppZHFSM212OHhQS2ZtZnpmcFY3cW1oMzgyZzZiRE1HZ1pGOVdXV1duSGtpeUt2QlNvUDhBJiN4QTtlYitHUXhhYWVPQkFJNGkyQkFlYy93QTJQTDh2bGFYeXY1TzBsOUtzTHBxM3J5cWtiRUVnc3FxalNidHhBTE0zVGFtSEZwWkNYSE0yJiN4QTtXY1F3dTk4eHA1YjhrNkRjWE51OXlsM2ZhbzhVYXY2WTRvTlBVc1hJWWpkR0FvcHFjcDFHVVJ5My9SL1cxNm5IeFVQYzkrL0t2ekhkJiN4QTsrWS9JR2themRXcVdVdHlrZ0Z0Rnk0TEhGTThVZEM1TEdzYUthNXE1R3phZ1V5ekFsMkt1eFZ0ZnRENTRxNXZ0SDU0cTFpcnNWZGlxJiN4QTtBMTIwZTgwVyt0VXFYbGdrVkFONnNWTkJRKytXWXBjTWdmTmhramNTSGhKZ1c0WjlPdUdTMnROVEVkczBraEtpSzVVazJiMFBSVWNtJiN4QTtONmZaV1ZtL1p6YlRsd0VURzljLzA3Ky83bkMwOHFQQ2RyNWZxcjNkeVI2RnJHcCtUZGV2VXVyVjQ3azI4OWhkd0UrbklnbVhqeVZxJiN4QTtIZFRSaDQvVFhNekpBWllpajV1WEVVeXAvd0E0YklQTzBOamNsWmdnRVU4MGNzWTRTeHkwS0NPTUZmZ0toUHNxRzJBekgvS0h2YlFwJiN4QTtlWnZ6ZnM5YTh2NnRwYjZaSUpOUzRDS1Y1bFpJVmp1R3VGb25EcURLeTFxUGg0anR1TWVrTVpBM3kvVlRJQmhtbTJIbUN5MDF0WTBxJiN4QTsxbGwxZTc1V21nSkd2eGV0S1JCSmQxTkFxVy9xaFZkaUI2eklQNXFWNjNOdHdqbXprYUZQUlB5Ti9KWFVmSytvU2VZZk1TSkZxQ3h0JiN4QTtCcHRnckpJWUErMHMwanFYWDFYVmVLOEcyU3RldEJxWjFlM0pxZTE1QlhZcTdGWFlxbk5uL3ZOSDhzVmRlZjd6U2ZMRlVteFYyS3V4JiN4QTtWMkt2SlB6UjAyYjlPVE8xVWh2WUY0eWlvM0NHTnZpQWFuQUxYY1UzR2JUVEVTeDhQNCszelBmMGNEUGNaMytQczdoM2pxODc4MmFkJiN4QTtkVG92bVZJUWtHb1NNdW9KRjlpMzFBZkZOSHNUeFdTdnJSYi9BR0dIZ2N6dExsc2NCK3FMa0QxQVNIVmtWdjhBbTVFZE90NEx1enVCJiN4QTtQQmIyZHJ6dDVvMVFyWnVyY2lqeFBVeUJhRlNTdmVoeUIwbSt4Ny90YmdqWVB6dXRvZ0FkTm1JOVFNN3JNQkk2ZW9zaFNTUXF6T2F4JiN4QTtoUXhOUXRSM3lCMFhteXBoR3VYTXZuTHpsZVhtbldndEJmdVoyaVpoNmNLS2dNc3NzbEZWVVhpWGRpTnN1RllzZEU4bXlPem8vd0FyJiN4QTsvT2ZuM1hJZnFzTDZaNVYwMGpUYkcrdWdzYnJieGt2Tk10dnlFM3JYRHl2S09TVUhJSnlvTTB1U2ZFVEk4eTF5Tmw5TzZacHRucG1tJiN4QTsybW0yVWZwV1ZqREhiVzBWUzNHS0ZBaUxWaVNhS28zSnpIUWlzVmRpcnNWYlg3UStlS3ViN1IrZUt0WXE3RlhZcXNra0NDdEN4b1NGJiN4QTtVVkpvSzA4UHZ5TTUweWpHMkZlY2JMeWJhYVpmNjFxV2xTWERvaXRkV0VabzgzcnVzTkRGekNOVm1vVDM5OHUwdXJsa0l4OGpYV3JyJiN4QTs5WDJNSjZVRDFmZHkvdCsxNXI1aWorc09zRCtVdFlheVJYanQwbmFOTHkyRUNlcTYyODVhWnA0WTAzOUdWVzQvc1NJUGh6WTRCS0hLJiN4QTtjYVRUR3o1UXZwSTRiaTMwM1dHdHJreGlCMnNvdC9YNGVrTnJuOXIxazhPb3pPL01EcVI4L3dCaVZUVDlGUkkwbmkwSFZOVG1lM2p2JiN4QTtZelBDa1VDMnNvWXBPWVk1bWt1QVJHeFZSTEhXbTVwc2FzdVdSMkJpT2llSjZYNWUxdlRMRUpZM2ZsWFVScU41SUliYTkxYUtCVW52JiN4QTtiVG0xdmI4MEJqdGdySTNvcWtZUmR5bzZuTmRMQWVmRUQzMTNNWHFrTHU4YW1SUWtsQjZpQTh1TEVWSzEyclRNTXF2d0s3RlhZcTdGJiN4QTtVNXMvOTVvL2xpcnJ6L2VhVDVZcWsyS3V4VjJLdXhWS3RZdGRLMUdEMHRSdFRMYXFQVVdadmdDMTJKRGdxeTdIZnBsUTFweEd4WWpYJiN4QTtQcDl2NmZ2Wm5UQ1lvMFQzZFhtR3ZEU0lML1ZMUFFQTFdweTNOcklscmU2akNxM0ZuY1VSWlJEZFF5eXFra2ErcXUvd3VsUVVkQ2E1JiN4QTt0SXdrYWx4QUhvMVJnQnlZSGMrWHhleVN0YTZCcStteXh4TGN6VzBheFhzQWlrZGtTUkpXa3QyVkdaR0NnOHpzZmlPYkdHY2dlb3hMJiN4QTtNSVQvQUE2YmVTZjY3WTZ3cVdpdkpkSXRuQ3JLa1VucE9TeHVEeEFmNGEwT1RPYStWZlA5aWJaajVkdC8wZGR5Vzk3NUsxaDdma0dUJiN4QTtURVNPUkpQU2NEMUx1WXNuMW1rbE9NZkZJbGFnNE5JQSthN05BNU56T0tDU1hyWGxIV2JQVnJSOVEwN1Qxc3RMdXo2MFVwQ3hTeTNMJiN4QTtPNlhLelFoUnhrU1NPak1XUExNUE5BeE5FMlIrQWhrR1VxN0ZYWXE3RlcxKzBQbmlybSswZm5pcldLdXhWMktxRjNhUjNNWlZsUXQyJiN4QTtMcUhGS2cwSU5LZzAzRmNwejRCa0ZHdmlML0FiTWVRd0tUZVpQTHNHcCtYTC9UYnljeDI4cWt4U1JLYXg4WEVpRmxabVdUaXlMNGJiJiN4QTtiWU1KL0wrc214RysvbDU3bS94UVptWEdRQU56K083WmpQMWY4d1dubGVIWDdFVFcxd2ViSll6Zyt0T2h0T1RBM0hHUS9Ec1g1VStXJiN4QTsyV2p0WFRIaUFqSThKRVQ4WkVEN1F5T21tS3V0eGZ5RnVFZjVpUlR4eUo1a3NJbVc3YU1CZFBrQ3M2cWtaaksrdFQwNlJyVDViWXk3JiN4QTtXMG8ySWw5WEI4Ui9hbzBzei9wZUw0S0M2UjU5Tm5QQU5mMDhRckhOWkVKcHJJNlFSeEJmUlVwS3JjWTEzUW40dmZKanRYVG16VXZTJiN4QTtUODQ3bEg1YWUzblgydHdlV3ZNZDc1bTArLzFQV2JLWnBMdUxVTGcyOWs4TWx6OVhXY1c2dklaSEhHTkhrQ2JkT3Rkc1k5cTREVUlnJiN4QTszTWJmYjkvQ1NpV25tQVNlbjdQMXN5MFB5cHAyamFwcStvMnNrN3phMU9MbTVTV1JualZndEtScWZzai9BR3VnQXl5ZVV5QUIvaGFFJiN4QTs2eXBYWXE3RlhZcW5Obi92Tkg4c1ZkZWY3elNmTEZVbXhWMkt1eFZvZ01DQ0tnN0VIb1JnSXRRVUVOTjlPZjFZVEhIVnF2OEFBUXhTJiN4QTtsT05WWmR3S2hUVGJNTWFUaGx4Um9iOTNUdTJJNWZ3bm81QnozR2paK1A3UG4zc1ExYlJ0WTAzVnJ1NTBQVm9MU0hVTGxKWjRMeTJsJiN4QTt1U3Qwa01hYzQ1RWxqcHlSRjNJNUExbzN4VXpMbDJsaHhBUm1EdDZmMDcvTllZSnozSHZRN2FmK1l6eFBZdnI5aHd1bmEyUEt3bFpqJiN4QTt4SWtvWkduWnlGUElnc1Q5cHZITFA1U3djUUhESytLdmlFZUJLcjI1V29HeDgvNmdwNStZOVBrL1NMU1c4elNhYXhNa2JDUnpBeGVVJiN4QTtsVVVYQlZlTkdvQUs3WkRGMnZwcGNQQ0plbzBQZUFHVTlMT04zMDNhdk5LODdYenZMZWEzcHR5a3FKZHZCSnAwclJrQ1JKb21DK3Y4JiN4QTtQRjFXbEtWSU5hL0ZVeDdYMDRHd2w5UEY4RCt1L3dBVXY1V2YyMThVeTB2OHU3YTk4cjZKWjZ0cUZ4YzNHbTNzdXBmVzdabXRmVm1sJiN4QTt1Skp6elFFMDNrcFViajlraXVYUTFvbmM0RDB5SFg1TkU0R0pvczd5bGk3RlhZcTdGVzErMFBuaXJtKzBmbmlxaktibjFJL1NDR09wJiN4QTs5VXNTR0E3Y1FBYS9UaXFrRzFMZ0twRHo1Ny9FOVBUOGZzL2F4VnR6cVhHWGdrSmJrUFJxekFGZS9LaTdINVlxMjV2K1V2Qll1TkI2JiN4QTtQSm1xVzc4cUxzUGxpclIrdk1hTWtKUXgvRUN6SDk1NGZaK3ppUUNvTFVhWGZLTG5GQUZOVGNGUzFlUUpLOGZoMzMzM3lQQkh1VHhGJiN4QTthc2Q3eGo1UTIvSXljcHFGcVVxTjErSGR2bmo0Y2U1UEVlOTNDOUN2eGh0d3hrSlVWYWhROVNmaCswY1JDUGN2RWU5dGt2QTBqUnhRJiN4QTtWUUJiWWtzRFQ5b05SZHZveDRJMkRTT0lyeWIvQUpQUll1UEQ0Q1dhdnFlQitIN09TUTVUZjhrNUxGeDRmdktNMVEvK1Q4UFRGV2tPJiN4QTtvMGk1cENEVSt2Um1OQjI0VlhmNmNWWFJHOTI5VlloOFo1Y0dZL0JUYWxRTjY0cXI0cW5Obi92Tkg4c1ZkZWY3elNmTEZVbXhWRHViJiN4QTsvbkx3V0xnQVBSTE0xUzNmbFFiRDVZcTZ0L3lId1JjZlQrTDRtcjZ2Z1BoK3o3OWNWY2gxQ3NYTllxR3ZyOFdhb1BiaFZkL3B4VmFwJiN4QTsxTGpIeVNFTnovZWdNNUFUL0orSDdXS3RPbDh5dis2Z0xjL2c1RnFjUEZ2aCsxc01CaEU4d2tTSWJrUzhyS1VpZ0pCQnR5eFlHcCswJiN4QTtXK0UwK2pIZ2ozTHhGcjA3b09hUlFjVlNzWnFhaVdnSDh2MmZmcmc0STl5ZUk5N2F4M1ZVRHhRQkRIeG1vU2R4V2lxT1AyZm5qd1I3JiN4QTtsNGozdWordnFzS21PRlFDUk1GWnFCUjluaDhQaDQ1SUFEWUlKdDFkUzRmWWg1K3AwNVBUMC9IN1Ayc1VOdWRScEx3V0hsVWVoVm1vJiN4QTtWNzgvaDJQeXhWdHpmOHBPQ3hjZUk5R3JOVXQzNWZEc1BsaXFwRWJqYjFRZytGYThTVDhlL0xxQnQwcGlxcXYyaDg4VmMzMmo4OFZhJiN4QTt4VjJLcU41ZFJXbHBOZFMvM2NDTkk5S0EwUVZQMmlCMjduRldNVGZtRGEyOHJKY1FJaXJjL1YrUW1Cb2dra2prZDZxdEdRUmN1QXJzJiN4QTt5K09TNFZWSi9QVUZwR2pYc0MyOHIzQ3d0YnRJd2tqaU5TMHJoNDR4c0J0dzVCdXh4NFZYVzNuQzR1NytTd3RyS05yaFdsQ0Y3Z3JIJiN4QTt4aGtlTmc3Q0p1TW53QmdnQitGZ2E0OEtxSytlcEpZcnFXM3NrZExhMit0bFhuNHY2WWlpbFBKUkcvR29ub201NUZXNlV4NFZSbHY1JiN4QTtxbCtvNmxlWGxvdHZIcHhrUnVNa2pCNUluYVBpcnZERkdlVExRRldOSzcweHBVVnB2bUdLL3dEMGNZb3h4djdlYWNzSERCR2dhTkhTJiN4QTtvRkcrS1FpdnRnSVZDMkhuRzB2cmFhZTNqRENLOWlzNkNRR3FUeXJHazFRTnFoNjhUNFV3bUtvM1FOWmJWclZyZzI1dDFBaUtndHk1JiN4QTtDV0NPYlkwWHA2bkg2TUJGS21tQlhZcTdGVTVzL3dEZWFQNVlxNjgvM21rK1dLcE5pcnNWZGlyc1ZVcnE2dDdTM2U0dUpCRkRHS3U3JiN4QTtkQU1WU2crZGZMQUJyZkQ0UVN3NFNWSEVCalVjYWo3VlBudDEydzhKVlVmemI1ZlFPVGNraU9Sb25JaWxhanIyMlE5ZjJmSHRqd2xWJiN4QTswUG1uUTV2ckhwM0JJdFkybW1KaWxVZW1yRlN5a3FPWTVLUjhOYTQwVlZKUE1XaXhoUzEwdEg1Y0NBeEI0UkNaaUtEcDZiQTE5d091JiN4QTtOS2lyUFVMUzg5WDZ0SjZub1NHS1hZaWpyMUc0R0NsUkdLdXhWMkt1eFZ0ZnRENTRxNXZ0SDU0cTFpcUMxclZyVFI5S3V0VHZPWDFhJiN4QTswak1rbkFjbUlIWlJ0dWVtVHh3TTVDSTVsWG5jL3dDZmZrZWVGNEp0UDFDU0dWU2trYlJRRU1wRkNDUFd6Ty9rekozeCszOVNMVS8rJiN4QTtWNmZsL3dBU3Y2THZlSldSU1BRdHFjWmp5bEg5OTBkaFZ2SHZoL2t6SjNqN2YxTGFsQitkUDVhMjZzc0dpWE1LdXJJNGp0YlZRVmVuJiN4QTtKVFNYY054RlI3WS95Yms3eDl2Nmx0ZEwrZHY1Y3kyd3RwZEh1NUxaV0xyQTF0YXNnWWtrc0ZNdEtrc2NmNU55ZDQrMzlTMnVQNTQvJiN4QTtsNGVkZEp2RDZpc2tsYmUyK0pYQ3F3UDc3Y0VScUQ4aDRZL3laazd4OXY2bHRhbjUyL2x3a3NreWFOZExMTXdlV1FXMXFHZDFibUdZJiN4QTtpV3BJY2NxbnZ2ai9BQ2JrN3g5djZsdDB2NTJmbHhNeU5MbzExSTBidExHWHRyVmlydVFXY1ZsMllrVkp4L2szSjNqN2YxTGE1L3p4JiN4QTsvTHg0bWhmU2J4b25SSW1qTnZiRlRIR1NVUWoxcWNWcWFEdGovSm1UdkgyL3FXMVdIOCsvSXNLbFlkT3Y0MU5LaEliZFJzb1VkSnV5JiN4QTtxQjhoZy9rekozajdmMUxiTVBKdm5mUi9OdG5QZGFhazBhMjhnamxqdUZWWEJJcUQ4RE90RDg4eGMrbmxpTkZMSWNvVjJLcHpaLzd6JiN4QTtSL0xGWFhuKzgwbnl4VkpzVmRpcnNWZGlxbGMydHZkUmVqY1JyTEVTR0tNS2dsVFVWSHpHS29RK1g5QU5LNmJhbWxLZnVJKzNUOW5EJiN4QTtaVmNkRTBVeGlNMkZzWTE1RlU5R1BpT2YycUNuZnZqYXJ6cE9sa01EWndFTXZCaDZhYnFHNThUdDA1ZkZUeDN4dFZvMFRSZzZ1TEMyJiN4QTs1clRpM3BKVWNRRldocDJDZ0Q1WTJxdmJXbHBheCtsYXd4d1IxTGNJbENMVTlUUlFNQ3EyS3V4VjJLdXhWdGZ0RDU0cTV2dEg1NHExJiN4QTtpckYvek8vNVFIVy8rWWMvOFNHWk9qL3ZZcVVvL0tQOHZQSldyL2w1cE9vNmxwRUYxZXovQUZqMVozRGNtNFhNcUxXaDdLb0daT3MxJiN4QTtPU09VZ0hiOWlBekQvbFUzNWNmOVdDMis1djhBbXJNYjg1bC9uSnAzL0twdnk0LzZzRnQ5emY4QU5XUDV6TC9PV25mOHFtL0xqL3F3JiN4QTtXMzNOL3dBMVkvbk12ODVhZC95cWI4dVArckJiZmMzL0FEVmorY3kvemxwMy9LcHZ5NC82c0Z0OXpmOEFOV1A1ekwvT1duZjhxbS9MJiN4QTtqL3F3VzMzTi93QTFZL25Ndjg1YWQveXFiOHVQK3JCYmZjMy9BRFZqK2N5L3pscDMvS3B2eTQvNnNGdDl6ZjhBTldQNXpML09Xbm1YJiN4QTsvT08vL0hIMWYvbUlqLzRnY3pPMVBxaWdQWE0xU1hZcW5Obi9BTHpSL0xGWFhuKzgwbnl4VkpzVmRpcnNWZGlyc1ZkaXJzVmRpcnNWJiN4QTtkaXJzVmRpcnNWZGlyYS9hSHp4VnpmYVB6eFZyRldML0FKbmY4b0RyZi9NT2YrSkRNblIvM3NWS0wvSTMvd0FsYm9uL0FFZGY5UmMyJiN4QTtTMS85OUw0ZmNFQm5lWWlYWXE3RlhZcTdGWFlxN0ZYWXE4Ri81eDMvQU9PUHEvOEF6RVIvOFFPYlh0VDZvb0Qxek5VbDJLcHpaLzd6JiN4QTtSL0xGWFhuKzgwbnl4VkpzVmRpcnNWZGlyc1ZkaXJzVmRpcnNWZGlyc1ZkaXJzVmRpcmEvYUh6eFZ6ZmFQenhWckZXTC9tZC95Z090JiN4QTsvd0RNT2Y4QWlRekowZjhBZXhVb3Y4amYvSlc2Si8wZGY5UmMyUzEvOTlMNGZjRUJuZVlpWFlxN0ZYWXE3RlhZcTdGWFlxOEYvd0NjJiN4QTtkLzhBamo2di93QXhFZjhBeEE1dGUxUHFpZ1BYTTFTWFlxbk5uL3ZOSDhzVmRlZjd6U2ZMRlVteFYyS3V4VjJLdXhWMkt1eFYyS3V4JiN4QTtWMkt1eFYyS3V4VjJLdHI5b2ZQRlhOOW8vUEZXc1ZZditaMy9BQ2dPdC84QU1PZitKRE1uUi8zc1ZLTC9BQ04vOGxib24vUjEvd0JSJiN4QTtjMlMxL3dEZlMrSDNCQVozbUlsMkt1eFYyS3V4VjJLdXhWMkt2QmYrY2QvK09QcS8vTVJIL3dBUU9iWHRUNm9vRDF6TlVsMktwelovJiN4QTs3elIvTEZYWG4rODBueXhWSnNWZGlyc1ZkaXJzVmRpcnNWZGlyc1ZkaXJzVmRpcnNWZGlyYS9hSHp4VnpmYVB6eFZyRldML21kL3lnJiN4QTtPdC84dzUvNGtNeWRIL2V4VW92OGpmOEF5VnVpZjlIWC9VWE5rdGYvQUgwdmg5d1FHZDVpSmRpcnNWZGlyc1ZkaXJzVmRpcndYL25IJiN4QTtmL2pqNnY4QTh4RWYvRURtMTdVK3FLQTljelZKZGlxYzJmOEF2Tkg4c1ZkZWY3elNmTEZVbXhWMkt1eFYyS3V4VjJLdXhWMkt1eFYyJiN4QTtLdXhWMkt1eFYyS3RyOW9mUEZYTjlvL1BGV3NWWXY4QW1kL3lnT3QvOHc1LzRrTXlkSC9leFVvdjhqZi9BQ1Z1aWY4QVIxLzFGelpMJiN4QTtYLzMwdmg5d1FHZDVpSmRpcnNWZGlyc1ZkaXJzVmRpcndYL25IZjhBNDQrci93RE1SSC94QTV0ZTFQcWlnUFhNMVNYWXFuTm4vdk5IJiN4QTs4c1ZkZWY3elNmTEZVbXhWMkt1eFYyS3V4VjJLdXhWMkt1eFYyS3V4VjJLdXhWMkt0cjlvZlBGWE45by9QRldzVll2K1ozL0tBNjMvJiN4QTtBTXc1L3dDSkRNblIvd0I3RlNpL3lOLzhsYm9uL1IxLzFGelpMWC8zMHZoOXdRR2Q1aUpkaXJzVmRpcnNWZGlyc1ZkaXJ3WC9BSngzJiN4QTsvd0NPUHEvL0FERVIvd0RFRG0xN1UrcUtBOWN6VkpkaXFjMmYrODBmeXhWMTUvdk5KOHNWU2JGWFlxN0ZYWXE3RlhZcTdGWFlxN0ZYJiN4QTtZcTdGWFlxN0ZYWXEydjJoODhWYzMyajg4VmF4VmkvNW5mOEFLQTYzL3dBdzUvNGtNeWRIL2V4VW92OEFJMy95VnVpZjlIWC9BRkZ6JiN4QTtaTFgvQU45TDRmY0VCbmVZaVhZcTdGWFlxN0ZYWXE3RlhZcThGLzV4My80NCtyLzh4RWYvQUJBNXRlMVBxaWdQWE0xU1hZcW5Obi92JiN4QTtOSDhzVmRlZjd6U2ZMRlVteFYyS3V4VjJLdXhWMkt1eFYyS3V4VjJLdXhWMkt1eFYyS3RyOW9mUEZYTjlvL1BGV3NWWXYrWjMvS0E2JiN4QTszL3pEbi9pUXpKMGY5N0ZTaS95Ti93REpXNkovMGRmOVJjMlMxLzhBZlMrSDNCQVozbUlsMkt1eFYyS3V4VjJLdXhWaS9tLzh5UEsvJiN4QTtsU1JJTlRsbGU2ZFBXK3JXOFpsZFl1WEgxSDZLcTh0dHptUmgwMDhtNFY1Yi93QTQ3LzhBSEgxZi9tSWovd0NJSE0zdFQ2b29EMXpOJiN4QTtVbDJLcHBDOHEyOXVJNHZVNXNGYzhnb1JhRWxqWGM5S0FBZFQ0VklJQVZWdlA5NXBQbGdWSnNWZGlyc1ZkaXJzVmRpcnNWZGlyc1ZkJiN4QTtpcnNWZGlyc1ZkaXJhL2FIenhWemZhUHp4VnJGV05mbVJCTlA1RjFxS0dOcEpEYk1RaUFzeG9RVHNQWVprYVExbGpmZXBlUmVVZnptJiN4QTs4MitXUEwxcG9kbnBWdk5iMm5xY0paa201bjFaV2xOZUxLT3IrR2JmTm9vWkpHUlBOamFjZjlER2VlUCtyTFovOEJjZjgxNVgvSnVQJiN4QTt2UDJMYnY4QW9Zenp4LzFaYlA4QTRDNC81cngvazNIM243RnQzL1F4bm5qL0FLc3RuL3dGeC96WGovSnVQdlAyTGJ2K2hqUFBIL1ZsJiN4QTtzLzhBZ0xqL0FKcngvazNIM243RnQzL1F4bm5qL3F5MmYvQVhIL05lUDhtNCs4L1l0dS82R004OGY5V1d6LzRDNC81cngvazNIM243JiN4QTtGdDMvQUVNWjU0LzZzdG4vQU1CY2Y4MTQvd0FtNCs4L1l0cFRZZm1wY3A1bXZmTlY5b1JtMXljUVJXL3B2T2x1dHVxK25jSTBmTDR5JiN4QTs2QWNlVlFHK0ttd3l5V2tIQUlDWHBXMmIvazdjM21wWFBtZlhKNHBZazFPLzlTSlpRZGg4VGNRYUFIaUhBMnpCMTRFZUdJNkJJZWs1JiN4QTtya3V4Vk9iUC9lYVA1WXE2OC8zbWsrV0twTmlyc1ZkaXJzVmRpcnNWZGlyc1ZkaXJzVmRpcnNWZGlyc1ZiWDdRK2VLdWI3UitlS3RZJiN4QTtxN0ZYWXE3RlVyMXpVclMwV0tPNHZyZXpNMVNpenlMRTBnU2hmanlaZGxCcTFNeGRWaHpaSTFqK0xmZ2xBRzVKY1BPV21BZ3lhcnBTJiN4QTt4dFVMSWJ1T2xRYUVWNWJtdmJLWURYR1hDWVIvMlg0KzV0TU1OV0RMN0VSWitZcmU1UDd2VWRPbFV0RkdmUnVGWWg1dnNMc1Q4VWdxJiN4QTtVSGZKUmhyZjQ0d0grbTI3K2pHUXc5T0w3R0cvbTU1dnVOSThqM3MyajN5cGV6M052SEZjMjAzT1ZFa1pwRmMwUHdCMWdLZzlDTXpPJiN4QTt6Tk5JNUNKajBtUjZtenorWFRsMFJra0tGY3dPNGVUSHZKdm1uek5xL3dDWm1tNlVtc1MzT25hZnAwVFh2Q1RuRk5MNllkeTVGUXoxJiN4QTtscDh4N1pYTEhLT25pWmVuSmt5bmgvcThSbFgrbEZOcytIaWxRMkVmdDVmZnU5d3k1d1hZcTdGWFlxN0ZVNXMvOTVvL2xpcnJ6L2VhJiN4QTtUNVlxazJLdXhWMkt1eFYyS3V4VjJLdXhWMkt1eFYyS3V4VjJLdXhWdGZ0RDU0cTh5UDhBemtENU5KSitwNmovQU1pb1ArcTJiSCtUJiN4QTtNbmZIN2YxTU9NTmY5REFlVGY4QWxqMUgva1ZCL3dCVnNmNU15ZDhmdC9VdkdIZjlEQWVUZitXUFVmOEFrVkIvMVd4L2t6SjN4KzM5JiN4QTtTOFlkL3dCREFlVGYrV1BVZitSVUgvVmJIK1RNbmZIN2YxSjR3Ny9vWUR5Yi93QXNlby84aW9QK3EyUDhtWk8rUDIvcVhqREgvTTM1JiN4QTtpL2xSNW1udFp0YTByVXJsck1NTGNValFMeklMYkxPT3ZFWmRpMGVhSDBtTy93Q081ZUlKSXVxZmtTcUxHdWlhc0lrNVVqOVNvL2VLJiN4QTtWYmMzSmJjSHh5endOUmQzRy94NUo0K2lMZzgwL2t0YitoNkdqNnZFTGFhSzRnQWxZOEpZR0xSTUszUit3enV3OTJieHlKMDJjOVkvJiN4QTtqNEx4TEkvTXY1S0pZWGRpMmo2ckxCZXhRd3orcXl5Tnh0dG9PTE5jRXFZMStGYWR0dW1SeWFUVVMvaUFJNUVkUDlpV1VaMGpmS1BuJiN4QTszOG8vS2ZxblI5SjFLT1NhbnFTeUxESTVBN2NqTlduK2ZqbUxMc25OT2ZIT2ZHUnl2bEgzQVJBMzd6Wjg2Wnl6K25oQUFIbDErZHNsJiN4QTsvd0NoZ3ZKbi9MRnFQL0lxRC9xdGxuOG1aTytQMi9xYXJkLzBNRjVNL3dDV0xVZitSVUgvQUZXeC9rekozeCszOVMyNy9vWUx5Wi95JiN4QTt4YWovQU1pb1ArcTJQOG1aTytQMi9xVzNmOURCZVRQK1dMVWYrUlVIL1ZiSCtUTW5mSDdmMUpkLzBNRjVNLzVZdFIvNUZRZjlWc2Y1JiN4QTtNeWQ4ZnQvVXIxTHliNWlzdk1YbHF5MW15U1NPMXVoSUkwbUNySVBTa2FJMUNzNCswaHB2bUZseEhISXhQTUszNXg4dzJYbDN5M2VhJiN4QTt4ZXBKSmJXd2pFaVFoV2tQcVNMRUtCbVFmYWNkOGNPSTVKQ0k1bEJOUExmK2hnUEp2L0xIcVA4QXlLZy82clptL3dBbVpPK1AyL3FZJiN4QTs4WWQvME1CNU4vNVk5Ui81RlFmOVZzZjVNeWQ4ZnQvVXZHSGY5REFlVGY4QWxqMUgva1ZCL3dCVnNmNU15ZDhmdC9VdkdIZjlEQWVUJiN4QTtmK1dQVWY4QWtWQi8xV3gva3pKM3grMzlTZU1PL3dDaGdQSnYvTEhxUC9JcUQvcXRqL0ptVHZqOXY2bDR3Ny9vWUR5Yi93QXNlby84JiN4QTtpb1ArcTJQOG1aTytQMi9xWGlkLzBNRDVOLzVZOVIvNUZRZjlWc2Y1TXlkOGZ0L1V2RTcvQUtHQjhtLzhzZW8vOGlvUCtxMlA4bVpPJiN4QTsrUDIvcVR4Ty93Q2hnZkp2L0xGcVAvSXFEL3F0ai9KbVR2ajl2Nmx0My9Rd0hrMmxmcVdvMDhmU2cvNnJZL3laazc0L2o0TGJYL1F3JiN4QTtYa3ovQUpZdFIvNUZRZjhBVmJIK1RNbmZIN2YxTGJ2K2hndkpuL0xGcVA4QXlLZy82clkveVprNzQvYitwYmQvME1GNU0vNVl0Ui81JiN4QTtGUWY5VnNmNU15ZDhmdC9VdHUvNkdDOG1mOHNXby84QUlxRC9BS3JZL3dBbVpPK1AyL3FTMlA4QW5JUHlZQ0Q5UzFIL0FKRlFmOVZzJiN4QTtmNU15ZDhmdC9VcnhyeS9xOWhZVzE1RmRJeGVlUzFlR1JZNDVlSG9UaDNQR1U4U2VGUUFkajBPMmJuSkFraXZOcEJWOVIxN1RaL09rJiN4QTtXc3hSTUxLT2UxbGtqNEtDM29yR0pUd0xNUGpaR05HWTlkeld1UmpqSWh3OWQxSjNYNjNyM2wrNjBTQzAwNndlMXZZcnlXNGtuYjB6JiN4QTt6VjZrYnFvWVUrRUJOMUFYeEp4aENRbFpPMUpKVEh6TDV0OHQ2bHBHbzJscFptR1dmVUpydXpZUXJHVlNTVGtPYnJLVjJTcThQVDYwJiN4QTtvM2JLOFdLVVNDVDBTUzY2ODNlWEpkQXZiRmJOa3ZMbTFzNGhNSVVxMHNGdkRHNUxCd0ZBa2pkcThHSjVmc25FWXBDUU43V2Z2VzBzJiN4QTs4dWEvcHVuV0lodVVrTXE2aGIzWHFSSWhiNnZIRFBITkdHWTdHVDFFSDQ5UmxtVEdTZHU3OVNnb1RTTmJ0NGZNYmFycUVJZUtVM0xUJiN4QTtReG9wWGxQRzYwVkdJVUFNL3dCR1NuRDAwRkNiNno1bTBDODFEUVpyT0pyTkxCVVc2bFcyaGRnRjRkSTJZcElWNHNkK0s3L1pHK1ZRJiN4QTt4eUFsZTlzbC9tSHpUNWV2dEl2YmExZ1lYRTg1ZUwvUm9vMUlMbzNydElIWi9VNHFZeUF0RFV0dFdtT1BGSUVFcmF5Kzh6NkhKcExXJiN4QTtnRFhFejZXdG9zaldzTUpXNEZ4QktOMGFuQkVqZFZOSzEzL2FOR09LVjM1OS9rVnRFNlQ1cjh2MnFhTUo1WFpyR0dUNjFXd3RtNU8zJiN4QTtwOFlLbHhXSDkxOGJmYmJrKzQ1N1JuaWtiOC9NL2o4RHVTRXMwWFh0SnM5RG50WjNZenZlUlRSS0xTQ1FKR2trYnM2dTdieUVKUlZhJiN4QTtxQWNoKzJTSnp4a3l2eTcvQU1majNLamJielRvWTg1WHVydURIWXpRS2dpTnJGTUpKRlNOV0RvNy9DanVoWnFQeVphcVQ4Uk9ST0tYJiN4QTtBQjE5NnBmcUd0NkJOYmFERFlXaldMNmM1TjVLNlJYSE9walBNcVFucS9FcnR4ZmFoNDlNbkdFZ1pXYnRLYmE3NXc4dVhtaTZwcDBFJiN4QTtEUEpjU3BKYTNMVzZSU3NVUzNqRFN2SEx4clNCMmY4QWRua3pWSEhmSzRZWkNRUDQ2cTk0L0kzL0FNbGJvbi9SMS8xRnpacDlkL2ZIJiN4QTs0ZmNyZjU0LytTdTFyL28xL3dDb3VIRG9QNzZQeCs0c1o4bnlmblJOTHNVdFlxeU02VkZZYVBlbTV0aTExNk1aTXJxYVJ5U3lKd2pRJiN4QTtuYmtFNUZqOUhqWFFmbkpadFJqNEpEZzQ1YmQ4WXhsY2o1Y1hDSStYcTNzVnNQQkVNY3VJZXFoOExJMitYUDVKQ3RyY3R5Q3d1ZUNlJiN4QTtvOUZKb214NUh3WGZybTdPYUFxeU56WFByM2U5d2hBOXl5U09TTWdTS1VKQVlCZ1JVTUtnNzlpTWxHUVBJMnBCSE56UXpLenEwYkswJiN4QTtmOTRwQkJYZW0vaGdFNGtBZzgrU2VFaFV1Yks4dHFmV0lYaXFTQnpCRzZrcXczOENDTWhpMUdQSjlFaEwzSHZGajdOMlVzY284eFRVJiN4QTtFTVJBZTRkb29UWGk2cHpMRVVxRnFWRzFmSEhKTThvZ0dYdnI5ZjNKakVkZGdtN05wZHY1ZVZSNjhvdTdvc2ZzUXNSYm9BUDkrN2Z2JiN4QTtqOU9hc0ROazFaSjRZK0hqODVEMW5mOEFtL3pCODNKUEJIRjFQRkwzY3ZuM29qOHZ2SzFwNXA4NldlaXlHYUt4dURLMHNrUlV5SkhIJiN4QTtHemdsaXBYcW9Xdkh2bWZxYzBzZUxpMjR0dmQ1OWYwdU1BTDhubzM1Zy9rZDVZOHUrVzU5U3NiKzhhNmpxVVc0YUo0eUVSbmFvU05HJiN4QTszQzA2NXBjbmJXVEhQSEV4RWhrbUk3YmMrdlBvMzRjSW1KZE9HTnUvTG44alBMdm1YeWZZNjNxTjNld1hOMzZwTWNMUktnVkpXalVnJiN4QTtQRzUzQ1Y2NW02blhaSVpERWNORDlYdmFkbm5INWhlV0xIeTM1a24wMnhuZWUxV3BqTTFQVUFWbVE4aW9WVFVvU0tESmRrZG95MVVKJiN4QTtraWpDY28rK3V2MnR1ZkR3Vi9TaUN4bk5xMHNpOHM2cnAxaGJhcXQ0NURYTnMwVnZFTGVPZFdkMFpLdTdzcklFNThoeC9iQ2svWm9hJiN4QTs4c0NTS2FRVVhINW5zcHZNbW1YdHc4a1ZwWld5UVRUckJDOHp0d1l5dHdiNEFUSkl5bzNWUlE5UmtUalBDUU9xYjNWUE1IbWJRTDd5JiN4QTszK2o3VzBFVjhiMTdneXBBa0tjR2xuZjRhTTVWU3MwYWhPM0hkaUFNR1BGSVNzbmF2MUtUc21Vdm5QeXlJcnVKb1d1ek5wNHRrbU5wJiN4QTtEQTdUVW0yYjAzNHFnZVplTkJzcUoxSzd3R0dXM3Y3L0FITXJRR2dlWjlCc3RHczdPOWplV2FLNmFZdUxlSi9TQmltUVNJUzYrb3l2JiN4QTtLamhXQTNYN1ZLREpaTVVqSWtkMzZrQXFkbDVtMFNMWE5hdlhoWVdsOUZKSEJDTGVJbHl5MHF3NUFSRmo4VzNJVjZoc01zY3VFRHFFJiN4QTtncXVuK2F2TDhYbWVYVXA3ZHhheVdkbkN2R0NLUmhOYnBiK3YrN2RsU2svb3lJV3JXajE4UmtaWXBjTmVaL1Q5eVVKRDVoMFU2enBkJiN4QTswOExRd1cxZzFwTzRpamtaSnlrcUpPaUZsV1QwaklqRGtSWGoyeVJ4eTRTUE5iWCtZUE0yaTMraTNWcGFRdkhMTnFMWGNDR0dLTllvJiN4QTtpWmR1VVovYUVpN2NkcVU1Y1FveHg0NUNRSjdsSlRPVHpuNUxPckpkTnBrazhDMnNzTVE5S0NMMERLU1ZqV1A5NHNnalg0RmRpRHVUJiN4QTtTb0dROEdkVmZWTEFNeWxkaXJzVmRpbDJLdnJMOGpmL0FDVnVpZjhBUjEvMUZ6Wnp1dS92ajhQdVZ2OEFQSC95VjJ0ZjlHdi9BRkZ3JiN4QTs0ZEIvZlIrUDNGakxrK1Q4NkpxYXhWRjJHcFhObEtyd0hpVllNekxSWElCK3p6cHlBUHRtTnFOTERORWlRc0VmRDVjaTI0OHBnYkNhJiN4QTtSNnovQUxpNzFwYmgzbXVwbURRc3haaXBRcXBidHhIcU1mOEFXQXpYejBBOGFGUkFFSTdIdTNCTmVaNFlqK3FUdTVVYy9vbFoza2Z4JiN4QTs5NStOSnF2bTNRNU9idGJ0Q1o1NC9yYUJGY3p4cU4ya1B3MFhsMVJkdHZBbk5RZXd0U0tBbnhjTUpjQnNqZ0o1VnozcllUUHEzUFduJiN4QTtLR3R4bnBWa1g1Ky85U2xxMnZhZVpsYTlzaGROYzJzYkt6Y1F5RDk0WTE2SGZpNjFJK2ZobVJvdXpNa1kxaW53Q09TWGZSK25pNjk0JiN4QTtORGZ1NVhjYzJwamZxamR4SDZhVW8vT2NFbHRmeDNsdTBzdDFKNmlQUks4RWtWNG9IUGRCOFZldTJ3d1Q5bnBSeTRwWTVjTWNZcXQrJiN4QTtaaktNcC8xdVZjdDdKS0JyZ1l5RWhaSi9Uc1BjMnZucFpFZUs3c2tsaERpUzJxRlprSUxtcDVBZ3NlZEs5dHppZlp2aG1KNDVtTXFxJiN4QTtYTWNYMDl4MkE0ZVhYYU4wRkhhRmlwUnNkUHRTblV0Y2d1OU10clVXeXJjeEFpUzVvbytIbXo4RVVDaWlyZGVwNzV0TkwyZkxGbm5rJiN4QTs0endTNVIzNTBCeEU5VFE1Y2gwY2ZMcUJLQWpXNDZvaTIxT3dzN2ExdDd5MEZ5ald6QnR4Vkdra2tQSmVRTy9Fb2ZveXJOcE11V1VwJiN4QTtRbndIakh4QUVkanYzOFE5eCtMT0dXTVFCSVg2ZjBuOWowTC9BSnh4c251L09tcTZvRVNPQzN0R1RndTNGN2lWU2dVZUFXTmhrdTBhJiN4QTtqamhBa2svZlFyOUxqM2RsbS84QXprQnFMVy9sb1FvZmlaRzVEMmtkSS84QWlQTE9lakh4TmZnaDBqeFMrUTIrMXpNSHB3emw3Z3puJiN4QTt5ZlpIU1BKZWtXazRDUFoyRUl1QU9nZFlnWlArR3JtWmx5QzVUNldUK2x4S0pOZkI4cC9tTGV5WGZtdTZMMC9kaEVCSHV2TS84TTV6JiN4QTtMOWw4ZkRvb3lQT1psSS9FL3FEbGRvSDk2UjNVR05aMExoUGMvd0FoZkpmbFhYdkx1b1hPc2FiRGV6eFhucHh5U0ExQ2VraG9LRWR6JiN4QTttcjdRenpoSUNKclpyZ0hwMy9LcC93QXVmK3JEYmZjMzljMS81ekwvQURtZEIzL0twL3k1L3dDckRiZmMzL05XUDV6TC9PV2cxL3lxJiN4QTtmOHVmK3JEYmZjMy9BRFZqK2N5L3psb08vd0NWVC9sei93QldHMis1dithc2Z6bVgrY3RPL3dDVlRmbHovd0JXRzIrNXYrYXNmem1YJiN4QTsrY3RPL3dDVlRmbHgvd0JXRzIrNXYrYXNmem1YK2NtbmY4cW0vTGovQUtzTnQ5emY4MVkvbk12ODVhZC95cWI4dVA4QXF3VzMzTi96JiN4QTtWaitjeS96bHAzL0twdnk0L3dDckJiZmMzL05XUDV6TC9PVjMvS3B2eTQvNnNGdDl6ZjhBTldQNXpML09WMy9LcHZ5NC93Q3JCYmZjJiN4QTszL05XUDV6TC9PVjMvS3B2eTQvNnNGdDl6ZjhBTldQNXpML09WMy9LcHZ5NC93Q3JCYmZjMy9OV1A1ekwvT1ZJUFB2NWFlUTdEeVhyJiN4QTtkN1o2TGJ3WFZ2WnpTUVRLRzVLNnFTQ044dTArcXlISUFUdGFwaitSbi9rck5FLzZPdjhBcUxteXZYZjN4K0gzS1cvengvOEFKWGExJiN4QTsvd0JHdi9VWERoMEg5OUg0L2NXTXVUNU96b21wMktXYmZsSm9WaHEzbWVjNmhiSmVXV24yTnpleTI4bGVMZW1vVlFhRWZ0T0RtTHE4JiN4QTtoakRZMFNRR1VROWR2UHlxL0x0N204bHQwaVNHR09IUmJtSVZIbzNrOGtTck90YS92ZUU0cFhhdE0xc2RYbG9YL1crSGN6b0xXL0xMJiN4QTt5VkhjV2N0eG9FTm5CYXozUjlGcmlacDVyZTNpa0ZaVWNGR1ZtNFB6RGZEVUN2akhKck1naklnbVJydUhQdUgzSmpFRTF5VkxueUo1JiN4QTtLaU9welNhUWt0L1p3MmNFakcydkx5M0VwVXVmU2h0LzNoVVFsRnF0RkcxZStVNldXVEhqakcrZkVUeUc1Tm41eXNzOHN1S1JQNHJvJiN4QTtnRy9MUHlmcU9tYUdEb2lhZDlmbWdGNU8wc3NNMGNqSVozU09wbGpuamxWZlRYZ3c0VnJ2dUJsZm1aeE10N3I4ZkJycGl2blh5UHAxJiN4QTsxcE9rdzJIbDRlWHZNZDlxcjJGbHAvck5JMDFtRlA4QXBFbk1rZ0s5S3Q0YjlDTXlNR2NpUnVYRkVSdS9OU0VaK1lINWE2QmJXdmxXJiN4QTszMFcyVmVlb3BvOTdkb3lPYm1TVUpTUnlqdUZOVWZZMHA0WkhUNm1STWpMdXYzTFNNMHY4czlObi9NZlc5UTFYU1RiZVdyQ1NPMjA2JiN4QTt5bkhvUjNEdUJDclJtVXhoMFJVWjltMzJwWEtobk1jSWpFM0kyU2U3ZS8wMHlrYktLL0tXWFRQTGY1bitiZkxMa1c1dVpxNmFqRUtDJiN4QTtrTHU2eGlwM2IwcGdSN0E1WHJpWlk0VFBMa2ZlYS9WODZDWWl3WHF1dmVVZkwydnZiUHE5b0xyNnE2eVJLek9xbGtOVjVxcEFkYS9zJiN4QTt0dG1yakFESjRnMm53bU4rUi9IUG15R1FpUEQwNXBaK1lIbXZUOUgwZTRnZVpWdUpZeUhGZjd1TWo0bWJ3MjJHWVd2eUdVZkN4NzVKJiN4QTs3VjczSjBlRzVjY3ZwanUrUnRUdld2dFJ1YncxSHJ5dElBZHlBeHFCOUEyenROSHB4aHd3eGorQ0lIeWNiTFBqa1pkNVF1WkxCNjVZJiN4QTtlYnZNdjVSWGVvK1hIMHlPNWlsdVd1TGU2bUxxSlkrSVJIUXJzUVZVVjhEdG12bGhocVFKVzFYU04vNkdaMTcvQUtzMXIveU1reUg4JiN4QTtseDd5bmpkLzBNMXIzL1ZtdGY4QWtaSmovSmNlOHJ4Ty93Q2htdGUvNnMxci93QWpKTWY1TGozbFBFNy9BS0dhMTcvcXpXdi9BQ01rJiN4QTt4L2t1UGVWNG5mOEFReld2ZjlXYTEvNUdTWS95WEh2SzIxLzBNM3IzL1ZtdGYrUmttUDhBSmNlOHJiditobTlmL3dDck5hLzhqSk1mJiN4QTs1TGozbE51LzZHYjEvd0Q2c3RyL0FNakpNZjVMajNsYmQvME0zci8vQUZaYlgva1pKai9KY2U4cmJ2OEFvWnZYL3dEcXpXdi9BQ01rJiN4QTt4L2t1UGVVdS93Q2htOWYvQU9yTGEvOEFJeVRIK1RJOTVWMy9BRU0zci84QTFaYlgva1pKai9Ka2U4cTcvb1p2WC84QXF5MnYvSXlUJiN4QTtIK1RJOTVTaGRVL1Biekw1cDA2NTh1d2FIQzgycXh0YW9zRFNQSldRY2ZoWHVjbERRUXhuaXZrdFBiL3krOHV6ZVhQSm1sYU5PUWJpJiN4QTsyaUp1S0dvRXNydExJQWU0RHVSbXAxR1RqbVpCQmIvTUR5N0w1ajhtNnJvMEJBdUxtSUczcWFBeXhPc3NZSjdBdWdHT255Y0dRU0tDJiN4QTtIeDNlMlYzWTNjdG5lUXZiM1VERkpvWkFWWldIVUVIT25qSUVXR3BRd3FpTFBVZFFzWGQ3SzVsdFhrWGc3UXUwWlpUdnhKVWlvd0dJJiN4QTtQTks1OVgxV1JaMWU5blpibGxlNURTdVJJNm1xczlUOFJCR3hPRGdIY2xjK3Q2eThyU3ZmM0xTdEdZR2tNemxqRWVzWkpOZUovbDZZJiN4QTtPQ1BjbFdYelI1bVZPQzZ2ZWhLY2VJdUpRS0FVcFRsNFlQQ2ozQlVMSnF1cHlSUVF5WGN6eFd4QnRvMmtjckdSMEtBbWkvUmtoRWR5JiN4QTtyanJXc0c5VytOL2NHOVFjVXV2VmYxUUNDS0I2OGhzYWRjSEJHcXJaS3lIVk5UZ2lXS0M4bmlpU1VYQ1JwSTZxc3dGQklBRFFQVDlyJiN4QTtyaE1RZWlWYTgxL1hiMUVTOTFHNnVVallQR3MwMGtnVnhXaktHWTBPL1hBTWNSeUFWUWwxQy9tdlByczF6TEplY2xmNnk3czB2SktjJiN4QTtUeko1VkZCVGZCTEhFeE1TQnducDBTQ1FiRE1MZjg1dlBrVnNzRFh2ckJkdWJtVU1SNzhIUmZ3elFaUFpyREkrbkptZ080VDIrMno5JiN4QTtybHgxaEhPTUNmNnJIZGI4MDZ6ckxmNlpOKzdyeTlGUGhTdmlkeVQ5SnpQMEhaR0RTN3dIcS9uSGMvajNNTTJwbmsyUEx1U2pObTBKJiN4QTs1NU04cGFuNXExNjIwcXhqWXJJNm02bkFxc01OZmprWTlCUWRQRTdaVG16REhHeWw5ZjhBbUQvRFAxTWY0aCtwZlVxN2ZwRDB2U3JUJiN4QTsvaTc0ZW1jNWo0NzlOMzVNV01mOGdNLzc5ai91WDVmL0FJUi9UKzFHenY4QWtCbi9BSDdIL2N2dy93Q0VmMC90WFpyL0FKQVgvd0IrJiN4QTt4LzNMOEgrRWYwL3RYWjMvQUNBdi92MlArNWZqL2hIOVA3VjJkL3lBdi92MlArNWZqL2hIOVA3VjJkL3lBdjhBNzlmL0FMbCtQK0VmJiN4QTswL3RYWjMvSUMvOEF2MS8rNWZqL0FJUi9UKzFMditRRi93RGZyLzhBY3Z4L3dqK245cXUvNUFYL0FOK3Yvd0J5L0gvQ1A2ZjJxNy9rJiN4QTtCZjhBMzYvL0FITDhmOEkvcC9hcnYrUUZmOSt2L3dCeS9IL0NQNmYycTcva0JmOEEzNi8vQUhMOGY4SS9wL2FyditRRmY5K3Yvd0J5JiN4QTsvSC9DUDZmMnFuWGxyL2xYM3JQL0FJWi9SUHJVL2VmbzM2dHk0LzVYb2IweXJMNG44ZkY4YlZrT1VxN0ZXUDhBbVQvbFgvckovaWI5JiN4QTtFK3RUOTMra3ZxM0tuK1Q2MjlNdXhlTC9BQWNYd3RCcEpmOEFrQm4vQUg3SC9jdnk3L0NQNmYycnMxL3lBei92MlA4QXVYNC80Ui9UJiN4QTsrMWRuZjhnTC93Qy9ZLzdsK0QvQ1A2ZjJyczcvQUpBWC93Qit4LzNMOGY4QUNQNmYycnM3L2tCZi9mc2Y5eS9IL0NQNmYycnM3L2tCJiN4QTtmL2ZyL3dEY3Z4L3dqK245cTdPLzVBWC9BTit2L3dCeS9IL0NQNmYycGQveUF2OEE3OWYvQUxsK1ArRWYwL3RWMy9JQy93RHYxLzhBJiN4QTt1WDQvNFIvVCsxWGY4Z0wvQU8vWC93QzVmai9oSDlQN1ZkL3lBci92MS84QXVYNC80Ui9UKzFYZjhnTC9BTy9YL3dDNWZqL2hIOVA3JiN4QTtWZC95QXIvdjEvOEF1WDQvNFIvVCsxV1VlWC84TWZVai9oMzZsOVNyditqL0FFdlNyVC9pbjRlbVVaT08vVmQrYXY4QS85az08L3htcEdJbWc6aW1hZ2U+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpBbHQ+CiAgICAgICAgIDwveG1wOlRodW1ibmFpbHM+CiAgICAgICAgIDx4bXBNTTpJbnN0YW5jZUlEPnhtcC5paWQ6NTJjYzY2NmUtY2I4ZS04ODQwLThhNTEtZWNmNWQ3OTRjZDNiPC94bXBNTTpJbnN0YW5jZUlEPgogICAgICAgICA8eG1wTU06RG9jdW1lbnRJRD54bXAuZGlkOmI4OTNmZGFhLTY5OWItMmE0ZS1iNzg4LTU3Yjc5MjE2M2ZmZDwveG1wTU06RG9jdW1lbnRJRD4KICAgICAgICAgPHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD51dWlkOjVEMjA4OTI0OTNCRkRCMTE5MTRBODU5MEQzMTUwOEM4PC94bXBNTTpPcmlnaW5hbERvY3VtZW50SUQ+CiAgICAgICAgIDx4bXBNTTpSZW5kaXRpb25DbGFzcz5wcm9vZjpwZGY8L3htcE1NOlJlbmRpdGlvbkNsYXNzPgogICAgICAgICA8eG1wTU06RGVyaXZlZEZyb20gcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICA8c3RSZWY6aW5zdGFuY2VJRD54bXAuaWlkOmE2ZDYwYWJiLTQ1NGQtZjE0YS04NTEzLTBiMWQ1NzJmZWU3Zjwvc3RSZWY6aW5zdGFuY2VJRD4KICAgICAgICAgICAgPHN0UmVmOmRvY3VtZW50SUQ+eG1wLmRpZDphNmQ2MGFiYi00NTRkLWYxNGEtODUxMy0wYjFkNTcyZmVlN2Y8L3N0UmVmOmRvY3VtZW50SUQ+CiAgICAgICAgICAgIDxzdFJlZjpvcmlnaW5hbERvY3VtZW50SUQ+dXVpZDo1RDIwODkyNDkzQkZEQjExOTE0QTg1OTBEMzE1MDhDODwvc3RSZWY6b3JpZ2luYWxEb2N1bWVudElEPgogICAgICAgICAgICA8c3RSZWY6cmVuZGl0aW9uQ2xhc3M+cHJvb2Y6cGRmPC9zdFJlZjpyZW5kaXRpb25DbGFzcz4KICAgICAgICAgPC94bXBNTTpEZXJpdmVkRnJvbT4KICAgICAgICAgPHhtcE1NOkhpc3Rvcnk+CiAgICAgICAgICAgIDxyZGY6U2VxPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5zYXZlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjI1NTVmNGYzLWZkNGMtNjU0MC04ZTUzLTM1ZWFkMDZlYjJiYTwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAyNS0wMS0xMFQxNToyMDoxMi0wNTowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgSWxsdXN0cmF0b3IgMjguMyAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpjaGFuZ2VkPi88L3N0RXZ0OmNoYW5nZWQ+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OmFjdGlvbj5zYXZlZDwvc3RFdnQ6YWN0aW9uPgogICAgICAgICAgICAgICAgICA8c3RFdnQ6aW5zdGFuY2VJRD54bXAuaWlkOjUyY2M2NjZlLWNiOGUtODg0MC04YTUxLWVjZjVkNzk0Y2QzYjwvc3RFdnQ6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OndoZW4+MjAyNS0wMS0xMlQxNjo0Mjo0Mi0wNTowMDwvc3RFdnQ6d2hlbj4KICAgICAgICAgICAgICAgICAgPHN0RXZ0OnNvZnR3YXJlQWdlbnQ+QWRvYmUgSWxsdXN0cmF0b3IgMjguNyAoV2luZG93cyk8L3N0RXZ0OnNvZnR3YXJlQWdlbnQ+CiAgICAgICAgICAgICAgICAgIDxzdEV2dDpjaGFuZ2VkPi88L3N0RXZ0OmNoYW5nZWQ+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICA8L3JkZjpTZXE+CiAgICAgICAgIDwveG1wTU06SGlzdG9yeT4KICAgICAgICAgPHhtcE1NOk1hbmlmZXN0PgogICAgICAgICAgICA8cmRmOlNlcT4KICAgICAgICAgICAgICAgPHJkZjpsaSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgIDxzdE1mczpsaW5rRm9ybT5FbWJlZEJ5UmVmZXJlbmNlPC9zdE1mczpsaW5rRm9ybT4KICAgICAgICAgICAgICAgICAgPHN0TWZzOnJlZmVyZW5jZSByZGY6cGFyc2VUeXBlPSJSZXNvdXJjZSI+CiAgICAgICAgICAgICAgICAgICAgIDxzdFJlZjpmaWxlUGF0aD5DOlxVc2Vyc1xVU1VBUklPXEFwcERhdGFcUm9hbWluZ1xBZG9iZVxDcmVhdGl2ZSBDbG91ZCBMaWJyYXJpZXNcTElCU1wzMDgwRkY1NjU5MjM0MUIyMEE0OTVEMjJfQWRvYmVJRFxjcmVhdGl2ZV9jbG91ZFxkY3hcMGE4OTVlM2MtOTcwMS00MzZkLWExZTYtNGZjZDVjYzViNmU1XGNvbXBvbmVudHNcMTEzMWUxOGMtNDg3Yy00MjI2LTk2YTYtNmU2YjFlOWE2YmRiLmFpPC9zdFJlZjpmaWxlUGF0aD4KICAgICAgICAgICAgICAgICAgICAgPHN0UmVmOmRvY3VtZW50SUQ+eG1wLmRpZDpiMzFhOWQ4NS1lYzFkLWUxNDgtOTNlZi1jOThiYTAxY2ZhZjE8L3N0UmVmOmRvY3VtZW50SUQ+CiAgICAgICAgICAgICAgICAgICAgIDxzdFJlZjppbnN0YW5jZUlEPnV1aWQ6YzI2YjU4YWMtM2U2OC00MzJjLWI4ODAtMDI2NWMxMzE1YjVlPC9zdFJlZjppbnN0YW5jZUlEPgogICAgICAgICAgICAgICAgICA8L3N0TWZzOnJlZmVyZW5jZT4KICAgICAgICAgICAgICAgPC9yZGY6bGk+CiAgICAgICAgICAgICAgIDxyZGY6bGkgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICA8c3RNZnM6bGlua0Zvcm0+RW1iZWRCeVJlZmVyZW5jZTwvc3RNZnM6bGlua0Zvcm0+CiAgICAgICAgICAgICAgICAgIDxzdE1mczpyZWZlcmVuY2UgcmRmOnBhcnNlVHlwZT0iUmVzb3VyY2UiPgogICAgICAgICAgICAgICAgICAgICA8c3RSZWY6ZmlsZVBhdGg+QzpcVXNlcnNcVVNVQVJJT1xBcHBEYXRhXFJvYW1pbmdcQWRvYmVcQ3JlYXRpdmUgQ2xvdWQgTGlicmFyaWVzXExJQlNcMzA4MEZGNTY1OTIzNDFCMjBBNDk1RDIyX0Fkb2JlSURcY3JlYXRpdmVfY2xvdWRcZGN4XDBhODk1ZTNjLTk3MDEtNDM2ZC1hMWU2LTRmY2Q1Y2M1YjZlNVxjb21wb25lbnRzXDExMzFlMThjLTQ4N2MtNDIyNi05NmE2LTZlNmIxZTlhNmJkYi5haTwvc3RSZWY6ZmlsZVBhdGg+CiAgICAgICAgICAgICAgICAgICAgIDxzdFJlZjpkb2N1bWVudElEPnhtcC5kaWQ6YjMxYTlkODUtZWMxZC1lMTQ4LTkzZWYtYzk4YmEwMWNmYWYxPC9zdFJlZjpkb2N1bWVudElEPgogICAgICAgICAgICAgICAgICAgICA8c3RSZWY6aW5zdGFuY2VJRD51dWlkOmMyNmI1OGFjLTNlNjgtNDMyYy1iODgwLTAyNjVjMTMxNWI1ZTwvc3RSZWY6aW5zdGFuY2VJRD4KICAgICAgICAgICAgICAgICAgPC9zdE1mczpyZWZlcmVuY2U+CiAgICAgICAgICAgICAgIDwvcmRmOmxpPgogICAgICAgICAgICAgICA8cmRmOmxpIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgPHN0TWZzOmxpbmtGb3JtPkVtYmVkQnlSZWZlcmVuY2U8L3N0TWZzOmxpbmtGb3JtPgogICAgICAgICAgICAgICAgICA8c3RNZnM6cmVmZXJlbmNlIHJkZjpwYXJzZVR5cGU9IlJlc291cmNlIj4KICAgICAgICAgICAgICAgICAgICAgPHN0UmVmOmZpbGVQYXRoPkM6XFVzZXJzXFVTVUFSSU9cQXBwRGF0YVxSb2FtaW5nXEFkb2JlXENyZWF0aXZlIENsb3VkIExpYnJhcmllc1xMSUJTXDMwODBGRjU2NTkyMzQxQjIwQTQ5NUQyMl9BZG9iZUlEXGNyZWF0aXZlX2Nsb3VkXGRjeFwwYTg5NWUzYy05NzAxLTQzNmQtYTFlNi00ZmNkNWNjNWI2ZTVcY29tcG9uZW50c1wxMTMxZTE4Yy00ODdjLTQyMjYtOTZhNi02ZTZiMWU5YTZiZGIuYWk8L3N0UmVmOmZpbGVQYXRoPgogICAgICAgICAgICAgICAgICAgICA8c3RSZWY6ZG9jdW1lbnRJRD54bXAuZGlkOmIzMWE5ZDg1LWVjMWQtZTE0OC05M2VmLWM5OGJhMDFjZmFmMTwvc3RSZWY6ZG9jdW1lbnRJRD4KICAgICAgICAgICAgICAgICAgICAgPHN0UmVmOmluc3RhbmNlSUQ+dXVpZDpjMjZiNThhYy0zZTY4LTQzMmMtYjg4MC0wMjY1YzEzMTViNWU8L3N0UmVmOmluc3RhbmNlSUQ+CiAgICAgICAgICAgICAgICAgIDwvc3RNZnM6cmVmZXJlbmNlPgogICAgICAgICAgICAgICA8L3JkZjpsaT4KICAgICAgICAgICAgPC9yZGY6U2VxPgogICAgICAgICA8L3htcE1NOk1hbmlmZXN0PgogICAgICAgICA8aWxsdXN0cmF0b3I6U3RhcnR1cFByb2ZpbGU+UHJpbnQ8L2lsbHVzdHJhdG9yOlN0YXJ0dXBQcm9maWxlPgogICAgICAgICA8aWxsdXN0cmF0b3I6Q3JlYXRvclN1YlRvb2w+QWRvYmUgSWxsdXN0cmF0b3I8L2lsbHVzdHJhdG9yOkNyZWF0b3JTdWJUb29sPgogICAgICAgICA8cGRmOlByb2R1Y2VyPkFkb2JlIFBERiBsaWJyYXJ5IDE1LjAwPC9wZGY6UHJvZHVjZXI+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAg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';
}
