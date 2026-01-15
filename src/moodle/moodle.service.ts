import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
@Injectable()
export class MoodleService {

  private readonly baseUrl: string;
  private readonly token: string;
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = config.get<string>('MOODLE_BASE_URL') ?? '';
    this.token = config.get<string>('MOODLE_TOKEN') ?? '';

    if (!this.baseUrl || !this.token) {
      throw new Error('Config MOODLE_BASE_URL/MOODLE_TOKEN faltante');
    }

    // Instancia de axios con timeout global
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 25000,
    });
  }

  /** Helper para llamar a cualquier wsfunction de Moodle REST (formato JSON) */
  private async call<T>(
    wsfunction: string,
    params: Record<string, any>,
  ): Promise<T> {
    const search = new URLSearchParams({
      wstoken: this.token,
      wsfunction,
      moodlewsrestformat: 'json',
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [k, String(v)]),
      ),
    }).toString();

    const { data } = await this.http.get<T>(`?${search}`);

    // Si Moodle retorna error del WS, viene como {exception, errorcode,...}
    if ((data as any)?.exception) {
      throw new BadRequestException(
        (data as any)?.message || 'Moodle WS error',
      );
    }
    return data;
  }

  // 1) core_user_get_users_by_field
  async getUserByUsername(username: string): Promise<any | null> {
    const data = await this.call<any[]>('core_user_get_users_by_field', {
      field: 'username',
      'values[0]': username,
    });
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0] as any;
  }

  // 2) core_enrol_get_users_courses
  async getUserCourses(userId: number): Promise<any[]> {
    const data = await this.call<any[]>('core_enrol_get_users_courses', {
      userid: userId,
    });
    return Array.isArray(data) ? data : [];
  }

  // 3) gradereport_user_get_grade_items
  async getUserGradesForCourse(
    courseId: number,
    userId: number,
  ): Promise<any[]> {
    const data = await this.call<any>('gradereport_user_get_grade_items', {
      courseid: courseId,
      userid: userId,
    });
    const items: any[] = data?.usergrades?.[0]?.gradeitems ?? [];
    return items.map((it) => ({
      courseid: courseId,
      idnumber: it.idnumber === '' || !it.idnumber ? null : it.idnumber,
      itemid: it.id,
      gradedategraded: it.gradedategraded,
      //new Date(1750827060 * 1000); convertido a fecha
      graderaw: it.graderaw ?? null,
      itemname: it.itemname,
      grade: it.gradeformatted ?? (it as any).graderaw ?? null,
      percentage: it.percentageformatted ?? null,
      grademin: it.grademin,
      grademax: it.grademax,
      categoryid: it.categoryid,
      comentario:it.feedback
    }));
  }

  /** Orquesta el flujo: username -> user -> courses -> grades[] */
  async getGradesReportByUsername(username: string, userId?: number) {
    let user = userId ? null : await this.getUserByUsername(username);
    const uid = userId ?? user?.id;
    if (!uid) throw new BadRequestException('Usuario no encontrado');

    const fullname =
      user?.fullname ??
      `${user?.firstname ?? ''} ${user?.lastname ?? ''}`.trim();

    const courses = await this.getUserCourses(uid);
    const results: any[] = [];

    for (const c of courses) {
      const rows = await this.getUserGradesForCourse(c.id, uid);
      results.push(...rows);
    }

    return {
      userId: uid,
      fullname,
      totalCourses: courses.length,
      rows: results,
    };
  }
  async getCleanCoursesByUsername(username: string, userId?: number) {
    // 1) resolver userId si no viene
    let user = userId ? null : await this.getUserByUsername(username);
    const uid = userId ?? user?.id;
    if (!uid) throw new BadRequestException('Usuario no encontrado');

    // 2) traer cursos
    const courses = await this.getUserCourses(uid);

    // 3) mapear limpio
    const clean = courses.map((c) => {
      // preferimos courseimage; si no hay, overviewfiles[0].fileurl
      const fromOverview = (c as any)?.overviewfiles?.[0]?.fileurl as
        | string
        | undefined;

      const image =
        (c as any)?.courseimage && String((c as any).courseimage).trim() !== ''
          ? ((c as any).courseimage as string)
          : fromOverview;

      return {
        id: c.id,
        shortname: (c as any).shortname ?? '',
        fullname: (c as any).fullname ?? '',
        image: image ?? null,
      };
    });

    // 4) (opcional) ordenar por fullname

    return {
      userId: uid,
      count: clean.length,
      courses: clean,
    };
  }


async getCoursesWithGradesByUsername(username: string, userId?: number) {
  let user = userId ? null : await this.getUserByUsername(username);
  const uid = userId ?? user?.id;
  if (!uid) throw new BadRequestException('Usuario no encontrado');

  const courses = (await this.getUserCourses(uid)) ?? [];

  const perCourse = await Promise.all(
    courses.map(async (c: any) => {
      if (!c?.id) return null; // ⚠️ curso inválido → descartamos

      const fromOverview = c?.overviewfiles?.[0]?.fileurl as string | undefined;
      const image =
        c?.courseimage && String(c.courseimage).trim() !== ''
          ? (c.courseimage as string)
          : fromOverview;

      const gradeItems = (await this.getUserGradesForCourse(c.id, uid)) ?? [];

      // 🔑 Ahora filtramos SOLO los que tengan idnumber válido
      const grades = gradeItems
        .filter((it) => it?.idnumber && String(it.idnumber).trim() !== '')
        .map((it) => ({
          itemId: it.itemid ?? null,   // opcional, por si igual quieres verlo
          idnumber: it.idnumber,       // ✅ criterio principal
          itemName: it.itemname ?? '',
          graderaw: it.graderaw ?? null,
          grade: it.grade ?? null,
          percentage: it.percentage ?? null,
          gradedategraded: it?.gradedategraded
            ? new Intl.DateTimeFormat('es-EC', {
                timeZone: 'America/Guayaquil',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(new Date(it.gradedategraded * 1000))
            : null,
          min: it.grademin ?? null,
          max: it.grademax ?? null,
          categoryid: it.categoryid ?? null,
        }));
 
      return grades.length > 0
        ? {
            id: c.id,
            shortname: c.shortname ?? '',
            fullname: c.fullname ?? '',
            image: image ?? null,
            grades,
          }
        : null; // ⚠️ si no tiene ningún idnumber válido → descartamos el curso
    }),
  );

  // descartamos cursos nulos o indefinidos
  return perCourse.filter((c): c is NonNullable<typeof c> => c != null);
}

async getCoursesWithGradesByUsernameV2(username: string, userId?: number) {
  let user = userId ? null : await this.getUserByUsername(username);
  const uid = userId ?? user?.id;
  if (!uid) throw new BadRequestException('Usuario no encontrado');

  const courses = (await this.getUserCourses(uid)) ?? [];

  const perCourse = await Promise.all(
    courses.map(async (c: any) => {
      if (!c?.id) return null;

      const fromOverview = c?.overviewfiles?.[0]?.fileurl as string | undefined;
      const image =
        c?.courseimage && String(c.courseimage).trim() !== ''
          ? (c.courseimage as string)
          : fromOverview;

      const gradeItems = (await this.getUserGradesForCourse(c.id, uid)) ?? [];

      // Solo con idnumber válido
      const validItems = gradeItems.filter(
        (it) => it?.idnumber && String(it.idnumber).trim() !== '',
      );

      // Agrupar por sección calculada
      const grouped: Record<string, any[]> = {};
      for (const it of validItems) {
        const section = getSectionFromIdnumber(it.idnumber);
        if (!grouped[section]) grouped[section] = [];

        grouped[section].push({
          itemId: it.itemid ?? null,
          idnumber: String(it.idnumber).trim().toUpperCase(),
          itemName: it.itemname ?? '',
          graderaw: it.graderaw ?? null,
          grade: it.grade ?? null,
          percentage: it.percentage ?? null,
          gradedategraded: it?.gradedategraded
            ? new Intl.DateTimeFormat('es-EC', {
                timeZone: 'America/Guayaquil',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(new Date(it.gradedategraded * 1000))
            : null,
          min: it.grademin ?? null,
          max: it.grademax ?? null,
          categoryid: it.categoryid ?? null,
          comentario:it.comentario
        });
      }

      return Object.keys(grouped).length > 0
        ? {
            id: c.id,
            shortname: c.shortname ?? '',
            fullname: c.fullname ?? '',
            image: image ?? null,
            grades: grouped, // { A: [...], B: [...], Z: [...], Otros: [...] }
          }
        : null;
    }),
  );

  return perCourse.filter((c): c is NonNullable<typeof c> => c != null);
}

async getCoursesWithGradesByUsernameV3(username: string, userId?: number) {
  // ── Helpers de saneo ─────────────────────────────────────────────────────────
  const isValidIdnumber = (v: any): boolean => {
    const s = String(v ?? "").trim();
    return s.length > 0;
  };

  const normalizeName = (v: any): string =>
    String(v ?? "").replace(/\s+/g, " ").trim();

  const isValidName = (v: any): boolean => {
    const s = normalizeName(v);
    if (!s) return false;              // vacío o solo espacios
    if (s === "-" || s === "—") return false;
    return true;
  };

  // Acepta 0 (cero), enteros y decimales; permite string numérico ("45", "19.5").
  const hasNumberGrade = (v: any): boolean => {
    if (v === 0 || v === "0") return true;
    if (v === null || v === undefined) return false;
    const s = String(v).trim();
    if (!s || s === "-" || s === "—") return false;
    const n = Number(s);
    return Number.isFinite(n);
  };

  // ── Resolución de usuario ────────────────────────────────────────────────────
  const user = userId ? null : await this.getUserByUsername(username);
  const uid = userId ?? user?.id;
  if (!uid) throw new BadRequestException("Usuario no encontrado");

  // ── Cursos del usuario ───────────────────────────────────────────────────────
  const courses = (await this.getUserCourses(uid)) ?? [];

  const perCourse = await Promise.all(
    courses.map(async (c: any) => {
      if (!c?.id) return null;

      const fromOverview = c?.overviewfiles?.[0]?.fileurl as string | undefined;
      const image =
        c?.courseimage && String(c.courseimage).trim() !== ""
          ? (c.courseimage as string)
          : fromOverview;

      // Calificaciones crudas
      const gradeItems = (await this.getUserGradesForCourse(c.id, uid)) ?? [];

      // 1) idnumber válido
      // 2) nombre válido
      // 3) graderaw numérico
      const validItems = gradeItems.filter(
        (it) =>
          isValidIdnumber(it?.idnumber) &&
          isValidName(it?.itemname) &&
          hasNumberGrade(it?.graderaw),
      );

      // Agrupar por sección calculada
      const grouped: Record<string, any[]> = {};
      for (const it of validItems) {
        const section = getSectionFromIdnumber(it.idnumber); // ← tu helper existente
        if (!grouped[section]) grouped[section] = [];

        grouped[section].push({
          itemId: it.itemid ?? null,
          idnumber: String(it.idnumber).trim().toUpperCase(),
          itemName: normalizeName(it.itemname),
          // ya garantizamos que es numérico → casteamos a number
          graderaw: Number(String(it.graderaw).trim()),
          grade: it.grade ?? null,
          percentage: it.percentage ?? null,
          gradedategraded: it?.gradedategraded
            ? new Intl.DateTimeFormat("es-EC", {
                timeZone: "America/Guayaquil",
                day: "2-digit",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }).format(new Date(it.gradedategraded * 1000))
            : null,
          min: it.grademin ?? null,
          max: it.grademax ?? null,
          categoryid: it.categoryid ?? null,
          comentario: it.comentario,
        });
      }

      // Quitar secciones vacías por si acaso
      const cleanedSections: Record<string, any[]> = {};
      for (const key of Object.keys(grouped)) {
        if (Array.isArray(grouped[key]) && grouped[key].length > 0) {
          cleanedSections[key] = grouped[key];
        }
      }

      // Si no quedó ninguna sección con elementos, descartar el curso
      if (Object.keys(cleanedSections).length === 0) return null;

      return {
        id: c.id,
        shortname: c.shortname ?? "",
        fullname: c.fullname ?? "",
        image: image ?? null,
        grades: cleanedSections, // { A: [...], B: [...], ... }
      };
    }),
  );

  // Solo cursos válidos
  return perCourse.filter((c): c is NonNullable<typeof c> => c != null);
}




}
// Helper: determina sección a partir del idnumber
function getSectionFromIdnumber(idnumber: any): string {
  if (!idnumber) return 'Otros';
  const id = String(idnumber).trim().toUpperCase();

  // Dos primeras letras iguales (AA, BB, ..., ZZ) => sección = esa letra
  // ^([A-Z])\1  => captura una letra y verifica que la siguiente sea la misma
  const m = id.match(/^([A-Z])\1/);
  if (m) return m[1]; // 'A', 'B', ..., 'Z'

  return 'Otros';
}

