"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  ACTION_DONE,
  blip,
  bumpStreak,
  collarToday,
  saysText,
  ACTION_LABEL,
  faceOf,
  formatWait,
  sanitizeNickname,
  STAGE_LABEL,
  stageOf,
  statusText,
  timeAgo,
  type PetAction,
  type PetState,
} from "@/lib/domine/pet";
import {
  bodyAt,
  currentHour,
  FAR_PATH,
  HILL_PATH,
  skyAt,
  STARS,
} from "@/lib/domine/sky";
import { PetBowl, PetDog } from "./PetDog";

const NICK_KEY = "domine-pet-nick";
const SOUND_KEY = "domine-pet-sound";
const ACTIONS: PetAction[] = ["feed", "pet", "walk"];
const ACTION_ICON: Record<PetAction, string> = { feed: "🍖", pet: "🤚", walk: "🦮" };

function safeGet(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="t-label flex justify-between text-[var(--lit-ink-muted)]">
        <span>{label}</span>
        <span className="tabular-nums">{value}</span>
      </div>
      <div
        className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[var(--lit-border)]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${value}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function PetGame() {
  const supabase = useRef(createClient());
  const [nick, setNick] = useState("");
  const [nickInput, setNickInput] = useState("");
  const [pet, setPet] = useState<PetState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [playing, setPlaying] = useState<PetAction | null>(null);
  const [message, setMessage] = useState("");
  const [wait, setWait] = useState<Record<PetAction, number>>({ feed: 0, pet: 0, walk: 0 });
  const [hour, setHour] = useState(12);
  const [busy, setBusy] = useState(false);
  const [sound, setSound] = useState(false);
  const [trick, setTrick] = useState(false);
  const [streak, setStreak] = useState(0);

  const load = useCallback(async (nickname: string) => {
    const { data, error } = await supabase.current.rpc("domine_pet_state", {
      p_nickname: nickname,
    });
    if (error) {
      const missing =
        error.code === "PGRST202" || /could not find the function/i.test(error.message);
      setStatus(missing ? "missing" : "error");
      return;
    }
    const state = data as PetState;
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
        setWait((w) => ({
          feed: Math.max(0, w.feed - 1),
          pet: Math.max(0, w.pet - 1),
          walk: Math.max(0, w.walk - 1),
        })),
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

  /** 공중제비 (산책이 끝났을 때, 또는 도미를 눌렀을 때) */
  function doTrick() {
    if (trick || playing) return;
    setTrick(true);
    navigator.vibrate?.(15);
    window.setTimeout(() => setTrick(false), 950);
  }

  async function care(action: PetAction) {
    if (busy || !nick) return;
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.current.rpc("domine_pet_care", {
      p_nickname: nick,
      p_action: action,
    });
    setBusy(false);
    if (error) {
      setMessage("잠시 후 다시 해 주세요.");
      return;
    }
    const r = data as { ok: boolean; message?: string; wait?: number };
    if (!r.ok) {
      setMessage(r.message ?? "지금은 할 수 없어요.");
      if (r.wait) setWait((w) => ({ ...w, [action]: r.wait! }));
      return;
    }
    setMessage(`${nick}님이 도미에게 ${ACTION_DONE[action]}.`);
    setStreak(bumpStreak());
    navigator.vibrate?.(25);
    if (sound) blip(action);
    setPlaying(action);
    window.setTimeout(() => {
      setPlaying(null);
      if (action === "walk") doTrick();
    }, action === "walk" ? 4000 : 2400);
    load(nick);
  }

  const c = skyAt(hour);
  const body = bodyAt(hour);
  const isNight = hour >= 21 || hour < 5;
  const stage = pet ? stageOf(pet.care_total) : "baby";
  const face = pet ? faceOf(pet, isNight) : "happy";
  const walking = playing === "walk";
  const collar = collarToday();

  if (status === "missing") {
    return (
      <p className="t-body rounded-xl border border-dashed border-[var(--lit-border-strong)] bg-[var(--lit-bg-elevated)] p-6 text-[var(--lit-ink-muted)]">
        도미를 데려오는 중이에요. 아직 준비가 끝나지 않았어요. (관리자: Supabase에
        domine_pet 마이그레이션을 실행해 주세요.)
      </p>
    );
  }
  if (status === "error") {
    return (
      <p className="t-body rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-6 text-[var(--lit-ink-muted)]">
        도미를 불러오지 못했어요. 잠시 후 다시 열어 주세요.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] shadow-[var(--lit-paper-shadow-soft)]">
        <svg
          viewBox="0 0 160 100"
          className="block w-full"
          role="img"
          aria-label={`${STAGE_LABEL[stage]} 도미. ${statusText(face)}`}
        >
          <defs>
            <linearGradient id="pet-sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={c.top} />
              <stop offset="1" stopColor={c.bot} />
            </linearGradient>
          </defs>
          <rect width="160" height="100" fill="url(#pet-sky)" />
          {STARS.map(([sx, sy], i) => (
            <circle key={i} cx={sx * 0.8} cy={sy} r={i % 3 === 0 ? 0.7 : 0.5} fill="#fff" opacity={c.star * (i % 2 ? 0.55 : 0.9)} />
          ))}
          {body.isDay ? (
            <g>
              <circle cx={body.x * 0.8} cy={body.y + 6} r="8" fill="#fff4c2" opacity="0.28" />
              <circle cx={body.x * 0.8} cy={body.y + 6} r="4.2" fill="#fff4c2" />
            </g>
          ) : (
            <g>
              <circle cx={body.x * 0.8} cy={body.y + 6} r="7" fill="#e8ecff" opacity="0.12" />
              <circle cx={body.x * 0.8} cy={body.y + 6} r="3.6" fill="#e8ecff" />
              <circle cx={body.x * 0.8 + 1.4} cy={body.y + 5.4} r="3.1" fill={c.top} opacity="0.55" />
            </g>
          )}
          <g transform="translate(0 24)">
            <g className={walking ? "mil-scroll-far" : undefined}>
              <path d={FAR_PATH} fill={c.far} />
            </g>
            <g className={walking ? "mil-scroll-hill" : undefined}>
              <path d={HILL_PATH} fill={c.hill} />
            </g>
          </g>
          <rect y="72" width="160" height="28" fill={c.ground} />
          <g transform="translate(78 92)">
            <PetDog
              stage={stage}
              face={face}
              eating={playing === "feed"}
              petting={playing === "pet"}
              walking={walking}
              flip={trick}
              onTap={doTrick}
              light={isNight ? 0.6 : hour < 6 || hour >= 18 ? 0.82 : 1}
              collar={collar.hex}
            />
          </g>
          {playing === "feed" ? (
            <g transform="translate(124 93) scale(0.8)">
              <PetBowl />
            </g>
          ) : null}
        </svg>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="t-heading text-[var(--lit-ink)]">
              도미 <span className="t-label text-[var(--lit-ink-muted)]">· {STAGE_LABEL[stage]}</span>
            </p>
            <p className="t-label tabular-nums text-[var(--lit-ink-subtle)]">
              돌봄 {pet?.care_total ?? 0}번
            </p>
          </div>
          <p className="t-body text-[var(--lit-ink-muted)]" aria-live="polite">
            {pet ? statusText(face) : "도미를 부르는 중…"}
          </p>
          {pet ? (
            <p className="t-label italic text-[var(--lit-ink-subtle)]">“{saysText(face)}”</p>
          ) : null}
          {collar.liturgy ? (
            <p className="t-caption flex items-center gap-1.5 text-[var(--lit-ink-subtle)]">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full ring-1 ring-[var(--lit-border)]"
                style={{ background: collar.hex }}
              />
              {collar.liturgy} · {collar.colorName} 목줄
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-4">
            <Gauge label="배부름" value={pet?.fullness ?? 0} color="#e0a050" />
            <Gauge label="기분" value={pet?.mood ?? 0} color="#e0707f" />
          </div>
        </div>
      </div>

      {nick ? (
        <>
          <div className="grid grid-cols-3 gap-3" role="group" aria-label="도미 돌보기">
            {ACTIONS.map((a) => {
              const w = wait[a];
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => care(a)}
                  disabled={busy || w > 0 || status !== "ready"}
                  className="flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-2 py-2 text-[var(--lit-ink)] transition duration-150 active:scale-[0.97] enabled:hover:border-[var(--lit-border-strong)] disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)] focus-visible:ring-offset-2"
                >
                  <span aria-hidden className="text-xl leading-none">
                    {ACTION_ICON[a]}
                  </span>
                  <span className="text-[15px] font-semibold">{ACTION_LABEL[a]}</span>
                  <span className="t-caption tabular-nums text-[var(--lit-ink-muted)]">
                    {w > 0 ? `${formatWait(w)} 뒤` : "지금 가능"}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="t-label min-h-5 text-center text-[var(--lit-ink-muted)]" aria-live="polite">
            {message}
          </p>
          <p className="t-caption text-center text-[var(--lit-ink-subtle)]">
            {nick}님으로 돌보는 중{streak > 1 ? ` · ${streak}일째` : ""} ·{" "}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                const next = !sound;
                setSound(next);
                try {
                  localStorage.setItem(SOUND_KEY, next ? "1" : "0");
                } catch {
                  /* 무시 */
                }
                if (next) blip("pet");
              }}
            >
              소리 {sound ? "끄기" : "켜기"}
            </button>{" "}
            ·{" "}
            <button
              type="button"
              className="underline underline-offset-2"
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
          </p>
        </>
      ) : (
        <form
          onSubmit={saveNick}
          className="space-y-3 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4"
        >
          <label htmlFor="pet-nick" className="t-label block text-[var(--lit-ink-muted)]">
            도미를 돌보려면 별명을 정해 주세요 (한글·영문·숫자 8자 이내)
          </label>
          <div className="flex gap-2">
            <input
              id="pet-nick"
              value={nickInput}
              onChange={(e) => setNickInput(sanitizeNickname(e.target.value))}
              maxLength={8}
              autoComplete="off"
              className="h-12 min-w-0 flex-1 rounded-lg border border-[var(--lit-border)] bg-[var(--lit-bg)] px-3 text-[15px] text-[var(--lit-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--lit-ring)]"
              placeholder="예: 별명"
            />
            <button
              type="submit"
              className="h-12 shrink-0 rounded-lg bg-[var(--lit-ink)] px-5 text-[15px] font-semibold text-[var(--lit-bg-elevated)] transition active:scale-[0.97]"
            >
              시작
            </button>
          </div>
          {message ? <p className="t-label text-[var(--lit-ink-muted)]">{message}</p> : null}
        </form>
      )}

      {pet && (pet.today_top.length > 0 || pet.recent.length > 0) ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <section aria-label="오늘 돌봐 준 친구들">
            <h2 className="t-label font-semibold text-[var(--lit-ink)]">오늘 돌봐 준 친구들</h2>
            <ol className="t-body mt-2 space-y-1 text-[var(--lit-ink-muted)]">
              {pet.today_top.length === 0 ? (
                <li>아직 아무도 안 왔어요.</li>
              ) : (
                pet.today_top.map((t, i) => (
                  <li key={t.nickname} className="flex justify-between gap-3">
                    <span>
                      {i + 1}. {t.nickname}
                    </span>
                    <span className="tabular-nums">{t.count}번</span>
                  </li>
                ))
              )}
            </ol>
          </section>
          <section aria-label="최근 기록">
            <h2 className="t-label font-semibold text-[var(--lit-ink)]">최근 기록</h2>
            <ul className="t-body mt-2 space-y-1 text-[var(--lit-ink-muted)]">
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
      ) : null}
    </div>
  );
}
