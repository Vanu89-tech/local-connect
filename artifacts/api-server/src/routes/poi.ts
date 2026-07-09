import { Router, type IRouter } from "express";

import { getSupabaseClient } from "../auth/supabase";

type PoiTileRow = {
  region_id: string;
  tile_key: string;
  fetched_at: string;
  version: number;
  pois: unknown;
};

const router: IRouter = Router();

router.get("/poi/tiles/:regionId/:tileKey", async (req, res) => {
  const { regionId, tileKey } = req.params;
  if (!regionId || !tileKey || !/^-?\d+:-?\d+$/.test(tileKey)) {
    res.status(400).json({ message: "Invalid POI tile request" });
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    res.status(503).json({ message: "Supabase server config is missing" });
    return;
  }

  const { data, error } = await supabase
    .from("poi_tiles")
    .select("region_id, tile_key, fetched_at, version, pois")
    .eq("region_id", regionId)
    .eq("tile_key", tileKey)
    .maybeSingle<PoiTileRow>();

  if (error) {
    res.status(500).json({ message: error.message });
    return;
  }
  if (!data) {
    res.status(404).json({ message: "POI tile is not cached yet" });
    return;
  }

  res.setHeader("cache-control", "public, max-age=300, stale-while-revalidate=86400");
  res.json({
    regionId: data.region_id,
    tileKey: data.tile_key,
    fetchedAt: data.fetched_at,
    version: data.version,
    pois: Array.isArray(data.pois) ? data.pois : [],
  });
});

export default router;
