import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { NotificacionesService } from './notificaciones.service';
import { CreateNotificacioneDto } from './dto/create-notificacione.dto';
import { UpdateNotificacioneDto } from './dto/update-notificacione.dto';
import { ApiBody, ApiTags } from '@nestjs/swagger';
@ApiTags('notificaciones')
@Controller('notificaciones')
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService) {}

  @Get('token')
  async getFirebaseToken(): Promise<{ token: string }> {
    const token = await this.notificacionesService.getAccessToken();
    return { token };
  }

  
  @ApiBody({
    type: CreateNotificacioneDto,
    examples: {
      ejemplo1: {
        summary: "Ejemplo de notificación básica",
        value: {
          "message": {
            "topic": "all",
            "notification": {
              "title": "📢 Nuevo Curso Disponible",
              "body": "Aprende Flutter desde cero",
              "image": "https://i.pinimg.com/736x/15/bc/04/15bc04bfc0f824358e48de5a6dc2238d.jpg"
            },
            "data": {
              "curso": "Flutter",
              "nivel": "Básico",
              "duración": "8 semanas"
            }
          }
        }
      }
    }
  })
  
  @Post('enviar')
  async enviarNotificacion(@Body() notificacion: any) {
    return this.notificacionesService.enviarNotificacion(notificacion);
  }


  @Get()
  findAll() {
    return this.notificacionesService.getAllNotifications();
  }


  @Post('reenviar')
  reenviarNotificacion(@Body() notificacion: any) { 
    return this.notificacionesService.enviarConAxios(notificacion);
  }


}
