import type { Feel } from "./feedback";
import type { Input } from "./input";
import type { Rng } from "./rng";
import type { CanvasStage, ThreeStage } from "./stage";

export type GameEvent =
  | { type: "score"; value: number }
  | { type: "over"; score: number }
  | { type: "feel"; kind: Feel };

export interface GameEnv<S> {
  stage: S;
  input: Input;
  rng: Rng;
  emit(e: GameEvent): void;
  /** Space covered by the HUD / home indicator, in CSS px. Games keep play inside it. */
  insets(): { top: number; bottom: number };
  reducedMotion: boolean;
}

/** The one contract every game implements. */
export interface GameInstance {
  update(dt: number): void;
  render(alpha: number): void;
  serialize(): unknown;
  restore(data: unknown): void;
  destroy(): void;
}

export type GameModule =
  | { kind: "2d"; create(env: GameEnv<CanvasStage>): GameInstance }
  | { kind: "3d"; create(env: GameEnv<ThreeStage>): GameInstance };
