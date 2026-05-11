import type { PrimaryFear } from "@/lib/engine";

export type Pillar =
  | "survival"
  | "enough"
  | "time"
  | "leverage"
  | "behavior";

export const PILLARS: readonly Pillar[] = [
  "survival",
  "enough",
  "time",
  "leverage",
  "behavior",
] as const;

export const PILLAR_LABEL: Record<Pillar, string> = {
  survival: "Survival",
  enough: "Enough",
  time: "Time",
  leverage: "Leverage",
  behavior: "Behavior",
};

export const PILLAR_TAGLINE: Record<Pillar, string> = {
  survival: "Avoid ruin first",
  enough: "Define your number",
  time: "Money is stored time",
  leverage: "Compound what you own",
  behavior: "Patience is the edge",
};

export interface Lesson {
  slug: string;
  pillar: Pillar;
  title: string;
  /** 1–2 sentence preview shown on cards. */
  hook: string;
  /** Estimated reading time. */
  estMinutes: number;
  /** Body, in plain paragraphs. */
  paragraphs: string[];
  /** Optional closing reflection prompt. */
  exercise?: string;
  /** Fears this lesson speaks to most directly. */
  speaksTo?: readonly PrimaryFear[];
}
