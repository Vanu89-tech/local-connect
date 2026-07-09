type LivePoiCategory = "transit" | "school" | "worship" | "food" | "shop" | "green";

type LivePoi = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: LivePoiCategory;
  poiType?: string;
};

type OverpassElement = {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

const CITY_POI_TILE_M = 1400;
const LIVE_POI_LIMIT = 500;
const OVERPASS_TIMEOUT_MS = 25000;
const IMPORT_BATCH_SIZE = 3;
const IMPORT_BATCH_PAUSE_MS = 700;
const REGION_ID = "augsburg";
const REGION_BBOX = { south: 48.25, west: 10.72, north: 48.50, east: 11.12 };
const REGION_CENTER = { lat: 48.3705, lng: 10.8978 };
const OVERPASS_ENDPOINTS = [
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function getSupabaseEnv(): { supabaseUrl: string; serviceKey: string } {
  const supabaseUrl = process.env["EXPO_PUBLIC_SUPABASE_URL"] ?? process.env["SUPABASE_URL"];
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!supabaseUrl || !serviceKey) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL/SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return { supabaseUrl, serviceKey };
}

function metersPerLngDegree(lat: number): number {
  return Math.max(1, 111320 * Math.cos((lat * Math.PI) / 180));
}

function distanceMetersApprox(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const avgLat = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const dLatM = (a.lat - b.lat) * 111320;
  const dLngM = (a.lng - b.lng) * 111320 * Math.cos(avgLat);
  return Math.sqrt(dLatM * dLatM + dLngM * dLngM);
}

function poiTileCoord(point: { lat: number; lng: number }): { x: number; y: number } {
  return {
    x: Math.floor((point.lng * metersPerLngDegree(point.lat)) / CITY_POI_TILE_M),
    y: Math.floor((point.lat * 111320) / CITY_POI_TILE_M),
  };
}

function poiTileKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function parsePoiTileKey(key: string): { x: number; y: number } {
  const [xRaw, yRaw] = key.split(":");
  return { x: Number(xRaw), y: Number(yRaw) };
}

function poiTileCenter(x: number, y: number, nearLat: number): { lat: number; lng: number } {
  const lat = ((y + 0.5) * CITY_POI_TILE_M) / 111320;
  return {
    lat,
    lng: ((x + 0.5) * CITY_POI_TILE_M) / metersPerLngDegree(nearLat),
  };
}

function poiTileBbox(x: number, y: number, nearLat: number): { south: number; west: number; north: number; east: number } {
  return {
    south: (y * CITY_POI_TILE_M) / 111320,
    west: (x * CITY_POI_TILE_M) / metersPerLngDegree(nearLat),
    north: ((y + 1) * CITY_POI_TILE_M) / 111320,
    east: ((x + 1) * CITY_POI_TILE_M) / metersPerLngDegree(nearLat),
  };
}

function poiTileKeysForBbox(bbox: typeof REGION_BBOX): string[] {
  const southWest = poiTileCoord({ lat: bbox.south, lng: bbox.west });
  const northEast = poiTileCoord({ lat: bbox.north, lng: bbox.east });
  const keys: string[] = [];
  for (let y = Math.min(southWest.y, northEast.y); y <= Math.max(southWest.y, northEast.y); y += 1) {
    for (let x = Math.min(southWest.x, northEast.x); x <= Math.max(southWest.x, northEast.x); x += 1) {
      keys.push(poiTileKey(x, y));
    }
  }
  return keys.sort((a, b) => {
    const ta = parsePoiTileKey(a);
    const tb = parsePoiTileKey(b);
    return (
      distanceMetersApprox(poiTileCenter(ta.x, ta.y, REGION_CENTER.lat), REGION_CENTER) -
      distanceMetersApprox(poiTileCenter(tb.x, tb.y, REGION_CENTER.lat), REGION_CENTER)
    );
  });
}

function detectLivePoiCategory(tags: Record<string, string>): LivePoiCategory | null {
  const amenity = tags.amenity ?? "";
  const shop = tags.shop ?? "";
  const publicTransport = tags.public_transport ?? "";
  const highway = tags.highway ?? "";
  const railway = tags.railway ?? "";

  if (
    amenity === "bus_station" ||
    amenity === "bus_stop" ||
    publicTransport === "platform" ||
    highway === "bus_stop" ||
    railway === "tram_stop" ||
    railway === "station"
  ) return "transit";
  if (amenity === "school" || amenity === "college" || amenity === "university" || amenity === "kindergarten") {
    return "school";
  }
  if (amenity === "place_of_worship") return "worship";
  if (amenity === "cafe" || amenity === "restaurant" || amenity === "bar" || amenity === "fast_food") return "food";
  if (shop) return "shop";
  if (
    tags.leisure === "park" ||
    tags.leisure === "garden" ||
    tags.leisure === "nature_reserve" ||
    tags.leisure === "recreation_ground" ||
    tags.landuse === "grass" ||
    tags.landuse === "meadow" ||
    tags.landuse === "forest" ||
    tags.landuse === "village_green" ||
    tags.natural === "wood"
  ) return "green";
  return null;
}

function toLivePoi(element: OverpassElement): LivePoi | null {
  const tags = element.tags ?? {};
  const category = detectLivePoiCategory(tags);
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  if (!category || lat == null || lng == null) return null;
  const name =
    tags.name ||
    tags["name:en"] ||
    (category === "shop"
      ? "Shop"
      : category === "food"
        ? "Essen & Trinken"
        : category === "green"
          ? "Gruenflaeche"
          : category === "worship"
            ? "Kirche"
            : category === "school"
              ? "Schule"
              : "Haltestelle");
  return {
    id: `${element.type}-${element.id}`,
    lat,
    lng,
    name,
    category,
    poiType:
      tags.shop ||
      tags.amenity ||
      tags.leisure ||
      tags.landuse ||
      tags.natural ||
      tags.public_transport ||
      tags.highway ||
      tags.railway ||
      undefined,
  };
}

function overpassQuery(bbox: ReturnType<typeof poiTileBbox>): string {
  const bboxArgs = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  return `[out:json][timeout:30];
(
  nwr(${bboxArgs})[shop];
  nwr(${bboxArgs})[amenity~"school|university|college|kindergarten|bus_station|bus_stop|place_of_worship|cafe|restaurant|fast_food|bar"];
  nwr(${bboxArgs})[public_transport=platform];
  nwr(${bboxArgs})[highway=bus_stop];
  nwr(${bboxArgs})[railway~"tram_stop|station"];
  nwr(${bboxArgs})[leisure~"park|garden|nature_reserve|recreation_ground"];
  nwr(${bboxArgs})[landuse~"grass|meadow|forest|village_green"];
  nwr(${bboxArgs})[natural=wood];
);
out body center ${LIVE_POI_LIMIT};`;
}

async function fetchTilePois(tileKey: string): Promise<LivePoi[]> {
  const tile = parsePoiTileKey(tileKey);
  const center = poiTileCenter(tile.x, tile.y, REGION_CENTER.lat);
  const bbox = poiTileBbox(tile.x, tile.y, REGION_CENTER.lat);
  let lastError = "unknown";

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OVERPASS_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": "Local-Connect POI Tile Builder",
        },
        body: `data=${encodeURIComponent(overpassQuery(bbox))}`,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!response.ok) {
        lastError = `${endpoint} ${response.status}`;
        continue;
      }
      const payload = (await response.json()) as { elements?: OverpassElement[] };
      const seen = new Set<string>();
      return (payload.elements ?? [])
        .map(toLivePoi)
        .filter((poi): poi is LivePoi => {
          if (!poi) return false;
          const key = `${poi.category}|${poi.name}|${poi.lat.toFixed(5)}|${poi.lng.toFixed(5)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .sort((a, b) => distanceMetersApprox(a, center) - distanceMetersApprox(b, center))
        .slice(0, LIVE_POI_LIMIT);
    } catch (error) {
      clearTimeout(timeout);
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(`Overpass failed for ${tileKey}: ${lastError}`);
}

async function upsertTile(tileKey: string, pois: LivePoi[]): Promise<void> {
  const { supabaseUrl, serviceKey } = getSupabaseEnv();

  const response = await fetch(`${supabaseUrl}/rest/v1/poi_tiles`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      region_id: REGION_ID,
      tile_key: tileKey,
      fetched_at: new Date().toISOString(),
      version: 1,
      source: "overpass",
      pois,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase upsert failed for ${tileKey}: ${response.status} ${await response.text()}`);
  }
}

async function upsertRegion(): Promise<void> {
  const { supabaseUrl, serviceKey } = getSupabaseEnv();

  const response = await fetch(`${supabaseUrl}/rest/v1/poi_regions`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      "content-type": "application/json",
      prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id: REGION_ID,
      name: "Augsburg und Umgebung",
      south: REGION_BBOX.south,
      west: REGION_BBOX.west,
      north: REGION_BBOX.north,
      east: REGION_BBOX.east,
      center_lat: REGION_CENTER.lat,
      center_lng: REGION_CENTER.lng,
      tile_m: CITY_POI_TILE_M,
      version: 1,
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase region upsert failed: ${response.status} ${await response.text()}`);
  }
}

async function getCachedTileKeys(): Promise<Set<string>> {
  const { supabaseUrl, serviceKey } = getSupabaseEnv();
  const response = await fetch(
    `${supabaseUrl}/rest/v1/poi_tiles?region_id=eq.${encodeURIComponent(REGION_ID)}&select=tile_key&limit=1000`,
    {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase cached tile lookup failed: ${response.status} ${await response.text()}`);
  }

  const rows = (await response.json()) as Array<{ tile_key?: unknown }>;
  return new Set(rows.map((row) => row.tile_key).filter((key): key is string => typeof key === "string"));
}

async function main() {
  const keys = poiTileKeysForBbox(REGION_BBOX);
  const only = process.argv.find((arg) => arg.startsWith("--tile="))?.slice("--tile=".length);
  const refresh = process.argv.includes("--refresh");
  const failedKeys: string[] = [];
  await upsertRegion();
  const cachedKeys = refresh || only ? new Set<string>() : await getCachedTileKeys();
  const selectedKeys = (only ? keys.filter((key) => key === only) : keys).filter((key) => !cachedKeys.has(key));
  console.log(
    `Building ${selectedKeys.length} POI tiles for ${REGION_ID}` +
      (cachedKeys.size ? ` (${cachedKeys.size} already cached)` : ""),
  );

  for (let index = 0; index < selectedKeys.length; index += IMPORT_BATCH_SIZE) {
    const batch = selectedKeys.slice(index, index + IMPORT_BATCH_SIZE);
    await Promise.all(
      batch.map(async (key, batchIndex) => {
        const position = index + batchIndex + 1;
        try {
          const pois = await fetchTilePois(key);
          await upsertTile(key, pois);
          console.log(`${position}/${selectedKeys.length} ${key}: ${pois.length} POIs`);
        } catch (error) {
          failedKeys.push(key);
          const message = error instanceof Error ? error.message : String(error);
          console.warn(`${position}/${selectedKeys.length} ${key}: failed (${message})`);
        }
      }),
    );
    await new Promise((resolve) => setTimeout(resolve, IMPORT_BATCH_PAUSE_MS));
  }

  if (failedKeys.length) {
    console.warn(`Failed ${failedKeys.length} tiles: ${failedKeys.join(",")}`);
    process.exitCode = 1;
  } else {
    console.log("All POI tiles built successfully");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
