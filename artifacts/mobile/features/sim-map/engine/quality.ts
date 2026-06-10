import type { SimFrameMetrics, SimQualityLevel } from "./types";

export type SimQualityProfile = {
  level: SimQualityLevel;
  label: string;
  maxVisibleEntities: number;
  labelDistanceM: number;
  guaranteedPeopleRadiusM: number;
  lodRadiusM: number;
  minZoom: number;
  vehicleTrail: boolean;
  iconPulse: boolean;
  tickMs: number;
};

export const SIM_QUALITY_PROFILES: Record<SimQualityLevel, SimQualityProfile> = {
  weak: {
    level: "weak",
    label: "WEAK",
    maxVisibleEntities: 90,
    labelDistanceM: 150,
    guaranteedPeopleRadiusM: 260,
    lodRadiusM: 650,
    minZoom: 14.45,
    vehicleTrail: false,
    iconPulse: false,
    tickMs: 50,
  },
  medium: {
    level: "medium",
    label: "MID",
    maxVisibleEntities: 190,
    labelDistanceM: 320,
    guaranteedPeopleRadiusM: 460,
    lodRadiusM: 1150,
    minZoom: 13.35,
    vehicleTrail: false,
    iconPulse: true,
    tickMs: 33,
  },
  strong: {
    level: "strong",
    label: "STRONG",
    maxVisibleEntities: 520,
    labelDistanceM: 620,
    guaranteedPeopleRadiusM: 920,
    lodRadiusM: 2300,
    minZoom: 11.75,
    vehicleTrail: true,
    iconPulse: true,
    tickMs: 16,
  },
};

export function chooseNextQuality(
  current: SimQualityLevel,
  metrics: Pick<SimFrameMetrics, "fps" | "frameMs">,
): SimQualityLevel {
  if (metrics.fps < 52 || metrics.frameMs > 19) {
    if (current === "strong") return "medium";
    if (current === "medium") return "weak";
  }

  if (metrics.fps > 58 && metrics.frameMs < 17) {
    if (current === "weak") return "medium";
    if (current === "medium") return "strong";
  }

  return current;
}
