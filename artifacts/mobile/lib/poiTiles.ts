import { ApiError, apiRequest } from "@/lib/api";

export type PoiTilePoi = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  category: "transit" | "school" | "worship" | "food" | "shop" | "green";
  poiType?: string;
};

export type ServerPoiTile = {
  regionId: string;
  tileKey: string;
  fetchedAt: string;
  version: number;
  pois: PoiTilePoi[];
};

export async function fetchServerPoiTile(
  regionId: string,
  tileKey: string,
): Promise<ServerPoiTile | null> {
  try {
    return await apiRequest<ServerPoiTile>(
      `/poi/tiles/${encodeURIComponent(regionId)}/${encodeURIComponent(tileKey)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
