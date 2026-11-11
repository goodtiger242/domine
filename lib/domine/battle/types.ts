export type Group = "rush" | "trick" | "track" | "guard" | "bond" | "endure";
export type Temperament = "lively" | "careful" | "kind" | "steady";
export type Size = "small" | "medium" | "large";
export type Stat = "hp" | "attack" | "defense" | "speed" | "focus" | "calm";
export type Stats = Record<Stat, number>;
export type Status = "stagger" | "blur" | "slow" | "tense" | "winded" | "open";
export type Trait = "restDamage" | "earlySpeed" | "firstTrack" | "firstShield" | "thirdEnergy" | "longBuff" | "firstBond" | "firstRush" | "trackDamage" | "statusImmune";
export interface Breed {
  id: string; name: string; group: Group; temperament: Temperament; size: Size;
  base: Stats; growth: string; trait: Trait; learn: readonly { level: number; move: string }[];
}
export interface Move {
  id: string; name: string; kind: "attack" | "defense" | "support";
  group: Group | "neutral"; power: number; accuracy: number; energy: number; priority: number;
  buff?: Exclude<Stat, "hp">; heal?: number; status?: Status; chance?: number;
}
export interface Item {
  id: string; name: string; slot: "collar" | "harness" | "charm" | "bag";
  rates?: Partial<Stats>; energy?: number; heal?: number;
}
export interface Fighter {
  breedId: string; level: number; stats: Stats; moves: readonly string[];
  equipment: readonly string[]; consumable?: string;
}
export interface Actor extends Fighter {
  hp: number; energy: number; healed: number; itemUsed: boolean;
  statuses: { id: Status; applied: number; expires: number }[];
  buffs: { stat: Exclude<Stat, "hp">; expires: number }[];
  shield?: { multiplier: number; expires: number };
  lastAction?: Action; lastDefense: number; traitUsed: boolean; rested: boolean;
}
export type Side = "player" | "opponent";
export type Action = { kind: "move"; moveId: string } | { kind: "push" | "rest" | "quit" } | { kind: "item"; itemId: string };
export type Difficulty = "normal" | "hard";
export type Outcome = "player" | "opponent" | "draw" | "quit";
export type Hint = "good" | "normal" | "weak";
export interface BattleState {
  round: number; rng: number; player: Actor; opponent: Actor; difficulty: Difficulty;
  opponentAction: Action; outcome?: Outcome;
}
export type BattleEvent = { round: number } & (
  | { type: "action"; side: Side; action: Action }
  | { type: "hit" | "miss"; side: Side; target: Side; moveId: string }
  | { type: "effectiveness"; side: Side; target: Side; hint: Hint; multiplier: number }
  | { type: "damage"; side: Side; target: Side; amount: number; hp: number }
  | { type: "status"; side: Side; status: Status; change: "applied" | "removed" | "blocked" }
  | { type: "buff"; side: Side; stat: Exclude<Stat, "hp">; change: "applied" | "removed" }
  | { type: "shield"; side: Side; multiplier: number; change: "applied" | "removed" }
  | { type: "energy"; side: Side; amount: number; energy: number; reason: "cost" | "rest" | "round" | "item" | "trait" }
  | { type: "heal"; side: Side; amount: number; hp: number }
  | { type: "end"; outcome: Outcome; reason: "hp" | "limit" | "quit" }
);
