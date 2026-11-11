import type { Actor, Move, SupportEffect } from "./types";

const stats = { attack: "공격", defense: "방어", speed: "민첩", focus: "집중", calm: "침착" };
export const SUPPORT_ROLES = ["energy", "buff", "disrupt", "recover", "prepare", "read", "momentum"] as const;
export function supportScale(actor: Actor, id: string) {
  return actor.supportChain?.id !== id ? 1 : actor.supportChain.count === 1 ? .7 : .4;
}
export function supportDescription(move: Move): string {
  const s = move.support;
  if (!s) return "";
  const effects = [
    move.buff ? `${stats[move.buff]} +${Math.round((s.rate ?? .2) * 100)}% · ${s.rounds}라운드` : "",
    s.debuff ? `상대 ${stats[s.debuff]} −${Math.round((s.rate ?? .2) * 100)}% · ${s.rounds}라운드` : "",
    move.status ? "혼란 65% · 2라운드" : "",
    move.heal ? `체력 ${Math.round(move.heal * 100)}~${Math.round((move.heal + (s.lowHeal ?? 0)) * 100)}% 회복` : "",
    s.cleanse ? "정화·1라운드 면역" : "",
    s.nextPower ? `다음 공격 +${Math.round(s.nextPower * 100)}%` : "",
    s.nextCritical ? `급소 +${s.nextCritical}%p` : "",
    s.read ? "버릇 반복 시 비접촉 반격 35%" : "",
    s.nextGuard ? `다음 방어 +${Math.round(s.nextGuard * 100)}%` : "",
    s.momentum ? `기세 +${s.momentum} · 한 판 최대 60` : "",
    s.restore ? `기력 +${s.restore}` : "",
    s.discount ? `다음 기술 −${s.discount}` : "",
  ];
  return effects.filter(Boolean).join(" · ");
}
export function redesignSupport(move: Move): Move {
  if (move.kind !== "support") return move;
  const role = move.support?.role ?? (move.heal ? "recover" : "buff");
  const effects: Record<SupportEffect["role"], SupportEffect> = {
    energy: { role, restore: 3, discount: 1 },
    buff: { role, rate: .2, rounds: 3, nextPower: .65 },
    disrupt: { role, debuff: "attack", rate: .3, rounds: 3, restore: 2 },
    recover: { role, cleanse: true, lowHeal: .04 },
    prepare: { role, nextPower: .65, nextCritical: 15 },
    read: { role, read: .35, nextGuard: .2 },
    momentum: { role, momentum: 50 },
  };
  const support = { ...effects[role], ...move.support };
  const result = { ...move, support, energy: role === "recover" ? 2 : move.energy,
    ...(role === "buff" ? { buff: move.buff ?? "attack" as const } : {}),
    ...(role === "recover" ? { heal: .06 } : {}),
    ...(role === "disrupt" ? { status: "blur" as const, chance: 65 } : {}),
  };
  return { ...result, description: supportDescription(result) };
}
