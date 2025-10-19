// src/modules/skool/certificate/certificate.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { CertificateRepo } from './repos/certificate.repo';
import { IssueCertificateDto } from './dto/issue-certificate.dto';
import { EnrollmentRepo } from '../enrollment/repos/enrollment.repo';
import { CourseRepo } from '../course/repos/course.repo';
import { CommunityRepo } from '../community/repos/community.repo';
import { AmazonS3Service } from '../../../amazon-s3/amazon-s3.service';
import PDFDocument = require('pdfkit');
import QRCode = require('qrcode');

function randCode(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

@Injectable()
export class CertificateService {
  constructor(
    private readonly repo: CertificateRepo,
    private readonly enrollments: EnrollmentRepo,
    private readonly courses: CourseRepo,
    private readonly communities: CommunityRepo,
    private readonly s3: AmazonS3Service,
  ) {}

  // URL pública de verificación (ajústala a tu dominio/front)
  private buildVerifyUrl(code: string) {
    return `https://tu-dominio.com/verify/certificate/${code}`;
  }

  async issue(dto: IssueCertificateDto) {
    const e = await this.enrollments.findById(dto.enrollmentId);
    if (!e) throw new NotFoundException('Matrícula no encontrada');
    if (e.status !== 'completed') throw new BadRequestException('La matrícula no está completada');

    // datos de contexto
    const course = await this.courses.findById(String(e.courseId));
    if (!course) throw new NotFoundException('Curso no encontrado');
    const communityId = course.communityId as any;
    const community = await this.communities.findById(String(communityId));

    // ¿ya emitido para este enrollment?
    const prev = await this.repo.findOne({ enrollmentId: e._id, status: 'issued' as any });
    if (prev) return prev;

    // construir snapshot “congelado”
    const snapshot = {
      studentName: dto.studentName ?? (e.userId ? 'Usuario Interno' : 'Usuario Externo'),
      courseTitle: dto.courseTitle ?? course.title,
      communityName: dto.communityName ?? community?.name ?? '',
      scorePercent: dto.scorePercent ?? 100,
    };

    const code = randCode(12);
    const verifyUrl = this.buildVerifyUrl(code);
    const pdfBuffer = await this.renderPdf({
      studentName: snapshot.studentName!,
      courseTitle: snapshot.courseTitle!,
      communityName: snapshot.communityName!,
      verifyUrl,
    });

    // sube a S3 (PDF → base64 data URL y usa tu uploadBase64)
    const base64 = pdfBuffer.toString('base64');
    const route = `skool/certificates/${communityId}/${course._id}`;
    const { key, imageUrl } = await this.s3.uploadBase64({
      image: `data:application/pdf;base64,${base64}`,
      route,
      contentType: 'application/pdf',
    });

    const doc = await this.repo.create({
      communityId: new Types.ObjectId(communityId),
      courseId: new Types.ObjectId(course._id),
      enrollmentId: new Types.ObjectId(e._id),
      userId: e.userId ? new Types.ObjectId(e.userId) : undefined,
      externalUserId: e.externalUserId ? new Types.ObjectId(e.externalUserId) : undefined,
      code,
      issuedAt: new Date(),
      pdfKey: key,
      verifyUrl,
      status: 'issued',
      snapshot,
    });

    return { ...doc, pdfUrl: imageUrl }; // si tu bucket es público; si es privado, presign GET al servir
  }

  async get(id: string) {
    const c = await this.repo.findById(id);
    if (!c) throw new NotFoundException('Certificado no encontrado');
    return c;
  }

  list(params: { communityId?: string; courseId?: string; userId?: string; externalUserId?: string; status?: string; limit?: number; skip?: number }) {
    const f: any = {};
    if (params.communityId) f.communityId = new Types.ObjectId(params.communityId);
    if (params.courseId) f.courseId = new Types.ObjectId(params.courseId);
    if (params.userId) f.userId = new Types.ObjectId(params.userId);
    if (params.externalUserId) f.externalUserId = new Types.ObjectId(params.externalUserId);
    if (params.status) f.status = params.status;
    return this.repo.list(f, params.limit ?? 50, params.skip ?? 0);
  }

  // público: verificación por código
  async verifyByCode(code: string) {
    const cert = await this.repo.findOne({ code, status: 'issued' });
    if (!cert) throw new NotFoundException('Código inválido o certificado revocado');
    // si el bucket es privado, devuelve URL firmada
    const url = cert.pdfKey ? await this.s3.presignGet({ key: cert.pdfKey }) : undefined;
    return {
      code: cert.code,
      issuedAt: cert.issuedAt,
      courseTitle: cert.snapshot?.courseTitle,
      studentName: cert.snapshot?.studentName,
      communityName: cert.snapshot?.communityName,
      pdfUrl: url ?? (cert as any).pdfUrl, // si quedó pública
      status: cert.status,
    };
  }

  async revoke(id: string) {
    const c = await this.repo.updateById(id, { status: 'revoked' as any });
    if (!c) throw new NotFoundException('Certificado no encontrado');
    return c;
  }

  // ---------- PDF generator ----------
  private async renderPdf(input: { studentName: string; courseTitle: string; communityName: string; verifyUrl: string; }) {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks: Buffer[] = [];
    doc.on('data', (d) => chunks.push(d));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

    // Cabecera
    doc.fontSize(18).text(input.communityName, { align: 'center' });
    doc.moveDown(1.5);
    doc.fontSize(28).text('CERTIFICADO DE FINALIZACIÓN', { align: 'center' });
    doc.moveDown(2);

    // Cuerpo
    doc.fontSize(12).text('Se certifica que', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(22).text(input.studentName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text('ha completado satisfactoriamente el curso', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(20).text(`“${input.courseTitle}”`, { align: 'center' });
    doc.moveDown(2);

    // QR de verificación
    const qrDataUrl = await QRCode.toDataURL(input.verifyUrl, { margin: 1, scale: 6 });
    const base64 = qrDataUrl.split(',')[1];
    const qrBuffer = Buffer.from(base64, 'base64');
    const x = (doc.page.width - 120) / 2;
    doc.image(qrBuffer, x, doc.y, { width: 120 }).moveDown(1.2);
    doc.fontSize(10).fillColor('#666').text('Verifica este certificado en:', { align: 'center' });
    doc.fontSize(10).fillColor('#000').text(input.verifyUrl, { align: 'center', link: input.verifyUrl, underline: true });
    doc.moveDown(2);
    doc.fillColor('#000');

    // Firma/fecha
    const today = new Date().toISOString().slice(0,10);
    doc.fontSize(10).text(`Emitido el: ${today}`, { align: 'center' });

    doc.end();
    return done;
  }
}
