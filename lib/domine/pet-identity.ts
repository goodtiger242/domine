import { YOUTH_MEMBERS } from "../constants/youth-members";

export type PetIdentity = { nickname: string; secret: string };
// 게임은 다른 화면의 임시 숨김 설정과 관계없이 21명 전체를 사용한다.
export const PET_LEGAL_NAMES = YOUTH_MEMBERS.map((member) => member.legalName).sort((a, b) => a.localeCompare(b, "ko"));
export function normalizeNickname(raw: string) {
  const nickname = raw.normalize("NFC").replace(/\s/g, "");
  return /^[가-힣a-zA-Z0-9]{1,8}$/.test(nickname) && PET_LEGAL_NAMES.includes(nickname) ? nickname : null;
}
export async function secretForName(name: string): Promise<string> {
  const nickname = normalizeNickname(name);
  if (!nickname) throw new Error("INVALID_INPUT");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`domine-pet-v1:${nickname}`));
  return Array.from(new Uint8Array(hash), (v) => v.toString(16).padStart(2, "0")).join("");
}
export function registrationConfirmed(nickname: string) {
  try { return localStorage.getItem(`domine-pet-reg:${nickname.toLowerCase()}`) === "1"; } catch { return false; }
}
export function saveIdentity(identity: PetIdentity, confirmed = false) {
  const registrationKey = `domine-pet-reg:${identity.nickname.toLowerCase()}`;
  localStorage.setItem("domine-pet-nick", identity.nickname);
  if (localStorage.getItem("domine-pet-nick") !== identity.nickname) throw new Error("STORAGE_UNAVAILABLE");
  if (confirmed) localStorage.setItem(registrationKey, "1");
}
export function storageAvailable() {
  try { localStorage.setItem("domine-pet-storage-probe", "1"); localStorage.removeItem("domine-pet-storage-probe"); return true; } catch { return false; }
}
