import { resolveYouthMemberLegalName } from "@/lib/constants/youth-members";

/** 전례 편집의 반주 필드에 노출할 반주 가능 멤버 목록 */
export const LITURGICAL_ORGANIST_LEGAL_NAMES = [
  "김혜수",
  "김보영",
  "김슬기",
  "송도훈",
  "유이진",
] as const;

const organistLegalNames = new Set<string>(LITURGICAL_ORGANIST_LEGAL_NAMES);

export function isLiturgicalOrganistName(name: string): boolean {
  const legal = resolveYouthMemberLegalName(name);
  return legal !== null && organistLegalNames.has(legal);
}
