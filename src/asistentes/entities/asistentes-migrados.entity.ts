// asistentes-migrados.schema.ts
import { HydratedDocument } from 'mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

export type AsistenteMigradoDocument = HydratedDocument<AsistenteMigrado>;

@Schema({ timestamps: true, collection: 'asistentes_migrados', strict: false })
export class AsistenteMigrado {

}
 
export const AsistenteMigradoSchema = SchemaFactory.createForClass(AsistenteMigrado);

// Índice compuesto útil para no duplicar una misma fuente en el mismo lote
//AsistenteMigradoSchema.index({ sourceId: 1, batchId: 1 }, { unique: true });
export const AsistentesMigradosModelName = 'asistentes_migrados';
