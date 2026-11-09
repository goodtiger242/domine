"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ACTION_DONE,
  ACTION_ICON,
  ACTION_LABEL,
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
  type PetState,
} from "@/lib/domine/pet";
import { rejectLine } from "@/lib/domine/pet-lines";
import { currentHour } from "@/lib/domine/sky";
import { PetScene } from "./PetScene";

const NICK_KEY = "domine-pet-nick";
const SOUND_KEY = "domine-pet-sound";
const NO_WAIT = Object.fromEntries(PET_ACTIONS.map((a) => [a, 0])) as Record<PetAction, number>;

function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function Mini({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  return (
    <span className="flex items-center gap-1" title={`${label} ${value}`}>
      <span aria-hidden className="text-[11px] leading-none">
        {icon}
      </span>
      <span
        className="h-1.5 w-8 overflow-hidden rounded-full bg-white/30"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <span className="block h-full rounded-full transition-[width] duration-700" style={{ width: `${value}%`, background: color }} />
      </span>
    </span>
  );
}

export function PetGame() {
  const supabase = useRef(createClient());
  const [nick, setNick] = useState("");
  const [nickInput, setNickInput] = useState("");
  const [pet, setPet] = useState<PetState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [cue, setCue] = useState<{ action: PetAction; id: number } | null>(null);
  const [message, setMessage] = useState("");
  const [wait, setWait] = useState<Record<PetAction, number>>(NO_WAIT);
  const [avail, setAvail] = useState<PetAction[]>(["feed", "pet", "walk"]);
  const [hour, setHour] = useState(12);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bubble, setBubble] = useState("");
  const [dogX, setDogX] = useState(78);
  const [sceneBusy, setSceneBusy] = useState(false);
  const sceneBusyRef = useRef(false);
  const startScene = useCallback((action: PetAction) => {
    sceneBusyRef.current = true;
    setSceneBusy(true);
    setCue({ action, id: Date.now() });
    // 혹시 끝 신호를 놓쳐도 영원히 잠기지 않게 안전장치
    window.setTimeout(() => {
      sceneBusyRef.current = false;
      setSceneBusy(false);
    }, 14000);
  }, []);
  const endScene = useCallback(() => {
    sceneBusyRef.current = false;
    setSceneBusy(false);
  }, []);
  const sayUntil = useRef(0);

  const say = useCallback((text: string) => {
    sayUntil.current = Date.now() + 2600;
    setBubble(text);
  }, []);

  const load = useCallback(async (nickname: string) => {
    const { data, error } = await supabase.current.rpc("domine_pet_state", { p_nickname: nickname });
    if (error) {
      const missing = error.code === "PGRST202" || /could not find the function/i.test(error.message);
      setStatus(missing ? "missing" : "error");
      return;
    }
    const raw = data as PetState;
    // 서버(DB)가 아직 옛 버전이어도 깨지지 않게 빈 값을 채우고, 서버가 아는 행동만 보여 준다
    const state: PetState = { ...raw, clean: raw.clean ?? 80, cooldown: { ...NO_WAIT, ...raw.cooldown } };
    setAvail(PET_ACTIONS.filter((a) => raw.cooldown && a in raw.cooldown));
    setPet(state);
    setWait(state.cooldown);
    setStatus("ready");
  }, []);

  useEffect(() => {
    const saved = safeGet(NICK_KEY);
    setNick(saved);
    setSound(safeGet(SOUND_KEY) === "1");
    setHour(currentHour());
    load(saved);
    const poll = window.setInterval(() => {
      setHour(currentHour());
      load(saved);
    }, 30_000);
    const tick = window.setInterval(
      () =>
        setWait(
          (w) => Object.fromEntries(PET_ACTIONS.map((a) => [a, Math.max(0, w[a] - 1)])) as Record<PetAction, number>
        ),
      1000
    );
    const onVisible = () => document.visibilityState === "visible" && load(saved);
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
    if (Date.now() > sayUntil.current) setBubble(saysText(face));
    const id = window.setInterval(() => {
      if (Date.now() > sayUntil.current) setBubble(saysText(face));
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
    setNick(n);
    setMessage("");
    load(n);
  }

  async function care(action: PetAction) {
    if (busy || !nick || sceneBusyRef.current) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.current.rpc("domine_pet_care", { p_nickname: nick, p_action: action });
    setBusy(false);
    if (error) {
      setMessage("잠시 후 다시 해 주세요.");
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
        startScene(action);
        window.setTimeout(() => say(rejectLine(why)), 1800);
      }
      return;
    }
    setMessage(`${nick}님이 도미에게 ${ACTION_DONE[action]}.`);
    setStreak(bumpStreak());
    navigator.vibrate?.(25);
    if (sound) blip(action);
    startScene(action);
    load(nick);
  }

  const collar = collarToday();

  const head = (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="t-heading text-[var(--lit-ink)]">우리 강아지 도미</h2>
      {nick ? (
        <button
          type="button"
          className="t-caption shrink-0 text-[var(--lit-ink-subtle)] underline underline-offset-2"
          onClick={() => {
            try {
              localStorage.removeItem(NICK_KEY);
            } catch {
              /* 무시 */
            }
            setNick("");
            setNickInput("");
          }}
        >
          별명 바꾸기
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
          도미를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
        </p>
      </div>
    );
  }

  return (
    <div>
      {head}
      <div className="space-y-2.5">
      <div className="relative overflow-hidden rounded-2xl border border-[var(--lit-border)] shadow-[var(--lit-paper-shadow-soft)]">
        <PetScene
          stage={stage}
          face={face}
          light={isNight ? 0.6 : hour < 6 || hour >= 18 ? 0.82 : 1}
          hour={hour}
          collar={collar.hex}
          cue={cue}
          onSay={say}
          onMove={setDogX}
          onDone={endScene}
        />
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-white backdrop-blur-sm">
          <span className="text-[13px] font-semibold leading-none">도미</span>
          <span className="text-[10px] leading-none opacity-80">
            {STAGE_LABEL[stage]} · 돌봄 {pet?.care_total ?? 0}
          </span>
        </div>
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-2 rounded-full bg-black/40 px-2.5 py-1.5 text-white backdrop-blur-sm">
          <Mini icon="🍖" label="배부름" value={pet?.fullness ?? 0} color="#f0b45a" />
          <Mini icon="💛" label="기분" value={pet?.mood ?? 0} color="#f27d8c" />
          {avail.length > 3 ? <Mini icon="🫧" label="청결" value={pet?.clean ?? 0} color="#6fc0f0" /> : null}
        </div>
        {bubble ? (
          <p
            key={bubble}
            className={`fade-in pointer-events-none absolute top-11 max-w-[58%] rounded-xl bg-white/95 px-2.5 py-1.5 text-[12px] leading-snug text-[#1f2433] shadow ${
              dogX < 80 ? "right-2" : "left-2"
            }`}
            aria-live="polite"
          >
            {bubble}
          </p>
        ) : null}
      </div>

      {nick ? (
        <>
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="도미 돌보기">
            {avail.map((a) => {
              const w = wait[a];
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => care(a)}
                  disabled={busy || sceneBusy || w > 0 || status !== "ready"}
                  className="flex min-h-[3.4rem] flex-col items-center justify-center rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-1 py-1 text-[var(--lit-ink)] transition duration-150 active:scale-[0.96] enabled:hover:border-[var(--lit-border-strong)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
                >
                  <span className="flex items-center gap-1 leading-none">
                    <span aria-hidden className="text-[17px]">
                      {ACTION_ICON[a]}
                    </span>
                    <span className="text-[12px] font-semibold">{ACTION_LABEL[a]}</span>
                  </span>
                  {w > 0 ? (
                    <span className="mt-0.5 text-[10px] tabular-nums leading-none text-[var(--lit-ink-muted)]">{formatWait(w)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <form
          onSubmit={saveNick}
          className="space-y-2 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-3"
        >
          <label htmlFor="pet-nick" className="t-label block text-[var(--lit-ink-muted)]">
            도미를 돌보려면 별명을 정해 주세요 (8자 이내)
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
              className="h-11 min-w-0 flex-1 rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 text-[15px] text-[var(--lit-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
              placeholder="예: 별명"
            />
            <button
              type="submit"
              className="h-11 shrink-0 rounded-lg bg-[var(--lit-ink)] px-5 text-[15px] font-semibold text-[var(--lit-bg-elevated)] transition active:scale-[0.97]"
            >
              시작
            </button>
          </div>
          {message ? <p className="t-label text-[var(--lit-ink-muted)]">{message}</p> : null}
        </form>
      )}

      {pet && (pet.today_top.length > 0 || pet.recent.length > 0) ? (
        <details className="rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-3 py-2">
          <summary className="t-label cursor-pointer select-none text-[var(--lit-ink-muted)]">
            오늘의 기록 보기
          </summary>
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
