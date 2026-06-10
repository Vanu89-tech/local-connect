export type SimEntityType = "person" | "friend" | "bus" | "tram" | "shop" | "event";

export type SimQualityLevel = "weak" | "medium" | "strong";

export type SimLodLevel = 0 | 1 | 2 | 3 | 4;

export type SimGeoPoint = {
  lat: number;
  lng: number;
};

export type SimScreenPoint = {
  x: number;
  y: number;
};

export type SimMotion = {
  speedMps: number;
  headingDeg: number;
};

export type SimWorldEntity = {
  id: string;
  type: SimEntityType;
  position: SimGeoPoint;
  priority: number;
  updatedAt: number;
  label?: string;
  icon?: string;
  motion?: SimMotion;
  metadata?: Record<string, unknown>;
};

export type SimCameraState = {
  center: SimGeoPoint;
  zoom: number;
  viewport: {
    width: number;
    height: number;
  };
};

export type SimFrameMetrics = {
  fps: number;
  frameMs: number;
  visibleEntities: number;
  totalEntities: number;
  quality: SimQualityLevel;
};
