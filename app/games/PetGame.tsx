"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ACTION_ICON, ACTION_LABEL, availableActionGroups, collarToday, faceOf, LOCAL_ACTIONS, PET_ACTIONS, stageOf, type PetCategory, type PetState } from "@/lib/domine/pet";
import { line } from "@/lib/domine/pet-lines";
import { routinePeriod } from "@/lib/domine/pet-idle";
import { CATALOG } from "@/lib/domine/pet-catalog";
import { fallingNeeds } from "@/lib/domine/pet-signals";
import { queueSpeech, type Speech } from "@/lib/domine/pet-bubble";
import { actionsForMap } from "@/lib/domine/pet-maps";
import { worldCell } from "@/lib/domine/pet-world";
import { PETS, petText } from "@/lib/domine/pet-photos";
import { encounterChoice, spawnsFor, encounterSlot, ENCOUNTER_STORAGE, readEncounterWins, type Encounter } from "@/lib/domine/pet-battle-view";
import { PET_LEGAL_NAMES } from "@/lib/domine/pet-identity";
import type { PetApi } from "@/lib/domine/pet-rpc";
import type { KingSettlement } from "@/lib/domine/pet-king-rpc";
import { visualLocked } from "@/lib/domine/pet-machine";
import { PetScene } from "./PetScene";
import PetProgress from "./PetProgress";
import PetFeedback, { PetNotice, PetPickupFeedback } from "./PetFeedback";
import { usePetController } from "./usePetController";
import { usePetKing } from "./usePetKing";
import { selectedItems } from "@/lib/domine/pet-king-items";
import { departedWins, type KingApi } from "@/lib/domine/pet-king-client";
import "./pet-game.css";
const loading = () => <div className="pet-sheet-loading" role="status" aria-busy="true">불러오는 중…</div>;
const PetShopSheet = dynamic(() => import("./PetShopSheet"), { loading });
const PetAlbumSheet = dynamic(() => import("./PetAlbumSheet"), { loading });
const PetHistorySheet = dynamic(() => import("./PetHistorySheet"), { loading });
const PetAchievementSheet = dynamic(() => import("./PetAchievementSheet"), { loading });
const PetWorldSheet = dynamic(() => import("./PetWorldSheet"), { loading });
const PetStatusSheet = dynamic(() => import("./PetStatusSheet"), { loading });
const PetJobSheet = dynamic(() => import("./PetJobSheet"), { loading });
const PetSheet = dynamic(() => import("./PetSheet"), { loading });
const PetBattleSheet = dynamic(() => import("./PetBattleSheet"), { ssr: false, loading });
const PetEncounterSheet = dynamic(() => import("./PetEncounterSheet"), { loading });
type Sheet = "status" | "job" | "map" | "shop" | "bag" | "album" | "achievements" | "history" | "record" | "notice" | "encounter" | "battle" | null;
const BUSY_ACTION: Record<string, string> = { feed: "밥 주는", treat: "간식 주는", pet: "쓰다듬는", play: "공놀이하는", walk: "산책하는", brush: "빗질하는", bath: "목욕시키는", train: "훈련하는" };


export function PetGame({ api, kingApi }: { api?: PetApi; kingApi?: KingApi } = {}) {
  const game = usePetController(api, kingApi);
  const { machine, shared: pet, personal, care } = game;
  const [sheet, setSheet] = useState<Sheet>(null), [category, setCategory] = useState<PetCategory>("먹이");
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [slot, setSlot] = useState(encounterSlot), [clock, setClock] = useState(() => Date.now());
  const [wins, setWins] = useState<string[]>([]);
  const [animalMap, setAnimalMap] = useState(false), [noOpponent, setNoOpponent] = useState(false);
  useEffect(() => { try { setAnimalMap(window.localStorage.getItem("domine-pet-map-animals") === "1"); } catch { /* Default: hidden. */ } }, []);
  const rememberAnimals = (visible: boolean) => { setAnimalMap(visible); try { window.localStorage.setItem("domine-pet-map-animals", visible ? "1" : "0"); } catch { /* Session only. */ } };
  const [storageError, setStorageError] = useState("");
  const [nameSearch, setNameSearch] = useState(""), [connecting, setConnecting] = useState(false);
  const query = nameSearch.normalize("NFC").trim();
  const [invalidName, setInvalidName] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [settlement, setSettlement] = useState<{ pet: number; result: KingSettlement; hasWon: boolean } | null>(null);
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const speech = speeches[0];
  const [hour, setHour] = useState(12);
  const tabsId = useId();
  // After the per-player migration every name owns its dogs and coins; before it they are shared.
  const mine = !!game.features?.perPlayer, coinLabel = mine ? "내 코인" : "우리 코인(공용)";
  const stage = stageOf(pet?.care_total ?? 0), face = pet ? faceOf(pet, hour >= 21 || hour < 5) : "happy";
  const cell = worldCell(machine.committedMap);
  const groups = availableActionGroups(actionsForMap(PET_ACTIONS, cell.theme));
  const selected = groups.find((g) => g.category === category) ?? groups[0];
  const locked = sheet === "battle" || !game.worldReady || visualLocked(machine), disabled = !game.registered || game.capability !== "ready" || machine.command !== "idle";
  const notice = game.capability === "missing" ? "강아지를 준비 중이에요."
    : game.capability === "error" ? "연결을 확인하지 못했어요."
    : !game.registered ? "내 이름을 입력하면 함께 키울 수 있어요" : "";
  const busyText = game.busy ? `${game.busy.nickname}님이 ${PETS[game.petId].name}에게 ${BUSY_ACTION[game.busy.action]} 중이에요` : "";
  const status = storageError || game.message || (game.canRetry ? "응답을 확인하지 못했어요." : "") || notice;
  const king = usePetKing(game.kingApi, game.registered ? game.identity : null, cell.id, game.arrival?.id,
    game.worldReady && !game.travel && machine.visual === "idle" && !sheet, game.refresh, game.active && sheet !== "battle");
  useEffect(() => { setSettlement(null); }, [game.identity]);
  const rewardEpoch = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (rewardEpoch.current && king.state?.resetEpoch && rewardEpoch.current !== king.state.resetEpoch) setSettlement(null);
    rewardEpoch.current = king.state?.resetEpoch;
  }, [king.state?.resetEpoch]);
  useEffect(() => {
    const epoch = king.state?.resetEpoch;
    if (!epoch) return;
    try {
      if (localStorage.getItem("domine-pet-encounter-epoch") === epoch) return;
      localStorage.removeItem(ENCOUNTER_STORAGE); localStorage.setItem("domine-pet-encounter-epoch", epoch);
    } catch { /* Reset session wins even when storage is unavailable. */ }
    setWins([]);
  }, [king.state?.resetEpoch]);
  const reward = settlement?.pet === game.petId ? settlement.result : undefined;
  const savedGrowth = king.state?.pets.find(p => p.pet === game.petId);
  const growth = reward?.progress && (!savedGrowth || reward.progress.version >= savedGrowth.version) ? reward.progress : savedGrowth;
  const playerLevel = growth?.level ?? 1;
  const wallet = king.state && king.state.version >= (personal?.version ?? -1) ? king.state : personal;
  const confirmedWallet = settlement?.result.wallet;
  const coins = confirmedWallet && confirmedWallet.version >= (wallet?.version ?? -1) ? confirmedWallet.coins : wallet?.coins ?? personal?.player?.coins ?? 0;
  const firstOpponent = game.registered && !king.state?.encyclopedia.some(e => e.wins > 0) && !settlement?.hasWon;
  const nameError = invalidName || game.message === "이름을 다시 입력해 주세요" || game.message === "도미네 청년회 이름을 정자로 사용해주세요";
  const connectionError = connectionFailed || game.capability === "error" || !!game.message && !["이름을 다시 입력해 주세요", "도미네 청년회 이름을 정자로 사용해주세요", "내 이름을 입력하면 함께 키울 수 있어요"].includes(game.message);
  const [supportMove, setSupportMove] = useState("");
  const [carried, setCarried] = useState<string[]>([]);
  const carryKey = `domine-pet-items:${game.petId}`;
  useEffect(() => {
    try { const saved = JSON.parse(window.localStorage.getItem(carryKey) ?? "[]"); setCarried(selectedItems(saved,Object.fromEntries((Array.isArray(saved) ? saved : []).map(id => [id,1])))); }
    catch { setCarried([]); }
  }, [carryKey]);
  const items = selectedItems(carried,growth?.inventory ?? {});
  const rememberItems = (next: string[]) => { setCarried(next); try { window.localStorage.setItem(carryKey,JSON.stringify(next)); } catch { /* Session memory remains available. */ } };
  const sharedWins = departedWins(wins, king.departed, slot);
  // Animals are the same for every player: the server's level profile and the clock decide who is here now.
  const profile = king.state?.levelProfile;
  const currentEncounters = spawnsFor(cell.id, playerLevel, slot, sharedWins, { profile, now: clock });
  const jobReady = !!growth && !growth.job && growth.level >= 10 && !!king.state?.certifications?.some(c => c.pet === game.petId && c.kind === "region" && c.target === "R01");
  const careLocked = locked || !!game.busy || (!!game.features?.busyLock && machine.command !== "idle");
  const say = useCallback((text: string, speaker: "dog" | "priest" = "dog") => setSpeeches((queue) => queueSpeech(queue, { text, speaker })), []);
  const strokePet = useCallback(() => care("pet", true), [care]);
  const greetings = useRef(new Set<string>());
  useEffect(() => {
    if (careLocked || !game.active || sheet) return;
    const period = routinePeriod(hour), key = `${game.petId}:${period}`;
    if (greetings.current.has(key)) return;
    greetings.current.add(key); say(line(`greeting_${period}`));
  }, [careLocked, game.active, game.petId, sheet, hour, say]);
  const needs = useRef<Record<number, { previous: PetState; seen: Set<string>; pending: string[] }>>({});
  useEffect(() => {
    if (!pet) return;
    const entry = needs.current[game.petId] ??= { previous: pet, seen: new Set(), pending: [] };
    entry.pending.push(...fallingNeeds(entry.previous, pet, entry.seen));
    entry.previous = pet;
    if (!locked && game.active && !sheet && entry.pending.length) {
      say([...new Set(entry.pending)].map((key) => line(key)).join(" "));
      entry.pending = [];
    }
  }, [pet, game.petId, locked, game.active, sheet, say]);
  useEffect(() => {
    if (game.arrival) setSpeeches((queue) => queueSpeech(queue, { text: game.arrival!.text, speaker: "dog", arrival: true }));
  }, [game.arrival]);
  useEffect(() => {
    if (!speech || !game.active || sheet) return;
    const timer = setTimeout(() => setSpeeches((queue) => queue.slice(1)), 2400);
    return () => clearTimeout(timer);
  }, [speech, game.active, sheet]);
  useEffect(() => { setHour(new Date().getHours()); }, []);
  useEffect(() => {
    if (sheet === "battle") return;
    const refresh = () => {
      const next = encounterSlot();
      setSlot(next); setClock(Date.now());
      try { setWins(previous => [...new Set([...previous.filter(key => key.startsWith(`${next}:`)), ...readEncounterWins(window.localStorage, next)])]); }
      catch { /* Storage may be unavailable; keep this session's wins. */ }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("storage", refresh);
    return () => { clearInterval(timer); window.removeEventListener("storage", refresh); };
  }, [sheet]);
  useEffect(() => {
    setNoOpponent(false);
  }, [cell.id]);
  useEffect(() => {
    if (!noOpponent) return;
    const timer = setTimeout(() => setNoOpponent(false), 2500);
    return () => clearTimeout(timer);
  }, [noOpponent]);
  useEffect(() => {
    if (!game.active || sheet) return;
    const timer = setInterval(() => { setHour(new Date().getHours()); }, 9000);
    return () => clearInterval(timer);
  }, [game.active, sheet]);
  function open(next: Sheet) { if (next === "record") { setNameSearch(""); setInvalidName(false); } setNoOpponent(false); game.pause(next === "battle"); setSheet(next); }
  function openMap(animals = false) { if (animals) rememberAnimals(true); open("map"); }
  function startBattle(selected?: Encounter) {
    if (sheet || locked) return;
    if (!game.registered) { game.setMessage("이름을 먼저 입력해 주세요"); return; }
    const now = encounterSlot();
    let saved = wins;
    try { saved = [...new Set([...wins, ...readEncounterWins(window.localStorage, now)])]; } catch { /* Use the session record. */ }
    const time = Date.now();
    setSlot(now); setWins(saved); setClock(time);
    const next = spawnsFor(cell.id, playerLevel, now, departedWins(saved, king.departed, now), { profile, now: time });
    const choice = encounterChoice(next);
    const chosen = selected ? next.find(e => e.id === selected.id) : choice === "confirm" ? next[0] : null;
    if (selected && !chosen || choice === "empty") { setNoOpponent(true); return; }
    setEncounter(chosen ?? null); open("encounter");
  }
  function confirmBattle() {
    if (!encounter) return;
    const now = encounterSlot();
    let saved = wins;
    try { saved = [...new Set([...wins, ...readEncounterWins(window.localStorage, now)])]; } catch { /* Keep session wins. */ }
    const next = spawnsFor(cell.id, playerLevel, now, departedWins(saved, king.departed, now), { profile, now: Date.now() }).find(e => e.id === encounter.id);
    setSlot(now); setWins(saved);
    if (!next) { close(); setNoOpponent(true); return; }
    setEncounter(next); open("battle");
  }
  function winBattle() {
    if (!encounter || encounter.slot !== encounterSlot()) return;
    let next = [...new Set([...wins, encounter.id])];
    try {
      next = [...new Set([...readEncounterWins(window.localStorage, encounter.slot), ...next.filter(key => key.startsWith(`${encounter.slot}:`))])];
      window.localStorage.setItem(ENCOUNTER_STORAGE, JSON.stringify(next));
      setStorageError("");
    } catch { setStorageError("승리 기록을 저장하지 못했어요. 새로 열면 상대가 다시 보여요."); }
    setWins(next);
  }
  function close() { setNameSearch(""); setInvalidName(false); setSheet(null); game.resume(); }
  const equipment = (slot: string) => personal?.equipment?.find((e) => e.pet_id === game.petId && e.slot === slot)?.item_id;
  async function connect(value: string) {
    const name = value.normalize("NFC").trim();
    if (!PET_LEGAL_NAMES.includes(name)) { setInvalidName(true); return; }
    if (connecting) return;
    setConnecting(true); setConnectionFailed(false); setInvalidName(false);
    try { await game.connect(name); setSheet(null); game.resume(); }
    catch { setConnectionFailed(true); }
    finally { setConnecting(false); }
  }
  async function retryConnection() {
    if (connecting) return;
    setConnecting(true); setConnectionFailed(false); game.setMessage("");
    try {
      if (game.capability !== "ready") await game.checkCapabilities();
      if (PET_LEGAL_NAMES.includes(query)) await game.connect(query);
    } catch { setConnectionFailed(true); }
    finally { setConnecting(false); }
  }
  return <div ref={game.host} className="pet-game">
    <div className="pet-title-row">
      <h2 className="t-heading">우리 강아지</h2>
      <div role="group" aria-label="강아지 선택">{([1, 2] as const).filter((id) => game.multiPet || id === 1).map((id) => <button type="button" key={id} aria-pressed={game.petId === id} disabled={locked} onClick={() => { game.selectPet(id); setSpeeches([]); }}>{PETS[id].name}</button>)}</div>
      <button type="button" className="pet-record-button" onClick={() => open("record")}>{game.registered && game.nickname || "내 이름"}</button>
    </div>
    {!game.registered && <form className="pet-name-gate" onSubmit={(event) => { event.preventDefault(); void connect(query); }}>
      <strong>이름을 입력해 주세요</strong>
      <p>{mine ? "이름마다 내 도미·미네를 키워요." : "청년회 이름을 입력하면 도미·미네와 함께 시작해요."}</p>
      <div>
        <input aria-label="이름" type="text" value={nameSearch} onChange={(e) => { setNameSearch(e.target.value); setInvalidName(false); }} autoComplete="off" placeholder="이름" enterKeyHint="go" />
        <button type="submit" aria-busy={connecting} disabled={connecting || !query || game.capability === "loading"}>{connecting ? "확인 중…" : "시작"}</button>
      </div>
      {nameError && <p role="status" className="pet-name-gate-error">도미네 청년회 이름을 정자로 사용해주세요</p>}
      {connectionError && <p role="status" className="pet-name-gate-error">연결을 확인하지 못했어요 · <button type="button" disabled={connecting} aria-busy={connecting} onClick={() => void retryConnection()}>{connecting ? "확인 중…" : "다시 시도"}</button></p>}
      {game.capability === "loading" && <p role="status">연결 확인 중…</p>}
    </form>}
    {game.registered && <div className="pet-progress-row">{personal && !personal.player ? <span role="status">불러오는 중… · <span aria-label={`${coinLabel} ${personal.coins ?? 0}`}>🪙 {personal.coins ?? 0}</span></span> : <PetProgress key={game.petId} coinLabel={coinLabel} onInfo={() => open("status")} needs={pet ? { fullness: pet.fullness, mood: pet.mood, clean: pet.clean ?? 80 } : undefined} name={PETS[game.petId].name} level={playerLevel} xp={growth?.xp ?? 0} coins={coins} reward={reward} />}
      {game.canRetry && <button type="button" onClick={game.retry}>결과 확인</button>}
    </div>}
    {status && game.registered && <PetNotice key={`${game.petId}-${status}`} parts={[status]} onOpen={() => open(game.registered ? "notice" : "record")} />}
    {firstOpponent && !sheet && <button type="button" className="pet-first-opponent" disabled={locked} onClick={() => openMap(true)}>지도에서 첫 상대 찾기</button>}
    {jobReady && !firstOpponent && !sheet && <button type="button" className="pet-job-ready" disabled={locked} onClick={() => open("job")}>⭐ {PETS[game.petId].name}가 직업을 가질 수 있어요</button>}
    <div onPointerDownCapture={() => setNoOpponent(false)} className="pet-stage relative aspect-[16/9] overflow-hidden rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg)]">
      {game.worldReady ? <PetScene key={game.petId} busyText={busyText} watchingText={sheet === "battle" ? "" : king.watching} petId={game.petId} cellId={cell.id} travel={game.travel} arrivalId={game.arrival?.id} onMap={() => openMap()} onLocal={game.localScene} locked={locked}
        onBattle={() => startBattle()} encounters={currentEncounters} selectedEncounter={sheet === "encounter" ? encounter?.id : undefined} onEncounter={startBattle} battleDisabled={locked}
        tapDisabled={careLocked || machine.command !== "idle"} onPet={strokePet}
        bagToy={personal?.inventory?.find((id) => CATALOG.some((item) => item.id === id && item.slot === "toy"))}
        paused={!game.active || !!sheet || machine.visual === "paused"} stage={stage} face={face} hour={hour}
        light={hour >= 21 || hour < 5 ? .8 : hour < 7 || hour >= 17 ? .9 : 1} collar={collarToday().hex}
        cue={game.cue} onSay={say} onDone={game.done} speaker={speech?.speaker} needs={pet ?? undefined}
        bubble={speech?.arrival ? speech.text : petText(speech?.text || "반가워요!", game.petId)} wearable={equipment("wearable")} toy={equipment("toy")} />
        : <p className="p-8 text-center text-sm" role="status">동네를 불러오고 있어요…</p>}
      {noOpponent && <div className="pet-encounter-notice" role="status"><button type="button" onClick={() => openMap(true)}>상대가 없어요 · 지도에서 찾기</button></div>}
      {game.feedback && <PetFeedback key={game.feedback.id} result={game.feedback.result} previousLevel={game.feedback.previousLevel} />}
      {king.pickup && !game.travel && !sheet && <PetPickupFeedback key={king.pickup.id} coins={king.pickup.coins} pouch={king.pickup.pouch} />}
    </div>
    <div role="tablist" aria-label="돌보기 카테고리" className="pet-tab-row">{groups.map((group, index) => <button type="button" role="tab" key={group.category}
      id={`${tabsId}-${group.category}`} aria-controls={`${tabsId}-panel-${group.category}`} aria-selected={selected.category === group.category}
      tabIndex={selected.category === group.category ? 0 : -1} className="pet-category" onClick={() => setCategory(group.category)}
      onKeyDown={(event) => {
        const n = event.key === "ArrowRight" ? (index + 1) % groups.length : event.key === "ArrowLeft" ? (index + groups.length - 1) % groups.length : event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : -1;
        if (n < 0) return; event.preventDefault(); setCategory(groups[n].category); document.getElementById(`${tabsId}-${groups[n].category}`)?.focus();
      }}>{group.category}</button>)}</div>
    {groups.map((group) => <div key={group.category} role="tabpanel" hidden={selected.category !== group.category} className="pet-actions"
      id={`${tabsId}-panel-${group.category}`} aria-labelledby={`${tabsId}-${group.category}`}>
      {group.actions.map((action) => <button type="button" key={action} className="pet-action" disabled={careLocked} data-pending={game.requestingAction === action} aria-busy={game.requestingAction === action} data-active={machine.visual === "acting" && game.cue?.action === action} onClick={() => game.care(action)}>
        <span aria-hidden="true">{action === "sleep" ? LOCAL_ACTIONS.sleep.icon : ACTION_ICON[action]}</span><span>{action === "sleep" ? LOCAL_ACTIONS.sleep.label : ACTION_LABEL[action]}</span>
      </button>)}
    </div>)}
    <nav className="pet-menu" aria-label="진행과 기록"><button type="button" onClick={() => open("shop")}><span aria-hidden="true">🛍️</span>상점</button><button type="button" onClick={() => open("bag")}><span aria-hidden="true">🎒</span>가방</button><button type="button" onClick={() => open("album")}><span aria-hidden="true">📖</span>도감</button><button type="button" onClick={() => open("achievements")}><span aria-hidden="true">🏅</span>업적</button><button type="button" onClick={() => open("history")}><span aria-hidden="true">🕘</span>이력</button></nav>
    {sheet === "encounter" && <PetEncounterSheet encounters={currentEncounters} selected={encounter} petId={game.petId} supportMove={supportMove} onSupportMove={setSupportMove} inventory={growth?.inventory} items={items} onItems={rememberItems} onSelect={setEncounter} onStart={confirmBattle} onClose={close} />}
    {sheet === "battle" && encounter && <PetBattleSheet key={`${encounter.id}:${game.petId}`} encounter={encounter} petId={game.petId} condition={pet ?? undefined} stage={stage} hour={hour} onClose={close} onWin={winBattle}
      kingApi={game.kingApi} identity={game.identity} growth={growth} supportMove={supportMove} items={items} onInventoryRefresh={king.refresh} firstWin={!!king.state && !king.state.encyclopedia.some(e => e.individualId === encounter.individual.id && e.wins > 0)} onSettled={result => { king.settled(result); setSettlement(previous => ({ pet: game.petId, result, hasWon: !!previous?.hasWon || result.outcome === "win" })); }} />}
    {sheet === "status" && <PetStatusSheet petId={game.petId} growth={growth} condition={pet ?? undefined} supportMove={supportMove} stage={stage} onClose={close} onJob={game.kingApi ? () => open("job") : undefined} />}
    {sheet === "job" && <PetJobSheet petId={game.petId} growth={growth} coins={coins} certifications={king.state?.certifications ?? []} chooseJob={king.chooseJob} onClose={close} onMap={() => openMap(true)} />}
    {sheet === "map" && <PetWorldSheet current={cell.id} visited={game.visited} onClose={close} slot={slot} wins={sharedWins} careLevel={playerLevel} showAnimals={animalMap} onAnimals={rememberAnimals} profile={profile} now={clock}
      onMove={(to) => { close(); void game.localScene({ action: "map", to, id: 0 }); }} />}
    {(sheet === "shop" || sheet === "bag") && <PetShopSheet coinLabel={coinLabel} pendingPurchase={king.pendingPurchase} kingState={king.state} buyItem={king.buyItem} bag={sheet === "bag"} state={personal} petId={game.petId} disabled={disabled || !personal?.player} notice={notice} execute={async (...args) => { await game.execute(...args); await king.refresh(); }} onClose={close} onSelectPet={game.selectPet} multiPet={game.multiPet} onFindOpponent={() => openMap(true)} />}
    {sheet === "album" && <PetAlbumSheet state={personal} disabled={disabled} notice={notice} map={cell.theme} execute={game.execute} onClose={close} />}
    {sheet === "history" && <PetHistorySheet title={mine ? "동네 소식" : undefined} history={game.api.history} onClose={close} />}
    {sheet === "achievements" && <PetAchievementSheet badges={personal?.badges ?? []} notice={notice} onClose={close} />}
    {(sheet === "record" || sheet === "notice") && <PetSheet title={sheet === "notice" ? "안내" : "내 이름"} onClose={close}>
      {sheet === "notice" ? <p className="pet-sheet-note">{status || "새 안내가 없어요."}</p> : <>
      <form className="pet-record-form" onSubmit={(event) => { event.preventDefault(); void connect(query); }}>
        <input id={`${tabsId}-name-search`} aria-label="이름" type="text" value={nameSearch} onChange={(e) => { setNameSearch(e.target.value); setInvalidName(false); }} autoComplete="off" placeholder="이름" enterKeyHint="go" />
        {invalidName && <p role="status">도미네 청년회 이름을 정자로 사용해주세요</p>}
        <button type="submit" className="pet-primary" disabled={connecting || !query || machine.command !== "idle"}>시작</button>
      </form>
      </>}
    </PetSheet>}
  </div>;
}

