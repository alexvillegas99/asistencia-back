import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

import {
  PATH_PRIVATE_KEY,
  PATH_PUBLIC_KEY,
} from 'src/config/config.env';
import { ConfigService } from '@nestjs/config';
import { AppCliente } from './enum/AppCliente.enum';
@Injectable()
export class EncryptionService {

  //Keys BUS
  private PRIVATE_KEY: any;
  private PUBLIC_KEY: any;

  constructor(private readonly configService: ConfigService) {
    //Asignar valores correspondientes a las llaves
    //Llaves para el BUS
    this.PRIVATE_KEY = fs.readFileSync(
      this.configService.get(PATH_PRIVATE_KEY),
      'utf8',
    );
    this.PUBLIC_KEY = fs.readFileSync(
      this.configService.get(PATH_PUBLIC_KEY),
      'utf8',
    );
   
  }
  //! Cifrado************************************************************************************************************

  encryption(data: object): object {
    try {
    

      // Generar IV y clave secreta
      const { iv, secretKey } = this.generateIVAndSecretKey();

      // Encriptar el cuerpo con AES
      const Data = this.encryptAES(JSON.stringify(data), secretKey, iv);
      // Encriptar el IV y la clave secreta con RSA
      const IV = this.encryptRSA(iv, this.PUBLIC_KEY);
      const SessionKey = this.encryptRSA(secretKey, this.PUBLIC_KEY);
      //Retornar datos encriptados
      return { IV, SessionKey, Data };
    } catch (error) {
      return data;
    }
  }

  private generateRandomNumbers(length: number): string {
    const numbers = '0123456789';
    const randomNumbers = Array.from({ length }, () =>
      numbers.charAt(Math.floor(Math.random() * numbers.length)),
    );
    return randomNumbers.join('');
  }

  private generateIVAndSecretKey(): { iv: string; secretKey: string } {
    const iv = this.generateRandomNumbers(16);
    const secretKey = this.generateRandomNumbers(32);
    return { iv, secretKey };
  }

  private encryptAES(data: string, secretKey: string, iv: string): string {
    const cipher = crypto.createCipheriv('aes-256-cbc', secretKey, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  private encryptRSA(data: string, key: any): string {
    const dataBuffer = Buffer.from(data);
    const encryptedDataBuffer = crypto.publicEncrypt(key, dataBuffer);
    const encryptedDataBase64 = encryptedDataBuffer.toString('base64');
    return encryptedDataBase64;
  }
  //! Descifrado************************************************************************************************************

  decryption(data: any): any {
    try {
      const { IV, SessionKey, Data } = data;

   
      // Desencriptar el IV y la clave secreta con RSA

      const iv = this.decryptRSA(IV, this.PRIVATE_KEY);

      const secretKey = this.decryptRSA(SessionKey, this.PRIVATE_KEY);

      const decryptedData = this.decryptAES(Data, secretKey, iv);

      return JSON.parse(decryptedData);
    } catch (error) {
      console.log('data', data);
      console.log('Error en la desencriptacion', error);
      return data;
    }
  }

  private decryptAES(data: string, secretKey: string, iv: string): string {
    try {
      // Create a decipher object with AES-256-CBC algorithm, secret key, and IV
      const decipher = crypto.createDecipheriv('aes-256-cbc', secretKey, iv);

      // Update the decipher object with the encrypted data in base64 encoding
      let decrypted = decipher.update(data, 'base64', 'utf8');

      // Finalize the decipher object and append the remaining decrypted data
      decrypted += decipher.final('utf8');

      // Return the decrypted data
      return decrypted;
    } catch (error) {
      // Handle errors during decryption
      //console.error('Error during AES decryption:', error);
      return data;
    }
  }

  private decryptRSA(dataDecrypt: any, key: any): string {
    try {
      const encryptedDataBuffer = Buffer.from(dataDecrypt, 'base64');
      const decryptedData = crypto.privateDecrypt(key, encryptedDataBuffer);
      const decryptedDataString = decryptedData.toString('utf-8');
      return decryptedDataString;
    } catch (error) {
      //console.error('Error during RSA decryption:', error);
      throw error;
    }
  }
}
