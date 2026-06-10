import type { SimLodLevel, SimQualityLevel, SimWorldEntity } from "./types";

const QUALITY_BONUS: Record<SimQualityLevel, number> = {
  weak: -1,
  medium: 0,
  strong: 1,
};

export function getSimLodLevel(distanceM: number, zoom: number, quality: SimQualityLevel): SimLodLevel {
  const zoomBoost = zoom >= 15.5 ? 1 : zoom <= 12.5 ? -1 : 0;
  const score =
    (distanceM < 120 ? 4 : distanceM < 280 ? 3 : distanceM < 700 ? 2 : distanceM < 1400 ? 1 : 0) +
    zoomBoost +
    QUALITY_BONUS[quality];

  return Math.max(0, Math.min(4, score)) as SimLodLevel;
}

export function shouldRenderEntity(entity: SimWorldEntity, lod: SimLodLevel): boolean {
  if (entity.priority >= 90) return true;
  if (entity.type === "bus" || entity.type === "tram") return lod >= 1;
  if (entity.type === "shop" || entity.type === "event") return lod >= 2;
  return lod >= 1;
}

export function shouldRenderLabel(entity: SimWorldEntity, lod: SimLodLevel): boolean {
  if (entity.type === "friend") return lod >= 2;
  if (entity.type === "bus" || entity.type === "tram") return lod >= 3;
  return lod >= 4;
}
