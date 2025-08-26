import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type NotificacioneDocument = HydratedDocument<Notificacione>;

@Schema({ timestamps: true })
export class Notificacione {
  
  @Prop({ type: Object, required: true })
  message: {
    notification: {
      title: string;
      body: string;
      image?: string; // Imagen en base64 o URL
    };
    data?: {
      link?: string; // Enlace opcional
    };
  };

  @Prop({ type: Date, default: Date.now })
  date: Date; // Fecha de envío
}

export const NotificacioneSchema = SchemaFactory.createForClass(Notificacione);
export const NotificacioneModelName = 'notificaciones';
