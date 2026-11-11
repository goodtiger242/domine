import type { PetAction } from "./pet";
import type { PetId } from "./pet-photos";

type Result = { data: unknown; error: { code?: string; message: string } | null };
type Rpc = (name: string, args: Record<string, string | number>) => PromiseLike<Result>;

/** 없는 함수에 한해서만 구버전으로 돌아간다. 미네 돌봄을 도미에게 보내지 않는다. */
export async function petRequest(rpc: Rpc, petId: PetId, nickname: string, action?: PetAction, legacy = false) {
  const name = action ? "domine_pet_care" : "domine_pet_state";
  const args = { p_nickname: nickname, ...(action ? { p_action: action } : {}) };
  if (!legacy) {
    const result = await rpc(`${name}_for`, { ...args, p_pet: petId });
    if (result.error?.code !== "PGRST202") return { ...result, petId, legacy: false };
  }
  if (action && petId !== 1) {
    return { data: null, error: { message: "미네는 아직 준비 중이에요." }, petId: 1 as const, legacy: true };
  }
  return { ...await rpc(name, args), petId: 1 as const, legacy: true };
}
