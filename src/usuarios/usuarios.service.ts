import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UsuarioDocument, UsuarioModelName } from './entities/usuario.entity';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectModel(UsuarioModelName) private usuarioModel: Model<UsuarioDocument>,
  ) {}

  async create(createUsuarioDto: any): Promise<any> {
    try {
      console.log(createUsuarioDto);
      // Hashear la contraseña antes de guardar
      const hashedPassword = await bcrypt.hash(createUsuarioDto.password, 10);
      const nuevoUsuario = new this.usuarioModel({
        ...createUsuarioDto,
        password: hashedPassword, // Guardamos la contraseña cifrada
      });
      return nuevoUsuario.save();
    } catch (error) {
      console.log(error);
      //Retorna Error con throw
      throw new Error('Error al crear usuario');
    }
  }

  async findAll(): Promise<any[]> {
    try {
      return this.usuarioModel.find().select('-password').exec(); // Excluye la contraseña
    } catch (error) {
      console.log(error);
      //Retorna Error con throw
      throw new Error('Error al buscar todos los usuarios');
    }
  }

  async findOne(id: any): Promise<any> {
    try {
      console.log(id);
      const usuario = await this.usuarioModel.findById(id).exec();
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
      return usuario;
    } catch (error) {
      console.log(error);
      //Retorna Error con throw
      throw new Error('Error al buscar usuario por id');
    }
  }

  async update(id: string, updateUsuarioDto: any): Promise<any> {
    try {
      // Verificar si el usuario es ADMIN antes de actualizar
      const usuario = await this.usuarioModel.findById(id).exec();
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
  
      // Si está intentando cambiar el rol a otro que no sea ADMIN
      if (usuario.rol === 'ADMIN' && updateUsuarioDto.rol !== 'ADMIN') {
        // Verificar si hay al menos otro usuario ADMIN
        const admins = await this.usuarioModel.countDocuments({ rol: 'ADMIN', _id: { $ne: id } });
        if (admins === 0) {
          throw new Error('Debe existir al menos un usuario ADMIN en el sistema');
        }
      }
  
      // Si el password está vacío, lo eliminamos del objeto
      if (updateUsuarioDto.password === '') {
        delete updateUsuarioDto.password;
      }
  
      // Encriptar nueva contraseña si se envía
      if (updateUsuarioDto.password) {
        updateUsuarioDto.password = await bcrypt.hash(updateUsuarioDto.password, 10);
      }
  
      // Actualizar usuario
      const usuarioActualizado = await this.usuarioModel
        .findByIdAndUpdate(id, updateUsuarioDto, { new: true })
        .exec();
  
      if (!usuarioActualizado) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
  
      return usuarioActualizado;
    } catch (error) {
      console.log(error);
      throw new Error('Error al actualizar usuario por ID');
    }
  }
  

  async remove(id: string): Promise<any> {
    try {
      // Verificar si el usuario a eliminar es ADMIN
      const usuario = await this.usuarioModel.findById(id).exec();
      if (!usuario) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
  
      if (usuario.rol === 'ADMIN') {
        // Contar cuántos ADMIN existen excluyendo el que se quiere eliminar
        const admins = await this.usuarioModel.countDocuments({ rol: 'ADMIN', _id: { $ne: id } });
        if (admins === 0) {
          throw new Error('Debe existir al menos un usuario ADMIN en el sistema');
        }
      }
  
      // Eliminar usuario
      const usuarioEliminado = await this.usuarioModel.findByIdAndDelete(id).exec();
      if (!usuarioEliminado) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }
  
      return usuarioEliminado;
    } catch (error) {
      console.log(error);
      throw new Error('Error al eliminar usuario por ID');
    }
  }
  

  async findByEmail(email: string) {
    try {
      return await this.usuarioModel.findOne({ email }).exec();
    } catch (error) {
      console.log(error);
      //Retorna Error con throw
      throw new Error('Error al buscar usuario por email');
    }
  }
}
