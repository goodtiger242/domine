"use client";
import { useEffect, useState } from "react";
import { CATALOG } from "@/lib/domine/pet-catalog";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import { timeAgo } from "@/lib/domine/pet";
import type { PetApi, PetHistoryEntry } from "@/lib/domine/pet-rpc";
import PetSheet from "./PetSheet";

export function historyText(row: PetHistoryEntry) {
  const dog = PETS[row.pet].name, who = `${row.nickname}님이`;
  switch (row.kind) {
    case "action": {
      const actions: Record<string, string> = { feed: "밥을 줬어요", treat: "간식을 줬어요", pet: "쓰다듬어 줬어요", play: "함께 놀아 줬어요", walk: "산책을 시켜 줬어요", brush: "빗질을 해 줬어요", bath: "목욕을 시켜 줬어요", train: "훈련을 해 줬어요" };
      return `${who} ${dog}에게 ${actions[row.detail ?? ""] ?? "돌봄을 해 줬어요"}`;
    }
    case "purchase": return `${who} ${dog}에게 ${CATALOG.find(item => item.id === row.detail)?.name ?? "물건"} 구매했어요`;
    case "equip": return row.detail ? `${who} ${dog}에게 ${CATALOG.find(item => item.id === row.detail)?.name ?? "물건"} 착용해 줬어요` : `${who} ${dog}의 착용을 해제했어요`;
    case "levelup": return `${row.nickname}님과 ${dog} Lv.${row.detail} 달성`;
    case "discover": return `${who} 새 도감 발견 · ${CATALOG.find(item => item.id === row.detail)?.name ?? "새 기록"}`;
  }
}

export function PetHistoryList({ entries }: { entries: PetHistoryEntry[] }) {
  return <ul className="pet-history" aria-label="최근 활동">{entries.map((row, index) => <li key={`${row.at}-${index}`}>
    <time dateTime={row.at}>{timeAgo(row.at)}</time> · {historyText(row)}
  </li>)}</ul>;
}

export default function PetHistorySheet({ history, onClose }: { history: PetApi["history"]; onClose: () => void }) {
  const [pet, setPet] = useState<PetId | null>(null);
  const [entries, setEntries] = useState<PetHistoryEntry[]>([]);
  const [refresh, setRefresh] = useState(0), [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    history().then(rows => { if (active) setEntries(rows); }).catch(() => {
      if (active) setError("이력을 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [history, refresh]);
  return <PetSheet title="함께한 이력" onClose={onClose}>
    <p className="pet-sheet-note">모두가 함께한 최근 30건 · 최대 100건, 14일간 보관해요.</p>
    <button type="button" disabled={loading} onClick={() => { setLoading(true); setError(""); setRefresh(n => n + 1); }}>새로고침</button>
    <p role="status" className="pet-sheet-note">{loading ? "이력을 불러오는 중…" : error || (!entries.length ? "아직 이력이 없어요." : "")}</p>
    <div className="pet-chips" role="group" aria-label="이력 강아지 필터">{([null, 1, 2] as const).map(id => <button type="button" key={id ?? "all"} aria-pressed={pet === id} onClick={() => setPet(id)}>{id === null ? "전체" : PETS[id].name}</button>)}</div>
    <PetHistoryList entries={entries.filter(row => pet === null || row.pet === pet)} />
  </PetSheet>;
}
