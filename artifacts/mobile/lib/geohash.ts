// Pure-TS Geohash-Implementierung (kein externes Paket).
// Precision 6 ≈ 1.2km × 0.6km Zelle – gut für Realtime-Kanal-Routing.

const CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';

export function encodeGeohash(lat: number, lon: number, precision = 6): string {
  let idx = 0, bit = 0, even = true, geohash = '';
  let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;

  while (geohash.length < precision) {
    if (even) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) { idx = idx * 2 + 1; minLon = mid; } else { idx *= 2; maxLon = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { idx = idx * 2 + 1; minLat = mid; } else { idx *= 2; maxLat = mid; }
    }
    even = !even;
    if (++bit === 5) { geohash += CHARS[idx]; bit = 0; idx = 0; }
  }
  return geohash;
}

type DecodedHash = { lat: number; lon: number; latErr: number; lonErr: number };

export function decodeGeohash(hash: string): DecodedHash {
  let even = true;
  let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;

  for (const ch of hash) {
    const val = CHARS.indexOf(ch);
    if (val === -1) break;
    for (let bits = 4; bits >= 0; bits--) {
      const b = (val >> bits) & 1;
      if (even) {
        const mid = (minLon + maxLon) / 2;
        if (b) minLon = mid; else maxLon = mid;
      } else {
        const mid = (minLat + maxLat) / 2;
        if (b) minLat = mid; else maxLat = mid;
      }
      even = !even;
    }
  }

  return {
    lat: (minLat + maxLat) / 2,
    lon: (minLon + maxLon) / 2,
    latErr: (maxLat - minLat) / 2,
    lonErr: (maxLon - minLon) / 2,
  };
}

// Gibt die 8 direkten Nachbar-Hashes zurück (N, S, E, W + Diagonalen).
export function geohashNeighbors(hash: string): string[] {
  const { lat, lon, latErr, lonErr } = decodeGeohash(hash);
  const p = hash.length;
  const dlat = latErr * 2;
  const dlon = lonErr * 2;

  const offsets: [number, number][] = [
    [dlat, 0], [-dlat, 0], [0, dlon], [0, -dlon],
    [dlat, dlon], [dlat, -dlon], [-dlat, dlon], [-dlat, -dlon],
  ];

  return offsets.map(([dy, dx]) => {
    const nLat = Math.max(-90, Math.min(90, lat + dy));
    const nLon = ((lon + dx + 180) % 360) - 180;
    return encodeGeohash(nLat, nLon, p);
  });
}
