"use client";
import { useEffect, useState } from "react";
import { groupHistory, historyText } from "@/lib/domine/pet-history";
import { timeAgo } from "@/lib/domine/pet";
import type { PetApi, PetHistoryEntry } from "@/lib/domine/pet-rpc";
import PetSheet from "./PetSheet";

export function PetHistoryList({ entries }: { entries: PetHistoryEntry[] }) {
  return <ul className="pet-history" aria-label="최근 활동">{groupHistory(entries).map((row, index) => <li key={`${row.at}-${index}`}>
    {historyText(row)} · <time dateTime={row.at}>{timeAgo(row.at)}</time>
  </li>)}</ul>;
}

export default function PetHistorySheet({ history, onClose }: { history: PetApi["history"]; onClose: () => void }) {
  const [entries, setEntries] = useState<PetHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    history().then(rows => { if (active) setEntries(rows); }).catch(() => {
      if (active) setError("이력을 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [history]);
  return <PetSheet title="함께한 이력" onClose={onClose}>
    <p role="status" className="pet-sheet-note">{loading ? "이력을 불러오는 중…" : error || (!entries.length ? "아직 이력이 없어요." : "")}</p>
    <PetHistoryList entries={entries} />
  </PetSheet>;
}
