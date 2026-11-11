"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createKingPickup, recoverKingBattles, watchingLine, retryKing, type KingApi } from "@/lib/domine/pet-king-client";
import { purchaseReason } from "@/lib/domine/pet-king-items";
import { encounterSlot } from "@/lib/domine/pet-battle-view";
import type { PetIdentity } from "@/lib/domine/pet-identity";
import type { KingPickupResult, KingSpawn, KingState, KingWatching, KingPet, KingProgress, KingSettlement } from "@/lib/domine/pet-king-rpc";

export function usePetKing(api: KingApi, identity: PetIdentity | null, cell: string, arrivalId: number | undefined, pickupReady: boolean, refreshWallet: (wallet?: KingSettlement["wallet"]) => Promise<void>, enabled = true) {
  const [pendingPurchase, setPendingPurchase] = useState<{ pet: KingPet; item: string } | null>(null);
  const [state, setState] = useState<KingState | null>(null);
  const [departed, setDeparted] = useState<KingSpawn[]>([]);
  const [watching, setWatching] = useState<KingWatching[]>([]);
  const [now, setNow] = useState(Date.now);
  const [pickup, setPickup] = useState<(KingPickupResult & { id: number; cell: string }) | null>(null);
  const current = useRef(identity), sequence = useRef(0);
  current.current = identity;
  const [claim] = useState(createKingPickup);
  const reading = useRef(false), failures = useRef(0), nextRead = useRef(0);
  const queuedRead = useRef<(() => void) | null>(null);
  const refresh = useCallback(async (): Promise<void> => {
    if (!identity) return;
    if (reading.current) { queuedRead.current = () => { void refresh(); }; return; }
    reading.current = true;
    const seq = ++sequence.current;
    try {
      const reply = await retryKing(() => api.state(identity));
      if (current.current !== identity || sequence.current !== seq) return;
      if (reply.supported && reply.ok && reply.data) {
        const data = reply.data;
        setState(previous => !previous || previous.resetEpoch !== data.resetEpoch || data.version >= previous.version ? data : previous);
        setDeparted(data.departed); setWatching(data.watching);
        if (enabled && !document.hidden && navigator.onLine !== false) {
          const recovered = await recoverKingBattles(api, identity, data);
          if (current.current !== identity || sequence.current !== seq) return;
          for (const result of recovered.results) {
            if (result.progress) setState(previous => previous ? { ...previous,
              ...(result.wallet && result.wallet.version >= previous.version ? result.wallet : {}),
              pets: previous.pets.map(p => p.pet === result.progress!.pet && result.progress!.version >= p.version ? result.progress! : p) } : previous);
            await refreshWallet(result.wallet);
          }
          if (recovered.changed) queuedRead.current = () => { void refresh(); };
        }
      }
      failures.current = 0; nextRead.current = 0; setNow(Date.now());
    } catch { nextRead.current = Date.now() + Math.min(240000, 30000 * 2 ** failures.current++); }
    finally { reading.current = false; const queued = queuedRead.current; queuedRead.current = null; queued?.(); }
  }, [api, identity, enabled, refreshWallet]);
  useEffect(() => {
    setState(null); setDeparted([]); setWatching([]); setPickup(null); purchase.current = null; setPendingPurchase(null);
  }, [identity]);
  useEffect(() => {
    if (!enabled) return;
    const update = () => { if (!document.hidden && navigator.onLine !== false) void refresh(); };
    update();
    const timer = setInterval(() => { if (Date.now() >= nextRead.current) update(); }, 30000);
    document.addEventListener("visibilitychange", update); window.addEventListener("online", update);
    return () => { clearInterval(timer); sequence.current++; queuedRead.current = null; document.removeEventListener("visibilitychange", update); window.removeEventListener("online", update); };
  }, [refresh, cell, enabled]);
  useEffect(() => {
    const entry = watching.find(w => w.cell === cell && w.nickname !== identity?.nickname && Date.parse(w.startedAt) + 180000 > now);
    if (!entry) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, Date.parse(entry.startedAt) + 180000 - Date.now()));
    return () => clearTimeout(timer);
  }, [watching, cell, identity, now]);
  const location = useRef(cell);
  const arrival = useRef("");
  location.current = cell;
  useEffect(() => {
    if (!identity || !pickupReady || !enabled || document.hidden || navigator.onLine === false) return;
    const visit = `${identity.nickname}:${state?.resetEpoch}:${cell}:${arrivalId ?? 0}:${Math.floor(now / 1800000)}`;
    if (arrival.current === visit) return;
    arrival.current = visit;
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Use session memory. */ }
    void claim(api, identity, cell, encounterSlot(), storage, state?.resetEpoch).then(result => {
      if (!result && arrival.current === visit) arrival.current = "";
      if (current.current !== identity || !result?.found) return;
      if (location.current === cell) setPickup({ ...result, cell, id: Date.now() });
      void refreshWallet(); void refresh();
    });
  }, [api, identity, cell, arrivalId, pickupReady, claim, refreshWallet, refresh, enabled, now, state?.resetEpoch]);
  useEffect(() => {
    if (!pickup) return;
    const timer = setTimeout(() => setPickup(null), 900);
    return () => clearTimeout(timer);
  }, [pickup]);
  const mergeProgress = useCallback((progress: KingProgress, wallet = progress.wallet) => {
    sequence.current++;
    setState(previous => !previous ? previous : { ...previous,
      ...(wallet && wallet.version >= previous.version ? { coins: wallet.coins, version: wallet.version } : {}),
      pets: previous.pets.map(p => p.pet === progress.pet && progress.version >= p.version ? progress : p) });
  }, []);
  const purchasing = useRef(false);
  const purchase = useRef<{ pet: KingPet; item: string; id: string } | null>(null);
  const buyItem = useCallback(async (pet: KingPet, item: string) => {
    if (!identity || purchasing.current) return "잠시 후 다시 눌러 주세요";
    const reason = purchaseReason(state,pet,item);
    if (reason && !(purchase.current?.pet === pet && purchase.current.item === item)) return reason;
    purchasing.current = true;
    if (purchase.current && (purchase.current.pet !== pet || purchase.current.item !== item)) { purchasing.current = false; return "이전 물품의 구매 결과를 먼저 확인해 주세요"; }
    const requestId = (purchase.current ??= { pet, item, id: crypto.randomUUID() }).id;
    setPendingPurchase({pet,item});
    try {
      const reply = await retryKing(() => api.buyItem(identity, requestId, { pet, item, quantity: 1 }));
      purchase.current = null; setPendingPurchase(null);
      if (current.current !== identity) return "";
      if (!reply.supported) return "전투 물품을 준비 중이에요";
      if (!reply.ok || !reply.data) return ({ INVENTORY_CAP: "최대 9개까지 보유해요", INSUFFICIENT_COINS: "코인이 부족해요" } as Record<string,string>)[reply.code] ?? "구매하지 못했어요";
      mergeProgress(reply.data);
      await Promise.allSettled([refresh(), refreshWallet()]);
      return "구매했어요";
    } catch { await refresh(); return "구매 결과를 확인하지 못했어요"; }
    finally { purchasing.current = false; }
  }, [api, identity, state, mergeProgress, refresh, refreshWallet]);
  const settled = useCallback((result?: KingSettlement) => {
    if (current.current !== identity) return;
    if (result?.progress) mergeProgress(result.progress, result.wallet);
    void refresh(); void refreshWallet(result?.wallet);
  }, [identity, refresh, refreshWallet, mergeProgress]);
  return { state, buyItem, pendingPurchase, refresh, departed, pickup: pickup?.cell === cell ? pickup : null, settled,
    watching: watchingLine(watching, cell, identity?.nickname ?? "", now) };
}
