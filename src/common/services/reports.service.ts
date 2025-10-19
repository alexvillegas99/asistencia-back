import { Injectable, NotFoundException } from '@nestjs/common';
import PdfPrinter = require('pdfmake');
import * as dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

type TFont = {
  normal: string;
  bold: string;
  italics: string;
  bolditalics: string;
};

@Injectable()
export class ReportsService {
  // Marca de agua (PNG con transparencia)
  private readonly BG_URL =
    'https://corpfourier.s3.us-east-2.amazonaws.com/marca_agua/marca-reportes.png';

  // Rutas de fuentes (ajusta si las pones en otro lado)
  private readonly FONTS: Record<string, TFont> = {
    Roboto: {
      normal:       'src/assets/fonts/Roboto-Regular.ttf',
      bold:         'src/assets/fonts/Roboto-Medium.ttf',
      italics:      'src/assets/fonts/Roboto-Italic.ttf',
      bolditalics:  'src/assets/fonts/Roboto-MediumItalic.ttf',
    },
  };
private readonly COLORS = {
  prim: '#0e3a66',
  primSuave: '#EEF4FF',
  textoSuave: '#6B7280',
  borde: '#E6E6E6',
  cardBg: '#FFFFFF',
  headerBg: '#F7FAFF',
  zebra: '#FAFAFA',
};
  // ====== API principal ======
  async pdfNotasPorUsername(
    username: string,
    getCursosV2: (user: string) => Promise<any[]>,            // inyectas desde MoodleService
    getAsistenteByCedula: (ced: string) => Promise<any | null>, // inyectas desde AsistentesService
  ): Promise<{ buffer: Buffer; filename: string }> {

    const [cursos, asistente] = await Promise.all([
      getCursosV2(username),                  // estructura V2 que ya tienes
      getAsistenteByCedula(username).catch(() => null),
    ]);

    if (!Array.isArray(cursos)) {
      throw new NotFoundException('Sin cursos para generar PDF');
    }

    const nombre = asistente?.nombre ?? '-';
    const cursoNombre = asistente?.cursoNombre ?? '-';

    // imágenes (watermark) → dataURL
    const bgDataUrl = await this.fetchImageAsDataURL(this.BG_URL).catch(() => null);

    // docDefinition (MISMO DISEÑO que en el front)
    const docDefinition = this.buildDocDefinition({
      cursos,
      cedula: username,
      nombre,
      cursoNombre,
      bgDataUrl,
    });

    // Crea el PDF (pdfMake server)
    const printer = new PdfPrinter(this.FONTS);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks: Buffer[] = [];
    const result = await new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on('data', (c) => chunks.push(c));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', reject);
      pdfDoc.end();
    });

    return {
      buffer: result,
      filename: `reporte_notas_${username}.pdf`,
    };
  }

  // ===== util: traer imagen y devolver dataURL =====
  private async fetchImageAsDataURL(url?: string | null): Promise<string> {
    if (!url) throw new Error('No url');
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch fail');
    const buf = Buffer.from(await res.arrayBuffer());
    const base64 = buf.toString('base64');
    const mime = url.endsWith('.png') ? 'image/png'
               : url.endsWith('.jpg') || url.endsWith('.jpeg') ? 'image/jpeg'
               : 'image/png';
    return `data:${mime};base64,${base64}`;
  }

  // ===== docDefinition (portado del front con pequeños helpers) =====
  private buildDocDefinition(params: {
    cursos: any[];
    cedula: string;
    nombre: string;
    cursoNombre: string;
    bgDataUrl?: string | null;
  }): any {
    const { cursos, cedula, nombre, cursoNombre, bgDataUrl } = params;

    // helpers (idénticos a los del front)
    const fmt   = (v: any) => (v !== null && v !== undefined && v !== '' ? v : '—');
    const fmtDt = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const show  = (v: any) => (v === null || v === undefined || v === '' || v === '-' ? '—' : String(v));
    const un_   = (s: any) => String(s ?? '').replace(/_/g, ' ');
    const clean = (s: string) =>
      (s ?? '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>\s*<p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

    const prim = '#2b0b83';
    const primSuave = '#EEF4FF';
    const textoSuave = '#6B7280';
    const borde = '#E6E6E6';
    const cardBg = '#FFFFFF';
    const headerBg = '#F7FAFF';
    const zebra = '#FAFAFA';

    const ahora = new Date();
    const listaCursos = Array.isArray(cursos) ? cursos : [];

    const getSectionStats = (items: any[]) => {
      const total = items.find((g: any) => !g?.itemName || g.itemName.trim() === '');
      const visibles = items.filter((g: any) => g?.itemName && g.itemName.trim() !== '');

      const maxTotalCalc = visibles.reduce((a: number, g: any) => a + (+g.max || 0), 0);
      const calificados = visibles.filter((g: any) => g.graderaw != null && g.max != null);
      const maxCalificado = calificados.reduce((a: number, g: any) => a + (+g.max || 0), 0);
      const score = calificados.reduce((a: number, g: any) => a + (+g.graderaw || 0), 0);

      const baseMaxTotal = total?.max ?? maxTotalCalc;
      const baseScoreTotal = total?.graderaw ?? score;

      const percentSobreCalificados = maxCalificado > 0 ? +((100 * score) / maxCalificado).toFixed(2) : null;
      const percentSobreTotal = baseMaxTotal > 0 ? +((100 * baseScoreTotal) / baseMaxTotal).toFixed(2) : null;

      return {
        itemsCount: items.length,
        score, maxCalificado, maxTotal: baseMaxTotal,
        percentSobreCalificados, percentSobreTotal,
        hasExplicitTotal: !!total, gradedCount: calificados.length,
        pendingCount: visibles.length - calificados.length,
        visibles
      };
    };

    const barraBase = {
      table: { widths: ['*'], body: [[{ text: '', margin: [0,0,0,0] }]] },
      layout: {
        hLineWidth: () => 0, vLineWidth: () => 0,
        fillColor: () => primSuave,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 6, paddingBottom: () => 6,
      },
    };
    const barraValor = (percent: number | null) => ({
      table: {
        widths: [
          percent != null ? ({ width: `${Math.min(Math.max(percent, 0), 100)}%` } as any) : ({ width: 0 } as any),
          '*',
        ],
        body: [[{ text: '', fillColor: prim }, { text: '' }]],
      },
      layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0 },
      margin: [0, -12, 0, 0],
    });

    const leyenda = {
      margin: [0, 6, 0, 10],
      table: {
        widths: ['*'],
        body: [[{
          margin: [10,10,10,10],
          stack: [
            { text: 'Cómo leer la calificación', style: 'legendTitle', margin: [0,0,0,6] },
            {
              ul: [
                { text: [{ text: '1. Guion ( - )\n', bold: true }, 'Indica que la actividad aún no ha sido calificada por el docente.\n', 'La tarea o evaluación está registrada, pero el docente todavía no ingresa la nota.'] },
                { text: [{ text: '2. Calificación = 0\n', bold: true }, 'El docente revisó la actividad y otorgó la nota mínima.\n', 'Sucede cuando el estudiante no entregó la tarea o evaluación en la fecha asignada ni en el plazo extendido.'] },
                { text: [{ text: '3. Calificación diferente de 0\n', bold: true }, 'Es la nota real obtenida por el estudiante.\n', 'Refleja el desempeño según criterios establecidos.'] },
              ],
            },
          ],
        }]],
      },
      layout: {
        hLineWidth: () => 0.8, vLineWidth: () => 0.8,
        hLineColor: () => borde, vLineColor: () => borde,
        fillColor: () => cardBg,
        paddingLeft: () => 0, paddingRight: () => 0,
        paddingTop: () => 0, paddingBottom: () => 0,
      },
    };

    const cursoCards = listaCursos.map((c: any, idx: number) => {
      const gradesObj = c?.grades && typeof c.grades === 'object' ? c.grades : {};
      const secciones = Object.keys(gradesObj);

      const sectionCards = secciones.map((sec) => {
        const raw = Array.isArray(gradesObj[sec]) ? gradesObj[sec] : [];
        const items = raw.map((it: any) => ({
          itemName: un_(it?.itemName ?? it?.name ?? ''),
          idnumber: it?.idnumber ?? '',
          graderaw: (it?.graderaw === '-' || it?.graderaw === '' || it?.graderaw == null) ? null : +it.graderaw,
          max:      (it?.max      === '-' || it?.max      === '' || it?.max      == null) ? null : +it.max,
          gradedategraded: it?.gradedategraded ?? '',
          comentario: clean(it?.comentario ?? ''),
        }));

        const s = getSectionStats(items);

        return {
          margin: [0, 4, 0, 0],
          table: {
            widths: ['*'],
            body: [[{
              stack: [
                { margin: [8, 6, 8, 6], columns: [
                  { width: '*', text: `Sección ${un_(sec)}`, style: 'sectionTitle' },
                  { width: 'auto', text: `Total ítems: ${s.itemsCount}`, style: 'muted' },
                ]},
                { margin: [8, 0, 8, 6], stack: [
                  { text: s.percentSobreTotal !== null ? `Nota parcial (sobre total): ${s.score} / ${s.maxTotal} (${s.percentSobreTotal}%)${s.hasExplicitTotal ? '' : '  • calculado'}` : 'Nota parcial (sobre total): —', style: 'muted' },
                  ...(s.percentSobreCalificados !== null ? [{ text: `Avance (solo calificados): ${s.score} / ${s.maxCalificado} (${s.percentSobreCalificados}%)`, style: 'muted' }] : []),
                  { text: `Calificados: ${s.gradedCount}   •   Pendientes: ${s.pendingCount}`, style: 'muted' },
                ]},
                barraBase,
                barraValor(s.percentSobreTotal),
                {
                  margin: [0, 10, 0, 0],
                  table: {
                      headerRows: 1,
                        widths: ['*', 40, 40, 36, 100, 140],

                        body: [
                          [
                            { text: 'Actividad', style: 'th' },
                            { text: 'Nota', style: 'th', alignment: 'right' },
                            { text: 'Máx', style: 'th', alignment: 'right' },
                            { text: '%', style: 'th', alignment: 'right' },
                            { text: 'Fecha', style: 'th', alignment: 'right' },
                            { text: 'Comentario', style: 'th' },
                          ],
                          ...s.visibles.map((it: any) => {
                            const p =
                              it.graderaw != null && it.max && it.max > 0
                                ? Math.round(
                                    (it.graderaw / it.max) * 100 * 100
                                  ) / 100
                                : null;
                            return [
                              {
                                text: `${show(it.itemName)}  ·  ${show(
                                  it.idnumber
                                )}`,
                                style: 'td',
                              },
                              {
                                text: show(it.graderaw),
                                alignment: 'right',
                                style: 'td',
                              },
                              {
                                text: show(it.max),
                                alignment: 'right',
                                style: 'td',
                              },
                              {
                                text: p != null ? `${p}%` : '—',
                                alignment: 'right',
                                style: 'td',
                              },
                              {
                                text: show(it.gradedategraded),
                                alignment: 'right',
                                style: 'td',
                              },
                              {
                                text: show(it.comentario),
                                style: 'td',
                                noWrap: false,
                              },
                            ];
                          }),
                          [
                            { text: 'Total sección', style: 'tdTotal' },
                            {
                              text: show(s.score),
                              alignment: 'right',
                              style: 'tdTotal',
                            },
                            {
                              text: show(s.maxTotal),
                              alignment: 'right',
                              style: 'tdTotal',
                            },
                            {
                              text:
                                s.percentSobreTotal !== null
                                  ? `${s.percentSobreTotal}%`
                                  : '—',
                              alignment: 'right',
                              style: 'tdTotal',
                            },
                            { text: '', alignment: 'right', style: 'tdTotal' }, // fecha vacío
                            { text: '', style: 'tdTotal' }, // comentario vacío
                          ],
                        ],
                  },
                  layout: {
                    fillColor: (ri: number) => (ri === 0 ? prim : ri % 2 === 0 ? zebra : null),
                    hLineColor: () => borde, vLineColor: () => borde,
                    hLineWidth: (ri: number, node: any) => (ri === 0 || ri === node.table.body.length ? 0.8 : 0.5),
                    vLineWidth: () => 0.5,
                    paddingLeft:  () => 6, paddingRight: () => 6,
                    paddingTop:   () => 6, paddingBottom: () => 6,
                  },
                  dontBreakRows: false,
                  keepWithHeaderRows: 1,
                },
              ],
            }]],
          },
          layout: {
            hLineWidth: () => 0.8, vLineWidth: () => 0.8,
            hLineColor: () => '#F3F4F6', vLineColor: () => '#F3F4F6',
            fillColor: () => cardBg,
            paddingLeft:  () => 0, paddingRight: () => 0,
            paddingTop:   () => 0, paddingBottom: () => 0,
          },
        };
      });

      return {
        margin: [0, idx === 0 ? 0 : 10, 0, 0],
        table: {
          widths: ['*'],
          body: [[{
            stack: [
              {
                fillColor: headerBg,
                margin: [10, 10, 10, 10],
                columns: [
                  { width: '*', stack: [
                    { text: un_(c?.fullname || c?.shortname || `Curso ${idx + 1}`), style: 'courseTitle' },
                    { text: un_(c?.shortname || ''), style: 'muted' },
                  ]},
                  { width: 'auto', text: '', style: 'mutedStrong' },
                ],
              },
              ...sectionCards,
            ],
          }]],
        },
        layout: {
          hLineWidth: () => 0.8, vLineWidth: () => 0.8,
          hLineColor: () => '#F3F4F6', vLineColor: () => '#F3F4F6',
          fillColor: () => cardBg,
          paddingLeft:  () => 0, paddingRight: () => 0,
          paddingTop:   () => 0, paddingBottom: () => 0,
        },
      };
    });

    const docDefinition: any = {
      pageSize: 'A4',
      pageMargins: [28, 100, 28, 60],
      defaultStyle: { font: 'Roboto', fontSize: 9, color: '#2B2B2B' },
      images: { ...(bgDataUrl ? { fondo: bgDataUrl } : {}) },

      ...(bgDataUrl ? {
        background: (_page: number, pageSize: any) => {
          const bleed = 2;
          return {
            image: 'fondo',
            width: pageSize.width + bleed * 2,
            height: pageSize.height + bleed * 2,
            absolutePosition: { x: -bleed, y: -bleed },
          };
        },
      } : {}),

      header: () => ({
        margin: [28, 28, 28, 10],
        stack: [
          {
            table: {
              widths: ['*', '*'],
              body: [[
                { text: `NOMBRE: ${fmt(nombre)}`, style: 'chipLabel' },
                { text: `CÉDULA: ${fmt(cedula)}`, style: 'chipLabel', alignment: 'right' },
              ]],
            },
            layout: {
              hLineWidth: () => 0, vLineWidth: () => 0,
              paddingLeft: () => 10, paddingRight: () => 10,
              paddingTop: () => 6,  paddingBottom: () => 6,
              fillColor: () => primSuave,
            },
            margin: [0,0,0,4],
          },
          {
            table: { widths: ['auto', '*'], body: [[
              { text: 'CURSO', style: 'chipLabel' },
              { text: String(fmt(un_(cursoNombre))), style: 'chipValue' },
            ]]},
            layout: {
              hLineWidth: () => 0, vLineWidth: () => 0,
              paddingLeft: () => 10, paddingRight: () => 10,
              paddingTop: () => 6,  paddingBottom: () => 6,
              fillColor: () => primSuave,
            },
            margin: [0,0,0,4],
          },
          {
            columns: [
              { text: `Cursos: ${listaCursos.length}`, style: 'muted' },
              { text: `Generado: ${fmtDt(ahora)}`, style: 'muted', alignment: 'right' },
            ],
            margin: [0,2,0,0],
          },
        ],
      }),

      footer: (currentPage: number, pageCount: number) => ({
        margin: [28, 0, 28, 16],
        columns: [
          { text: `Generado por el sistema • ${fmtDt(ahora)}`, style: 'foot' },
          { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'foot' },
        ],
      }),

      content: [ leyenda, ...cursoCards ],

      styles: {
        legendTitle: { fontSize: 11, bold: true, color: '#111' },
        sectionTitle: { fontSize: 11, bold: true, color: '#111111' },
        chipLabel: { fontSize: 8, color: textoSuave, bold: true },
        chipValue: { fontSize: 10, color: '#111111' },
        muted: { fontSize: 9, color: textoSuave },
        foot: { fontSize: 8, color: '#808080' },
        courseTitle: { fontSize: 12, bold: true, color: prim },
        mutedStrong: { fontSize: 10, color: textoSuave, bold: true },
        th: { bold: true, color: '#FFFFFF' },
        td: { fontSize: 9 },
        tdTotal: { bold: true, fontSize: 9 },
      },
    };

    return docDefinition;
  }
  

  // ====== NUEVO: genera Ficha de OV por cédula ======
async pdfOVPorCedula(
  cedula: string,
  getAsistenteByCedula: (ced: string) => Promise<any | null>, // inyectas desde tu AsistentesService
): Promise<{ buffer: Buffer; filename: string }> {
  const asistente = await getAsistenteByCedula(cedula);
  if (!asistente) {
    throw new NotFoundException('No se encontró asistente para generar la Ficha OV');
  }

  // Marca de agua (misma mecánica que en tu reporte de calificaciones)
  const bgDataUrl = await this.fetchImageAsDataURL(this.BG_URL).catch(() => null);

  // Armamos docDefinition con el mismo look&feel del front
  const docDefinition = this.buildDocDefinitionOV({
    asistente,
    bgDataUrl,
  });

  // Crear PDF con las mismas fuentes que ya usas
  const printer = new (PdfPrinter as any)(this.FONTS);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  const chunks: Buffer[] = [];
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    pdfDoc.on('data', (c: Buffer) => chunks.push(c));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });

  return {
    buffer,
    filename: `ficha_ov_${cedula}.pdf`,
  };
}

// ====== NUEVO: constructor de docDefinition para OV ======
private buildDocDefinitionOV(params: {
  asistente: any;
  bgDataUrl?: string | null;
}): any {
  const { asistente, bgDataUrl } = params;

  // ===== Helpers locales (idénticos a los del front) =====
  const show = (v: any) =>
    v === null || v === undefined || v === '' ? '—' : String(v);

  const fmtDateTime = (v: any) => {
    try {
      const d = dayjs(v);
      return d.isValid() ? d.format('D MMM YYYY, HH:mm') : show(v);
    } catch {
      return show(v);
    }
  };

  const etapaLabel = (et?: string | null) => {
    switch (et) {
      case 'SIN_CITA': return 'Sin cita asignada';
      case 'PRIMERA':  return 'Primera cita';
      case 'SEGUNDA':  return 'Segunda cita';
      case 'TERCERA':  return 'Tercera cita';
      case 'CUARTA':   return 'Cuarta cita';
      default:         return show(et);
    }
  };

  const estadoLabel = (s?: string | null) => {
    switch (s) {
      case 'EN_PROCESO':     return 'En proceso';
      case 'COMPLETA':       return 'Completa';
      case 'NO_ASISTE':      return 'No asiste';
      case 'REAGENDAMIENTO': return 'Reagendamiento';
      default:               return '—';
    }
  };

  // ===== Colores iguales a los de calificaciones =====
const { prim, primSuave, textoSuave, borde, cardBg, headerBg, zebra } = this.COLORS;

  // ===== Normalización de datos =====
  const ov = asistente?.orientacionVocacional ?? {};
  const data = {
    cedula: show(asistente?.cedula),
    nombre: show(asistente?.nombre),
    cursoNombre: show(asistente?.cursoNombre),
    dealId: show(asistente?.negocio || asistente?.dealId),
    etapaActual: etapaLabel(ov?.etapaActual),
    siguienteCita: ov?.siguienteCitaISO ? fmtDateTime(ov?.siguienteCitaISO) : '—',
    generado: fmtDateTime(new Date()),
    etapas: {
      primera: ov?.primera ?? { estado: null, fechaISO: null, comentario: null, logs: [] },
      segunda: ov?.segunda ?? { estado: null, fechaISO: null, comentario: null, logs: [] },
      tercera: ov?.tercera ?? { estado: null, fechaISO: null, comentario: null, logs: [] },
      cuarta:  ov?.cuarta  ?? { estado: null, fechaISO: null, comentario: null, logs: [] },
    },
  };

  // ===== Helpers de layout =====
  const infoRow = (label: string, value: string) => ({
    columns: [
      { width: 140, text: label, style: 'muted' },
      { width: '*', text: value, style: 'td' },
    ],
    margin: [0, 2, 0, 2],
  });

  const etapaBlock = (
    key: 'primera' | 'segunda' | 'tercera' | 'cuarta',
    titulo: string,
  ) => {
    const st = data.etapas[key] ?? {
      estado: null,
      fechaISO: null,
      comentario: null,
      logs: [],
    };
    const logs = Array.isArray(st?.logs) ? st.logs : [];

    return {
      margin: [0, 10, 0, 0],
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  fillColor: headerBg,
                  margin: [10, 10, 10, 10],
                  columns: [
                    {
                      width: '*',
                      text: `${titulo} cita`,
                      style: 'sectionTitle',
                    },
                    {
                      width: 'auto',
                      alignment: 'right',
                      text: `Estado: ${estadoLabel(st?.estado)} · Fecha: ${show(st?.fechaISO ? fmtDateTime(st?.fechaISO) : '—')}`,
                      style: 'mutedStrong',
                    },
                  ],
                },
               /*  {
                  margin: [10, 0, 10, 6],
                  text: `Comentario: ${show(st?.comentario)}`,
                  style: 'td',
                }, */ 
                {
                  margin: [0, 6, 0, 0],
                  table: {
                    headerRows: 1,
                    widths: [120, 120, 120, '*'],
                    body: [
                      [
                        { text: 'Estado', style: 'th' },
                        { text: 'Fecha cita', style: 'th' },
                        { text: 'Registrado', style: 'th' },
                        { text: 'Comentario', style: 'th' },
                      ],
                      ...logs.map((l: any) => [
                        { text: estadoLabel(l?.estado), style: 'td' },
                        { text: show(l?.fechaISO ? fmtDateTime(l?.fechaISO) : '—'), style: 'td' },
                        { text: show(l?.tsISO ? fmtDateTime(l?.tsISO) : '—'), style: 'td' },
                        { text: show(l?.comentario), style: 'td' },
                      ]),
                    ],
                  },
                  layout: {
                    fillColor: (ri: number) =>
                      ri === 0 ? prim : ri % 2 === 0 ? zebra : null,
                    hLineColor: () => borde,
                    vLineColor: () => borde,
                    hLineWidth: (ri: number, node: any) =>
                      ri === 0 || ri === node.table.body.length ? 0.8 : 0.5,
                    vLineWidth: () => 0.5,
                    paddingLeft: () => 6,
                    paddingRight: () => 6,
                    paddingTop: (ri: number) => (ri === 0 ? 8 : 6),
                    paddingBottom: (ri: number) => (ri === 0 ? 8 : 6),
                  },
                  dontBreakRows: true,
                  keepWithHeaderRows: 1,
                },
              ],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.8,
        vLineWidth: () => 0.8,
        hLineColor: () => '#F3F4F6',
        vLineColor: () => '#F3F4F6',
        fillColor: () => cardBg,
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0,
      },
    };
  };

  // ===== Documento =====
  const docDefinition: any = {
    pageSize: 'A4',
    pageMargins: [28, 25, 28, 60],
    defaultStyle: { font: 'Roboto', fontSize: 9, color: '#2B2B2B' },

    images: { ...(bgDataUrl ? { fondo: bgDataUrl } : {}) },

    ...(bgDataUrl
      ? {
          background: (_page: number, pageSize: any) => {
            const bleed = 2;
            return {
              image: 'fondo',
              width: pageSize.width + bleed * 2,
              height: pageSize.height + bleed * 2,
              absolutePosition: { x: -bleed, y: -bleed },
              // opacity: 0.12, // opcional
            };
          },
        }
      : {}),

    header: () => ({
      margin: [28, 20, 28, 10],
      stack: [
        {
          table: {
            widths: ['*', '*'],
            body: [[
              { text: `NOMBRE: ${show(asistente?.nombre)}`, style: 'chipLabel' },
              { text: `CÉDULA: ${show(asistente?.cedula)}`, style: 'chipLabel', alignment: 'right' },
            ]],
          },
          layout: {
            hLineWidth: () => 0, vLineWidth: () => 0,
            paddingLeft: () => 10, paddingRight: () => 10,
            paddingTop: () => 6,  paddingBottom: () => 6,
            fillColor: () => primSuave,
          },
          margin: [0,0,0,4],
        },
        {
          table: { widths: ['auto', '*'], body: [[
            { text: 'CURSO', style: 'chipLabel' },
            { text: show(asistente?.cursoNombre), style: 'chipValue' },
          ]]},
          layout: {
            hLineWidth: () => 0, vLineWidth: () => 0,
            paddingLeft: () => 10, paddingRight: () => 10,
            paddingTop: () => 6,  paddingBottom: () => 6,
            fillColor: () => primSuave,
          },
          margin: [0,0,0,4],
        },
        {
          columns: [
            { text: `Etapa actual: ${data.etapaActual}`, style: 'muted' },
            { text: `Generado: ${data.generado}`,        style: 'muted', alignment: 'right' },
          ],
          margin: [0,2,0,0],
        },
      ],
    }),

    footer: (currentPage: number, pageCount: number) => ({
      margin: [28, 0, 28, 16],
      columns: [
        { text: `Generado por el sistema • ${data.generado}`, style: 'foot' },
        { text: `Página ${currentPage} de ${pageCount}`, alignment: 'right', style: 'foot' },
      ],
    }),

    content: [
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: [
                  {
                    fillColor: headerBg,
                    margin: [10, 10, 10, 10],
                    columns: [
                      { width: '*', text: 'Resumen del estudiante', style: 'sectionTitle' },
                      { width: 'auto', alignment: 'right', text: `Siguiente cita: ${data.siguienteCita}`, style: 'mutedStrong' },
                    ],
                  },
                  {
                    margin: [10, 0, 10, 8],
                    stack: [
                      infoRow('Cédula', data.cedula),
                      infoRow('Nombre', data.nombre),
                      infoRow('Curso',  data.cursoNombre),
                      infoRow('Deal/Negocio', data.dealId),
                    ],
                  },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.8,
          vLineWidth: () => 0.8,
          hLineColor: () => '#F3F4F6',
          vLineColor: () => '#F3F4F6',
          fillColor: () => cardBg,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
      },

      etapaBlock('primera', 'Primera'),
      etapaBlock('segunda', 'Segunda'),
      etapaBlock('tercera', 'Tercera'),
      etapaBlock('cuarta',  'Cuarta'),
    ],

    styles: {
      chipLabel: { fontSize: 8, color: textoSuave, bold: true },
      chipValue: { fontSize: 10, color: '#111111' },
      headerTitle:  { fontSize: 16, bold: true, color: prim },
      sectionTitle: { fontSize: 12, bold: true, color: prim },
      muted:        { fontSize: 9,  color: textoSuave },
      mutedStrong:  { fontSize: 10, color: textoSuave, bold: true },
      th:   { bold: true, color: '#FFFFFF' },
      td:   { fontSize: 9 },
      foot: { fontSize: 8, color: '#808080' },
    },
  };

  return docDefinition;
}

}
