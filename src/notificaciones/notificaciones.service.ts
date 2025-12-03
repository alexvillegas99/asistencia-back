import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import axios from 'axios';
import { AmazonS3Service } from 'src/amazon-s3/amazon-s3.service';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  NotificacioneDocument,
  NotificacioneModelName,
} from './entities/notificacione.entity';

@Injectable()
export class NotificacionesService {
  private credentials: any;
  private readonly FCM_URL =
    'https://fcm.googleapis.com/v1/projects/nic-app-corpfourier/messages:send';

  constructor(
    private readonly amazonS3Service: AmazonS3Service,
    @InjectModel(NotificacioneModelName)
    private readonly notificacionesModel: Model<NotificacioneDocument>,
  ) {
    console.log('🟡 [NotificacionesService] Constructor iniciado');
    this.loadCredentials();
  }

  /** 🔹 Cargar credenciales de Firebase desde Base64 */
  private loadCredentials() {
    console.log('🟡 [loadCredentials] Intentando cargar credenciales Firebase...');
    try {
      const base64Credentials = process.env.FIREBASE_CONFIG_BASE64;
      if (!base64Credentials) {
        console.error(
          '❌ [loadCredentials] La variable FIREBASE_CONFIG_BASE64 no está definida.',
        );
        throw new Error('La variable FIREBASE_CONFIG_BASE64 no está definida.');
      }

      const json = Buffer.from(base64Credentials, 'base64').toString('utf8');
      this.credentials = JSON.parse(json);

      console.log(
        '✅ [loadCredentials] Credenciales de Firebase cargadas correctamente.',
      );
      console.log(
        'ℹ️ [loadCredentials] project_id:',
        this.credentials?.project_id,
      );
      console.log(
        'ℹ️ [loadCredentials] client_email:',
        this.credentials?.client_email,
      );
    } catch (error: any) {
      console.error(
        '❌ [loadCredentials] Error al cargar las credenciales de Firebase:',
        error?.message,
      );
      console.error('❌ [loadCredentials] Error completo:', error);
      throw new InternalServerErrorException(
        'No se pudieron cargar las credenciales de Firebase.',
      );
    }
  }

  /** 🔹 Obtener el token de acceso de Firebase */
  async getAccessToken(): Promise<string> {
    console.log('🟡 [getAccessToken] Solicitando token de acceso a Firebase...');
    try {
      if (!this.credentials) {
        console.error(
          '❌ [getAccessToken] Credenciales no están inicializadas.',
        );
      }

      const auth = new GoogleAuth({
        credentials: this.credentials,
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });

      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();

      console.log(
        '✅ [getAccessToken] Token obtenido (primeros 20 chars):',
        accessToken.token?.substring(0, 20),
      );

      if (!accessToken.token) {
        console.error(
          '❌ [getAccessToken] No se pudo obtener el token de acceso. accessToken:',
          accessToken,
        );
        throw new Error('No se pudo obtener el token de acceso');
      }

      return accessToken.token;
    } catch (error: any) {
      console.error(
        '❌ [getAccessToken] Error al obtener el token de Firebase:',
        error?.message,
      );
      console.error('❌ [getAccessToken] Error completo:', error);
      throw new InternalServerErrorException(
        'Error al obtener el token de Firebase.',
      );
    }
  }

  /** 🔹 Enviar notificación a Firebase y guardar en la base de datos */
  async enviarNotificacion(notificacion: any): Promise<any> {
    console.log('🟡 [enviarNotificacion] Iniciando envío de notificación...');
    console.log(
      '➡️ [enviarNotificacion] Notificación de entrada:',
      JSON.stringify(notificacion, null, 2),
    );

    try {
      const accessToken = await this.getAccessToken();
      console.log(
        'ℹ️ [enviarNotificacion] Token listo para usar (primeros 20 chars):',
        accessToken.substring(0, 20),
      );

      // Subir imagen a S3 si existe
      if (notificacion?.message?.notification?.image) {
        console.log(
          '🖼 [enviarNotificacion] Imagen base64 detectada, subiendo a Amazon S3...',
        );
        try {
          const s3Response = await this.amazonS3Service.uploadBase64({
            image: notificacion.message.notification.image,
            route: 'nic/notificaciones',
          });
          console.log(
            '✅ [enviarNotificacion] Imagen subida a S3. URL:',
            s3Response.imageUrl,
          );
          notificacion.message.notification.image = s3Response.imageUrl;
        } catch (s3Error: any) {
          console.error(
            '❌ [enviarNotificacion] Error subiendo imagen a S3:',
            s3Error?.message,
          );
          console.error(
            '❌ [enviarNotificacion] Error S3 completo:',
            s3Error,
          );
          throw s3Error;
        }
      } else {
        console.log(
          'ℹ️ [enviarNotificacion] No se detectó imagen en notification.image',
        );
      }

      // 🚫 AQUÍ estábamos mandando también "date" a FCM
      // Sacamos date del objeto que va a Firebase
      const { date, ...firebasePayload } = notificacion;

      // (Opcional) Si quieres que la fecha también viaje al cliente,
      // la metemos dentro de message.data.date
      if (date) {
        firebasePayload.message = firebasePayload.message || {};
        firebasePayload.message.data = {
          ...(firebasePayload.message.data || {}),
          date: String(date),
        };
      }

      console.log(
        '📨 [enviarNotificacion] Payload FINAL a Firebase (sin date en raíz):',
        JSON.stringify(firebasePayload, null, 2),
      );
      console.log('ℹ️ [enviarNotificacion] URL FCM:', this.FCM_URL);

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      console.log('ℹ️ [enviarNotificacion] Headers:', headers);

      const response = await axios.post(this.FCM_URL, firebasePayload, {
        headers,
      });

      console.log(
        '✅ [enviarNotificacion] Notificación enviada correctamente. Respuesta de Firebase:',
        JSON.stringify(response.data, null, 2),
      );

      // Guardar notificación en la base de datos (aquí sí puedes guardar date aparte)
      console.log(
        '🟡 [enviarNotificacion] Guardando notificación en MongoDB...',
      );
      await this.createNotification(notificacion);
      console.log(
        '✅ [enviarNotificacion] Notificación guardada en MongoDB correctamente.',
      );

      return response.data;
    } catch (error: any) {
      console.error(
        '❌ [enviarNotificacion] Error al enviar la notificación.',
      );
      console.error(
        '❌ [enviarNotificacion] error.response?.status:',
        error?.response?.status,
      );
      console.error(
        '❌ [enviarNotificacion] error.response?.data:',
        JSON.stringify(error?.response?.data, null, 2),
      );
      console.error(
        '❌ [enviarNotificacion] error.message:',
        error?.message,
      );
      console.error('❌ [enviarNotificacion] error completo:', error);

      throw new InternalServerErrorException(
        `No se pudo enviar la notificación: ${
          error?.response?.data?.error?.message || error.message
        }`,
      );
    }
  }

  /** 🔹 Enviar notificación con Axios (otra variante) */
  async enviarConAxios(notificacion: any): Promise<any> {
    console.log('🟡 [enviarConAxios] Iniciando envío con Axios simple...');
    console.log(
      'ℹ️ [enviarConAxios] Notificación de entrada:',
      JSON.stringify(notificacion, null, 2),
    );

    try {
      const accessToken = await this.getAccessToken();
      console.log(
        'ℹ️ [enviarConAxios] Token listo (primeros 20 chars):',
        accessToken.substring(0, 20),
      );

      // Igual que arriba: no mandamos date en la raíz
      const { date, ...firebaseMessage } = notificacion;

      const payload: any = { message: firebaseMessage };

      if (date) {
        payload.message.data = {
          ...(payload.message.data || {}),
          date: String(date),
        };
      }

      console.log(
        '📨 [enviarConAxios] Payload a Firebase:',
        JSON.stringify(payload, null, 2),
      );
      console.log('ℹ️ [enviarConAxios] URL FCM:', this.FCM_URL);

      const headers = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };
      console.log('ℹ️ [enviarConAxios] Headers:', headers);

      const response = await axios.post(this.FCM_URL, payload, {
        headers,
      });

      console.log(
        '✅ [enviarConAxios] Notificación enviada con éxito. Respuesta:',
        JSON.stringify(response.data, null, 2),
      );

      return response.data;
    } catch (error: any) {
      console.error('❌ [enviarConAxios] Error al enviar la notificación.');
      console.error(
        '❌ [enviarConAxios] error.response?.status:',
        error?.response?.status,
      );
      console.error(
        '❌ [enviarConAxios] error.response?.data:',
        JSON.stringify(error?.response?.data, null, 2),
      );
      console.error(
        '❌ [enviarConAxios] error.message:',
        error?.message,
      );
      console.error('❌ [enviarConAxios] error completo:', error);

      throw new InternalServerErrorException(
        `No se pudo enviar la notificación: ${
          error?.response?.data?.error?.message || error.message
        }`,
      );
    }
  }

  /** 🔹 Guardar notificación en MongoDB */
  async createNotification(data: Partial<any>): Promise<any> {
    console.log(
      '🟡 [createNotification] Intentando guardar notificación en MongoDB...',
    );
    console.log(
      'ℹ️ [createNotification] Data de entrada:',
      JSON.stringify(data, null, 2),
    );

    try {
      const newNotification = new this.notificacionesModel({
        ...data,
        date: new Date(), // fecha de creación interna
      });
      const saved = await newNotification.save();

      console.log(
        '✅ [createNotification] Notificación guardada:',
        JSON.stringify(saved, null, 2),
      );
      return saved;
    } catch (error: any) {
      console.error(
        '❌ [createNotification] Error al guardar la notificación en la BD:',
        error?.message,
      );
      console.error('❌ [createNotification] Error completo:', error);
      throw new InternalServerErrorException(
        'Error al guardar la notificación.',
      );
    }
  }

  /** 🔹 Obtener todas las notificaciones */
  async getAllNotifications(): Promise<any[]> {
    console.log(
      '🟡 [getAllNotifications] Consultando todas las notificaciones...',
    );
    try {
      const results = await this.notificacionesModel
        .find()
        .sort({ date: -1 })
        .exec();

      console.log(
        `✅ [getAllNotifications] Notificaciones obtenidas: ${results.length}`,
      );
      return results;
    } catch (error: any) {
      console.error(
        '❌ [getAllNotifications] Error al obtener notificaciones:',
        error?.message,
      );
      console.error('❌ [getAllNotifications] Error completo:', error);
      throw new InternalServerErrorException(
        'Error al obtener las notificaciones.',
      );
    }
  }
}
