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
import { encounterFor } from "@/lib/domine/pet-battle-view";
import { PET_LEGAL_NAMES } from "@/lib/domine/pet-identity";
import type { PetApi } from "@/lib/domine/pet-rpc";
import { visualLocked } from "@/lib/domine/pet-machine";
import { PetScene } from "./PetScene";
import PetProgress from "./PetProgress";
import PetFeedback, { PetNotice } from "./PetFeedback";
import { usePetController } from "./usePetController";
import "./pet-game.css";
const PetShopSheet = dynamic(() => import("./PetShopSheet"));
const PetAlbumSheet = dynamic(() => import("./PetAlbumSheet"));
const PetHistorySheet = dynamic(() => import("./PetHistorySheet"));
const PetAchievementSheet = dynamic(() => import("./PetAchievementSheet"));
const PetWorldSheet = dynamic(() => import("./PetWorldSheet"));
const PetSheet = dynamic(() => import("./PetSheet"));
const PetBattleSheet = dynamic(() => import("./PetBattleSheet"), { ssr: false });
type Sheet = "map" | "shop" | "bag" | "album" | "achievements" | "history" | "record" | "notice" | "battle" | null;
const BUSY_ACTION: Record<string, string> = { feed: "밥 주는", treat: "간식 주는", pet: "쓰다듬는", play: "공놀이하는", walk: "산책하는", brush: "빗질하는", bath: "목욕시키는", train: "훈련하는" };

function Mini({ label, icon, value, color }: { label: string; icon: string; value: number; color: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5" title={`${label} ${value} / 100`}>
      <span aria-hidden="true" className="text-[12px] leading-none" style={{ color }}>{icon}</span>
      <span
        className="block h-1 flex-1 overflow-hidden rounded-full bg-white/40"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span className="block h-full origin-left rounded-full transition-transform duration-700 motion-reduce:transition-none" style={{ transform: `scaleX(${value / 100})`, background: color }} />
      </span>
    </span>
  );
}

export function PetGame({ api }: { api?: PetApi } = {}) {
  const game = usePetController(api);
  const { machine, shared: pet, personal, care } = game;
  const [sheet, setSheet] = useState<Sheet>(null), [category, setCategory] = useState<PetCategory>("먹이");
  const [encounter, setEncounter] = useState<ReturnType<typeof encounterFor>>(null);
  const [nameSearch, setNameSearch] = useState(""), [connecting, setConnecting] = useState(false);
  const query = nameSearch.normalize("NFC").trim();
  const [invalidName, setInvalidName] = useState(false);
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const speech = speeches[0];
  const [hour, setHour] = useState(12);
  const tabsId = useId();
  const stage = stageOf(pet?.care_total ?? 0), face = pet ? faceOf(pet, hour >= 21 || hour < 5) : "happy";
  const cell = worldCell(machine.committedMap);
  const groups = availableActionGroups(actionsForMap(PET_ACTIONS, cell.theme));
  const selected = groups.find((g) => g.category === category) ?? groups[0];
  const locked = sheet === "battle" || !game.worldReady || visualLocked(machine), disabled = !game.registered || game.capability !== "ready" || machine.command !== "idle";
  const notice = game.capability === "missing" ? "우리 강아지 준비 중 · 돌보기는 계속할 수 있어요."
    : game.capability === "error" ? "우리 강아지 연결을 확인하지 못했어요. 잠시 후 다시 열어 주세요."
    : !game.registered ? "내 이름을 입력하면 함께 키울 수 있어요" : "";
  const busyText = game.busy ? `${game.busy.nickname}님이 ${PETS[game.petId].name}에게 ${BUSY_ACTION[game.busy.action]} 중이에요` : "";
  const status = game.message || (game.canRetry ? "응답을 확인하지 못했어요. 결과 확인을 눌러 주세요." : "") || notice;
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
    if (!game.active || sheet) return;
    const timer = setInterval(() => { setHour(new Date().getHours()); }, 9000);
    return () => clearInterval(timer);
  }, [game.active, sheet]);
  function open(next: Sheet) { game.pause(next === "battle"); setSheet(next); }
  function startBattle() {
    if (sheet || locked || machine.command !== "idle" || game.busy) return;
    const next = encounterFor(cell.id, personal?.levels?.[game.petId] ?? personal?.player?.level ?? 1);
    if (next) { setEncounter(next); open("battle"); }
  }
  function close() { setNameSearch(""); setInvalidName(false); setSheet(null); game.resume(); }
  const equipment = (slot: string) => personal?.equipment?.find((e) => e.pet_id === game.petId && e.slot === slot)?.item_id;
  async function connect(value: string) {
    const name = value.normalize("NFC").trim();
    if (!PET_LEGAL_NAMES.includes(name)) { setInvalidName(true); return; }
    if (connecting) return;
    setConnecting(true);
    try { await game.connect(name); close(); } finally { setConnecting(false); }
  }
  return <div ref={game.host} className="pet-game">
    <div className="pet-title-row">
      <h2 className="t-heading">우리 강아지</h2>
      <div role="group" aria-label="강아지 선택">{([1, 2] as const).filter((id) => game.multiPet || id === 1).map((id) => <button type="button" key={id} aria-pressed={game.petId === id} disabled={locked} onClick={() => { game.selectPet(id); setSpeeches([]); }}>{PETS[id].name}</button>)}</div>
      <button type="button" className="pet-record-button" onClick={() => open("record")}>{game.nickname || "내 이름"}</button>
    </div>
    <div className="pet-progress-row">{personal && !personal.player ? <span role="status">{PETS[game.petId].name} 진행 불러오는 중… · 우리 코인(공용) {personal.coins ?? 0}</span> : <PetProgress key={game.petId} name={PETS[game.petId].name} xp={personal?.player?.xp ?? 0} coins={personal?.coins ?? personal?.player?.coins ?? 0} />}
      {game.capability === "missing" && <span className="pet-preparing">준비 중</span>}
      {game.canRetry && <button type="button" onClick={game.retry}>결과 확인</button>}
    </div>
    {status && <PetNotice key={`${game.petId}-${status}`} parts={[status]} onOpen={() => open(game.registered ? "notice" : "record")} />}
    <div className="pet-stage relative aspect-[16/9] overflow-hidden rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg)]">
      {game.worldReady ? <PetScene key={game.petId} busyText={busyText} petId={game.petId} cellId={cell.id} travel={game.travel} arrivalId={game.arrival?.id} onMap={() => open("map")} onLocal={game.localScene} locked={locked}
        onBattle={cell.id !== "E5" && cell.id !== "D5" ? startBattle : undefined} battleDisabled={careLocked || machine.command !== "idle"}
        tapDisabled={careLocked || machine.command !== "idle"} onPet={strokePet}
        bagToy={personal?.inventory?.find((id) => CATALOG.some((item) => item.id === id && item.slot === "toy"))}
        paused={!game.active || !!sheet || machine.visual === "paused"} stage={stage} face={face} hour={hour}
        light={hour >= 21 || hour < 5 ? .8 : hour < 7 || hour >= 17 ? .9 : 1} collar={collarToday().hex}
        cue={game.cue} onSay={say} onDone={game.done} speaker={speech?.speaker} needs={pet ?? undefined}
        bubble={speech?.arrival ? speech.text : petText(speech?.text || "반가워요!", game.petId)} wearable={equipment("wearable")} toy={equipment("toy")} />
        : <p className="p-8 text-center text-sm" role="status">동네를 불러오고 있어요…</p>}
      {pet && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-4 bg-gradient-to-t from-black/55 to-transparent px-3 pb-1 pt-3">
        <Mini label="배부름" icon="🍖" value={pet.fullness} color="#f5c878" /><Mini label="기분" icon="♥" value={pet.mood} color="#ffabbc" /><Mini label="청결" icon="💧" value={pet.clean ?? 80} color="#9ae4f0" />
      </div>}
      {game.feedback && <PetFeedback key={game.feedback.id} result={game.feedback.result} previousLevel={game.feedback.previousLevel} />}
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
    {sheet === "battle" && encounter && <PetBattleSheet key={`${encounter.cellId}:${game.petId}`} encounter={encounter} petId={game.petId} stage={stage} hour={hour} onClose={close} />}
    {sheet === "map" && <PetWorldSheet current={cell.id} visited={game.visited} onClose={close}
      onMove={(to) => { close(); void game.localScene({ action: "map", to, id: 0 }); }} />}
    {(sheet === "shop" || sheet === "bag") && <PetShopSheet bag={sheet === "bag"} state={personal} petId={game.petId} disabled={disabled || !personal?.player} notice={notice} execute={game.execute} onClose={close} onSelectPet={game.selectPet} multiPet={game.multiPet} onShop={() => setSheet("shop")} />}
    {sheet === "album" && <PetAlbumSheet state={personal} disabled={disabled} notice={notice} map={cell.theme} execute={game.execute} onClose={close} />}
    {sheet === "history" && <PetHistorySheet history={game.api.history} onClose={close} />}
    {sheet === "achievements" && <PetAchievementSheet badges={personal?.badges ?? []} notice={notice} onClose={close} />}
    {(sheet === "record" || sheet === "notice") && <PetSheet title={sheet === "notice" ? "안내" : "내 이름"} onClose={close}>
      {sheet === "notice" ? <p className="pet-sheet-note">{status || "새 안내가 없어요."}</p> : <>
      {game.nickname && <p className="pet-current-name">지금: {game.nickname}</p>}
      <form className="pet-record-form" onSubmit={(event) => { event.preventDefault(); void connect(query); }}>
        <input id={`${tabsId}-name-search`} aria-label="이름" type="text" value={nameSearch} onChange={(e) => { setNameSearch(e.target.value); setInvalidName(false); }} autoComplete="off" placeholder="이름" enterKeyHint="go" />
        {invalidName && <p role="status">도미네 청년회 이름을 정자로 사용해주세요</p>}
        <button type="submit" className="pet-primary" disabled={connecting || !query || machine.command !== "idle"}>시작</button>
      </form>
      </>}
    </PetSheet>}
  </div>;
}

