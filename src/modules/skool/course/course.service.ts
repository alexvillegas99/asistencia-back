// src/modules/skool/course/course.service.ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CourseRepo } from './repos/course.repo';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { MediaService } from '../media/media.service';

function simpleSlug(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}



@Injectable()
export class CourseService {
  constructor(
    private readonly repo: CourseRepo,
    private readonly media: MediaService,
  ) {}

  async create(dto: CreateCourseDto) {
    try {
      const communityId = new Types.ObjectId(dto.communityId);
      const slugBase = simpleSlug(dto.title);
      if (!slugBase) throw new BadRequestException('Título inválido');

      // slug único
      let slug = slugBase; 
      let i = 1;
      while (await this.repo.findOne({ slug })) slug = `${slugBase}-${i++}`;

      // Si viene base64, lo subimos y obtenemos un mediaId listo
      let coverMediaId: Types.ObjectId | undefined;
      if (dto.coverImageBase64) {
        const { mediaId, url } = await this.media.uploadBase64({
          image: dto.coverImageBase64,
          // carpeta destino en S3 (ajústala a tu gusto)
          route: `skool/${dto.communityId}/course-covers`,
          contentType: dto.coverImageContentType, // opcional; si es dataURL no es necesario
        });
        coverMediaId = new Types.ObjectId(mediaId);
      } else if (dto.coverMediaId) {
        coverMediaId = new Types.ObjectId(dto.coverMediaId);
      }

      const data: any = {
        communityId,
        title: dto.title.trim(),
        slug,
        category: dto.category?.trim(),
        description: dto.description ?? '',
        visibility: dto.visibility ?? 'private',
        status: dto.status ?? 'draft',
        sortIndex: dto.sortIndex ?? 0,
        ...(coverMediaId ? { coverMediaId } : {}),
      };

      return await this.repo.create(data);
    } catch (error: any) {
      throw new BadRequestException(
        'Error al crear el curso: ' + (error?.message || error),
      );
    }
  }

  async findById(id: string) {
    const course = await this.repo.findById(id);
    if (!course) throw new NotFoundException('Curso no encontrado');
    return course;
  }

  async list(params: {
    communityId?: string;
    q?: string;
    visibility?: string;
    status?: string;
    limit?: number;
    skip?: number;
  }) {
    const filter: any = {};
    if (params.communityId)
      filter.communityId = new Types.ObjectId(params.communityId);
    if (params.visibility) filter.visibility = params.visibility;
    if (params.status) filter.status = params.status;
    if (params.q) {
      filter.$or = [
        { title: new RegExp(params.q, 'i') },
        { category: new RegExp(params.q, 'i') },
        { description: new RegExp(params.q, 'i') },
      ];
    }
    return this.repo.list(filter, params.limit ?? 50, params.skip ?? 0);
  }

async update(id: string, dto: any) {
  try {
    console.log(dto)
    // Traemos el curso actual para conocer communityId (por ruta S3) y comparar slug
    const current = await this.repo.findById(id);
    if (!current) throw new NotFoundException('Curso no encontrado');

    const upd: any = {};

    // --- Campos simples ---
    if (dto.title) upd.title = dto.title.trim();
    if (typeof dto.category === 'string') upd.category = dto.category.trim();
    if (typeof dto.description === 'string') upd.description = dto.description;
    if (dto.visibility) upd.visibility = dto.visibility;
    if (dto.status) upd.status = dto.status;
    if (typeof dto.sortIndex === 'number') upd.sortIndex = dto.sortIndex;

    // Si permiten mover el curso de comunidad (opcional)
    let targetCommunityId: Types.ObjectId = current.communityId as any;
    if (dto.communityId) {
      targetCommunityId = new Types.ObjectId(dto.communityId);
      upd.communityId = targetCommunityId;
    }

    // --- Slug: si llega título o slug, normalizamos + garantizamos unicidad si cambió ---
    if (dto.slug || dto.title) {
      const base = simpleSlug(dto.slug ?? dto.title ?? current.slug);
      if (!base) throw new BadRequestException('Slug/título inválido');

      let newSlug = base;
      if (newSlug !== current.slug) {
        let i = 1;
        while (await this.repo.findOne({ slug: newSlug })) newSlug = `${base}-${i++}`;
        upd.slug = newSlug;
      }
    }

    // --- Portada: 4 vías ---
    // 4.1 Eliminar portada
    if (dto.coverRemove === true || dto.coverMediaId === null) {
      upd.$unset = { ...(upd.$unset || {}), coverMediaId: 1 };
    }

    // 4.2 coverMediaId directo
    if (typeof dto.coverMediaId === 'string' && dto.coverMediaId) {
      upd.coverMediaId = new Types.ObjectId(dto.coverMediaId);
    }

    // 4.3 coverImageBase64 (data URL)
    if (dto.coverImageBase64) {
      const dataUrl = isDataUrl(dto.coverImageBase64)
        ? dto.coverImageBase64
        : `data:${dto.coverImageContentType || 'image/jpeg'};base64,${dto.coverImageBase64}`;

      const { mediaId } = await this.media.uploadBase64({
        image: dataUrl,
        route: `skool/${String(targetCommunityId)}/course-covers`,
        contentType: dto.coverImageContentType, // opcional
      });
      upd.coverMediaId = new Types.ObjectId(mediaId);
    }

    // 4.4 coverImageUrl (http/https o data URL)
    if (dto.coverImageUrl) {
      let dataUrl: string;
      let contentType: string | undefined;


      const { mediaId } = await this.media.uploadBase64({
        image: dataUrl,
        route: `skool/${String(targetCommunityId)}/course-covers`,
        contentType,
      });
      upd.coverMediaId = new Types.ObjectId(mediaId);
    }

    // Si por error llega coverMediaId vacío, evitamos poner ObjectId('').
    if (upd.coverMediaId === '') delete upd.coverMediaId;

    // --- Persistimos ---
    const course = await this.repo.updateById(id, upd);
    if (!course) throw new NotFoundException('Curso no encontrado');

    return course;
  } catch (err: any) {
    console.error('[CourseService.update] error:', err);
    throw new BadRequestException('Error al actualizar el curso: ' + (err?.message || err));
  }
}


  async remove(id: string) {
    const course = await this.repo.deleteById(id);
    if (!course) throw new NotFoundException('Curso no encontrado');
    return { ok: true };
  }
}
function isDataUrl(v?: string) {
  return !!v && /^data:([a-z]+\/[a-z0-9+.-]+)?;base64,/.test(v);
}

// ¿es http/https?
function isHttpUrl(v?: string) {
  return !!v && /^https?:\/\//i.test(v);
}

