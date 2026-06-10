import type { SimGeoPoint } from "./types";

export function interpolateGeoPoint(from: SimGeoPoint, to: SimGeoPoint, progress: number): SimGeoPoint {
  const clamped = Math.max(0, Math.min(1, progress));
  return {
    lat: from.lat + (to.lat - from.lat) * clamped,
    lng: from.lng + (to.lng - from.lng) * clamped,
  };
}

export function headingBetween(from: SimGeoPoint, to: SimGeoPoint): number {
  return (Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180) / Math.PI;
}
