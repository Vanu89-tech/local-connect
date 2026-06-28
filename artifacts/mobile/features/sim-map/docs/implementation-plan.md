# Sim Map Implementation Plan

## Phase 1: Isolated Sim Engine

Build the game-map surface inside the Sim tab with mock entities, camera-aware rendering, FPS metrics, quality tiers, and distance-based LOD. Keep React Native responsible for app chrome and let the map surface own high-frequency animation.

## Phase 2: Rendering Backend

Use the existing WebView/MapLibre surface for the first stable version because it is already installed and styled. Move dense overlays into batched DOM/canvas-style layers. Evaluate `react-native-skia` later when we are ready to add a native dependency.

## Phase 3: Entity System

Represent people, friends, transit, shops, and events through one `SimWorldEntity` contract. Keep live data normalization separate from rendering state.

## Phase 4: LOD

Calculate LOD from camera zoom, distance from focus, entity priority, and quality level. Nearby entities get labels and animation; distant entities collapse to simple marks or disappear.

## Phase 5: Device Quality

Target 60 FPS. Degrade labels, animation, visible entity count, and update frequency before allowing the map to feel sluggish.

## Phase 6: Live Update Pipeline

Route real feeds through source adapters, a normalizer, an entity store, an interpolation layer, LOD filtering, and finally the renderer.

## Phase 7: Sim Lab Controls

Expose play/pause, speed, FPS, visible entity count, LOD, quality, and mock world toggles in the Sim tab so performance and behavior can be tested before production migration.

Current Sim Lab expansion:

- Shared entity contract now covers users, friends, public users, transit, places, live events, visibility, source adapters, payloads, and frame metrics.
- The Sim tab uses mock adapter boundaries for users, transit, places, and events so later live feeds can replace mocks without changing renderer semantics.
- Transit simulation includes buses, trams, and trains with route progress, direction, speed, and delay events.
- Place simulation includes shops, bars, clubs, food spots, events, opening windows, crowd level, happy-hour/live states, and closed states.
- User simulation includes friends and public online users with activity/status labels such as moving, food, social, party, transit, quiet, and online.
- Live event simulation produces transit delays, place pulses, user status changes, and scenario events.
- Scenario controls cover day, rush hour, night, event, and load/stress conditions.
- Performance HUD tracks FPS, LOD visible count, scenario, sim clock, entity counts, active events, and tick cost.
- During camera interaction, simulation work is deprioritized so map dragging/zooming stays the first performance priority.

## Phase 8: Map Tab Migration

Move proven modules to the real map tab in this order: entity contracts, quality manager, LOD manager, interpolation, transit adapter, POI adapter, renderer. Keep feature flags until parity is stable.

Migration gates before enabling in the real map tab:

- Sim tab holds 60 FPS during pan/zoom on strong profile with current mock density.
- Strong profile keeps tick cost below 8 ms for normal scenarios and below 12 ms for stress scenario.
- Medium and weak profiles degrade labels, animation, and visible entity count before camera movement becomes sluggish.
- Live adapters must normalize into `SimEntitySnapshot` instead of mutating map markers directly.
- Renderer must reuse markers/screen overlays and only update positions/classes/text.
- Real Supabase presence data must respect visibility before reaching the renderer.
- Real transit and places adapters must be feature flagged independently.
