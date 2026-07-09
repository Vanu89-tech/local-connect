create table if not exists public.poi_regions (
  id text primary key,
  name text not null,
  south double precision not null,
  west double precision not null,
  north double precision not null,
  east double precision not null,
  center_lat double precision not null,
  center_lng double precision not null,
  tile_m integer not null default 1400,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint poi_regions_bbox_valid check (south < north and west < east),
  constraint poi_regions_tile_m_positive check (tile_m > 0)
);

create table if not exists public.poi_tiles (
  region_id text not null references public.poi_regions(id) on delete cascade,
  tile_key text not null,
  fetched_at timestamptz not null default now(),
  version integer not null default 1,
  source text not null default 'overpass',
  pois jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (region_id, tile_key),
  constraint poi_tiles_pois_array check (jsonb_typeof(pois) = 'array')
);

create index if not exists poi_tiles_region_fetched_at_idx
  on public.poi_tiles (region_id, fetched_at desc);

insert into public.poi_regions (
  id,
  name,
  south,
  west,
  north,
  east,
  center_lat,
  center_lng,
  tile_m,
  version
) values (
  'augsburg',
  'Augsburg und Umgebung',
  48.25,
  10.72,
  48.50,
  11.12,
  48.3705,
  10.8978,
  1400,
  1
) on conflict (id) do update set
  name = excluded.name,
  south = excluded.south,
  west = excluded.west,
  north = excluded.north,
  east = excluded.east,
  center_lat = excluded.center_lat,
  center_lng = excluded.center_lng,
  tile_m = excluded.tile_m,
  version = excluded.version,
  updated_at = now();

alter table public.poi_regions enable row level security;
alter table public.poi_tiles enable row level security;

drop policy if exists "Authenticated users can read POI regions" on public.poi_regions;
create policy "Authenticated users can read POI regions"
  on public.poi_regions
  for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read POI tiles" on public.poi_tiles;
create policy "Authenticated users can read POI tiles"
  on public.poi_tiles
  for select
  to authenticated
  using (true);
