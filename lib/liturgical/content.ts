/** actions/liturgical.ts 의 행과 동일 필드 */
export function hasLiturgicalContent(s: {
  title: string;
  announcement_detail: string;
  role_commentator: string;
  role_reader_1: string;
  role_reader_2: string;
  role_gospel_acclamation: string;
  thurifer_main: string;
  thurifer_sub: string;
  conductor: string;
  organist: string;
}): boolean {
  const fields = [
    s.title,
    s.announcement_detail,
    s.role_commentator,
    s.role_reader_1,
    s.role_reader_2,
    s.role_gospel_acclamation,
    s.thurifer_main,
    s.thurifer_sub,
    s.conductor,
    s.organist,
  ];
  return fields.some((x) => x.trim().length > 0);
}
