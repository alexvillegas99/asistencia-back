import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import { UsuarioDocument } from 'src/usuarios/entities/usuario.entity';

@Schema({ timestamps: true })
export class Rating extends Document {
  @Prop({ required: true })
  usuario: string;

  @Prop({ required: true, min: 1, max: 5 })
  calificacion: number;

  @Prop()
  observacion?: string;
}

export const RatingSchema = SchemaFactory.createForClass(Rating);

RatingSchema.pre<Rating>('save', async function () {
  if (!this.usuario.includes('@')) return;

  // ✅ AQUÍ ESTÁ LA CLAVE
  const UsuarioModel = this.model(
    'usuarios',
  ) as Model<UsuarioDocument>;

  const usuario = await UsuarioModel
    .findOne({ email: this.usuario })
    .select('nombre')
    .lean();

  if (usuario?.nombre) {
    this.usuario = usuario.nombre;
  }
});
