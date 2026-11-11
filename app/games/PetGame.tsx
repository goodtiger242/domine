"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ACTION_DONE, ACTION_ICON, ACTION_LABEL, availableActionGroups, collarToday, faceOf, LOCAL_ACTIONS, PET_ACTIONS, stageOf, STAGE_LABEL, timeAgo, type PetCategory, type PetState } from "@/lib/domine/pet";
import { line } from "@/lib/domine/pet-lines";
import { fallingNeeds } from "@/lib/domine/pet-signals";
import { actionsForMap } from "@/lib/domine/pet-maps";
import { worldCell } from "@/lib/domine/pet-world";
import { PETS, petText } from "@/lib/domine/pet-photos";
import type { PetApi } from "@/lib/domine/pet-rpc";
import { visualLocked } from "@/lib/domine/pet-machine";
import { PetScene } from "./PetScene";
import PetProgress from "./PetProgress";
import PetFeedback from "./PetFeedback";
import { usePetController } from "./usePetController";
import "./pet-game.css";
const PetShopSheet = dynamic(() => import("./PetShopSheet"));
const PetAlbumSheet = dynamic(() => import("./PetAlbumSheet"));
const PetAchievementSheet = dynamic(() => import("./PetAchievementSheet"));
const PetHistorySheet = dynamic(() => import("./PetHistorySheet"));
const PetWorldSheet = dynamic(() => import("./PetWorldSheet"));
const PetSheet = dynamic(() => import("./PetSheet"));
type Sheet = "map" | "shop" | "bag" | "album" | "achievements" | "history" | "record" | "notice" | null;

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
  const { machine, shared: pet, personal } = game;
  const [sheet, setSheet] = useState<Sheet>(null), [category, setCategory] = useState<PetCategory>("먹이");
  const [nickInput, setNickInput] = useState(""), [transfer, setTransfer] = useState("");
  const [showCode, setShowCode] = useState(false), [connecting, setConnecting] = useState(false);
  const [speech, setSpeech] = useState<{ text: string; speaker: "dog" | "priest" }>({ text: "", speaker: "dog" });
  const [hour, setHour] = useState(12);
  const tabsId = useId();
  const stage = stageOf(pet?.care_total ?? 0), face = pet ? faceOf(pet, hour >= 21 || hour < 5) : "happy";
  const cell = worldCell(machine.committedMap);
  const groups = availableActionGroups(actionsForMap(PET_ACTIONS, cell.theme));
  const selected = groups.find((g) => g.category === category) ?? groups[0];
  const locked = !game.worldReady || visualLocked(machine), disabled = !game.registered || game.capability !== "ready" || machine.command !== "idle";
  const notice = game.capability === "missing" ? "개인 진행 준비 중 · 기존 돌보기는 계속할 수 있어요."
    : game.capability === "error" ? "개인 기록 연결을 확인하지 못했어요. 기록 메뉴에서 다시 확인해 주세요."
    : !game.registered ? "기록 메뉴에서 별명을 등록하면 코인이 쌓여요." : game.message;
  const progressNotice = [machine.command === "pending" ? "보상 확인 중…" : machine.command === "uncertain" ? "응답을 확인하지 못했어요. 결과 확인을 눌러 주세요." : "", game.rewardNotice, game.message || notice,
    game.capability === "ready" && !game.features?.v9 ? "서버 업데이트 대기 중(새 지역 탐험은 아직)" : ""].filter(Boolean).join(" · ");
  const say = useCallback((text: string, speaker: "dog" | "priest" = "dog") => setSpeech({ text, speaker }), []);
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
  useEffect(() => { if (game.arrival) say(game.arrival.text); }, [game.arrival, say]);
  useEffect(() => { setHour(new Date().getHours()); }, []);
  useEffect(() => {
    if (!game.active || sheet) return;
    const timer = setInterval(() => { setHour(new Date().getHours()); }, 9000);
    return () => clearInterval(timer);
  }, [game.active, sheet]);
  function open(next: Sheet) { game.pause(); setSheet(next); }
  function close() { setShowCode(false); setTransfer(""); setSheet(null); game.resume(); }
  const equipment = (slot: string) => personal?.equipment?.find((e) => e.pet_id === game.petId && e.slot === slot)?.item_id;
  async function connect(value: string, imported = false) {
    setConnecting(true);
    try { await game.connect(value, imported); } finally { setConnecting(false); }
  }
  return <div ref={game.host} className="pet-game">
    <div className="pet-title-row">
      <h2 className="t-heading">우리 강아지</h2>
      <div role="group" aria-label="강아지 선택">{([1, 2] as const).filter((id) => game.multiPet || id === 1).map((id) => <button type="button" key={id} aria-pressed={game.petId === id} disabled={locked} onClick={() => { game.selectPet(id); setSpeech({ text: "", speaker: "dog" }); }}>{PETS[id].name}</button>)}</div>
      <button type="button" className="pet-record-button" onClick={() => open("record")}>내 별명 바꾸기</button>
    </div>
    <div className="pet-progress-row">{personal && !personal.player ? <span role="status">{PETS[game.petId].name} 진행 불러오는 중… · 우리 코인(공용) {personal.coins ?? 0}</span> : <PetProgress key={game.petId} name={PETS[game.petId].name} xp={personal?.player?.xp ?? 0} coins={personal?.coins ?? personal?.player?.coins ?? 0} />}
      {game.capability === "missing" && <span className="pet-preparing">준비 중</span>}
      {machine.command === "uncertain" && <button type="button" onClick={game.retry}>결과 확인</button>}
    </div>
    <div className="pet-progress-note" role="status"><button type="button" disabled={!progressNotice} title={progressNotice || undefined} aria-label={progressNotice ? `안내 전체 보기: ${progressNotice}` : "새 안내 없음"} onClick={() => open("notice")}>{progressNotice || "\u00a0"}</button></div>
    <div className="pet-stage relative aspect-[16/9] overflow-hidden rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg)]">
      {game.worldReady ? <PetScene key={game.petId} petId={game.petId} cellId={cell.id} travel={game.travel} arrivalId={game.arrival?.id} onMap={() => open("map")} onLocal={game.localScene} locked={locked}
        paused={!game.active || !!sheet || machine.visual === "paused"} stage={stage} face={face} hour={hour}
        light={hour >= 21 || hour < 5 ? .8 : hour < 7 || hour >= 17 ? .9 : 1} collar={collarToday().hex}
        cue={game.cue} onSay={say} onDone={game.done} speaker={speech.speaker}
        bubble={speech.text.endsWith("에 왔어요") ? speech.text : petText(speech.text || "반가워요!", game.petId)} wearable={equipment("wearable")} toy={equipment("toy")} />
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
      {group.actions.map((action) => <button type="button" key={action} className="pet-action" disabled={locked} data-active={machine.visual === "acting" && game.cue?.action === action} onClick={() => game.care(action)}>
        <span aria-hidden="true">{action === "sleep" ? LOCAL_ACTIONS.sleep.icon : ACTION_ICON[action]}</span><span>{action === "sleep" ? LOCAL_ACTIONS.sleep.label : ACTION_LABEL[action]}</span>
      </button>)}
    </div>)}
    <nav className="pet-menu" aria-label="진행과 기록"><button type="button" onClick={() => open("shop")}><span aria-hidden="true">🛍️</span>상점</button><button type="button" onClick={() => open("bag")}><span aria-hidden="true">🎒</span>가방</button><button type="button" onClick={() => open("album")}><span aria-hidden="true">📖</span>도감</button><button type="button" onClick={() => open("achievements")}><span aria-hidden="true">🏅</span>업적</button><button type="button" onClick={() => open("history")}><span aria-hidden="true">🕘</span>이력</button></nav>
    {sheet === "map" && <PetWorldSheet current={cell.id} visited={game.visited} onClose={close}
      onMove={(to) => { close(); void game.localScene({ action: "map", to, id: 0 }); }} />}
    {(sheet === "shop" || sheet === "bag") && <PetShopSheet bag={sheet === "bag"} state={personal} petId={game.petId} disabled={disabled || !personal?.player} notice={notice} execute={game.execute} onClose={close} onSelectPet={game.selectPet} multiPet={game.multiPet} onShop={() => setSheet("shop")} />}
    {sheet === "album" && <PetAlbumSheet state={personal} disabled={disabled} notice={notice} map={cell.theme} execute={game.execute} onClose={close} />}
    {sheet === "achievements" && <PetAchievementSheet badges={personal?.badges ?? []} notice={notice} onClose={close} />}
    {sheet === "history" && <PetHistorySheet history={game.api.history} onClose={close} />}
    {(sheet === "record" || sheet === "notice") && <PetSheet title={sheet === "notice" ? "안내" : "내 기록"} onClose={close}
      footer={sheet === "notice" && !game.registered && <button type="button" className="pet-primary" onClick={() => setSheet("record")}>별명 등록하고 코인 모으기</button>}>
      {sheet === "notice" ? <p className="pet-sheet-note">{progressNotice || "새 안내가 없어요."}</p> : <>
      <p className="pet-sheet-note" role="status">{game.message || notice || `${game.nickname}님의 개인 기록이에요.`}</p>
      <form className="pet-record-form" onSubmit={(e) => { e.preventDefault(); void connect(nickInput); }}><label htmlFor={`${tabsId}-nick`}>별명 · 한글, 영문, 숫자 1~8자</label>
        <input id={`${tabsId}-nick`} value={nickInput} onChange={(e) => setNickInput(e.target.value)} autoComplete="off" enterKeyHint="done" maxLength={16} />
        <button type="submit" disabled={connecting || machine.command !== "idle"}>별명으로 시작 / 연결</button>
      </form>
      {game.capability !== "missing" && <form className="pet-record-form" onSubmit={(e) => { e.preventDefault(); void connect(transfer, true); }}><label htmlFor={`${tabsId}-transfer`}>다른 기기의 이전 코드</label>
        <input id={`${tabsId}-transfer`} type="password" value={transfer} onChange={(e) => setTransfer(e.target.value)} autoComplete="off" enterKeyHint="done" spellCheck={false} />
        <button type="submit" disabled={connecting || machine.command !== "idle"}>기록 가져오기</button>
      </form>}
      {game.identity && <div className="pet-record-form"><button type="button" onClick={() => setShowCode(!showCode)}>내 이전 코드 {showCode ? "숨기기" : "보기"}</button>
        {showCode && <><p>이 코드는 내 기록의 열쇠예요. 다른 사람에게 공유하지 마세요.</p><textarea readOnly aria-label="내 이전 코드" value={`${game.identity.nickname}:${game.identity.secret}`} onFocus={(e) => e.target.select()} /><button type="button" onClick={() => { void navigator.clipboard.writeText(`${game.identity!.nickname}:${game.identity!.secret}`).then(() => game.setMessage("이전 코드를 복사했어요.")).catch(() => game.setMessage("코드를 선택해 직접 복사해 주세요.")); }}>복사</button></>}
      </div>}
      <button type="button" onClick={() => void game.checkCapabilities()}>연결 다시 확인</button>
      {machine.command === "uncertain" && <button type="button" onClick={game.retry}>미확인 요청 결과 확인</button>}
      {pet && <><p className="pet-sheet-note">{STAGE_LABEL[stage]} · 함께한 돌봄 {pet.care_total}회</p><h3>오늘 돌봐 준 친구들</h3><ul>{pet.today_top.map((r) => <li key={r.nickname}>{r.nickname} · {r.count}번</li>)}</ul><h3>최근 기록</h3><ul>{pet.recent.map((r, i) => <li key={i}>{r.nickname}님이 {ACTION_DONE[r.action]} · {timeAgo(r.created_at)}</li>)}</ul></>}
      </>}
    </PetSheet>}
  </div>;
}

