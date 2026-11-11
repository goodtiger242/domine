export type Group = "rush" | "trick" | "track" | "guard" | "bond" | "endure";
export type MoveTag = "contact" | "sound" | "scent" | "trick" | "multi" | "charge" | "gaze";
export type Species = "dog" | "cat" | "pigeon" | "magpie" | "sparrow" | "bulbul" | "duck" | "deer" | "boar" | "raccoon" | "squirrel" | "chipmunk";
export type JobId = "rush" | "guard" | "trick" | "track" | "bond";
export type Job = { id: JobId; tier: 1 | 2 | 3; nodes?: Readonly<Record<string, 1 | 2>> };
export type AiTier = "gentle" | "normal" | "veteran" | "boss" | "king";
export type Temperament = "lively" | "careful" | "kind" | "steady";
export type Size = "small" | "medium" | "large";
export type Stat = "hp" | "attack" | "defense" | "speed" | "focus" | "calm";
export type Stats = Record<Stat, number>;
export interface BattleProfile {
  critBonus: number; critMultiplier: number; momentumRate: number; evade: number;
  restEnergy: number; statusTaken: number; statusDealt: number; statTilt: Partial<Stats>;
}
export type Condition = { fullness: number; mood: number; clean: number };
export type MovementType = "companion" | "agile" | "flying" | "runner" | "heavy" | "waterside";
export type Habitat = "H" | "U" | "G" | "F" | "W";
export type TimeBand = "morning" | "day" | "evening" | "night";
export interface BattleEnvironment { habitat?: Habitat; time?: TimeBand; weather?: "clear" | "rain" | "wind" | "snow" }
export interface FighterOptions {
  moves?: readonly string[]; consumable?: string;
  items?: readonly string[]; owned?: boolean; boss?: boolean; equipmentStats?: boolean; finisher?: string;
  allocation?: Partial<Stats>; job?: Partial<Stats> | Job | JobId; condition?: Condition; mastery?: Readonly<Record<string, number>>;
  species?: Species; signatureBreedId?: string; element?: Group; weakTag?: MoveTag; resistTag?: MoveTag;
  knownWeakTag?: boolean; knownResistTag?: boolean; aiTier?: AiTier;
  movementType?: MovementType; habitats?: readonly Habitat[]; activeBands?: readonly TimeBand[];
  environment?: BattleEnvironment;
}
export type Status = "stagger" | "blur" | "slow" | "tense" | "winded" | "open";
export type Trait = "restDamage" | "earlySpeed" | "firstTrack" | "firstShield" | "thirdEnergy" | "longBuff" | "firstBond" | "firstRush" | "trackDamage" | "statusImmune";
export interface Breed {
  id: string; name: string; group: Group; temperament: Temperament; size: Size;
  base: Stats; growth: string; trait: Trait; learn: readonly { level: number; move: string }[];
}
export interface Move {
  tags?: readonly MoveTag[]; fx?: string;
  source?: "common" | "element" | "species" | "breed" | "job";
  learn?: { level: number; species?: Species; breedId?: string; job?: JobId; tier?: 1 | 2 | 3; prerequisite?: string };
  id: string; name: string; kind: "attack" | "defense" | "support";
  group: Group | "neutral"; power: number; accuracy: number; energy: number; priority: number;
  buff?: Exclude<Stat, "hp">; heal?: number; status?: Status; chance?: number;
  mode?: "normal" | "charge" | "multi" | "recoil";
  hits?: 2 | 3; recoil?: { energy?: number; stat?: Exclude<Stat, "hp">; rate?: number };
  common?: boolean;
  defense?: "guard" | "counter" | "evade" | "stance";
  contact?: boolean; breaksDefense?: boolean; finisher?: boolean;
}
export interface Item {
  id: string; name: string; slot: "collar" | "harness" | "charm" | "bag";
  rates?: Partial<Stats>; energy?: number; heal?: number;
  category?: "heal" | "energy" | "buff" | "cleanse" | "protect" | "critical" | "cancel" | "survive";
  buff?: Exclude<Stat, "hp" | "calm">; price?: number;
}
export interface Fighter extends FighterOptions {
  battleProfile?: BattleProfile;
  baseStats?: Stats;
  breedId: string; level: number; stats: Stats; moves: readonly string[];
  equipment: readonly string[]; consumable?: string;
}
export interface Actor extends Fighter {
  history?: Action[];
  hp: number; energy: number; healed: number; itemUsed: boolean;
  statuses: { id: Status; applied: number; expires: number }[];
  buffs: { stat: Exclude<Stat, "hp">; expires: number; rate?: number; item?: boolean }[];
  shield?: { multiplier: number; expires: number };
  lastAction?: Action; lastDefense: number; traitUsed: boolean; rested: boolean;
  charging?: string;
  momentum?: number; usedItems?: string[]; guaranteedCritical?: boolean; survival?: boolean; survivalUsed?: boolean;
  defense?: { kind: NonNullable<Move["defense"]>; expires: number; strength: number; triggered?: boolean };
  exposedUntil?: number;
  recoil?: { energy?: number; stat?: Exclude<Stat, "hp">; rate?: number; expires: number };
}
export type Side = "player" | "opponent";
export type Action = { kind: "move"; moveId: string; phase?: "prepare" | "release" } | { kind: "push" | "rest" | "quit" } | { kind: "item"; itemId: string };
export type Difficulty = "normal" | "hard";
export type Outcome = "player" | "opponent" | "draw" | "quit";
export type Hint = "good" | "normal" | "weak";
export type Timing = "miss" | "good" | "perfect";
export interface RoundInput { attackTiming?: Timing; guardTiming?: Timing }
export interface BattleState {
  aiTier?: AiTier;
  opponentHint?: { obscured: boolean; clue: string };
  round: number; rng: number; player: Actor; opponent: Actor; difficulty: Difficulty;
  opponentAction: Action; outcome?: Outcome;
  criticals?: boolean;
}
export type BattleEvent = { round: number } & (
  | { type: "reveal"; side: Side; tag: MoveTag; affinity: "weak" | "resist" }
  | { type: "action"; side: Side; action: Action }
  | { type: "hit" | "miss"; side: Side; target: Side; moveId: string }
  | { type: "effectiveness"; side: Side; target: Side; hint: Hint; multiplier: number }
  | { type: "damage"; side: Side; target: Side; amount: number; hp: number; critical?: true }
  | { type: "status"; side: Side; status: Status; change: "applied" | "removed" | "blocked" }
  | { type: "buff"; side: Side; stat: Exclude<Stat, "hp">; change: "applied" | "removed" }
  | { type: "shield"; side: Side; multiplier: number; change: "applied" | "removed" }
  | { type: "energy"; side: Side; amount: number; energy: number; reason: "cost" | "rest" | "round" | "item" | "trait" }
  | { type: "heal"; side: Side; amount: number; hp: number }
  | { type: "end"; outcome: Outcome; reason: "hp" | "limit" | "quit" }
  | { type: "counter" | "evade" | "break" | "stagger" | "cancel"; side: Side; target: Side }
  | { type: "momentum"; side: Side; amount: number; momentum: number }
  | { type: "finisher"; side: Side; moveId: string }
  | { type: "survive"; side: Side }
);
