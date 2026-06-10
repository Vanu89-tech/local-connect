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

## Phase 8: Map Tab Migration

Move proven modules to the real map tab in this order: entity contracts, quality manager, LOD manager, interpolation, transit adapter, POI adapter, renderer. Keep feature flags until parity is stable.
