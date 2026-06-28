export type SimEntityType =
  | "user"
  | "friend"
  | "person"
  | "transit"
  | "bus"
  | "tram"
  | "train"
  | "place"
  | "shop"
  | "bar"
  | "club"
  | "food"
  | "event";

export type SimEntitySource =
  | "mockUsersAdapter"
  | "mockTransitAdapter"
  | "mockPlacesAdapter"
  | "mockEventsAdapter"
  | "supabaseUsersAdapter"
  | "gtfsTransitAdapter"
  | "placesOpeningHoursAdapter";

export type SimVisibility = "public" | "friends" | "private" | "hidden";

export type SimScenarioId = "day" | "rush" | "night" | "event" | "stress";

export type SimUserActivityId =
  | "idle"
  | "walk"
  | "food"
  | "social"
  | "party"
  | "transit"
  | "quiet";

export type SimPlaceState =
  | "open"
  | "closed"
  | "closingSoon"
  | "busy"
  | "happy-hour"
  | "event-live";

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

export type SimTransitPayload = {
  routeId: string;
  label: string;
  vehicleType: "bus" | "tram" | "train";
  direction: 1 | -1;
  progress: number;
  delaySec?: number;
  nextStopId?: string;
};

export type SimUserPayload = {
  relation: "self" | "friend" | "public";
  online: boolean;
  activity: SimUserActivityId;
  statusLabel: string;
};

export type SimPlacePayload = {
  category: "shop" | "bar" | "club" | "food" | "event";
  state: SimPlaceState;
  openHour?: number;
  closeHour?: number;
  crowd?: number;
  offer?: string | null;
};

export type SimLiveEventPayload = {
  kind: "transit-delay" | "place-pulse" | "user-status" | "scenario";
  entityId?: string;
  expiresAt: number;
};

export type SimWorldEntity = {
  id: string;
  type: SimEntityType;
  source?: SimEntitySource;
  position: SimGeoPoint;
  priority: number;
  updatedAt: number;
  visibility?: SimVisibility;
  renderMode?: "marker" | "screen-overlay" | "line" | "hidden";
  label?: string;
  icon?: string;
  motion?: SimMotion;
  metadata?: Record<string, unknown>;
  payload?: SimTransitPayload | SimUserPayload | SimPlacePayload | SimLiveEventPayload;
};

export type SimEntitySnapshot = {
  users: SimWorldEntity[];
  transit: SimWorldEntity[];
  places: SimWorldEntity[];
  events: SimWorldEntity[];
  capturedAt: number;
};

export type SimEntityAdapter<T = SimWorldEntity> = {
  name: SimEntitySource;
  snapshot: () => T[];
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
  tickMs?: number;
  adapterMs?: number;
  scenario?: SimScenarioId;
  droppedFrames?: number;
};
