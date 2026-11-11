"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ACTION_DONE,
  LOCAL_ACTIONS,
  ACTION_ICON,
  ACTION_LABEL,
  availableActionGroups,
  blip,
  bumpStreak,
  collarToday,
  faceOf,
  formatWait,
  PET_ACTIONS,
  sanitizeNickname,
  saysText,
  STAGE_LABEL,
  stageOf,
  timeAgo,
  type PetAction,
  type PetCategory,
  type PetState,
} from "@/lib/domine/pet";
import { rejectLine } from "@/lib/domine/pet-lines";
import { currentHour } from "@/lib/domine/sky";
import { PETS, petText, type PetId } from "@/lib/domine/pet-photos";
import { DEFAULT_MAP, actionsForMap, petMap, type PetMap, type SceneAction, type SceneCue } from "@/lib/domine/pet-maps";
import { petRequest } from "@/lib/domine/pet-rpc";
import { PetScene } from "./PetScene";

const NICK_KEY = "domine-pet-nick";
const MAP_KEY = "domine-pet-map";
const PET_KEY = "domine-pet-selected";
const SOUND_KEY = "domine-pet-sound";
const NO_WAIT = Object.fromEntries(PET_ACTIONS.map((a) => [a, 0])) as Record<PetAction, number>;

function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

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

export function PetGame() {
  const [supabase] = useState(createClient);
  const tabsId = useId();
  const [petId, setPetId] = useState<PetId>(1);
  const petIdRef = useRef<PetId>(1);
  const nicknameRef = useRef("");
  const legacyRef = useRef(false);
  const [multiPet, setMultiPet] = useState(false);
  const requestId = useRef(0);
  const busyRef = useRef(false);
  const [map, setMap] = useState<PetMap>(DEFAULT_MAP);
  const changeMap = useCallback((next: PetMap) => {
    setMap(next);
    try { localStorage.setItem(MAP_KEY, next); } catch { /* 기기 저장 실패는 무시 */ }
  }, []);
  const [speaker, setSpeaker] = useState<"dog" | "priest">("dog");
  const [category, setCategory] = useState<PetCategory>("먹이");
  const [nick, setNick] = useState("");
  const [nickInput, setNickInput] = useState("");
  const [pet, setPet] = useState<PetState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [cue, setCue] = useState<SceneCue | null>(null);
  const [message, setMessage] = useState("");
  const [wait, setWait] = useState<Record<PetAction, number>>(NO_WAIT);
  const [avail, setAvail] = useState<PetAction[]>(["feed", "pet", "walk"]);
  const [hour, setHour] = useState(12);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bubble, setBubble] = useState("");
  const [sceneBusy, setSceneBusy] = useState(false);
  const sceneBusyRef = useRef(false);
  const sceneTimeout = useRef<number | undefined>(undefined);
  const endScene = useCallback(() => {
    window.clearTimeout(sceneTimeout.current);
    sceneBusyRef.current = false;
    setSceneBusy(false);
  }, []);
  const startScene = useCallback((next: SceneCue) => {
    window.clearTimeout(sceneTimeout.current);
    sceneBusyRef.current = true;
    setSceneBusy(true);
    setCue(next);
    sceneTimeout.current = window.setTimeout(endScene, 30000);
  }, [endScene]);
  useEffect(() => () => window.clearTimeout(sceneTimeout.current), []);
  const localScene = useCallback((next: SceneCue) => {
    if (sceneBusyRef.current || busyRef.current) return;
    startScene(next);
  }, [startScene]);
  const sayUntil = useRef(0);

  // 말풍선은 한 줄씩 충분히 읽을 시간 동안 보여 주고, 그사이 새 말은 줄을 세운다(밀리면 오래된 것부터 버림)
  const sayQueue = useRef<{ text: string; speaker: "dog" | "priest" }[]>([]);
  const sayBusy = useRef(false);
  const speechTimer = useRef<number | undefined>(undefined);
  const rejectTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => {
    window.clearTimeout(speechTimer.current);
    window.clearTimeout(rejectTimer.current);
  }, []);
  const pump = useCallback(function nextBubble() {
    if (sayBusy.current) return;
    const next = sayQueue.current.shift();
    if (!next) return;
    sayBusy.current = true;
    const ms = Math.min(3800, Math.max(2400, 1700 + next.text.length * 75));
    sayUntil.current = Date.now() + ms + 600;
    setBubble(next.text);
    setSpeaker(next.speaker);
    speechTimer.current = window.setTimeout(() => {
      sayBusy.current = false;
      nextBubble();
    }, ms);
  }, []);
  const say = useCallback(
    (text: string, speaker: "dog" | "priest" = "dog") => {
      if (speaker === "priest") {
        window.clearTimeout(speechTimer.current);
        sayQueue.current = [];
        sayBusy.current = false;
      }
      sayQueue.current.push({ text, speaker });
      if (sayQueue.current.length > 2) sayQueue.current.splice(0, sayQueue.current.length - 2);
      pump();
    },
    [pump]
  );

  const load = useCallback(async (nickname: string, selected: PetId = petIdRef.current) => {
    const id = ++requestId.current;
    try {
      const result = await petRequest((name, args) => supabase.rpc(name, args), selected, nickname, undefined, legacyRef.current);
      if (id !== requestId.current || selected !== petIdRef.current) return;
      legacyRef.current = result.legacy;
      setMultiPet(!result.legacy);
      if (result.petId !== selected) {
        petIdRef.current = result.petId;
        setPetId(result.petId);
        try { localStorage.setItem(PET_KEY, String(result.petId)); } catch { /* 저장 실패는 무시 */ }
      }
      if (result.error) {
        setStatus(result.error.code === "PGRST202" ? "missing" : "error");
        return;
      }
      const raw = result.data as PetState;
      const state: PetState = { ...raw, clean: raw.clean ?? 80, cooldown: { ...NO_WAIT, ...raw.cooldown } };
      setAvail(PET_ACTIONS.filter((a) => raw.cooldown && a in raw.cooldown));
      setPet(state);
      setWait(state.cooldown);
      setStatus("ready");
    } catch {
      if (id === requestId.current) setStatus("error");
    }
  }, [supabase]);

  useEffect(() => {
    const saved = safeGet(NICK_KEY);
    nicknameRef.current = saved;
    setNick(saved);
    const selected: PetId = safeGet(PET_KEY) === "2" ? 2 : 1;
    petIdRef.current = selected;
    setPetId(selected);
    setMap(petMap(safeGet(MAP_KEY)).id);
    setSound(safeGet(SOUND_KEY) === "1");
    setHour(currentHour());
    load(nicknameRef.current);
    const poll = window.setInterval(() => {
      setHour(currentHour());
      load(nicknameRef.current);
    }, 30_000);
    const tick = window.setInterval(
      () =>
        setWait(
          (w) => PET_ACTIONS.some((a) => w[a] > 0)
            ? Object.fromEntries(PET_ACTIONS.map((a) => [a, Math.max(0, w[a] - 1)])) as Record<PetAction, number>
            : w
        ),
      1000
    );
    const onVisible = () => document.visibilityState === "visible" && load(nicknameRef.current);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const isNight = hour >= 21 || hour < 5;
  const stage = pet ? stageOf(pet.care_total) : "baby";
  const face = pet ? faceOf(pet, isNight) : "happy";

  // 가만히 있을 때는 상태에 맞는 한마디를 가끔 바꿔 보여 준다
  useEffect(() => {
    if (!pet) return;
    if (!sceneBusyRef.current && Date.now() > sayUntil.current) { setBubble(saysText(face)); setSpeaker("dog"); }
    const id = window.setInterval(() => {
      if (!sceneBusyRef.current && Date.now() > sayUntil.current) { setBubble(saysText(face)); setSpeaker("dog"); }
    }, 9000);
    return () => window.clearInterval(id);
  }, [face, pet === null]); // eslint-disable-line react-hooks/exhaustive-deps

  function saveNick(e: FormEvent) {
    e.preventDefault();
    const n = sanitizeNickname(nickInput);
    if (!n) {
      setMessage("별명은 한글·영문·숫자 1~8자로 입력해 주세요.");
      return;
    }
    try {
      localStorage.setItem(NICK_KEY, n);
    } catch {
      /* 저장 못 해도 이번 방문에는 사용 가능 */
    }
    nicknameRef.current = n;
    setNick(n);
    setMessage("");
    load(n);
  }

  async function care(action: SceneAction) {
    if (busyRef.current || !nick || sceneBusyRef.current || status !== "ready") return;
    if (action === "sleep") {
      if (map === "home") localScene({ action, id: Date.now() });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setMessage("");
    let result;
    try {
      result = await petRequest((name, args) => supabase.rpc(name, args), petId, nick, action, legacyRef.current);
    } catch {
      setMessage("잠시 후 다시 해 주세요.");
      say("잠시 후 다시 해 주세요.");
      return;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    const { data, error } = result;
    legacyRef.current = result.legacy;
    setMultiPet(!result.legacy);
    if (result.petId !== petId) {
      petIdRef.current = result.petId;
      setPetId(result.petId);
      setPet(null);
      setStatus("loading");
      setCue(null);
      setStreak(0);
      try { localStorage.setItem(PET_KEY, String(result.petId)); } catch { /* 저장 실패는 무시 */ }
      void load(nick);
      return;
    }
    if (error) {
      setMessage("잠시 후 다시 해 주세요.");
      say("잠시 후 다시 해 주세요.");
      return;
    }
    const r = data as { ok: boolean; message?: string; wait?: number };
    if (!r.ok) {
      const why = r.message ?? "지금은 할 수 없어요.";
      setMessage(why);
      if (r.wait) {
        // 쉬는 중: 연출 없이 안내만
        setWait((w) => ({ ...w, [action]: r.wait! }));
        say(rejectLine(why));
      } else {
        // 이미 배부르거나 기분이 최고인 경우: 수치는 그대로지만 연출은 보여 주고, 이유는 연출 끝 무렵에 말한다
        startScene({ action, id: Date.now() });
        rejectTimer.current = window.setTimeout(() => say(rejectLine(why)), 1800);
      }
      return;
    }
    setMessage(`${nick}님이 ${PETS[petId].name}에게 ${ACTION_DONE[action]}.`);
    setStreak(bumpStreak(petId));
    navigator.vibrate?.(25);
    if (sound) blip(action);
    startScene({ action, id: Date.now() });
    load(nick);
  }

  const collar = collarToday();
  const groups = availableActionGroups(actionsForMap(avail, map));
  const selected = groups.find((group) => group.category === category) ?? groups[0];

  const head = (
    <div className="flex min-h-11 items-center justify-between gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2">
      <h2 className="t-heading text-[var(--lit-ink)]">우리 강아지</h2>
      {multiPet && <div className="flex items-center text-[12px]" role="group" aria-label="강아지 선택">
        {([1, 2] as const).map((id) => <button key={id} type="button" aria-pressed={petId === id}
          className={`min-h-11 min-w-10 rounded-lg px-1.5 ${petId === id ? "font-bold text-[var(--lit-ink)]" : "text-[var(--lit-ink-muted)]"}`}
          disabled={busy || sceneBusy || status === "loading"}
          onClick={() => {
            if (petIdRef.current === id || busyRef.current || sceneBusyRef.current) return;
            petIdRef.current = id;
            setPetId(id);
            setPet(null);
            setStatus("loading");
            setCue(null);
            setStreak(0);
            setBubble("");
            sayQueue.current = [];
            window.clearTimeout(speechTimer.current);
            sayBusy.current = false;
            sayUntil.current = 0;
            try { localStorage.setItem(PET_KEY, String(id)); } catch { /* 저장 실패는 무시 */ }
            void load(nicknameRef.current, id);
          }}>{PETS[id].name}</button>)}
      </div>}
      </div>
      {nick ? (
        <button
          type="button"
          className="t-caption ml-auto min-h-11 shrink-0 rounded-lg px-2 text-[var(--lit-ink-muted)] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
          onClick={() => {
            try {
              localStorage.removeItem(NICK_KEY);
            } catch {
              /* 무시 */
            }
            nicknameRef.current = "";
            setNick("");
            setNickInput("");
          }}
        >
          내 별명 바꾸기
        </button>
      ) : null}
    </div>
  );

  if (status === "missing") {
    return (
      <div>
        {head}
        <p className="t-body rounded-xl border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] p-4 text-[var(--lit-ink-muted)]">
          도미를 데려오는 중이에요. 아직 준비가 끝나지 않았어요.
        </p>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div>
        {head}
        <p className="t-body rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4 text-[var(--lit-ink-muted)]">
          {PETS[petId].name}를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {head}
      <div className="space-y-1">
      <div className="overflow-hidden rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] shadow-[var(--lit-paper-shadow-soft)]" aria-busy={status === "loading"}>
        <div className="relative aspect-[16/9] overflow-hidden bg-[var(--lit-bg)]">
        {pet && <PetScene
          key={petId}
          petId={petId}
          map={map}
          onMap={changeMap}
          onLocal={localScene}
          locked={busy || sceneBusy || status !== "ready"}
          speaker={speaker}
          stage={stage}
          face={face}
          light={isNight ? 0.8 : hour < 7 || hour >= 17 ? 0.9 : 1}
          hour={hour}
          collar={collar.hex}
          cue={cue}
          onSay={say}
          onDone={endScene}
          bubble={petText(bubble || "잠깐만 기다려 주시오…", petId)}
        />}
          {!pet && <p role="status" className="absolute inset-0 flex items-center justify-center text-[13px] text-[var(--lit-ink-muted)]">{PETS[petId].name}가 오는 중이에요…</p>}
          {pet && <div className="pointer-events-none absolute inset-x-0 bottom-0 flex gap-4 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-4">
            <Mini label="배부름" icon="🍖" value={pet.fullness} color="#f5c878" />
            <Mini label="기분" icon="♥" value={pet.mood} color="#ffabbc" />
            <Mini label="청결" icon="💧" value={pet.clean} color="#9ae4f0" />
          </div>}
        </div>
      </div>

      {nick ? (
        <>
          <div aria-busy={busy || sceneBusy}>
            <div role="tablist" aria-label="돌보기 카테고리" className="flex h-10 gap-1">
              {groups.map((group, index) => (
                <button key={group.category} type="button" role="tab"
                  id={`${tabsId}-tab-${group.category}`} aria-controls={`${tabsId}-panel-${group.category}`}
                  aria-selected={selected?.category === group.category} tabIndex={selected?.category === group.category ? 0 : -1}
                  className="pet-category px-4 text-[12px] font-semibold"
                  onClick={() => setCategory(group.category)}
                  onKeyDown={(event) => {
                    const next = event.key === "ArrowRight" ? (index + 1) % groups.length
                      : event.key === "ArrowLeft" ? (index + groups.length - 1) % groups.length
                      : event.key === "Home" ? 0 : event.key === "End" ? groups.length - 1 : -1;
                    if (next < 0) return;
                    event.preventDefault();
                    setCategory(groups[next].category);
                    document.getElementById(`${tabsId}-tab-${groups[next].category}`)?.focus();
                  }}>
                  {group.category}
                </button>
              ))}
            </div>
            {groups.map((group) => (
            <div key={group.category} role="tabpanel" id={`${tabsId}-panel-${group.category}`}
              aria-labelledby={`${tabsId}-tab-${group.category}`} hidden={group.category !== selected?.category}
              tabIndex={0} className="pet-actions">
            {group.actions.map((a) => {
              const w = a === "sleep" ? 0 : wait[a];
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => care(a)}
                  disabled={busy || sceneBusy || w > 0 || status !== "ready"}
                  data-active={sceneBusy && cue?.action === a}
                  className="pet-action"
                >
                  <span className="flex items-center gap-1 leading-none">
                    <span aria-hidden className="text-[12px]">
                      {a === "sleep" ? LOCAL_ACTIONS.sleep.icon : ACTION_ICON[a]}
                    </span>
                    <span className="text-[11px] font-semibold">{a === "sleep" ? LOCAL_ACTIONS.sleep.label : ACTION_LABEL[a]}</span>
                  </span>
                  {w > 0 ? (
                    <span className="text-[10px] tabular-nums leading-none text-[var(--lit-ink-muted)]">{formatWait(w)}</span>
                  ) : null}
                </button>
              );
            })}
            </div>
            ))}
          </div>
          <p role="status" className="sr-only">{message}</p>
        </>
      ) : (
        <form
          onSubmit={saveNick}
          className="space-y-2 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-3"
        >
          <label htmlFor="pet-nick" className="t-label block text-[var(--lit-ink-muted)]">
            {PETS[petId].name}를 돌보려면 별명을 정해 주세요 (8자 이내)
          </label>
          <div className="flex gap-2">
            <input
              id="pet-nick"
              value={nickInput}
              onChange={(e) => setNickInput(e.target.value.slice(0, 12))}
              lang="ko"
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 text-base text-[var(--lit-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
              placeholder="예: 별명"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-[var(--lit-ink)] px-5 text-[15px] font-semibold text-[var(--lit-bg-elevated)] transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            >
              시작
            </button>
          </div>
          {message ? <p className="t-label text-[var(--lit-ink-muted)]">{message}</p> : null}
        </form>
      )}

      {pet ? (
        <details className="px-1">
          <summary className="t-label min-h-10 cursor-pointer select-none content-center rounded text-[var(--lit-ink-muted)] focus-visible:outline-2 focus-visible:outline-offset-2">
            오늘의 기록 보기
          </summary>
          <p className="t-caption text-[var(--lit-ink-muted)]">{STAGE_LABEL[stage]} · 함께한 돌봄 {pet.care_total.toLocaleString("ko-KR")}{streak > 0 ? ` · ${streak}일 연속` : ""}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <section aria-label="오늘 돌봐 준 친구들">
              <h2 className="t-caption font-semibold text-[var(--lit-ink)]">오늘 돌봐 준 친구들</h2>
              <ol className="t-label mt-1 space-y-0.5 text-[var(--lit-ink-muted)]">
                {pet.today_top.map((t, i) => (
                  <li key={t.nickname} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {t.nickname}
                    </span>
                    <span className="tabular-nums">{t.count}번</span>
                  </li>
                ))}
              </ol>
            </section>
            <section aria-label="최근 기록">
              <h2 className="t-caption font-semibold text-[var(--lit-ink)]">최근 기록</h2>
              <ul className="t-label mt-1 space-y-0.5 text-[var(--lit-ink-muted)]">
                {pet.recent.map((r, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {r.nickname}님이 {ACTION_DONE[r.action]}
                    </span>
                    <span className="shrink-0">{timeAgo(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </details>
      ) : null}
      </div>
    </div>
  );
}
