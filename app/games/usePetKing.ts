"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createKingPickup, watchingLine, type KingApi } from "@/lib/domine/pet-king-client";
import { encounterSlot } from "@/lib/domine/pet-battle-view";
import type { PetIdentity } from "@/lib/domine/pet-identity";
import type { KingPickupResult, KingSpawn, KingState, KingWatching } from "@/lib/domine/pet-king-rpc";

export function usePetKing(api: KingApi, identity: PetIdentity | null, cell: string, arrivalId: number | undefined, pickupReady: boolean, refreshWallet: () => Promise<void>) {
  const [state, setState] = useState<KingState | null>(null);
  const [departed, setDeparted] = useState<KingSpawn[]>([]);
  const [watching, setWatching] = useState<KingWatching[]>([]);
  const [now, setNow] = useState(Date.now);
  const [pickup, setPickup] = useState<(KingPickupResult & { id: number; cell: string }) | null>(null);
  const current = useRef(identity), sequence = useRef(0);
  current.current = identity;
  const [claim] = useState(createKingPickup);
  const refresh = useCallback(async () => {
    if (!identity) return;
    const seq = ++sequence.current;
    const replies = await Promise.allSettled([api.state(identity), api.spawns(identity), api.watching(identity)]);
    if (current.current !== identity || sequence.current !== seq) return;
    const [growth, spawns, live] = replies;
    if (growth.status === "fulfilled" && growth.value.supported && growth.value.ok && growth.value.data) {
      const data = growth.value.data;
      setState(previous => !previous || data.version >= previous.version ? data : previous);
    }
    if (spawns.status === "fulfilled" && spawns.value.supported && spawns.value.ok && spawns.value.data) setDeparted(spawns.value.data.departed);
    if (live.status === "fulfilled" && live.value.supported && live.value.ok && live.value.data) setWatching(live.value.data);
    setNow(Date.now());
  }, [api, identity]);
  useEffect(() => {
    setState(null); setDeparted([]); setWatching([]); setPickup(null);
  }, [identity]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    return () => { clearInterval(timer); sequence.current++; };
  }, [refresh, cell]);
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
    if (!identity || !pickupReady) return;
    const visit = `${identity.nickname}:${cell}:${arrivalId ?? 0}`;
    if (arrival.current === visit) return;
    arrival.current = visit;
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Use session memory. */ }
    void claim(api, identity, cell, encounterSlot(), storage).then(result => {
      if (current.current !== identity || !result?.found) return;
      if (location.current === cell) setPickup({ ...result, cell, id: Date.now() });
      void refreshWallet();
    });
  }, [api, identity, cell, arrivalId, pickupReady, claim, refreshWallet]);
  useEffect(() => {
    if (!pickup) return;
    const timer = setTimeout(() => setPickup(null), 900);
    return () => clearTimeout(timer);
  }, [pickup]);
  const settled = useCallback(() => {
    if (current.current !== identity) return;
    void refresh(); void refreshWallet();
  }, [identity, refresh, refreshWallet]);
  return { state, departed, pickup: pickup?.cell === cell ? pickup : null, settled,
    watching: watchingLine(watching, cell, identity?.nickname ?? "", now) };
}
