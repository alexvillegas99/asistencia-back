import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { UploadBase64ImageDto } from './dto/upload-base64-image.dto';
import axios from 'axios';
@Injectable()
export class AmazonS3Service {
  private s3: S3Client;
  private bucketName: string;
  private regionName: string;
  private logger = new Logger(AmazonS3Service.name);

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.get('AWS_S3_BUCKET_REGION'),
      credentials: {
        accessKeyId: this.configService.get('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get('AWS_SECRET_ACCESS_KEY'),
      },
    });
    this.bucketName = this.configService.get('AWS_S3_BUCKET_NAME');
    this.regionName = this.configService.get('AWS_S3_BUCKET_REGION');
  }

  async uploadBase64(body: UploadBase64ImageDto) {
    try {
      const imageName = uuidv4();
      const imageData = body.image.includes('data:')
        ? body.image.split(',')[1]
        : body.image;

      const params = {
        Bucket: this.bucketName,
        Key: `${body.route}/${imageName}`.replace(/\s+/g, ''),
        Body: Buffer.from(imageData, 'base64'),
        ContentType: 'image/jpeg',
      };
 
      const uploadCommand = new PutObjectCommand(params);
      const result = await this.s3.send(uploadCommand);

      let imageUrl = `https://${this.bucketName}.s3.${this.regionName}.amazonaws.com/${params.Key}`.replace(/\s+/g, '');
 

      return { imageUrl };
    } catch (error) {
      this.logger.error('Error al cargar la imagen:', error);
      
    }
  }

  async deleteImageByUrl(imageUrl: string) {
    try {
     /*  const data = imageUrl.split('/');
      const imageName = data[data.length - 1];

      const params = {
        Bucket: this.bucketName,
        Key:imageUrl,
      };
      const deleteCommand = new DeleteObjectCommand(params);
      await this.s3.send(deleteCommand);

      this.logger.log('Imagen eliminada correctamente.');
      return true; */
      return true;
    } catch (error) {
      this.logger.error('Error al eliminar la imagen:', error);
      return false;
    }
  }

  async getImageBase64(imageUrl: string): Promise<string> {
    try {
      // Descargar la imagen como un buffer de datos
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer', // Permite obtener los datos binarios
      });

      // Determinar el tipo de imagen (ej: 'image/png' o 'image/jpeg')
      const contentType = response.headers['content-type'];

      // Convertir la imagen a base64
      const base64String = Buffer.from(response.data, 'binary').toString('base64');

      // Formatear el string en base64 con el prefijo de tipo MIME
      return `data:${contentType};base64,${base64String}`;
    } catch (error) {
      console.error('Error al descargar la imagen:', error.message);
      throw new Error('No se pudo obtener la imagen en base64.');
    }
  }
}
