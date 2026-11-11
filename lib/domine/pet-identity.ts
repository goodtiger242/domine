export type PetIdentity = { nickname: string; secret: string };
const PREFIX = "domine-pet-identity:";
export function normalizeNickname(raw: string) {
  const nickname = raw.normalize("NFC").trim();
  return /^[가-힣a-zA-Z0-9]{1,8}$/.test(nickname) ? nickname : null;
}
export function parseTransfer(raw: string): PetIdentity | null {
  const parts = raw.trim().split(":");
  const nickname = normalizeNickname(parts[0] ?? "");
  return parts.length === 2 && nickname && /^[0-9a-f]{64}$/.test(parts[1]) ? { nickname, secret: parts[1] } : null;
}
export function createSecret() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join("");
}
export function readIdentity(nickname: string): PetIdentity | null {
  const secret = localStorage.getItem(PREFIX + nickname.toLowerCase());
  return secret ? parseTransfer(`${nickname}:${secret}`) : null;
}
export function registrationConfirmed(nickname: string) {
  try { return localStorage.getItem(`domine-pet-reg:${nickname.toLowerCase()}`) === "1"; } catch { return false; }
}
export function saveIdentity(identity: PetIdentity, confirmed = false) {
  const registrationKey = `domine-pet-reg:${identity.nickname.toLowerCase()}`;
  if (readIdentity(identity.nickname)?.secret !== identity.secret) localStorage.removeItem(registrationKey);
  localStorage.setItem(PREFIX + identity.nickname.toLowerCase(), identity.secret);
  if (readIdentity(identity.nickname)?.secret !== identity.secret) throw new Error("STORAGE_UNAVAILABLE");
  localStorage.setItem("domine-pet-nick", identity.nickname);
  if (confirmed) localStorage.setItem(registrationKey, "1");
}
export function storageAvailable() {
  try { localStorage.setItem(PREFIX + "probe", "1"); localStorage.removeItem(PREFIX + "probe"); return true; } catch { return false; }
}
