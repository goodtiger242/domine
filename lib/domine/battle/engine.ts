import { chooseOpponentAction } from "./ai";
import { BREED_BY_ID, ITEM_BY_ID } from "./data";
import { availableActions, buildFighter, clamp, critChance, damageAt, effectiveStat, effectHint, hitChance, matchup, MAX_ENERGY, MAX_ROUNDS, moveFor, recoveryLeft, sameAction, statusChance } from "./rules";
import { random } from "./rng";
import type { Action, Actor, BattleEvent, BattleState, Difficulty, Fighter, Outcome, Side } from "./types";

export { availableActions, buildFighter, effectHint, previewDamage, cumulativeXp, levelFromXp, xpToNext, growthQ, growthScale, recommendedAllocation, conditionPenalty, critChance, MAX_LEVEL } from "./rules";
export { opponentFor } from "./opponents";

function cloneActor(actor: Actor): Actor {
  return { ...actor, stats: { ...actor.stats }, moves: [...actor.moves], equipment: [...actor.equipment],
    allocation: actor.allocation && { ...actor.allocation }, job: actor.job && { ...actor.job }, condition: actor.condition && { ...actor.condition }, mastery: actor.mastery && { ...actor.mastery },
    habitats: actor.habitats && [...actor.habitats], activeBands: actor.activeBands && [...actor.activeBands], environment: actor.environment && { ...actor.environment }, recoil: actor.recoil && { ...actor.recoil },
    statuses: actor.statuses.map(s => ({ ...s })), buffs: actor.buffs.map(b => ({ ...b })),
    shield: actor.shield && { ...actor.shield }, lastAction: actor.lastAction && { ...actor.lastAction } };
}
function newActor(fighter: Fighter, energy: number): Actor {
  const canonical = buildFighter(fighter.breedId, fighter.level, fighter.equipment, {
    moves: fighter.moves, consumable: fighter.consumable, allocation: fighter.allocation, job: fighter.job,
    condition: fighter.condition, mastery: fighter.mastery, movementType: fighter.movementType,
    habitats: fighter.habitats, activeBands: fighter.activeBands, environment: fighter.environment,
  });
  if (Object.entries(canonical.stats).some(([key,value]) => fighter.stats[key as keyof Fighter["stats"]] !== value)) throw new Error("출전 스탯이 견종·레벨·장비와 다릅니다.");
  return { ...canonical, hp: canonical.stats.hp, energy, healed: 0, itemUsed: false, statuses: [], buffs: [], lastDefense: -1, traitUsed: false, rested: false };
}
export function createBattle(input: { seed: number; player: Fighter; opponent: Fighter; startEnergyBonus?: 0 | 1; difficulty?: Difficulty; criticals?: boolean }): BattleState {
  if (!Number.isSafeInteger(input.seed)) throw new Error("시드는 안전한 정수여야 합니다.");
  if (input.startEnergyBonus !== undefined && input.startEnergyBonus !== 0 && input.startEnergyBonus !== 1) throw new Error("시작 기력 보너스는 0 또는 1입니다.");
  if (input.difficulty && input.difficulty !== "normal" && input.difficulty !== "hard") throw new Error("올바른 난이도가 아닙니다.");
  if (input.criticals !== undefined && typeof input.criticals !== "boolean") throw new Error("크리티컬 설정은 참/거짓입니다.");
  const state: BattleState = { round: 1, rng: input.seed >>> 0,
    player: newActor(input.player,6 + (input.startEnergyBonus ?? 0)), opponent: newActor(input.opponent,6),
    difficulty: input.difficulty ?? "normal", criticals: input.criticals ?? true, opponentAction: { kind: "rest" } };
  const forecast = chooseOpponentAction(state);
  return { ...state, opponentAction: forecast.action, rng: forecast.rng };
}

type EventPayload = BattleEvent extends infer E ? E extends BattleEvent ? Omit<E, "round"> : never : never;
export function stepRound(previous: BattleState, playerAction: Action): { state: BattleState; events: BattleEvent[] } {
  if (previous.outcome) throw new Error("이미 끝난 대결입니다.");
  for (const [side,action] of [["player",playerAction],["opponent",previous.opponentAction]] as const) {
    if (!availableActions(previous,side).some(a => sameAction(a,action))) throw new Error("사용할 수 없는 행동입니다.");
  }
  const state: BattleState = { ...previous, player: cloneActor(previous.player), opponent: cloneActor(previous.opponent), opponentAction: { ...previous.opponentAction } };
  const events: BattleEvent[] = [];
  const emit = (event: EventPayload) => events.push({ ...event, round: state.round } as BattleEvent);
  const draw = () => { const next = random(state.rng); state.rng = next.seed; return next.value; };
  const finish = (outcome: Outcome, reason: "hp" | "limit" | "quit") => { state.outcome = outcome; emit({ type: "end", outcome, reason }); };
  const energy = (side: Side, amount: number, reason: Extract<BattleEvent,{ type: "energy" }>["reason"]) => {
    const actor = state[side], before = actor.energy;
    actor.energy = clamp(actor.energy + amount,0,MAX_ENERGY);
    emit({ type: "energy", side, amount: actor.energy - before, energy: actor.energy, reason });
  };
  const heal = (side: Side, ratio: number) => {
    const actor = state[side], amount = Math.min(Math.floor(actor.stats.hp * ratio),recoveryLeft(actor));
    actor.hp += amount; actor.healed += amount;
    emit({ type: "heal", side, amount, hp: actor.hp });
  };
  const removeShield = (side: Side) => {
    const actor = state[side];
    if (actor.shield) emit({ type: "shield", side, multiplier: actor.shield.multiplier, change: "removed" });
    delete actor.shield;
  };
  const applyStatus = (side: Side, id: NonNullable<ReturnType<typeof moveFor>>["status"]) => {
    if (!id) return;
    const actor = state[side];
    if (BREED_BY_ID[actor.breedId].trait === "statusImmune" && !actor.traitUsed) {
      actor.traitUsed = true; emit({ type: "status", side, status: id, change: "blocked" }); return;
    }
    const existing = actor.statuses.find(s => s.id === id);
    if (existing) existing.expires = state.round + 1;
    else {
      if (actor.statuses.length === 2) {
        actor.statuses.sort((a,b) => a.applied - b.applied || (a.id < b.id ? -1 : 1));
        emit({ type: "status", side, status: actor.statuses.shift()!.id, change: "removed" });
      }
      actor.statuses.push({ id, applied: state.round, expires: state.round + 1 });
    }
    emit({ type: "status", side, status: id, change: "applied" });
  };
  const execute = (side: Side, action: Action) => {
    const targetSide: Side = side === "player" ? "opponent" : "player";
    const actor = state[side], target = state[targetSide], trait = BREED_BY_ID[actor.breedId].trait;
    if (action.kind === "move" && moveFor(action)?.mode === "charge") action = { ...action, phase: actor.charging ? "release" : "prepare" };
    emit({ type: "action", side, action: { ...action } });
    actor.lastAction = { ...action };
    if (action.kind === "quit") { finish("quit","quit"); return; }
    if (action.kind === "rest") { actor.rested = true; energy(side,4,"rest"); return; }
    if (action.kind === "item") {
      const item = ITEM_BY_ID[action.itemId]; actor.itemUsed = true;
      if (item.energy) energy(side,item.energy,"item");
      if (item.heal) heal(side,item.heal);
      return;
    }
    const move = moveFor(action)!;
    if (actor.charging === move.id) delete actor.charging;
    else {
      energy(side,-move.energy,"cost");
      if (move.mode === "charge") { actor.charging = move.id; return; }
    }
    if (move.mode === "recoil") actor.recoil = { ...move.recoil, expires: state.round + 1 };
    if (move.kind === "attack") {
      const hits = move.mode === "multi" ? move.hits ?? 2 : 1;
      let connected = false;
      for (let hit = 0; hit < hits; hit++) {
        if (Math.floor(draw() * 10000) >= hitChance(move,actor,target,state.round) * 100) {
          emit({ type: "miss", side, target: targetSide, moveId: move.id }); continue;
        }
        emit({ type: "hit", side, target: targetSide, moveId: move.id });
        connected = true;
        // Consume the same draw with criticals disabled so simulation pairs share their RNG stream.
        const criticalRoll = draw();
        const defending = moveFor(targetSide === "player" ? playerAction : state.opponentAction)?.kind === "defense";
        const critical = state.criticals !== false && !defending && criticalRoll * 100 < critChance(actor);
        const amount = Math.min(target.hp,Math.floor(damageAt(move,actor,target,[.95,1,1.05][Math.floor(draw() * 3)],state.round) * (critical ? 1.5 : 1)));
        target.hp -= amount;
        emit({ type: "effectiveness", side, target: targetSide, hint: effectHint(move,actor,target), multiplier: matchup(move.group,BREED_BY_ID[target.breedId].group,actor,target) });
        emit({ type: "damage", side, target: targetSide, amount, hp: target.hp, ...(critical ? { critical: true as const } : {}) });
        actor.rested = false;
        if ((trait === "firstTrack" && move.group === "track") || (trait === "firstBond" && move.group === "bond") || (trait === "firstRush" && move.group === "rush")) actor.traitUsed = true;
        if (BREED_BY_ID[target.breedId].trait === "firstShield") target.traitUsed = true;
        removeShield(targetSide);
        if (target.hp === 0) { finish(side,"hp"); return; }
        if (move.status && Math.floor(draw() * 10000) < statusChance(move,actor,target) * 100) applyStatus(targetSide,move.status);
      }
      if (!connected) return;
    }
    if (move.kind === "defense") {
      actor.shield = { multiplier: actor.lastDefense === state.round - 1 ? .85 : .65, expires: state.round + 1 };
      actor.lastDefense = state.round;
      emit({ type: "shield", side, multiplier: actor.shield.multiplier, change: "applied" });
    }
    if (move.buff) {
      const extra = trait === "longBuff" && !actor.traitUsed ? 1 : 0;
      if (extra) actor.traitUsed = true;
      const existing = actor.buffs.find(b => b.stat === move.buff);
      if (existing) existing.expires = state.round + 1 + extra;
      else actor.buffs.push({ stat: move.buff, expires: state.round + 1 + extra });
      emit({ type: "buff", side, stat: move.buff, change: "applied" });
    }
    if (move.heal) heal(side,move.heal);
  };
  const priority = (action: Action) => action.kind === "quit" ? 3 : action.kind === "item" ? 2 : moveFor(action)?.priority ?? 0;
  const order = priority(playerAction) - priority(state.opponentAction) || effectiveStat(state.player,"speed",state.round) - effectiveStat(state.opponent,"speed",state.round);
  const playerFirst = order > 0 || order === 0 && draw() < .5;
  const turns: [Side,Action][] = playerFirst ? [["player",playerAction],["opponent",state.opponentAction]] : [["opponent",state.opponentAction],["player",playerAction]];
  for (const [side,action] of turns) { execute(side,action); if (state.outcome) return { state, events }; }
  for (const side of ["player","opponent"] as const) {
    const actor = state[side];
    for (const status of actor.statuses) if (status.expires <= state.round) emit({ type: "status", side, status: status.id, change: "removed" });
    actor.statuses = actor.statuses.filter(s => s.expires > state.round);
    for (const buff of actor.buffs) if (buff.expires <= state.round) emit({ type: "buff", side, stat: buff.stat, change: "removed" });
    actor.buffs = actor.buffs.filter(b => b.expires > state.round);
    if (actor.shield && actor.shield.expires <= state.round) removeShield(side);
    energy(side,actor.statuses.some(s => s.id === "winded") ? 1 : 2,"round");
    if (state.round === 3 && BREED_BY_ID[actor.breedId].trait === "thirdEnergy") energy(side,2,"trait");
    if (actor.recoil) {
      if (actor.recoil.expires <= state.round) delete actor.recoil;
      else if (actor.recoil.energy) { energy(side,-actor.recoil.energy,"cost"); delete actor.recoil.energy; }
    }
  }
  if (state.round === MAX_ROUNDS) {
    // Integer cross-products keep the inclusive 5 percentage-point boundary exact.
    const difference = state.player.hp * state.opponent.stats.hp - state.opponent.hp * state.player.stats.hp;
    finish(Math.abs(difference) * 20 <= state.player.stats.hp * state.opponent.stats.hp ? "draw" : difference > 0 ? "player" : "opponent","limit");
  } else {
    state.round++;
    const forecast = chooseOpponentAction(state);
    state.opponentAction = forecast.action; state.rng = forecast.rng;
  }
  return { state, events };
}
