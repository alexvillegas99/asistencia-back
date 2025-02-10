import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { CodigoProfesoresDocument, CodigoProfesoresModelName } from './entities/codigos_profesore.entity';

@Injectable()
export class CodigoProfesoresService {

  constructor(
    @InjectModel(CodigoProfesoresModelName) private codigoModel: Model<CodigoProfesoresDocument>,
    private readonly usuariosService: UsuariosService,
  ) {}

  async generarCodigo(profesorId: string): Promise<any> {
    try {
 
    // Verificar que el usuario existe y es un profesor
    console.log(profesorId);
    const profesor = await this.usuariosService.findOne(profesorId);
    if (!profesor || profesor.rol !== 'PROFESOR') {
      throw new NotFoundException('El usuario no es un profesor o no existe');
    }

    // Generar código alfanumérico de 10 caracteres
    const codigoGenerado = Math.random().toString(36).substring(2, 12).toUpperCase();

    // Calcular la fecha de expiración (1 hora y 30 minutos)
    const expiracion = new Date();
    expiracion.setMinutes(expiracion.getMinutes() + 90);

    // Guardar en la base de datos
    const nuevoCodigo = new this.codigoModel({
      codigo: codigoGenerado,
      profesor: profesor._id,
      expiracion,
    });

    await nuevoCodigo.save();
    return nuevoCodigo;
  } catch (error) {
    console.log(error);
    //Retorna Error con throw
    throw new Error('Error al generar código');
  }
  }


  async vaidarCodigo(codigo: string) {
    try {
      console.log(`Validando código: ${codigo}`);

      // Buscar el código en la base de datos
      const codigoProfesor = await this.codigoModel.findOne({ codigo }).exec();

      if (!codigoProfesor) {
        return { valido: false, mensaje: 'Código no encontrado' };
      }
      console.log(codigoProfesor);
      // Obtener la fecha actual en UTC
      const ahoraUTC = new Date().toISOString(); // Convierte a formato ISO (UTC)
      console.log(ahoraUTC);
      console.log(codigoProfesor.expiracion.toISOString());
      // Verificar si el código ha expirado comparando en UTC
      if (codigoProfesor.expiracion.toISOString() < ahoraUTC) {
        return { valido: false, mensaje: 'Código expirado' };
      }

      return { valido: true, mensaje: 'Código válido' };

    } catch (error) {
      console.error('Error al validar código:', error);
      throw new Error('Error interno al validar código');
    }
  }
}
