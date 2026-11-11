"use client";
import { useState } from "react";
import { CATALOG, catalogHint } from "@/lib/domine/pet-catalog";
import type { PetCommand, V6Result } from "@/lib/domine/pet-rpc";
import PetSheet from "./PetSheet";
import PetItemIcon from "./PetItemIcon";
const seasonIds: Record<string, string[]> = { advent: ["081","082","083"], christmas: ["084","085","086"], lent: ["087","088","089"], triduum: ["088"], easter: ["090","091"], pentecost: ["090","091","092"] };
const explanations: Record<string, string> = {
  "081": "대림환의 촛불은 성탄을 기다리는 시간을 알려 줍니다.", "082": "대림은 주님의 오심을 기다리며 마음을 준비하는 시기입니다.", "083": "성탄 준비 봉사는 공동체가 함께 기쁨을 나누는 모습입니다.", "084": "구유는 아기 예수님의 탄생을 기억하게 합니다.", "085": "성탄 트리는 성탄의 기쁨을 나누는 장식입니다.", "086": "성탄 인사는 이웃과 평화와 기쁨을 나누는 말입니다.",
  "087": "사순의 보라색은 회개와 준비를 떠올리게 합니다.", "088": "십자가의 길은 예수님의 수난을 묵상하는 기도입니다.", "089": "나눔은 도움이 필요한 이웃을 향한 사랑의 실천입니다.",
  "090": "부활초는 부활하신 그리스도의 빛을 상징합니다.", "091": "부활 인사는 예수님의 부활과 희망을 함께 기뻐하는 말입니다.", "092": "성령 강림 대축일은 제자들에게 성령께서 오심을 기념합니다.",
};
export default function PetAlbumSheet({ state, disabled, notice, map, execute, onClose }: {
  state: V6Result | null; disabled: boolean; notice: string; map: string; execute: (c: PetCommand) => Promise<void>; onClose: () => void;
}) {
  const [detail, setDetail] = useState<string | null>(null);
  const [filter, setFilter] = useState("전체"), [category, setCategory] = useState("전체");
  const found = state?.album ?? [];
  const discovered = CATALOG.filter(i => found.includes(i.id)).length;
  const item = CATALOG.find(i => i.id === detail);
  const visible = CATALOG.filter(i => (category === "전체" || i.category === category) && (filter === "전체" || found.includes(i.id) === (filter === "발견")));
  return <PetSheet title="도감" onClose={onClose} onBack={() => { if (!detail) return false; setDetail(null); return true; }}
    toolbar={<>
      <label className="pet-album-progress">발견 {discovered} / {CATALOG.length}<progress value={discovered} max={CATALOG.length} /></label>
      <div className="pet-chips" role="group" aria-label="발견 필터">{["전체", "발견", "미발견"].map(value => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
      <div className="pet-chips" role="group" aria-label="도감 분류">{["전체", ...new Set(CATALOG.map(i => i.category))].map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>
    </>}
    footer={item && <section className="pet-album-detail" aria-label="도감 설명" aria-live="polite">
      <div><h3>{item.name}</h3><button type="button" aria-label="설명 닫기" onClick={() => setDetail(null)}>×</button></div>
      <p>{item.category} · {item.rarity} · {found.includes(item.id) ? "✓ 기록함" : "미발견"}</p>
      <p>{explanations[item.id] ?? catalogHint(item)}</p>
      {explanations[item.id] && <p>게임의 확인 기록이며 실제 미사 참석이나 신앙 활동의 증명은 아니에요.</p>}
      {item.storage === "device" && <p>기기 산책 기념 · 다음 단계 준비 중</p>}
    </section>}>
    {notice && <p className="pet-sheet-note" role="status">{notice}</p>}
    <div className="pet-catalog-grid pet-album-grid">{visible.map(item => <button type="button" key={item.id} className="pet-catalog-card" data-found={found.includes(item.id)} aria-pressed={detail === item.id} onClick={() => {
      setDetail(item.id);
      if (explanations[item.id] && !disabled && map === "church" && seasonIds[state?.season ?? ""]?.includes(item.id)) void execute({ kind: "record_season", entry: item.id, requestId: crypto.randomUUID() });
    }}>
      <PetItemIcon item={item} discovered={found.includes(item.id)} /><strong>{item.name}</strong>
      <span>{found.includes(item.id) ? "✓ 발견" : catalogHint(item)}</span>
    </button>)}</div>
    {!visible.length && <p className="pet-sheet-note">이 분류에는 아직 기록이 없어요.</p>}
  </PetSheet>;
}
