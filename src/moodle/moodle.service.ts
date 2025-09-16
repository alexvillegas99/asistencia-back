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
      timeout: 15000,
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
    console.log('Data grades:', data?.usergrades?.[0]?.gradeitems);
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

  /**
   * Devuelve cursos del usuario con sus ítems de nota.
   * - Estructura "limpia"
   * - Fechas formateadas a ISO o a zona local si quieres
   * - Paraleliza la consulta de notas por curso
   */
/*   async getCoursesWithGradesByUsername(username: string, userId?: number) {
    // 1) resolver userId si no viene
    let user = userId ? null : await this.getUserByUsername(username);
    const uid = userId ?? user?.id;
    if (!uid) throw new BadRequestException('Usuario no encontrado');

    // 2) cursos
    const courses = await this.getUserCourses(uid);

    // 3) paralelizar las notas por curso
    const perCourse = await Promise.all(
      courses.map(async (c: any) => {
        const fromOverview = c?.overviewfiles?.[0]?.fileurl as
          | string
          | undefined;
        const image =
          c?.courseimage && String(c.courseimage).trim() !== ''
            ? (c.courseimage as string)
            : fromOverview;

        // notas del usuario en ese curso
        const gradeItems = await this.getUserGradesForCourse(c.id, uid);
        console.log(`Notas para el curso ${c.id}:`, gradeItems);

        // limpiar / mapear ítems
        const grades = gradeItems.map((it) => ({
          itemId: it.itemid, // si no viene este campo o es vacio no enviart y si eel curtso no tiene items no mostrar 
          itemName: it.itemname ?? '',
          graderaw: it.graderaw ?? null,
          grade: it.grade, // puede venir como número o string formateado
          percentage: it.percentage, // ej. "85.00 %"
          gradedategraded: it.gradedategraded
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
          // si te llega gradedategraded en el WS, formateamos:
          // gradedAt: it.gradedategraded ? new Date(it.gradedategraded * 1000).toISOString() : null,
        }));

        return {
          id: c.id,
          shortname: c.shortname ?? '',
          fullname: c.fullname ?? '',
          image: image ?? null,

          grades, // array de ítems con sus notas
        };
      }),
    );

    const dtfEC = new Intl.DateTimeFormat('es-EC', {
      timeZone: 'America/Guayaquil',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

   
    return perCourse;
  } */
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


}
