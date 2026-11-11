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
  const [count, setCount] = useState(24), [detail, setDetail] = useState<string | null>(null);
  const found = state?.album ?? [];
  const core = CATALOG.filter((i) => i.core && found.includes(i.id)).length;
  return <PetSheet title="도감" onClose={onClose} onBack={() => { if (!detail) return false; setDetail(null); return true; }}>
    <p className="pet-sheet-note">상시 {core}/80 · 전례 기록 12 · 기기 산책 기념 4</p>
    <p className="pet-sheet-note" role="status">{notice || "맵 이동·산책 뒤 같은 맵에서 15초 머무르면 탐색해요. 발견 확률 75%, 발견 시 일반 65% · 특별 25% · 희귀 8% · 아주 드묾 2%. 새 발견 없이 4회면 다음 탐색에서 가능한 미발견 하나를 보장해요."}</p>
    {detail ? <div className="pet-product-detail"><button type="button" onClick={() => setDetail(null)}>‹ 목록으로</button><h3>{CATALOG.find((i) => i.id === detail)?.name}</h3><p>{explanations[detail]}</p><p>게임의 확인 기록이며 실제 미사 참석이나 신앙 활동의 증명은 아니에요.</p></div>
      : <><div className="pet-catalog-grid">{CATALOG.slice(0, count).map((item) => <div key={item.id} className="pet-catalog-card" data-found={found.includes(item.id)}>
        <PetItemIcon item={item} discovered={found.includes(item.id)} /><small>{item.id} · {item.rarity}</small><strong>{item.name}</strong><span>{found.includes(item.id) ? item.condition : catalogHint(item)}{item.storage === "device" ? " · 다음 단계 준비 중" : ""}</span>
        {explanations[item.id] && <button type="button" onClick={() => { setDetail(item.id); if (!disabled && map === "church" && seasonIds[state?.season ?? ""]?.includes(item.id)) void execute({ kind: "record_season", entry: item.id, requestId: crypto.randomUUID() }); }}>설명 읽기{found.includes(item.id) ? " ✓" : ""}</button>}
        {found.includes(item.id) && <small>✓ 기록함</small>}
      </div>)}</div>{count < 96 && <button type="button" className="pet-more" onClick={() => setCount(count + 24)}>24개 더 보기 ({count}/96)</button>}</>}
  </PetSheet>;
}
