"use client";
import { useRef, useState } from "react";
import { SHOP, type CatalogEntry } from "@/lib/domine/pet-catalog";
import type { PetCommand, V6Result } from "@/lib/domine/pet-rpc";
import { PETS, type PetId } from "@/lib/domine/pet-photos";
import PetSheet from "./PetSheet";
import PetItemIcon from "./PetItemIcon";
export default function PetShopSheet({ state, petId, disabled, notice, execute, onClose, bag = false, onSelectPet, onShop, multiPet = true }: {
  bag?: boolean; state: V6Result | null; petId: PetId; disabled: boolean; notice: string; execute: (c: PetCommand) => Promise<void>; onClose: () => void;
  onSelectPet?: (id: PetId) => void; onShop?: () => void; multiPet?: boolean;
}) {
  const [selected, setSelected] = useState<CatalogEntry | null>(null);
  const [done, setDone] = useState("");
  const [asked, setAsked] = useState<{ id: string; on: boolean } | null>(null);
  const [category, setCategory] = useState("전체"), [confirm, setConfirm] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const busy = useRef(false);
  const dog = PETS[petId].name, coins = state?.coins ?? state?.player?.coins ?? 0;
  const owned = (item: CatalogEntry) => state?.inventory?.includes(item.id);
  const equipped = (item: CatalogEntry) => state?.equipment?.some((e) => e.pet_id === petId && e.item_id === item.id);
  const blocked = disabled || pending !== null;
  function back() { if (confirm) { setConfirm(false); return true; } if (!selected) return false; setSelected(null); return true; }
  async function act(item: CatalogEntry, purchase = false) {
    if (disabled || busy.current) return;
    if (purchase && coins < (item.price ?? 0)) {
      setDone(`코인이 부족해요 · 보유 ${coins} / 필요 ${item.price} (${(item.price ?? 0) - coins}코인 더 필요)`); setConfirm(false); return;
    }
    if (purchase && !confirm) { setConfirm(true); return; }
    busy.current = true; setPending(item.id); setDone(""); setConfirm(false);
    const on = !equipped(item);
    if (!purchase) setAsked({ id: item.id, on });
    try {
      await execute(purchase
        ? { kind: "purchase", pet: petId, item: item.id, requestId: crypto.randomUUID() }
        : { kind: "equip", pet: petId, slot: item.slot!, item: on ? item.id : null, requestId: crypto.randomUUID() });
    } catch { setDone("요청을 확인하지 못했어요. 잠시 후 다시 확인해 주세요."); }
    finally { busy.current = false; setPending(null); }
  }
  const applied = asked && SHOP.find(item => item.id === asked.id);
  const status = done || (applied && owned(applied) ? (!!equipped(applied) === asked.on
    ? asked.on ? `${dog}에게 착용했어요` : `${dog}의 착용을 해제했어요`
    : blocked ? "적용하는 중이에요…" : "아직 적용되지 않았어요. 잠시 뒤 다시 눌러 주세요.") : "");
  const feedback = <>{notice && <p className="pet-sheet-note" role="status">{notice}</p>}{status && <p className="pet-purchase-check" role={done || (applied && !!equipped(applied) !== asked.on) ? "alert" : "status"}>{status}</p>}</>;
  return <PetSheet title={bag ? `${dog}의 가방` : "상점"} onClose={onClose} onBack={back}
    toolbar={<>
      {bag && onSelectPet && <div className="pet-chips" role="group" aria-label="가방 강아지 선택">{([1, 2] as const).filter(id => multiPet || id === 1).map(id => <button type="button" key={id} aria-pressed={petId === id} disabled={blocked} onClick={() => { if (id === petId) return; setAsked(null); setDone(""); onSelectPet(id); }}>{PETS[id].name}</button>)}</div>}
      <p className="pet-shop-coins">우리 코인(공용) {coins} · {dog}</p>
      {!bag && <div className="pet-chips" role="group" aria-label="상품 분류">{["전체", "옷", "장난감"].map(value => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{value}</button>)}</div>}
    </>}
    panel={!bag && selected && <div className="pet-product-detail">
      <button type="button" onClick={() => { setSelected(null); setConfirm(false); }}>‹ 목록으로</button>
      <PetItemIcon key={selected.id} item={selected} />
      <h3>{selected.name}</h3><p>{selected.price} 코인 · {selected.category}</p>
      {owned(selected) && <span className="pet-purchase-check">✓ {dog} 보유</span>}
      {owned(selected) && <span className="pet-purchase-check">{equipped(selected) ? `✓ ${dog}가 착용 중이에요` : `${dog}는 아직 안 입었어요`}</span>}
      {!owned(selected) && coins < (selected.price ?? 0) && <p>{(selected.price ?? 0) - coins}코인 부족</p>}
      {feedback}
    </div>}
    footer={!bag && selected ? <>
      {confirm && !owned(selected) && <p role="status">{dog}용으로 {selected.price}코인에 살까요?</p>}
      <div className="pet-footer-actions">
        {confirm && !owned(selected) && <button type="button" disabled={blocked} onClick={() => setConfirm(false)}>취소</button>}
        <button type="button" className="pet-primary" disabled={blocked} onClick={() => void act(selected, !owned(selected))}>
          {pending === selected.id ? "처리 중…" : owned(selected) ? equipped(selected) ? "착용 해제" : `${dog}에게 착용하기` : confirm ? "구매 확인" : `${dog}용 구매 · ${selected.price} 코인`}
        </button>
      </div>
    </> : bag && state?.inventory?.length === 0 && onShop ? <button type="button" className="pet-primary" onClick={onShop}>상점 가기</button> : undefined}>
    {feedback}
    {bag && <section className="pet-equipped" aria-label="지금 착용 중"><h3>지금 착용 중</h3>{(["wearable", "toy"] as const).map(slot => {
      const item = SHOP.find(item => item.slot === slot && equipped(item));
      return <div className="pet-equipped-row" key={slot}><span>{slot === "wearable" ? "옷" : "장난감"}</span>{item ? <><PetItemIcon key={item.id} item={item} /><strong>{item.name}</strong><button type="button" disabled={blocked} aria-label={`${item.name} 착용 해제`} onClick={() => void act(item)}>해제</button></> : <span>없음</span>}</div>;
    })}</section>}
    {bag && !state?.inventory && <p className="pet-sheet-note" role="status">{disabled ? "가방을 불러오는 중…" : "기록 메뉴에서 이름을 선택해 주세요."}</p>}
    {bag && state?.inventory?.length === 0 && <p className="pet-sheet-note">아직 가진 물건이 없어요. 상점에서 코인으로 살 수 있어요.</p>}
    <div className="pet-catalog-grid pet-shop-grid">{SHOP.filter(item => bag ? owned(item) : category === "전체" || item.category === category).map(item => <button type="button" key={item.id} className="pet-catalog-card" data-equipped={!!equipped(item)} aria-pressed={bag ? !!equipped(item) : undefined} disabled={bag && blocked} onClick={() => { if (bag) { void act(item); return; } setSelected(item); setDone(""); setAsked(null); setConfirm(false); }}>
      <PetItemIcon item={item} /><strong>{item.name}</strong><span className={!owned(item) && coins < (item.price ?? 0) ? "pet-price-short" : undefined}>{equipped(item) ? `✓ ${dog} 착용 중` : owned(item) ? `✓ ${dog} 보유` : `${item.price} 코인`}</span>
      {!owned(item) && coins < (item.price ?? 0) && <small>{(item.price ?? 0) - coins}코인 부족</small>}
      {pending === item.id && <small role="status">적용 중…</small>}
    </button>)}</div>
  </PetSheet>;
}
