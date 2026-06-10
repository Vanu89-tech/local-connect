import type { SimWorldEntity } from "../engine/types";

const NOW = 0;

export const SIM_MUNICH_CENTER = {
  lat: 48.1351,
  lng: 11.582,
};

export const MOCK_WORLD_ENTITIES: SimWorldEntity[] = [
  {
    id: "shop-viktualienmarkt",
    type: "shop",
    label: "Markt",
    icon: "M",
    position: { lat: 48.1342, lng: 11.5761 },
    priority: 54,
    updatedAt: NOW,
  },
  {
    id: "shop-cafe-tal",
    type: "shop",
    label: "Cafe",
    icon: "C",
    position: { lat: 48.1356, lng: 11.58 },
    priority: 48,
    updatedAt: NOW,
  },
  {
    id: "event-marienhof",
    type: "event",
    label: "Live",
    icon: "!",
    position: { lat: 48.1373, lng: 11.5797 },
    priority: 72,
    updatedAt: NOW,
  },
];
