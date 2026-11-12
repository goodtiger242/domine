"use client";

import { cellBackground } from "@/lib/domine/pet-cells";
import { createKingApi, type KingSettlement } from "@/lib/domine/pet-king-rpc";
import type { KingApi } from "@/lib/domine/pet-king-client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPetApi, acceptsResult, PetRpcError, supportsExploration, type PetApi, type PetBusy, type PetCapabilities, type PetCommand, type V6Result } from "@/lib/domine/pet-rpc";
import { createClient } from "@/lib/supabase/client";
import { secretForName, normalizeNickname, registrationConfirmed, saveIdentity, storageAvailable, type PetIdentity } from "@/lib/domine/pet-identity";
import { rewardDisplay } from "@/lib/domine/pet-progress";
import { gameReducer, initialMachine, visualLocked, type GameEvent } from "@/lib/domine/pet-machine";
import { mapBackground, type PetMap, type SceneCue } from "@/lib/domine/pet-maps";
import { DIRECTIONS, neighborCell, savedCell, visitedCells, worldCell, travelDirection, type MapTravel } from "@/lib/domine/pet-world";
import { type PetId } from "@/lib/domine/pet-photos";
import { prepareImage, vibrate } from "@/lib/domine/pet-assets";
import { SCENE_DURATION } from "@/lib/domine/pet-scene-plan";
import type { PetAction, PetState } from "@/lib/domine/pet";

function sceneDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener("abort", finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener("abort", finish, { once: true });
    if (signal.aborted) finish();
  });
}
const safeGet = (key: string) => { try { return localStorage.getItem(key) ?? ""; } catch { return ""; } };
const errorText: Record<string, string> = {
  AUTH_FAILED: "이름을 다시 입력해 주세요",
  NICKNAME_TAKEN: "이름을 다시 입력해 주세요",
  SERVER_UPDATE_REQUIRED: "서버 업데이트 대기 중(새 지역 탐험은 아직)",
  INSUFFICIENT_COINS: "코인이 조금 더 필요해요.", NOT_OWNED: "먼저 구매해 주세요.",
  INVALID_INPUT: "입력 내용을 확인해 주세요.", REQUEST_CONFLICT: "요청이 달라 기록을 확인하지 못했어요.",
  RATE_LIMITED: "우리 강아지는 잠시 후 다시 확인해 주세요. 놀이는 계속할 수 있어요.",
};
export function usePetController(injectedApi?: PetApi, injectedKingApi?: KingApi) {
  const [supabase] = useState(createClient);
  const [kingApi] = useState<KingApi>(() => injectedKingApi ?? (injectedApi
    ? createKingApi(() => Promise.resolve({ data: null, error: { code: "PGRST202", message: "King mock not supplied" } }))
    : Object.assign(createKingApi((name, args) => supabase.rpc(name, args)), {
      abortSignal: (signal: AbortSignal) => createKingApi((name, args) => supabase.rpc(name, args).abortSignal(signal)),
    })));
  const [api] = useState(() => injectedApi ?? createPetApi((name, args, signal) => {
    const request = supabase.rpc(name, args);
    return signal ? request.abortSignal(signal) : request;
  }));
  const [machine, rawDispatch] = useReducer(gameReducer, initialMachine);
  const machineRef = useRef(machine);
  const dispatch = useCallback((event: GameEvent) => {
    machineRef.current = gameReducer(machineRef.current, event);
    rawDispatch(event);
  }, []);
  const [capability, setCapability] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const capabilityRef = useRef(capability);
  const [features, setFeatures] = useState<PetCapabilities | null>(null);
  const featuresRef = useRef<PetCapabilities | null>(null);
  const [registered, setRegistered] = useState(false);
  const registeredRef = useRef(false);
  const [identity, setIdentity] = useState<PetIdentity | null>(null);
  const identityRef = useRef<PetIdentity | null>(null);
  const [nickname, setNickname] = useState("");
  const nickRef = useRef("");
  const [petId, setPetId] = useState<PetId>(1);
  const petRef = useRef<PetId>(1);
  const [shared, setShared] = useState<PetState | null>(null);
  const [personal, setPersonal] = useState<V6Result | null>(null);
  const personalRef = useRef<V6Result | null>(null);
  const petStates = useRef<Partial<Record<PetId, V6Result>>>({});
  const [busyPets, setBusyPets] = useState<Partial<Record<PetId, PetBusy & { until: number }>>>({});
  const busyRef = useRef(busyPets);
  const [autoAttempts, setAutoAttempts] = useState(0);
  const [feedback, setFeedback] = useState<{ id: number; result: V6Result; previousLevel: number } | null>(null);
  const [message, setMessage] = useState("");
  const [rewardNotice, setRewardNotice] = useState("");
  const [cue, setCue] = useState<SceneCue | null>(null);
  const [visited, setVisited] = useState<string[]>([]);
  const [travel, setTravel] = useState<MapTravel | null>(null);
  const [arrival, setArrival] = useState<{ id: number; text: string } | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const [multiPet, setMultiPet] = useState(true);
  const legacy = useRef(false), alive = useRef(false), generation = useRef(0), readSequence = useRef(0);
  const pending = useRef<PetCommand | null>(null);
  const abort = useRef<AbortController | null>(null);
  const readAbort = useRef<AbortController | null>(null), queuedRead = useRef<boolean | null>(null);
  const readFailures = useRef(0), nextRead = useRef(0);
  const commandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapAbort = useRef<AbortController | null>(null);
  const registrationPending = useRef(false);
  const idCounter = useRef(0);
  const [active, setActive] = useState(true);
  const activeRef = useRef(true);
  const offline = useRef(false);
  const host = useRef<HTMLDivElement>(null);
  const pendingKey = (i: PetIdentity) => `domine-pet-pending:${i.nickname.toLowerCase()}`;
  const current = useCallback((g: number, i: PetIdentity | null, selected: PetId) => alive.current && generation.current === g && identityRef.current === i && petRef.current === selected, []);
  const apply = useCallback((result: V6Result, show = false, replay = false, elapsed = 0) => {
    const selected = result.pet ?? petRef.current;
    if (!acceptsResult(petStates.current[selected] ?? null, result)) return;
    petStates.current[selected] = result;
    if (!replay && "busy" in result) {
      busyRef.current = { ...busyRef.current, [selected]: result.busy ? { ...result.busy, until: Date.now() + Math.max(0, result.busy.remainingMs - elapsed) } : undefined };
      setBusyPets(busyRef.current);
    }
    if (selected !== petRef.current) {
      const prior = personalRef.current;
      if (prior && (result.version ?? -1) >= (prior.version ?? -1)) {
        personalRef.current = { ...prior, coins: result.coins, levels: result.levels, album: result.album, equipment: result.equipment };
        setPersonal(personalRef.current);
      }
      return;
    }
    const prior = personalRef.current;
    const previousLevel = prior?.levels?.[petRef.current] ?? prior?.player?.level ?? result.player?.level ?? 1;
    if (acceptsResult(prior, result)) {
      personalRef.current = result;
      setPersonal(result);
      if (show && result.reward && (result.version ?? 0) > (prior?.version ?? -1)) {
        setFeedback({ id: ++idCounter.current, result, previousLevel });
        if (result.reward.skipped === "DAILY_CAP") setRewardNotice(rewardDisplay(result.reward).notice);
        else if (result.reward.xp + result.reward.coins + result.reward.levelCoins > 0) setRewardNotice("");
        if ((result.player?.level ?? 1) > previousLevel) vibrate([15, 40, 20]);
        else if (result.reward.newEntries.length) vibrate(20);
        else if (result.reward.coins + result.reward.levelCoins > 0) vibrate(15);
      }
    }
  }, []);
  const refresh = useCallback(async (wallet?: KingSettlement["wallet"], background = false): Promise<void> => {
    if (wallet) {
      ++readSequence.current;
      for (const pet of [1, 2] as const) {
        const previous = petStates.current[pet];
        if (previous && wallet.version >= (previous.version ?? -1)) petStates.current[pet] = { ...previous, ...wallet,
          player: previous.player ? { ...previous.player, coins: wallet.coins } : undefined };
      }
      const previous = personalRef.current;
      if (previous && wallet.version >= (previous.version ?? -1)) {
        personalRef.current = { ...previous, ...wallet, player: previous.player ? { ...previous.player, coins: wallet.coins } : undefined };
        setPersonal(personalRef.current);
      }
      return;
    }
    if (!alive.current || offline.current) return;
    if (background && (!activeRef.current || document.hidden || navigator.onLine === false || Date.now() < nextRead.current)) return;
    if (readAbort.current) { queuedRead.current = (queuedRead.current ?? true) && background; return; }
    const controller = new AbortController(); readAbort.current = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    const g = generation.current, selected = petRef.current, i = identityRef.current, seq = ++readSequence.current;
    const started = Date.now();
    let succeeded = false;
    try {
      if (capabilityRef.current === "ready" && i && registeredRef.current) {
        const result = await api.state(i, selected, controller.signal);
        if (controller.signal.aborted) throw new Error("TIMEOUT");
        succeeded = result.ok;
        if (!current(g, i, selected) || seq !== readSequence.current) return;
        if (!result.ok) { setMessage(errorText[result.code] ?? "우리 강아지 상태를 확인하지 못했어요."); return; }
        apply(result, false, false, Date.now() - started);
        if (result.shared) setShared(result.shared.pet);
      } else {
        const result = await api.legacy(selected, nickRef.current, undefined, legacy.current, controller.signal);
        if (controller.signal.aborted) throw new Error("TIMEOUT");
        succeeded = !result.error;
        if (!current(g, i, selected) || seq !== readSequence.current) return;
        if (result.error) { setMessage("강아지를 불러오지 못했어요. 잠시 후 다시 열어 주세요."); return; }
        legacy.current = result.legacy; setMultiPet(!result.legacy);
        if (result.petId !== selected) { petRef.current = result.petId; setPetId(result.petId); }
        setShared(result.data as PetState);
      }
    } catch { if (current(g, i, selected)) setMessage("연결을 확인해 주세요. 놀이는 계속할 수 있어요."); }
    finally {
      clearTimeout(timer); readAbort.current = null;
      if (succeeded) { readFailures.current = 0; nextRead.current = 0; }
      else { nextRead.current = Date.now() + Math.min(240000, 30000 * 2 ** readFailures.current); readFailures.current = Math.min(3, readFailures.current + 1); }
      const queued = queuedRead.current; queuedRead.current = null;
      if (queued !== null) void refresh(undefined, queued);
    }
  }, [api, apply, current]);

  const execute = useCallback(async (command: PetCommand, retry = false, presented = false) => {
    if (offline.current) return;
    const i = identityRef.current;
    if (!i || !registeredRef.current || capabilityRef.current !== "ready") return;
    if (pending.current && !retry) return;
    if (!retry && command.kind === "explore_begin" && !supportsExploration(featuresRef.current?.v9 === true, command.map)) {
      setMessage(errorText.SERVER_UPDATE_REQUIRED); return;
    }
    const valid = () => alive.current && identityRef.current === i && pending.current?.requestId === command.requestId;
    if (retry && pending.current?.requestId !== command.requestId) return;
    if (retry && machineRef.current.command === "pending") return;
    try { localStorage.setItem(pendingKey(i), JSON.stringify(command)); }
    catch { setMessage("기기에 기록을 저장할 수 없어 개인 보상을 잠시 멈췄어요."); return; }
    pending.current = command;
    if (!retry) { setAutoAttempts(0); setMessage(""); }
    dispatch({ type: "request", id: command.requestId });
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    if (commandTimer.current) clearTimeout(commandTimer.current);
    commandTimer.current = setTimeout(() => {
      if (!valid()) return;
      controller.abort(); dispatch({ type: "uncertain", id: command.requestId });
    }, 8000);
    let mutationAttempted = !retry;
    const started = Date.now();
    try {
      let result: V6Result;
      if (retry) {
        result = await api.operation(i, command.requestId);
        if (!valid() || controller.signal.aborted) return;
        if (result.code === "NOT_FOUND") { mutationAttempted = true; result = await api.execute(i, command, controller.signal); }
      } else result = await api.execute(i, command, controller.signal);
      if (!valid() || controller.signal.aborted) return;
      // A lookup rate limit does not establish whether an earlier mutation committed.
      if (retry && result.code === "RATE_LIMITED") { dispatch({ type: "uncertain", id: command.requestId }); return; }
      pending.current = null;
      try { localStorage.removeItem(pendingKey(i)); } catch { /* Same ID remains safe to replay. */ }
      dispatch({ type: "settled", id: command.requestId });
      apply(result, true, retry, Date.now() - started);
      ++readSequence.current;
      if (retry || (result.pet !== undefined && result.pet !== petRef.current)) void refresh();
      if (result.shared && (command.kind === "action" || command.kind === "equip") && command.pet === petRef.current) setShared(result.shared.pet);
      if (!presented && !retry && result.ok && command.kind === "action" && featuresRef.current?.busyLock && command.pet === petRef.current && !visualLocked(machineRef.current)) {
        const duration = Math.min(command.durationMs ?? SCENE_DURATION[command.action], (busyRef.current[command.pet]?.until ?? Date.now()) - Date.now());
        if (duration > 0) {
          const id = ++idCounter.current;
          dispatch({ type: "act", id, now: Date.now(), duration });
          setCue({ action: command.action, id, endsAt: Date.now() + duration });
        }
      }
      if (!result.ok && !["BUSY", "ALREADY_OWNED", "TOO_EARLY", "EXPIRED", "RATE_LIMITED"].includes(result.code)) setMessage(errorText[result.code] ?? "우리 강아지 상태를 확인하지 못했어요.");
      else setMessage("");
      if (result.ok && command.kind === "purchase") vibrate(15);
    } catch (error) {
      if (!valid() || controller.signal.aborted) return;
      // A failed lookup cannot establish whether the original mutation committed.
      if (mutationAttempted && error instanceof PetRpcError && error.definitive) {
        pending.current = null;
        try { localStorage.removeItem(pendingKey(i)); } catch { /* Same ID remains safe to replay. */ }
        dispatch({ type: "settled", id: command.requestId });
        setMessage(`서버 점검 중이에요. 잠시 후 다시 해 주세요 (${command.kind} · ${error.message})`);
      } else dispatch({ type: "uncertain", id: command.requestId });
    } finally {
      if (abort.current === controller && commandTimer.current) clearTimeout(commandTimer.current);
    }
  }, [api, apply, dispatch, refresh]);

  useEffect(() => {
    if (machine.command !== "uncertain" || autoAttempts >= 3) return;
    const timer = setTimeout(() => {
      if (!pending.current) return;
      setAutoAttempts((count) => count + 1);
      void execute(pending.current, true);
    }, [1500, 3000, 6000][autoAttempts]);
    return () => clearTimeout(timer);
  }, [machine.command, machine.operationId, autoAttempts, execute]);

  const busy = busyPets[petId];
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => {
      busyRef.current = { ...busyRef.current, [petId]: undefined };
      setBusyPets(busyRef.current);
    }, Math.max(0, busy.until - Date.now()));
    return () => clearTimeout(timer);
  }, [busy, petId]);

  const startExploration = useCallback((map: PetMap, source: "map" | "walk") => {
    void execute({ kind: "explore_begin", map, source, requestId: crypto.randomUUID() });
  }, [execute]);
  const visit = useCallback((id: string) => {
    setVisited((previous) => {
      const next = previous.includes(id) ? previous : [...previous, id];
      try {
        localStorage.setItem("domine-pet-cell", id);
        localStorage.setItem("domine-pet-visited", JSON.stringify(next));
      } catch { /* Visiting still works without device storage. */ }
      return next;
    });
  }, []);
  const localScene = useCallback(async (next: SceneCue) => {
    if (!worldReady || visualLocked(machineRef.current)) return;
    const currentCell = worldCell(machineRef.current.committedMap);
    if (next.action === "sleep" && currentCell.theme !== "home") return;
    if (next.action === "priest" && currentCell.theme !== "church") return;
    if (next.action === "shop" && currentCell.id !== "F6") return;
    vibrate(10);
    const id = ++idCounter.current;
    if (next.action === "map") {
      const cell = next.to ? worldCell(next.to) : next.direction ? neighborCell(currentCell.id, next.direction) : null;
      if (!cell || cell.id === currentCell.id) return;
      const g = generation.current;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const trip: MapTravel = { id, from: currentCell.id, direction: travelDirection(currentCell.id, cell.id), phase: "exit", reduced };
      dispatch({ type: "map", map: cell.id, id });
      setCue(null); setTravel(trip);
      const controller = new AbortController(); mapAbort.current?.abort(); mapAbort.current = controller;
      const valid = () => alive.current && generation.current === g && !controller.signal.aborted && machineRef.current.sceneId === id;
      const cancel = () => {
        if (!alive.current) return;
        setTravel((current) => current?.id === id ? null : current);
        dispatch({ type: "map-cancel", id });
      };
      controller.signal.addEventListener("abort", cancel, { once: true });
      const safety = setTimeout(() => controller.abort(), 2500);
      try {
        const src = cellBackground(cell.id, new Date().getHours());
        const [ready] = await Promise.all([prepareImage(src, controller.signal), sceneDelay(reduced ? 0 : 450, controller.signal)]);
        if (!valid()) return;
        if (ready === false) { controller.abort(); return; }
        dispatch({ type: "map-ready", id });
        setTravel({ ...trip, phase: "cross" });
        visit(cell.id);
        await sceneDelay(200, controller.signal);
        if (!valid()) return;
        if (!reduced) {
          setTravel({ ...trip, phase: "enter" });
          await sceneDelay(450, controller.signal);
          if (!valid()) return;
        }
        setTravel(null); dispatch({ type: "done", id });
        setArrival({ id, text: `${cell.name}에 왔어요` });
        startExploration(cell.theme, "map");
      } catch {
        controller.abort();
      } finally {
        clearTimeout(safety);
        controller.signal.removeEventListener("abort", cancel);
        cancel();
      }
    } else {
      dispatch({ type: "act", id, now: Date.now(), duration: SCENE_DURATION[next.action] });
      setCue({ ...next, id });
    }
  }, [dispatch, startExploration, visit, worldReady]);
  const care = useCallback((action: PetAction | "sleep", presented = false) => {
    if (!worldReady || visualLocked(machineRef.current) || (busyRef.current[petRef.current]?.until ?? 0) > Date.now()) return;
    const waitForServer = featuresRef.current?.busyLock && registeredRef.current && action !== "sleep";
    if (waitForServer && pending.current) return;
    if (!waitForServer && !presented) void localScene({ action, id: 0 });
    if (!registeredRef.current) setMessage("내 이름을 입력하면 함께 키울 수 있어요");
    if (action === "sleep") return;
    const i = identityRef.current;
    if (i && registeredRef.current && capabilityRef.current === "ready") {
      void execute({ kind: "action", pet: petRef.current, action, durationMs: SCENE_DURATION[action], requestId: crypto.randomUUID() }, false, presented);
    } else if (nickRef.current && capabilityRef.current === "missing") {
      const selected = petRef.current, g = generation.current;
      void api.legacy(selected, nickRef.current, action, legacy.current)
        .then(() => { if (current(g, i, selected)) void refresh(); })
        .catch(() => { if (current(g, i, selected)) setMessage("공동 기록을 확인하지 못했어요."); });
    }
  }, [api, current, execute, localScene, refresh, worldReady]);

  const connect = useCallback(async (raw: string) => {
    if (registrationPending.current) return;
    setMessage("");
    const nick = normalizeNickname(raw);
    if (!nick) { setMessage("도미네 청년회 이름을 정자로 사용해주세요"); return; }
    if (pending.current && nick !== identityRef.current?.nickname) return;
    if (capabilityRef.current === "missing") {
      nickRef.current = nick; setNickname(nick);
      try { localStorage.setItem("domine-pet-nick", nick); } catch { /* Shared care works without storage. */ }
      void refresh(); return;
    }
    if (capabilityRef.current !== "ready") { setMessage("우리 강아지 연결을 확인하지 못했어요. 잠시 후 다시 해 주세요."); return; }
    if (!storageAvailable()) {
      if (!identityRef.current) { nickRef.current = nick; setNickname(nick); void refresh(); }
      setMessage("기기 저장소를 사용할 수 없어 이름을 저장할 수 없어요. 공동 놀이는 가능해요."); return;
    }
    registrationPending.current = true;
    const g = generation.current, previousIdentity = identityRef.current, selected = petRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const candidate = { nickname: nick, secret: await secretForName(nick) };
      if (!current(g, previousIdentity, selected) || controller.signal.aborted) return;
      saveIdentity(candidate);
      if (!previousIdentity) { nickRef.current = nick; setNickname(nick); }
      const result = registrationConfirmed(nick)
        ? await api.state(candidate, selected, controller.signal)
        : await api.register(candidate, controller.signal);
      if (!current(g, previousIdentity, selected) || controller.signal.aborted) return;
      if (!result.ok) {
        localStorage.removeItem(`domine-pet-reg:${nick.toLowerCase()}`);
        setMessage(errorText[result.code] ?? "등록을 완료하지 못했어요."); return;
      }
      saveIdentity(candidate, true);
      registeredRef.current = true; setRegistered(true);
      setRewardNotice("");
      ++generation.current; ++readSequence.current;
      identityRef.current = candidate; setIdentity(candidate); nickRef.current = nick; setNickname(nick);
      petStates.current = {}; busyRef.current = {}; setBusyPets({}); setAutoAttempts(0);
      personalRef.current = null; setPersonal(null); setFeedback(null); apply(result); dispatch({ type: "reset" }); setCue(null);
      const savedCommand = safeGet(pendingKey(candidate));
      if (savedCommand) {
        const command = JSON.parse(savedCommand) as PetCommand;
        if (command.requestId && command.kind) { pending.current = command; dispatch({ type: "request", id: command.requestId }); dispatch({ type: "uncertain", id: command.requestId }); }
      }
      void refresh();
    } catch { if (current(g, previousIdentity, selected)) setMessage("연결 또는 저장을 완료하지 못했어요. 같은 이름으로 다시 확인해 주세요."); }
    finally { clearTimeout(timer); registrationPending.current = false; }
  }, [api, apply, current, dispatch, refresh]);

  const checkCapabilities = useCallback(async () => {
    try {
      const supported = await api.capabilities();
      if (!alive.current) return;
      capabilityRef.current = supported ? "ready" : "missing"; setCapability(capabilityRef.current);
      featuresRef.current = supported || null; setFeatures(featuresRef.current);
      // Retry the selected name until the server has confirmed registration.
      if (supported && !registeredRef.current && nickRef.current) await connect(nickRef.current);
      await refresh();
    } catch { if (alive.current) { capabilityRef.current = "error"; setCapability("error"); setMessage("우리 강아지 연결을 확인하지 못했어요."); } }
  }, [api, refresh, connect]);
  useEffect(() => {
    alive.current = true;
    // Each visit starts without a name; a previous visitor's name and record are never shown.
    const selected: PetId = safeGet("domine-pet-selected") === "2" ? 2 : 1; petRef.current = selected; setPetId(selected);
    let saved: string | null = null;
    try { saved = localStorage.getItem("domine-pet-cell"); } catch { /* Default location. */ }
    const map = savedCell(saved, safeGet("domine-pet-map"));
    setVisited(visitedCells(safeGet("domine-pet-visited")));
    const id = ++idCounter.current;
    const controller = new AbortController();
    dispatch({ type: "map", map, id }); dispatch({ type: "map-ready", id }); dispatch({ type: "done", id });
    void prepareImage(cellBackground(map, new Date().getHours()), controller.signal).then(() => {
      if (!alive.current || controller.signal.aborted) return;
      visit(map); setWorldReady(true);
    });
    void checkCapabilities();
    return () => {
      alive.current = false;
      queuedRead.current = null; readAbort.current?.abort();
      controller.abort();
      // Invalidate requests, not a DOM ref; cleanup must advance the current generation.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++generation.current;
      abort.current?.abort(); mapAbort.current?.abort(); if (commandTimer.current) clearTimeout(commandTimer.current);
    };
  }, [checkCapabilities, dispatch, visit]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3000);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!worldReady || !active || machine.visual !== "idle") return;
    const controller = new AbortController();
    const preload = () => {
      const hour = new Date().getHours();
      const backgrounds = new Set(DIRECTIONS.flatMap((dir) => {
        const cell = neighborCell(machine.committedMap, dir);
        return cell ? [cellBackground(cell.id, hour)] : [];
      }));
      backgrounds.delete(cellBackground(machine.committedMap, hour));
      backgrounds.forEach((src) => { void prepareImage(src, controller.signal); });
    };
    const idle = typeof window.requestIdleCallback === "function";
    const id = idle ? window.requestIdleCallback(preload) : window.setTimeout(preload, 300);
    return () => { controller.abort(); if (idle) window.cancelIdleCallback(id); else window.clearTimeout(id); };
  }, [worldReady, active, machine.visual, machine.committedMap]);

  useEffect(() => {
    let intersecting = true;
    const update = () => {
      const visible = !document.hidden && intersecting;
      if (visible === activeRef.current) return;
      activeRef.current = visible; setActive(visible);
      if (!visible) { ++generation.current; mapAbort.current?.abort(); dispatch({ type: "pause" }); setCue(null); }
      else if (!offline.current) { dispatch({ type: "resume" }); void refresh(undefined, true); }
    };
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    if (host.current) observer.observe(host.current);
    const hide = () => { intersecting = false; update(); };
    const show = () => { intersecting = true; update(); };
    document.addEventListener("visibilitychange", update); window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    const online = () => { void refresh(undefined, true); };
    window.addEventListener("online", online);
    let poll: ReturnType<typeof setTimeout>;
    const schedule = () => { poll = setTimeout(() => {
      if (machineRef.current.command === "idle") void refresh(undefined, true);
      schedule();
    }, 30000 * (0.85 + Math.random() * 0.3)); };
    schedule();
    return () => { observer.disconnect(); clearTimeout(poll); document.removeEventListener("visibilitychange", update); window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show); window.removeEventListener("online", online); };
  }, [dispatch, refresh]);
  useEffect(() => {
    if (machine.visual !== "acting" || !machine.deadlineAt) return;
    const timer = setTimeout(() => dispatch({ type: "done", id: machine.sceneId }), Math.max(0, Math.min(machine.deadlineAt, cue?.endsAt ?? Infinity) - Date.now()));
    return () => clearTimeout(timer);
  }, [machine.visual, machine.sceneId, machine.deadlineAt, cue?.endsAt, dispatch]);
  const completedWalk = useRef(0);
  useEffect(() => {
    if (machine.visual !== "idle" || machine.command !== "idle" || cue?.action !== "walk" || completedWalk.current === cue.id) return;
    completedWalk.current = cue.id; startExploration(worldCell(machine.committedMap).theme, "walk");
  }, [machine.visual, machine.command, machine.committedMap, cue, startExploration]);
  useEffect(() => {
    const ticket = personal?.ticket;
    if (offline.current || !active || !ticket || ticket.map_id !== worldCell(machine.committedMap).theme || machine.command !== "idle") return;
    const delay = Math.max(250, Date.parse(ticket.eligible_at) - Date.parse(personal.serverNow) + 200);
    const timer = setTimeout(() => { void execute({ kind: "explore_finish", pet: petRef.current, ticket: ticket.id, requestId: crypto.randomUUID() }); }, delay);
    return () => clearTimeout(timer);
  }, [personal?.ticket, personal?.serverNow, machine.committedMap, machine.command, machine.visual, active, execute]);

  function selectPet(id: PetId) {
    if (offline.current) return;
    if ((machineRef.current.visual !== "paused" && visualLocked(machineRef.current)) || id === petRef.current) return;
    ++generation.current; ++readSequence.current;
    petRef.current = id; setPetId(id); setCue(null); setShared(petStates.current[id]?.shared?.pet ?? null); setMessage("");
    setFeedback(null);
    if (personalRef.current) {
      personalRef.current = petStates.current[id] ?? { ...personalRef.current, pet: id, coins: personalRef.current.coins ?? personalRef.current.player?.coins, player: undefined, inventory: undefined };
      setPersonal(personalRef.current);
    }
    try { localStorage.setItem("domine-pet-selected", String(id)); } catch { /* Optional preference. */ }
    void refresh();
  }
  function clearIdentity() {
    try { localStorage.removeItem("domine-pet-nick"); }
    catch { setMessage("이 기기에 이름 선택 해제를 저장하지 못했어요."); return; }
    ++generation.current; ++readSequence.current;
    abort.current?.abort(); mapAbort.current?.abort();
    pending.current = null;
    identityRef.current = null; setIdentity(null);
    nickRef.current = ""; setNickname("");
    registeredRef.current = false; setRegistered(false);
    petStates.current = {}; busyRef.current = {}; setBusyPets({}); setAutoAttempts(0);
    personalRef.current = null; setPersonal(null); setFeedback(null); setRewardNotice(""); setCue(null);
    dispatch({ type: "reset" });
    setMessage("내 이름을 입력하면 함께 키울 수 있어요");
    void refresh();
  }
  const done = useCallback((id: number, sleep?: boolean) => dispatch({ type: "done", id, sleep }), [dispatch]);
  return { host, api, kingApi, machine, active, shared, personal, feedback, message, rewardNotice, setMessage, capability, features, registered, identity, nickname, petId, multiPet, cue, visited, arrival, travel, worldReady,
    busy: busy && busy.until > Date.now() ? busy : undefined,
    requestingAction: machine.command === "pending" && pending.current?.kind === "action" && pending.current.pet === petId ? pending.current.action : null,
    canRetry: machine.command === "uncertain" && autoAttempts >= 3,
    care, localScene, done, connect, clearIdentity, selectPet, execute, refresh, checkCapabilities,
    retry: () => { if (pending.current) void execute(pending.current, true); },
    pause: (localOnly = false) => { offline.current = localOnly; ++generation.current; mapAbort.current?.abort(); dispatch({ type: "pause" }); setCue(null); },
    resume: () => { offline.current = false; if (activeRef.current) { dispatch({ type: "resume" }); void refresh(); } },
  };
}
