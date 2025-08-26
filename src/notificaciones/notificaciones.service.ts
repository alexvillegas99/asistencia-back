import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { NotificacioneDocument, NotificacioneModelName } from './entities/notificacione.entity';

@Injectable()
export class NotificacionesService {
  private credentials: any;
  private readonly FCM_URL = 'https://fcm.googleapis.com/v1/projects/nic-app-corpfourier/messages:send';

  constructor(
    private readonly amazonS3Service: AmazonS3Service,
    @InjectModel(NotificacioneModelName)
    private readonly notificacionesModel: Model<NotificacioneDocument>,
  ) {
    this.loadCredentials();
  }

  /** 🔹 Cargar credenciales de Firebase desde Base64 */
  private loadCredentials() {
    try {
      const base64Credentials = process.env.FIREBASE_CONFIG_BASE64;
      if (!base64Credentials) {
        throw new Error('La variable FIREBASE_CONFIG_BASE64 no está definida.');
      }

      this.credentials = JSON.parse(
        Buffer.from(base64Credentials, 'base64').toString('utf8'),
      );
      console.log('✅ Credenciales de Firebase cargadas correctamente.');
    } catch (error) {
      console.error('❌ Error al cargar las credenciales de Firebase:', error.message);
      throw new InternalServerErrorException('No se pudieron cargar las credenciales de Firebase.');
    }
  }

  /** 🔹 Obtener el token de acceso de Firebase */
  async getAccessToken(): Promise<string> {
    try {
      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });

      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      if (!accessToken.token) {
        throw new Error('No se pudo obtener el token de acceso');
      }

      return accessToken.token;
    } catch (error) {
      console.error('❌ Error al obtener el token de Firebase:', error.message);
      throw new InternalServerErrorException('Error al obtener el token de Firebase.');
    }
  }

  /** 🔹 Enviar notificación a Firebase y guardar en la base de datos */
  async enviarNotificacion(notificacion: any): Promise<any> {
    try {
      console.log('📡 Preparando notificación para enviar...');

      const accessToken = await this.getAccessToken();
      
      // Subir imagen a S3 si existe
      if (notificacion.message.notification?.image) {
        console.log('🖼 Subiendo imagen a Amazon S3...');
        const url = (
          await this.amazonS3Service.uploadBase64({
            image: notificacion.message.notification.image,
            route: 'nic/notificaciones',
          })
        ).imageUrl;
        notificacion.message.notification.image = url;
      }

      console.log('📨 Enviando notificación a Firebase...');
      const response = await axios.post(this.FCM_URL, notificacion, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('✅ Notificación enviada correctamente:', response.data);

      // Guardar notificación en la base de datos
      await this.createNotification(notificacion);

      return response.data;
    } catch (error) {
      console.error('❌ Error al enviar la notificación:', error?.response?.data || error.message);
      throw new InternalServerErrorException(
        `No se pudo enviar la notificación: ${error?.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /** 🔹 Enviar notificación con Axios */
  async enviarConAxios(notificacion: any): Promise<any> {
    try {
      console.log('📡 Enviando notificación con Axios...');
      console.log('ℹ️ Notificación:', notificacion);
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        this.FCM_URL,
        { message: notificacion },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      console.log('✅ Notificación enviada con éxito:', response.data);
      return response.data; // Solo devolvemos el cuerpo de la respuesta
    } catch (error) {
      console.error('❌ Error al enviar la notificación:', error?.response?.data || error.message);
      throw new InternalServerErrorException(
        `No se pudo enviar la notificación: ${error?.response?.data?.error?.message || error.message}`,
      );
    }
  }

  /** 🔹 Guardar notificación en MongoDB */
  async createNotification(data: Partial<any>): Promise<any> {
    try {
      const newNotification = new this.notificacionesModel({
        ...data,
        date: new Date(), // Agregar fecha de creación
      });
      return await newNotification.save();
    } catch (error) {
      console.error('❌ Error al guardar la notificación en la BD:', error.message);
      throw new InternalServerErrorException('Error al guardar la notificación.');
    }
  }

  /** 🔹 Obtener todas las notificaciones */
  async getAllNotifications(): Promise<any[]> {
    try {
      return await this.notificacionesModel.find().sort({ date: -1 }).exec();
    } catch (error) {
      console.error('❌ Error al obtener notificaciones:', error.message);
      throw new InternalServerErrorException('Error al obtener las notificaciones.');
    }
  }
}
