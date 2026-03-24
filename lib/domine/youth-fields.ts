/** 저장·표시 시 라벨 중복 방지 — 본문 앞의 "특기:", "장기:" 접두어 제거 */
export function normalizeYouthNotes(raw: string): string {
  return raw.replace(/^\s*특기\s*[:：]\s*/i, "").trim();
}

export function normalizeYouthTalents(raw: string): string {
  return raw.replace(/^\s*장기\s*[:：]\s*/i, "").trim();
}
