"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { createPetApi, acceptsResult, PetRpcError, supportsExploration, type PetApi, type PetCapabilities, type PetCommand, type V6Result } from "@/lib/domine/pet-rpc";
import { createClient } from "@/lib/supabase/client";
import { createSecret, normalizeNickname, parseTransfer, readIdentity, registrationConfirmed, saveIdentity, storageAvailable, type PetIdentity } from "@/lib/domine/pet-identity";
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
  AUTH_FAILED: "이미 쓰는 별명이에요. 다른 기기의 이전 코드를 입력하거나 다른 별명을 고르세요",
  NICKNAME_TAKEN: "이미 쓰는 별명이에요. 다른 기기의 이전 코드를 입력하거나 다른 별명을 고르세요",
  SERVER_UPDATE_REQUIRED: "서버 업데이트 대기 중(새 지역 탐험은 아직)",
  INSUFFICIENT_COINS: "코인이 조금 더 필요해요.", NOT_OWNED: "먼저 구매해 주세요.",
  INVALID_INPUT: "입력 내용을 확인해 주세요.", REQUEST_CONFLICT: "요청이 달라 기록을 확인하지 못했어요.",
  RATE_LIMITED: "개인 기록은 잠시 후 다시 확인해 주세요. 놀이는 계속할 수 있어요.",
};
export function usePetController(injectedApi?: PetApi) {
  const [supabase] = useState(createClient);
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
  const commandTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapAbort = useRef<AbortController | null>(null);
  const registrationPending = useRef(false);
  const idCounter = useRef(0);
  const [active, setActive] = useState(true);
  const activeRef = useRef(true);
  const host = useRef<HTMLDivElement>(null);
  const pendingKey = (i: PetIdentity) => `domine-pet-pending:${i.nickname.toLowerCase()}`;
  const current = useCallback((g: number, i: PetIdentity | null, selected: PetId) => alive.current && generation.current === g && identityRef.current === i && petRef.current === selected, []);
  const apply = useCallback((result: V6Result, show = false) => {
    if (result.pet !== undefined && result.pet !== petRef.current) return;
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
  const refresh = useCallback(async () => {
    const g = generation.current, selected = petRef.current, i = identityRef.current, seq = ++readSequence.current;
    try {
      if (capabilityRef.current === "ready" && i && registeredRef.current) {
        const result = await api.state(i, selected);
        if (!current(g, i, selected) || seq !== readSequence.current) return;
        if (!result.ok) { setMessage(errorText[result.code] ?? "개인 기록을 확인하지 못했어요."); return; }
        apply(result);
        if (result.shared) setShared(result.shared.pet);
      } else {
        const result = await api.legacy(selected, nickRef.current, undefined, legacy.current);
        if (!current(g, i, selected) || seq !== readSequence.current) return;
        if (result.error) { setMessage("강아지를 불러오지 못했어요. 기록 메뉴에서 다시 확인해 주세요."); return; }
        legacy.current = result.legacy; setMultiPet(!result.legacy);
        if (result.petId !== selected) { petRef.current = result.petId; setPetId(result.petId); }
        setShared(result.data as PetState);
      }
    } catch { if (current(g, i, selected)) setMessage("연결을 확인해 주세요. 놀이는 계속할 수 있어요."); }
  }, [api, apply, current]);

  const execute = useCallback(async (command: PetCommand, retry = false) => {
    const i = identityRef.current;
    if (!i || !registeredRef.current || capabilityRef.current !== "ready") return;
    if (pending.current && !retry) { setMessage("보상 확인 중이라 이번엔 코인이 없어요"); return; }
    if (!retry && command.kind === "explore_begin" && !supportsExploration(featuresRef.current?.v9 === true, command.map)) {
      setMessage(errorText.SERVER_UPDATE_REQUIRED); return;
    }
    const g = generation.current, selected = petRef.current;
    if (retry && pending.current?.requestId !== command.requestId) return;
    try { localStorage.setItem(pendingKey(i), JSON.stringify(command)); }
    catch { setMessage("기기에 기록을 저장할 수 없어 개인 보상을 잠시 멈췄어요."); return; }
    pending.current = command;
    dispatch({ type: "request", id: command.requestId });
    abort.current?.abort();
    const controller = new AbortController(); abort.current = controller;
    if (commandTimer.current) clearTimeout(commandTimer.current);
    commandTimer.current = setTimeout(() => {
      if (!current(g, i, selected) || pending.current?.requestId !== command.requestId) return;
      controller.abort(); dispatch({ type: "uncertain", id: command.requestId });
    }, 8000);
    let mutationAttempted = !retry;
    try {
      let result: V6Result;
      if (retry) {
        result = await api.operation(i, command.requestId);
        if (!current(g, i, selected) || controller.signal.aborted) return;
        if (result.code === "NOT_FOUND") { mutationAttempted = true; result = await api.execute(i, command, controller.signal); }
      } else result = await api.execute(i, command, controller.signal);
      if (!current(g, i, selected) || controller.signal.aborted || pending.current?.requestId !== command.requestId) return;
      // A lookup rate limit does not establish whether an earlier mutation committed.
      if (retry && result.code === "RATE_LIMITED") { dispatch({ type: "uncertain", id: command.requestId }); return; }
      pending.current = null;
      try { localStorage.removeItem(pendingKey(i)); } catch { /* Same ID remains safe to replay. */ }
      dispatch({ type: "settled", id: command.requestId });
      apply(result, true);
      ++readSequence.current;
      if (result.pet !== undefined && result.pet !== selected) void refresh();
      if (result.shared && (command.kind === "action" || command.kind === "equip") && command.pet === selected) setShared(result.shared.pet);
      if (!result.ok && !["ALREADY_OWNED", "TOO_EARLY", "EXPIRED"].includes(result.code)) setMessage(errorText[result.code] ?? "개인 기록을 확인하지 못했어요.");
      else setMessage("");
      if (result.ok && command.kind === "purchase") vibrate(15);
    } catch (error) {
      if (!current(g, i, selected) || pending.current?.requestId !== command.requestId) return;
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
  }, [api, apply, current, dispatch, refresh]);

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
        const src = mapBackground(cell.theme, new Date().getHours());
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
  const care = useCallback((action: PetAction | "sleep") => {
    if (visualLocked(machineRef.current)) return;
    void localScene({ action, id: 0 });
    if (!registeredRef.current) setMessage("구경 중이에요 · 별명을 등록하면 코인이 쌓여요");
    if (action === "sleep") return;
    const i = identityRef.current;
    if (i && registeredRef.current && capabilityRef.current === "ready") {
      void execute({ kind: "action", pet: petRef.current, action, requestId: crypto.randomUUID() });
    } else if (nickRef.current && (capabilityRef.current === "missing" || (!i && capabilityRef.current === "ready"))) {
      const selected = petRef.current, g = generation.current;
      void api.legacy(selected, nickRef.current, action, legacy.current)
        .then(() => { if (current(g, i, selected)) void refresh(); })
        .catch(() => { if (current(g, i, selected)) setMessage("공동 기록을 확인하지 못했어요."); });
    }
  }, [api, current, execute, localScene, refresh]);

  const connect = useCallback(async (raw: string, transfer = false) => {
    if (registrationPending.current) return;
    setMessage("");
    const imported = transfer ? parseTransfer(raw) : null;
    const nick = transfer ? imported?.nickname : normalizeNickname(raw);
    if (!nick) { setMessage(transfer ? "이전 코드 형식을 확인해 주세요." : "별명은 한글·영문·숫자 1~8자로 입력해 주세요."); return; }
    if (pending.current && (nick.toLowerCase() !== identityRef.current?.nickname.toLowerCase() || (imported && imported.secret !== identityRef.current?.secret))) return;
    if (capabilityRef.current === "missing") {
      nickRef.current = nick; setNickname(nick);
      try { localStorage.setItem("domine-pet-nick", nick); } catch { /* Shared care works without storage. */ }
      void refresh(); return;
    }
    if (capabilityRef.current !== "ready") { setMessage("개인 기록 연결을 먼저 확인해 주세요."); return; }
    if (!storageAvailable()) {
      if (!identityRef.current) { nickRef.current = nick; setNickname(nick); void refresh(); }
      setMessage("기기 저장소를 사용할 수 없어 개인 기록을 시작할 수 없어요. 공동 놀이는 가능해요."); return;
    }
    registrationPending.current = true;
    const g = generation.current, previousIdentity = identityRef.current, selected = petRef.current;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const saved = readIdentity(nick);
      const candidate = imported ?? saved ?? { nickname: nick, secret: createSecret() };
      // Persist before registration so a lost response cannot lose the new credential.
      if (!imported && !saved) saveIdentity(candidate);
      const result = imported ? await api.state(candidate, selected, controller.signal) : await api.register(candidate, controller.signal);
      if (!current(g, previousIdentity, selected) || controller.signal.aborted) return;
      if (!result.ok) { setMessage(errorText[result.code] ?? "등록을 완료하지 못했어요."); return; }
      saveIdentity(candidate, true);
      registeredRef.current = true; setRegistered(true);
      setRewardNotice("");
      ++generation.current; ++readSequence.current;
      identityRef.current = candidate; setIdentity(candidate); nickRef.current = nick; setNickname(nick);
      personalRef.current = null; apply(result); dispatch({ type: "reset" }); setCue(null);
      const savedCommand = safeGet(pendingKey(candidate));
      if (savedCommand) {
        const command = JSON.parse(savedCommand) as PetCommand;
        if (command.requestId && command.kind) { pending.current = command; dispatch({ type: "request", id: command.requestId }); dispatch({ type: "uncertain", id: command.requestId }); }
      }
      void refresh();
    } catch { if (current(g, previousIdentity, selected)) setMessage("연결 또는 저장을 완료하지 못했어요. 같은 별명으로 다시 확인해 주세요."); }
    finally { clearTimeout(timer); registrationPending.current = false; }
  }, [api, apply, current, dispatch, refresh]);

  const checkCapabilities = useCallback(async () => {
    try {
      const supported = await api.capabilities();
      if (!alive.current) return;
      capabilityRef.current = supported ? "ready" : "missing"; setCapability(capabilityRef.current);
      featuresRef.current = supported || null; setFeatures(featuresRef.current);
      // Retry with the saved token until the server has confirmed registration.
      if (supported && !registeredRef.current && nickRef.current) await connect(nickRef.current);
      await refresh();
    } catch { if (alive.current) { capabilityRef.current = "error"; setCapability("error"); setMessage("개인 기록 연결을 확인하지 못했어요."); } }
  }, [api, refresh, connect]);
  useEffect(() => {
    alive.current = true;
    const nick = safeGet("domine-pet-nick"); nickRef.current = nick; setNickname(nick);
    try { identityRef.current = readIdentity(nick); setIdentity(identityRef.current); } catch { /* No personal storage. */ }
    registeredRef.current = !!identityRef.current && registrationConfirmed(nick); setRegistered(registeredRef.current);
    const selected: PetId = safeGet("domine-pet-selected") === "2" ? 2 : 1; petRef.current = selected; setPetId(selected);
    let saved: string | null = null;
    try { saved = localStorage.getItem("domine-pet-cell"); } catch { /* Default location. */ }
    const map = savedCell(saved, safeGet("domine-pet-map"));
    setVisited(visitedCells(safeGet("domine-pet-visited")));
    const id = ++idCounter.current;
    const controller = new AbortController();
    dispatch({ type: "map", map, id }); dispatch({ type: "map-ready", id }); dispatch({ type: "done", id });
    void prepareImage(mapBackground(worldCell(map).theme, new Date().getHours()), controller.signal).then(() => {
      if (!alive.current || controller.signal.aborted) return;
      visit(map); setWorldReady(true);
    });
    if (identityRef.current) {
      try {
        const saved = safeGet(pendingKey(identityRef.current));
        if (saved) { pending.current = JSON.parse(saved); dispatch({ type: "request", id: pending.current!.requestId }); dispatch({ type: "uncertain", id: pending.current!.requestId }); }
      } catch { setMessage("이 기기의 미확인 요청을 읽지 못했어요."); }
    }
    void checkCapabilities();
    return () => {
      alive.current = false;
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
        return cell ? [mapBackground(cell.theme, hour)] : [];
      }));
      backgrounds.delete(mapBackground(worldCell(machine.committedMap).theme, hour));
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
      if (!visible) { ++generation.current; abort.current?.abort(); mapAbort.current?.abort(); dispatch({ type: "pause" }); setCue(null); }
      else { dispatch({ type: "resume" }); void refresh(); }
    };
    const observer = new IntersectionObserver(([entry]) => { intersecting = entry.isIntersecting; update(); });
    if (host.current) observer.observe(host.current);
    const hide = () => { intersecting = false; update(); };
    const show = () => { intersecting = true; update(); };
    document.addEventListener("visibilitychange", update); window.addEventListener("pagehide", hide); window.addEventListener("pageshow", show);
    const poll = setInterval(() => { if (activeRef.current && machineRef.current.command === "idle") void refresh(); }, 30000);
    return () => { observer.disconnect(); clearInterval(poll); document.removeEventListener("visibilitychange", update); window.removeEventListener("pagehide", hide); window.removeEventListener("pageshow", show); };
  }, [dispatch, refresh]);
  useEffect(() => {
    if (machine.visual !== "acting" || !machine.deadlineAt) return;
    const timer = setTimeout(() => { setCue(null); dispatch({ type: "done", id: machine.sceneId }); }, Math.max(0, machine.deadlineAt - Date.now()));
    return () => clearTimeout(timer);
  }, [machine.visual, machine.sceneId, machine.deadlineAt, dispatch]);
  const completedWalk = useRef(0);
  useEffect(() => {
    if (machine.visual !== "idle" || machine.command !== "idle" || cue?.action !== "walk" || completedWalk.current === cue.id) return;
    completedWalk.current = cue.id; startExploration(worldCell(machine.committedMap).theme, "walk");
  }, [machine.visual, machine.command, machine.committedMap, cue, startExploration]);
  useEffect(() => {
    const ticket = personal?.ticket;
    if (!active || !ticket || ticket.map_id !== worldCell(machine.committedMap).theme || machine.command !== "idle") return;
    const delay = Math.max(250, Date.parse(ticket.eligible_at) - Date.parse(personal.serverNow) + 200);
    const timer = setTimeout(() => { void execute({ kind: "explore_finish", pet: petRef.current, ticket: ticket.id, requestId: crypto.randomUUID() }); }, delay);
    return () => clearTimeout(timer);
  }, [personal?.ticket, personal?.serverNow, machine.committedMap, machine.command, active, execute]);

  function selectPet(id: PetId) {
    if ((machineRef.current.visual !== "paused" && visualLocked(machineRef.current)) || id === petRef.current) return;
    ++generation.current; ++readSequence.current; abort.current?.abort();
    if (pending.current) dispatch({ type: "uncertain", id: pending.current.requestId });
    petRef.current = id; setPetId(id); setCue(null); setShared(null);
    setFeedback(null);
    if (personalRef.current) {
      personalRef.current = { ...personalRef.current, pet: id, coins: personalRef.current.coins ?? personalRef.current.player?.coins, player: undefined, inventory: undefined };
      setPersonal(personalRef.current);
    }
    try { localStorage.setItem("domine-pet-selected", String(id)); } catch { /* Optional preference. */ }
    void refresh();
  }
  const done = useCallback((id: number, sleep?: boolean) => dispatch({ type: "done", id, sleep }), [dispatch]);
  return { host, api, machine, active, shared, personal, feedback, message, rewardNotice, setMessage, capability, features, registered, identity, nickname, petId, multiPet, cue, visited, arrival, travel, worldReady,
    care, localScene, done, connect, selectPet, execute, refresh, checkCapabilities,
    retry: () => { if (pending.current) void execute(pending.current, true); },
    pause: () => { ++generation.current; abort.current?.abort(); mapAbort.current?.abort(); dispatch({ type: "pause" }); setCue(null); },
    resume: () => { if (activeRef.current) { dispatch({ type: "resume" }); void refresh(); } },
  };
}
