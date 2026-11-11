import { BREED_BY_ID, ITEM_BY_ID } from "./data";
import { availableActions, moveFor, previewDamage, recoveryLeft } from "./rules";
import { random } from "./rng";
import type { Action, AiTier, Actor, BattleState } from "./types";

export const AI_TIERS = {
  gentle: { name: "순둥이", mistake: .30, read: 0 },
  normal: { name: "보통", mistake: .15, read: .25 },
  veteran: { name: "노련", mistake: .05, read: .7 },
  boss: { name: "대장", mistake: .01, read: .9 },
  king: { name: "싸움왕", mistake: 0, read: 1 },
} as const;

function expected(action: Action, actor: Actor, target: Actor, round: number): number {
  const move = moveFor(action);
  if (move?.kind !== "attack") return 0;
  const p = previewDamage(move,actor,target,round);
  return (p.min + p.max) / 2 * p.hitChance / 100 / (1 + p.preparationRounds);
}

export function chooseAction(state: BattleState, aiTier: AiTier = state.aiTier ?? state.opponent.aiTier ?? (state.difficulty === "hard" ? "veteran" : "normal"), announcedResponse?: Action): { action: Action; rng: number; hint?: BattleState["opponentHint"] } {
  if (!Object.hasOwn(AI_TIERS,aiTier)) throw new Error("AI 등급을 확인해 주세요.");
  const actor = state.opponent, target = state.player, config = AI_TIERS[aiTier];
  const actions = availableActions(state,"opponent").filter(a => a.kind !== "item" || actor.owned === true);
  if (!actions.length) return { action: { kind: "rest" }, rng: state.rng };
  if (actor.charging) return { action: actions[0], rng: state.rng };
  const history = target.history ?? (target.lastAction ? [target.lastAction] : []);
  const guards = history.filter(a => moveFor(a)?.kind === "defense").length / Math.max(1,history.length);
  const contacts = history.filter(a => moveFor(a)?.contact && moveFor(a)?.kind === "attack").length / Math.max(1,history.length);
  const temperament = BREED_BY_ID[actor.breedId].temperament;
  const targetActions = availableActions(state,"player").filter(a => a.kind !== "quit");
  const targetBest = config.read >= .7 ? targetActions.filter(a => moveFor(a)?.kind === "attack").sort((a,b) => expected(b,target,actor,state.round)-expected(a,target,actor,state.round))[0] : undefined;
  // Predict from public history/response only, never an unsubmitted action or hidden affinity.
  const lookAhead = config.read >= .7 && random(state.rng ^ 0x9e3779b9).value < (aiTier === "veteran" ? .5 : 1);
  const prediction = lookAhead ? announcedResponse ?? (target.charging ? targetActions[0] : target.energy < 2 ? { kind: "rest" } as Action : guards >= .5 ? target.lastAction : targetBest) : target.lastAction;
  const incoming = prediction && moveFor(prediction);
  const threat = prediction ? expected(prediction,target,actor,state.round) / actor.stats.hp * 100 : 0;
  const attacks = actions.filter(a => moveFor(a)?.kind === "attack");
  const bestDamage = Math.max(0,...attacks.map(a => expected(a,actor,target,state.round)));
  const urgent = actor.hp / actor.stats.hp < .35;
  const ranked = actions.map(action => {
    const move = moveFor(action), item = action.kind === "item" ? ITEM_BY_ID[action.itemId] : undefined;
    let score = -20;
    if (action.kind === "rest") score = actor.energy <= 2 ? (aiTier === "gentle" ? 6 : 23) : actor.energy <= 4 && threat === 0 ? 17 : -10;
    if (move?.kind === "attack") {
      const damage = expected(action,actor,target,state.round);
      score = damage / target.stats.hp * 100;
      if (move.mode !== "charge" && damage >= target.hp) score += 70;
      if (move.energy >= 5 && actor.energy - move.energy < 2 && target.hp > damage * 2) score -= temperament === "lively" ? 0 : 4;
      if (move.mode === "charge" && (state.round >= 11 || urgent)) score -= 30;
      if (move.mode === "recoil") score -= (move.recoil?.energy ?? 0) * 2 + (move.recoil?.rate ?? 0) * 15;
      if (move.breaksDefense) score += config.read * (guards * 44 + (incoming?.kind === "defense" ? 28 : 0));
      if (move.status && !target.statuses.some(s => s.id === move.status)) score += config.read * 2;
      if (move.finisher) score += 5 + (temperament === "lively" ? 3 : 0);
      if (config.read >= .7 && incoming?.defense === "counter" && move.contact && !move.breaksDefense) score -= 22;
      if (config.read >= .7 && incoming?.defense === "evade" && (move.finisher || move.mode === "charge")) score -= 24;
    }
    if (move?.kind === "defense") {
      score = urgent ? 6 : 0;
      if (temperament === "careful") score += 2;
      if (move.defense === "counter") score += config.read * (contacts * 8 + (incoming?.contact && !incoming.breaksDefense ? threat + 4 : -12));
      if (move.defense === "evade") score += incoming?.mode === "charge" || incoming?.finisher ? 32 : -10;
      if (move.defense === "guard") score += actor.energy <= 2 && threat > 0 ? 16 : threat * .3;
      if (move.defense === "stance") score += state.round <= 4 ? 7 : 0;
      if (actor.lastAction && moveFor(actor.lastAction)?.defense === move.defense) score -= 24;
      if (incoming?.breaksDefense) score -= 30 * config.read;
    }
    if (move?.buff && !actor.buffs.some(b => b.stat === move.buff) && state.round <= 5) score = Math.max(score,8 + config.read * 7 + (threat === 0 ? 4 : 0));
    if ((move?.heal || item?.heal) && recoveryLeft(actor) > 0) {
      const heal = Math.min(recoveryLeft(actor),actor.stats.hp * (move?.heal ?? item?.heal ?? 0));
      score = urgent ? heal / actor.stats.hp * 100 + (threat >= actor.hp / actor.stats.hp * 100 ? 12 : 0) : -10;
    }
    if (item?.energy) score = actor.energy <= 2 ? 26 : -10;
    if (item?.category === "cleanse") score = actor.statuses.length * 9;
    if (item?.category === "protect" || item?.category === "survive") score = urgent && threat > 0 ? 25 : -5;
    if (item?.category === "critical") score = threat === 0 && actor.energy >= 3 ? 16 : -5;
    if (item?.buff) score = state.round <= 4 && !actor.buffs.some(b => b.stat === item.buff) ? 14 : -5;
    if (item?.category === "cancel") score = !target.boss && threat > 20 ? 28 : -5;
    if (bestDamage >= target.hp && move?.kind !== "attack") score -= 50;
    if (aiTier === "king" && actor.hp < actor.stats.hp * .5 && move?.kind === "attack") score += 4;
    const id = action.kind === "move" ? action.moveId : action.kind === "item" ? action.itemId : action.kind;
    return { action,score,id };
  }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
  const draw = random(state.rng);
  const alternative = Math.max(1,ranked.findIndex((r,i) => i > 0 && r.score < ranked[0].score - 5));
  const index = draw.value < config.mistake && ranked.length > 1 ? alternative : 0;
  const obscure = (aiTier === "boss" || aiTier === "king") && random(draw.seed).value < .08;
  return { action: ranked[index].action, rng: draw.seed, ...(obscure ? { hint: { obscured: true, clue: "시선을 피하며 몸을 낮춘다" } } : {}) };
}

export function chooseOpponentAction(state: BattleState) {
  return chooseAction(state);
}
