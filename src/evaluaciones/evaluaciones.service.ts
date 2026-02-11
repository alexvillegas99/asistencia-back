import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CursoDocument } from 'src/curso/entities/curso.entity';
import { UsuarioDocument } from 'src/usuarios/entities/usuario.entity';

@Injectable()
export class EvaluacionesService {
  constructor(
    @InjectModel('Evaluacion')
    private evaluacionModel: Model<any>,

    @InjectModel('CalificacionProfesor')
    private calificacionModel: Model<any>,

    @InjectModel('usuarios') // 👈 nombre exacto del model
    private usuarioModel: Model<UsuarioDocument>,

    @InjectModel('asistentes') // 👈 nombre exacto del model
    private asistentesModel: Model<CursoDocument>,

    @InjectModel('Curso') // 👈 según tu export
    private cursoModel: Model<any>,
  ) {}

  private readonly logger = new Logger(EvaluacionesService.name);
  // ===== EVALUACIONES =====

  crearEvaluacion(dto: any) {
    return this.evaluacionModel.create(dto);
  }

  obtenerEvaluaciones() {
    return this.evaluacionModel.find().sort({ createdAt: -1 });
  }

  actualizarEvaluacion(id: string, dto: any) {
    return this.evaluacionModel.findByIdAndUpdate(id, dto, { new: true });
  }

  // ===== CALIFICACIONES =====

  async crearCalificacion(dto: any) {
    console.log('DTO recibido en crearCalificacion:', dto); 
    const existe = await this.calificacionModel.findOne({
      evaluacionId: dto.evaluacionId,
      profesorNombre: dto.profesorNombre,
      cursoId: dto.cursoId,
      estudianteCedula: dto.estudianteCedula,
    });

    if (existe) {
      throw new Error(
        'Ya existe una calificación para este estudiante en esta evaluación, curso y profesor.',
      );
    }

    return this.calificacionModel.create(dto);
  }

  obtenerCalificaciones(filtros: any) {
    const query: any = {};

    if (filtros.evaluacionId) query.evaluacionId = filtros.evaluacionId;

    if (filtros.cursoId) query.cursoId = filtros.cursoId;

    if (filtros.profesorNombre)
      query.profesorNombre = new RegExp(filtros.profesorNombre, 'i');

    if (filtros.estudianteNombre)
      query.estudianteNombre = new RegExp(filtros.estudianteNombre, 'i');

    if (filtros.estudianteCedula)
      query.estudianteCedula = new RegExp(filtros.estudianteCedula, 'i');

    return this.calificacionModel.find(query).sort({ createdAt: -1 });
  }

  async obtenerEvaluacionesActivasHoy() {
    const hoy = new Date();

    return this.evaluacionModel
      .find({
        activa: true,
        fechaInicio: { $lte: hoy },
        fechaFin: { $gte: hoy },
      })
      .sort({ fechaInicio: 1 });
  }

 async obtenerEstadoEvaluacionesPorEstudiante(
  evaluacionId: string,
  cedula: string,
) {

  this.logger.log(
    `Inicio obtenerEstadoEvaluaciones | evaluacionId=${evaluacionId} | cedula=${cedula}`,
  );

  // 1️⃣ Buscar asistente con populate de cursos
  const asistente: any = await this.asistentesModel
    .findOne({ cedula })
    .populate({
      path: 'cursos',
      model: 'Curso',
      select: 'nombre estado',
    })
    .exec();

  if (!asistente) {
    this.logger.warn(`Asistente no encontrado | cedula=${cedula}`);
    throw new Error('Asistente no encontrado');
  }

  const cursosEstudiante = asistente.cursos || [];

  if (!cursosEstudiante.length) {
    this.logger.warn(`Estudiante sin cursos | cedula=${cedula}`);
    return [];
  }

  this.logger.log(
    `Cursos del estudiante: ${cursosEstudiante.map((c: any) => c.nombre).join(', ')}`,
  );

  const cursosIds = cursosEstudiante.map((c: any) =>
    c._id.toString(),
  );

  // 2️⃣ Buscar SOLO profesores que estén en esos cursos
  const profesores = await this.usuarioModel
    .find({
      cursos: { $in: cursosIds },
    })
    .populate({
      path: 'cursos',
      model: 'Curso',
      select: 'nombre estado',
    })
    .exec();

  this.logger.log(`Profesores encontrados=${profesores.length}`);

  // 3️⃣ Buscar calificaciones ya realizadas
  const calificaciones = await this.calificacionModel.find({
    evaluacionId,
    estudianteCedula: cedula,
  });

  this.logger.log(
    `Calificaciones existentes=${calificaciones.length}`,
  );

  const evaluacionesRealizadas = new Set(
    calificaciones.map(
      (c: any) => `${c.cursoId}_${c.profesorNombre}`,
    ),
  );

  const resultado: any[] = [];

  // 4️⃣ Agrupar por curso
  for (const curso of cursosEstudiante) {

    const cursoId = curso._id.toString();
    const cursoNombre = curso.nombre;

    // 🔥 Profesores que tengan este curso dentro de su populate
    const profesoresDelCurso = profesores.filter((prof: any) =>
      prof.cursos.some(
        (c: any) => c._id.toString() === cursoId,
      ),
    );

    this.logger.debug(
      `Curso=${cursoNombre} | Profesores asociados=${profesoresDelCurso.length}`,
    );

    if (!profesoresDelCurso.length) continue;

    const profesoresMap = profesoresDelCurso.map((prof: any) => {

      const key = `${cursoId}_${prof.nombre}`;
      const yaEvaluado = evaluacionesRealizadas.has(key);

      this.logger.debug(
        `Curso=${cursoNombre} | Profesor=${prof.nombre} | yaEvaluado=${yaEvaluado}`,
      );

      return {
        profesorNombre: prof.nombre,
        yaEvaluado,
      };
    });

    resultado.push({
      cursoId,
      cursoNombre,
      profesores: profesoresMap,
    });
  }

  this.logger.log(
    `Fin obtenerEstadoEvaluaciones | cursosProcesados=${resultado.length}`,
  );

  return resultado;
}

}
