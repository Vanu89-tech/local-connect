import React, { useRef } from "react";
import { Platform, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import Colors from "@/constants/colors";

// Simulation center – Augsburg Königsplatz / Innenstadt
const SIM_LAT = 48.3655;
const SIM_LNG = 10.8947;
const FRIEND_COUNT = 30;
const LOCAL_COUNT  = 70;
const TRANSIT_COUNT = 50;
const WORLD_ICON_COUNT = 14;
const SIM_ENGINE_VERSION = "Sim Engine V5";

function buildSimHtml(lat: number, lng: number): string {
  const mapStyle  = Colors.map;
  const appColors = Colors.light;
  const isNeon    = Colors.activeStyle.id === "neon";
  const markerRadius      = isNeon ? "8px" : "50%";
  const smallMarkerRadius = isNeon ? "5px" : "50%";

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css" />
<script src="https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.js"></script>
<style>
  :root {
    --ink: ${appColors.text};
    --paper: ${mapStyle.paper};
    --accent: ${appColors.tint};
    --mint: ${appColors.mint};
    --outline: ${appColors.text};
    --accent-blue: ${mapStyle.accentBlue};
    --accent-pink: ${mapStyle.accentPink};
    --accent-yellow: ${mapStyle.accentYellow};
    --marker-radius: ${markerRadius};
    --small-marker-radius: ${smallMarkerRadius};
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:var(--paper); font-family:"Avenir Next","Trebuchet MS","Arial Rounded MT Bold",sans-serif; overflow:hidden; }
  #map { width:100vw; height:100vh; }
  #transit-layer { position:fixed; inset:0; z-index:470; pointer-events:none; overflow:hidden; }
  #parchment-overlay {
    position:fixed; inset:0; pointer-events:none; z-index:330;
    background:
      radial-gradient(circle at 12% 16%, ${mapStyle.overlayBlue} 0%, rgba(0,240,255,0) 32%),
      radial-gradient(circle at 84% 80%, ${mapStyle.overlayPink} 0%, rgba(255,43,214,0) 36%),
      radial-gradient(circle at 52% 42%, ${mapStyle.overlayYellow} 0%, rgba(239,255,58,0) 38%);
    mix-blend-mode:screen;
  }
  #vignette { position:fixed; inset:0; pointer-events:none; z-index:360; box-shadow:inset 0 0 90px rgba(0,0,0,0.46); }
  #lod-focus {
    position:fixed; left:50%; top:50%; width:18px; height:18px;
    transform:translate(-50%,-50%); z-index:590; pointer-events:none;
    border-radius:50%; border:2px solid rgba(0,240,255,0.86);
    box-shadow:0 0 14px rgba(0,240,255,0.55),0 0 0 var(--lod-radius-px,150px) rgba(0,240,255,0.035);
  }
  #lod-focus::before,
  #lod-focus::after {
    content:""; position:absolute; left:50%; top:50%; background:rgba(239,255,58,0.82);
    transform:translate(-50%,-50%); border-radius:2px;
  }
  #lod-focus::before { width:30px; height:2px; }
  #lod-focus::after { width:2px; height:30px; }
  #recenter {
    position:fixed; right:16px; bottom:116px; width:62px; height:62px;
    border-radius:var(--marker-radius); border:2px solid var(--outline);
    background:linear-gradient(135deg,rgba(0,240,255,0.24) 0%,rgba(255,43,214,0.22) 100%),#07131f;
    box-shadow:0 0 0 1px rgba(0,240,255,0.45),0 0 18px rgba(0,240,255,0.42);
    z-index:500; display:flex; align-items:center; justify-content:center;
    color:var(--accent-blue); font-size:25px; font-weight:900; cursor:pointer;
    -webkit-tap-highlight-color:transparent;
  }
  #recenter:active { transform:translateY(2px); box-shadow:0 0 10px rgba(255,43,214,0.42); }
  #recenter::before { content:"✦"; position:absolute; top:6px; left:50%; transform:translateX(-50%); color:var(--accent-pink); font-size:13px; }
  .maplibregl-canvas { filter:saturate(1.25) contrast(1.06) brightness(0.9); }
  .pulse { animation:pulse 2s infinite; }
  @keyframes pulse { 0%{opacity:1} 50%{opacity:0.68} 100%{opacity:1} }
  .sim-lod-0 { --lod-scale:0.1; opacity:0 !important; pointer-events:none !important; }
  .sim-lod-1 { --lod-scale:0.64; opacity:0.72; }
  .sim-lod-2 { --lod-scale:0.82; opacity:0.86; }
  .sim-lod-3 { --lod-scale:1; opacity:1; }
  .sim-lod-4 { --lod-scale:1.16; opacity:1; }
  body.quality-weak .friend-name-tag,
  body.quality-weak .entity-label { display:none !important; }
  body.quality-weak .sim-float-icon { animation:none !important; }
  body.quality-medium .entity-label { display:none; }
  .friend-pulse { animation:friendPulse 1.9s infinite; }
  @keyframes friendPulse {
    0%   { box-shadow:0 0 0 0 rgba(239,255,58,0.92),0 0 14px rgba(239,255,58,0.54); }
    45%  { box-shadow:0 0 0 13px rgba(239,255,58,0.36),0 0 22px rgba(239,255,58,0.48); }
    80%  { box-shadow:0 0 0 24px rgba(239,255,58,0),0 0 30px rgba(239,255,58,0.26); }
    100% { box-shadow:0 0 0 0 rgba(239,255,58,0),0 0 14px rgba(239,255,58,0.42); }
  }
  /* ── Walking Figures ──────────────────────────────────────────── */
  .fig-wrap {
    display:flex; flex-direction:column; align-items:center;
    transform-origin:50% 50%; position:relative;
    touch-action:manipulation; -webkit-tap-highlight-color:transparent;
  }
  .fig {
    position:relative; display:flex; flex-direction:column; align-items:center;
    gap:1px; cursor:pointer;
    transform:scaleX(var(--face-dir,1)) scale(var(--symbol-scale,1)) scale(var(--lod-scale,1)); transform-origin:50% 100%;
    touch-action:manipulation; -webkit-tap-highlight-color:transparent;
  }
  .fig.fig-me { min-width:44px; min-height:44px; justify-content:center; }
  .fig-glow {
    position:absolute; bottom:-4px; left:50%; transform:translateX(-50%);
    width:30px; height:8px; border-radius:50%;
    background:radial-gradient(ellipse,rgba(239,255,58,0.42) 0%,transparent 70%);
    pointer-events:none; opacity:0; transition:opacity 1.2s;
  }
  .fig-head {
    width:13px; height:13px; border-radius:50%;
    background:#efff3a; border:2px solid rgba(255,255,255,0.92); flex-shrink:0; z-index:2;
    box-shadow:0 0 8px rgba(239,255,58,0.95),0 0 18px rgba(239,255,58,0.55);
  }
  .fig-body { width:5px; height:8px; background:#efff3a; border-radius:2px; flex-shrink:0; box-shadow:0 0 6px rgba(239,255,58,0.7); }
  .fig-legs { display:flex; gap:3px; }
  .fig-leg { width:3px; height:9px; background:#efff3a; border-radius:2px; transform-origin:50% 0%; box-shadow:0 0 4px rgba(239,255,58,0.6); }
  .fig.fig-me .fig-head { width:16px; height:16px; box-shadow:0 0 12px rgba(239,255,58,1),0 0 26px rgba(239,255,58,0.6); }
  .fig.fig-me .fig-body { width:6px; height:10px; }
  .fig.fig-me .fig-leg  { width:4px; height:11px; }
  /* Idle */
  @keyframes fig-bob    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1.5px)} }
  @keyframes fig-sway-l { 0%,100%{transform:rotate(-9deg)} 50%{transform:rotate(9deg)} }
  @keyframes fig-sway-r { 0%,100%{transform:rotate(9deg)} 50%{transform:rotate(-9deg)} }
  .fig[data-state="idle"] .fig-head,
  .fig[data-state="idle"] .fig-body { animation:fig-bob 2.2s ease-in-out infinite; }
  .fig[data-state="idle"] .fig-leg:first-child { animation:fig-sway-l 2.2s ease-in-out infinite; }
  .fig[data-state="idle"] .fig-leg:last-child  { animation:fig-sway-r 2.2s ease-in-out infinite; }
  /* Walk */
  @keyframes fig-walk-l    { 0%{transform:rotate(-33deg)} 50%{transform:rotate(33deg)} 100%{transform:rotate(-33deg)} }
  @keyframes fig-walk-r    { 0%{transform:rotate(33deg)} 50%{transform:rotate(-33deg)} 100%{transform:rotate(33deg)} }
  @keyframes fig-walk-body { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-1px)} }
  .fig[data-state="walk"] .fig-leg:first-child { animation:fig-walk-l 0.54s ease-in-out infinite; }
  .fig[data-state="walk"] .fig-leg:last-child  { animation:fig-walk-r 0.54s ease-in-out infinite; }
  .fig[data-state="walk"] .fig-head,
  .fig[data-state="walk"] .fig-body { animation:fig-walk-body 0.54s ease-in-out infinite; }
  /* Run */
  .fig[data-state="run"] .fig-leg:first-child { animation:fig-walk-l 0.27s ease-in-out infinite; }
  .fig[data-state="run"] .fig-leg:last-child  { animation:fig-walk-r 0.27s ease-in-out infinite; }
  .fig[data-state="run"] .fig-head,
  .fig[data-state="run"] .fig-body { animation:fig-walk-body 0.27s ease-in-out infinite; }
  /* Popup */
  @keyframes fig-popup-appear {
    from { transform:translateX(-50%) translateY(8px) scale(0.92); opacity:0; }
    to   { transform:translateX(-50%) translateY(0) scale(1); opacity:1; }
  }
  .fig-popup-inner {
    position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
    background:rgba(7,19,31,0.97); border:1.5px solid rgba(0,240,255,0.55);
    border-radius:10px; box-shadow:0 0 18px rgba(0,240,255,0.28);
    padding:10px 14px; min-width:160px; max-width:210px;
    z-index:10000; display:none; pointer-events:auto;
  }
  .fig-popup-inner.visible {
    display:block;
    animation:fig-popup-appear 200ms cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .fig-popup-inner::after {
    content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%);
    border:6px solid transparent; border-top-color:rgba(0,240,255,0.55);
  }
  .fig-popup-name { color:#efff3a; font-size:14px; font-weight:900; display:block; margin-bottom:3px; }
  .fig-popup-sub  { color:#00f0ff; font-size:11px; font-weight:700; display:block; }
  .friend-marker-wrap.popup-open { z-index:10000 !important; }
  /* Pop-in */
  @keyframes fig-pop-in {
    0%   { transform:scale(0) translateY(8px); opacity:0; }
    68%  { transform:scale(1.18) translateY(-2px); opacity:1; }
    100% { transform:scale(1) translateY(0); opacity:1; }
  }
  .fig-entering { animation:fig-pop-in 0.32s cubic-bezier(0.34,1.56,0.64,1) forwards; }
  /* Burst */
  @keyframes burst-ring { 0%{transform:scale(1);opacity:0.9} 100%{transform:scale(4);opacity:0} }
  .burst-ring {
    position:absolute; left:50%; top:50%; width:22px; height:22px; margin:-11px 0 0 -11px;
    border-radius:50%; border:2px solid #efff3a; pointer-events:none;
    animation:burst-ring 0.65s ease-out forwards;
  }
  /* Friend name tag */
  .friend-name-tag {
    padding:2px 8px; border-radius:var(--marker-radius);
    border:1px solid var(--accent-blue); background:rgba(7,19,31,0.92);
    box-shadow:0 0 6px rgba(0,240,255,0.24); color:var(--ink);
    font-size:11px; font-weight:900; white-space:nowrap;
    margin-bottom:4px; max-width:120px; overflow:hidden;
    text-overflow:ellipsis; text-align:center; cursor:pointer;
    pointer-events:auto; touch-action:manipulation;
  }
  .friend-marker-wrap {
    display:flex; flex-direction:column; align-items:center;
    transform-origin:50% 100%; pointer-events:none;
  }
  .friend-marker-wrap .fig { pointer-events:auto; }
  /* ── Game world entities ───────────────────────────────────────── */
  .transit-wrap {
    position:relative; width:54px; height:54px; display:flex; align-items:center; justify-content:center;
    transform-origin:50% 50%; pointer-events:auto; touch-action:manipulation;
  }
  .transit-core {
    min-width:42px; height:30px; padding:0 7px; border-radius:8px;
    border:2px solid rgba(255,255,255,0.98);
    display:flex; align-items:center; justify-content:center;
    color:#02070d; font-size:13px; font-weight:1000;
    box-shadow:0 0 16px rgba(255,43,214,0.76),0 0 30px rgba(0,240,255,0.26);
    transform:rotate(var(--heading,0deg)) scale(var(--lod-scale,1));
    transform-origin:50% 50%;
  }
  .transit-wrap.bus .transit-core { background:#ff2bd6; color:#ffffff; }
  .transit-wrap.tram .transit-core { background:#efff3a; color:#02070d; box-shadow:0 0 18px rgba(239,255,58,0.88),0 0 30px rgba(0,240,255,0.24); }
  .transit-wrap::after {
    content:""; position:absolute; left:50%; top:50%; width:8px; height:2px;
    background:rgba(234,251,255,0.92); transform:translate(-50%, 16px);
    border-radius:50%;
  }
  .transit-screen {
    position:absolute; left:0; top:0; width:54px; height:54px;
    display:flex; align-items:center; justify-content:center; pointer-events:none;
    transform:translate(-9999px,-9999px); will-change:transform,opacity;
  }
  .transit-screen-core {
    min-width:42px; height:30px; padding:0 7px; border-radius:8px;
    border:2px solid rgba(255,255,255,0.98);
    display:flex; align-items:center; justify-content:center;
    font-size:13px; font-weight:1000;
    transform:rotate(var(--heading,0deg)) scale(var(--lod-scale,1));
    transform-origin:50% 50%;
  }
  .transit-screen.bus .transit-screen-core {
    background:#ff2bd6; color:#fff;
    box-shadow:0 0 16px rgba(255,43,214,0.76),0 0 30px rgba(0,240,255,0.26);
  }
  .transit-screen.tram .transit-screen-core {
    background:#efff3a; color:#02070d;
    box-shadow:0 0 18px rgba(239,255,58,0.88),0 0 30px rgba(0,240,255,0.24);
  }
  .entity-marker {
    position:relative; display:flex; flex-direction:column; align-items:center; gap:4px;
    transform-origin:50% 100%; pointer-events:auto;
  }
  .sim-float-icon {
    width:28px; height:28px; border-radius:var(--small-marker-radius);
    display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg,rgba(255,43,214,0.22),rgba(0,240,255,0.18)),#07131f;
    border:1.5px solid rgba(0,240,255,0.62);
    color:#efff3a; font-size:13px; font-weight:1000;
    box-shadow:0 0 12px rgba(0,240,255,0.34),0 0 20px rgba(255,43,214,0.18);
    animation:floatIcon 2.4s ease-in-out infinite;
    transform:scale(var(--lod-scale,1));
    transform-origin:50% 100%;
  }
  .entity-marker.shop .sim-float-icon { color:#00ffb2; border-color:rgba(0,255,178,0.58); }
  .entity-marker.event .sim-float-icon { color:#ff2bd6; border-color:rgba(255,43,214,0.65); }
  .entity-label {
    padding:2px 7px; border-radius:var(--small-marker-radius);
    background:rgba(7,19,31,0.88); border:1px solid rgba(0,240,255,0.28);
    color:#eafbff; font-size:10px; font-weight:900; max-width:86px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
  }
  @keyframes floatIcon { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  /* Popup card */
  .maplibregl-popup-content {
    border-radius:var(--marker-radius);
    box-shadow:0 0 18px rgba(0,240,255,0.32),0 0 28px rgba(255,43,214,0.18);
    border:2px solid var(--outline);
    background:linear-gradient(180deg,rgba(7,19,31,0.98) 0%,rgba(8,28,43,0.98) 100%);
    padding:10px 12px;
  }
  .maplibregl-popup-tip { border-top-color:var(--outline) !important; }
  .info-sheet { min-width:200px; display:flex; align-items:center; gap:10px; }
  .info-sheet-title { font-size:14px; font-weight:900; color:var(--ink); line-height:1.1; }
  .info-sheet-activity { margin-top:4px; font-size:11px; font-weight:700; color:var(--accent-blue); }

  /* ── Simulation HUD ──────────────────────────────────────────── */
  #sim-hud {
    position:fixed; top:12px; left:50%; transform:translateX(-50%);
    display:flex; gap:6px; z-index:600; pointer-events:none; flex-wrap:nowrap;
  }
  .hud-chip {
    background:rgba(7,19,31,0.88); border:1px solid rgba(0,240,255,0.3);
    border-radius:20px; padding:5px 10px;
    font-size:10px; font-weight:800; color:#00f0ff;
    backdrop-filter:blur(8px); white-space:nowrap;
    font-family:"Avenir Next","Trebuchet MS",sans-serif;
  }
  .hud-chip span { color:#efff3a; }

  /* ── Simulation Controls ─────────────────────────────────────── */
  #sim-controls {
    position:fixed; bottom:22px; left:50%; transform:translateX(-50%);
    display:flex; align-items:center; gap:8px;
    background:rgba(7,19,31,0.9); border:1px solid rgba(0,240,255,0.28);
    border-radius:28px; padding:8px 16px; z-index:600;
    backdrop-filter:blur(12px);
  }
  .sim-btn {
    width:36px; height:36px; border-radius:50%;
    border:1.5px solid rgba(0,240,255,0.4); background:rgba(0,240,255,0.07);
    color:#00f0ff; font-size:15px; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    -webkit-tap-highlight-color:transparent; font-family:sans-serif;
  }
  .sim-btn:active { background:rgba(0,240,255,0.2); }
  .sim-btn.on { background:rgba(239,255,58,0.12); border-color:#efff3a; color:#efff3a; }
  .sim-sep { width:1px; height:24px; background:rgba(0,240,255,0.18); }
  .sim-label { font-size:9px; font-weight:800; color:#3a5a70; text-transform:uppercase; letter-spacing:0.5px; font-family:"Avenir Next",sans-serif; }
  .sim-val   { font-size:13px; font-weight:900; color:#efff3a; min-width:28px; text-align:center; font-family:"Avenir Next",sans-serif; }
</style>
</head>
<body>
<div id="map"></div>
<div id="transit-layer"></div>
<div id="parchment-overlay"></div>
<div id="vignette"></div>
<div id="lod-focus" aria-hidden="true"></div>
<button id="recenter" aria-label="Zentrieren" type="button">⌖</button>

<!-- Simulation HUD -->
<div id="sim-hud">
  <div class="hud-chip">SIM &nbsp;👥 <span id="hud-total">${FRIEND_COUNT + LOCAL_COUNT + TRANSIT_COUNT + WORLD_ICON_COUNT}</span></div>
  <div class="hud-chip">FPS <span id="hud-fps">60</span></div>
  <div class="hud-chip">LOD <span id="hud-lod">3</span></div>
  <div class="hud-chip">R <span id="hud-radius">900m</span></div>
  <div class="hud-chip">PHONE <span id="hud-quality">STRONG</span></div>
  <div class="hud-chip">⭐ <span id="hud-friends">${FRIEND_COUNT}</span> Freunde</div>
  <div class="hud-chip">🚋 <span id="hud-transit">${TRANSIT_COUNT}</span></div>
  <div class="hud-chip">🚶 <span id="hud-walking">0</span></div>
</div>

<!-- Simulation Controls -->
<div id="sim-controls">
  <button class="sim-btn on" id="btn-play" onclick="simTogglePlay()" title="Play/Pause">⏸</button>
  <div class="sim-sep"></div>
  <span class="sim-label">Speed</span>
  <button class="sim-btn" onclick="simChangeSpeed(-1)">−</button>
  <span class="sim-val" id="speed-val">1×</span>
  <button class="sim-btn" onclick="simChangeSpeed(1)">+</button>
  <div class="sim-sep"></div>
  <button class="sim-btn on" id="profile-strong" onclick="simSetProfile('strong')" title="Strong phone">S</button>
  <button class="sim-btn" id="profile-medium" onclick="simSetProfile('medium')" title="Medium phone">M</button>
  <button class="sim-btn" id="profile-weak" onclick="simSetProfile('weak')" title="Weak phone">W</button>
</div>

<script>
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
var SIM_LAT = ${lat};
var SIM_LNG = ${lng};
var LAT_PER_M = 1 / 111320;

var FRIEND_NAMES = [
  'Lena','Max','Anna','Felix','Sophie','Jonas','Marie','Lukas','Emma','Paul',
  'Laura','Tim','Mia','Jan','Julia','David','Hannah','Tobias','Lea','Niklas',
  'Lisa','Moritz','Clara','Simon','Sarah','Finn','Nina','Leon','Amelie','Noah'
];
var LOCAL_NAMES = [
  'Marco','Elena','Ivan','Yuki','Rania','Omar','Priya','Carlos','Aisha','Dmitri',
  'Selin','Mateus','Nadia','Tarek','Chiara','Kenji','Fatima','Arjun','Celine','Viktor',
  'Amira','Rafael','Lina','Kai','Zara','Mohammed','Ingrid','Sven','Mei','Thomas',
  'Özlem','Bashir','Isabel','Andre','Vera','Raj','Karin','Hamid','Petra','Alexei',
  'Zanele','Kofi','Maria','Hendrik','Yuna','Fabio','Astrid','Ibram','Nour','Giulia',
  'Bram','Sasha','Aya','Mihail','Bettina','Kwame','Ren','Ayasha','Freya','Stavros',
  'Nadège','Tobia','Rim','Seun','Hana','Matteo','Linh','Boris','Amara','Ezra'
];

// ─────────────────────────────────────────────────────────────────────────────
// COORDINATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function metersToLat(m) { return m * LAT_PER_M; }
function metersToLng(m, lat) { return m / (111320 * Math.cos(lat * Math.PI / 180)); }
function distM(lat1, lng1, lat2, lng2) {
  var dLat = (lat2 - lat1) * 111320;
  var dLng = (lng2 - lng1) * 111320 * Math.cos(lat1 * Math.PI / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
function seeded(s) { var x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function offsetPoint(northM, eastM) {
  return {
    lat: SIM_LAT + metersToLat(northM),
    lng: SIM_LNG + metersToLng(eastM, SIM_LAT),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GAME MAP PERFORMANCE + LOD
// ─────────────────────────────────────────────────────────────────────────────
var PERF = {
  fps: 60,
  frameMs: 16.7,
  quality: 'strong',
  lastFrame: performance.now(),
  lastQualityCheck: 0,
  visibleEntities: 0,
  totalRenderable: 0,
};

var QUALITY = {
  weak: {
    label: 'WEAK',
    tickMs: 50,
    maxVisible: 90,
    guaranteedPeopleRadiusM: 260,
    labelDistanceM: 150,
    lodRadiusM: 650,
    minZoom: 14.45,
  },
  medium: {
    label: 'MID',
    tickMs: 33,
    maxVisible: 190,
    guaranteedPeopleRadiusM: 460,
    labelDistanceM: 320,
    lodRadiusM: 1150,
    minZoom: 13.35,
  },
  strong: {
    label: 'STRONG',
    tickMs: 16,
    maxVisible: 520,
    guaranteedPeopleRadiusM: 920,
    labelDistanceM: 620,
    lodRadiusM: 2300,
    minZoom: 11.75,
  },
};

function setQuality(level) {
  if (!QUALITY[level]) return;
  if (PERF.quality === level && document.body.classList.contains('quality-' + level)) return;
  PERF.quality = level;
  var profile = QUALITY[level];
  document.body.classList.remove('quality-weak','quality-medium','quality-strong');
  document.body.classList.add('quality-' + level);
  var q = document.getElementById('hud-quality');
  if (q) q.textContent = profile.label;
  ['strong','medium','weak'].forEach(function(name) {
    var btn = document.getElementById('profile-' + name);
    if (btn) btn.classList.toggle('on', name === level);
  });
  var radius = document.getElementById('hud-radius');
  if (radius) radius.textContent = profile.lodRadiusM + 'm';
  updateLodRadiusOverlay();
  if (window.map) {
    map.setMinZoom(profile.minZoom);
    if (map.getZoom() < profile.minZoom) {
      map.easeTo({ zoom: profile.minZoom, duration: 260 });
    }
  }
}

function updatePerformanceSample() {
  var now = performance.now();
  var dt = Math.max(1, now - PERF.lastFrame);
  PERF.lastFrame = now;
  PERF.frameMs = PERF.frameMs * 0.88 + dt * 0.12;
  PERF.fps = PERF.fps * 0.88 + (1000 / dt) * 0.12;

  if (now - PERF.lastQualityCheck > 1400) {
    PERF.lastQualityCheck = now;
    if ((PERF.fps < 52 || PERF.frameMs > 19) && PERF.quality === 'strong') setQuality('medium');
    else if ((PERF.fps < 50 || PERF.frameMs > 21) && PERF.quality === 'medium') setQuality('weak');
    else if (PERF.fps > 58 && PERF.frameMs < 17 && PERF.quality === 'weak') setQuality('medium');
    else if (PERF.fps > 58 && PERF.frameMs < 17 && PERF.quality === 'medium') setQuality('strong');
  }

  var fps = document.getElementById('hud-fps');
  if (fps) fps.textContent = String(Math.round(PERF.fps));
}

function lodForDistance(distanceM, zoom) {
  var profile = QUALITY[PERF.quality];
  var normalized = distanceM / profile.lodRadiusM;
  var zoomBonus = zoom >= 15.2 ? 1 : zoom <= 12.2 ? -1 : 0;
  var base = normalized < 0.18 ? 4 : normalized < 0.38 ? 3 : normalized < 0.68 ? 2 : normalized <= 1 ? 1 : 0;
  return clamp(base + zoomBonus, 0, 4);
}

function applyLodClass(el, lod) {
  if (!el) return;
  el.classList.remove('sim-lod-0','sim-lod-1','sim-lod-2','sim-lod-3','sim-lod-4');
  el.classList.add('sim-lod-' + lod);
  el.dataset.lod = String(lod);
}

function updateLodForAll() {
  if (!window._simMarkers || !window._worldMarkers || !window._transitMarkers || !window.map) return;
  var center = map.getCenter();
  var zoom = map.getZoom();
  var profile = QUALITY[PERF.quality];
  updateLodRadiusOverlay();
  var visible = 0;
  var lodSum = 0;
  var lodCount = 0;
  var candidates = [];
  function addEntry(entry, lat, lng, minLod, priority, kind) {
    var d = distM(center.lat, center.lng, lat, lng);
    var lod = lodForDistance(d, zoom);
    if (kind === 'person' && d <= profile.guaranteedPeopleRadiusM) {
      lod = Math.max(lod, entry.agent && entry.agent.isFriend ? 3 : 2);
    }
    if (lod < minLod) lod = 0;
    candidates.push({ entry:entry, lod:lod, distance:d, priority:priority || 0, kind:kind || 'other' });
  }
  Object.keys(window._simMarkers).forEach(function(id) {
    var entry = window._simMarkers[id];
    if (!entry || !entry.agent) return;
    addEntry(entry, entry.agent.lat, entry.agent.lng, entry.agent.isFriend ? 1 : 2, entry.agent.isFriend ? 78 : 34, 'person');
  });
  Object.keys(window._transitMarkers).forEach(function(id) {
    var entry = window._transitMarkers[id];
    addEntry(entry, entry.entity.lat, entry.entity.lng, 1, entry.entity.priority || 86, 'transit');
  });
  Object.keys(window._worldMarkers).forEach(function(id) {
    var entry = window._worldMarkers[id];
    addEntry(entry, entry.entity.lat, entry.entity.lng, 2, entry.entity.priority || 50, 'poi');
  });

  candidates.sort(function(a, b) {
    var aGuaranteed = a.kind === 'person' && a.distance <= profile.guaranteedPeopleRadiusM;
    var bGuaranteed = b.kind === 'person' && b.distance <= profile.guaranteedPeopleRadiusM;
    if (aGuaranteed !== bGuaranteed) return aGuaranteed ? -1 : 1;
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.lod !== b.lod) return b.lod - a.lod;
    if (a.priority !== b.priority) return b.priority - a.priority;
    return 0;
  });

  candidates.forEach(function(item, index) {
    var lod = item.lod;
    if (index >= profile.maxVisible) lod = 0;
    applyLodClass(item.entry.wrap || item.entry.el, lod);
    if (lod > 0) visible++;
    lodSum += lod;
    lodCount++;
  });
  PERF.visibleEntities = visible;
  PERF.totalRenderable = candidates.length;
  var hudLod = document.getElementById('hud-lod');
  if (hudLod) hudLod.textContent = String(Math.round(lodSum / Math.max(1, lodCount)));
}

function metersPerPixelAtCenter() {
  if (!window.map) return 3;
  var center = map.getCenter();
  var zoom = map.getZoom();
  return 156543.03392 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
}

function updateLodRadiusOverlay() {
  var focus = document.getElementById('lod-focus');
  if (!focus || !window.map) return;
  var profile = QUALITY[PERF.quality];
  var radiusPx = clamp(profile.lodRadiusM / Math.max(0.2, metersPerPixelAtCenter()), 54, Math.max(window.innerWidth, window.innerHeight) * 0.82);
  focus.style.setProperty('--lod-radius-px', radiusPx.toFixed(0) + 'px');
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATION ENGINE
// Extensible via SIM.registerMechanic({ name, onTick, onAgentArrived, onAgentStateChange })
// ─────────────────────────────────────────────────────────────────────────────
var SIM = (function() {
  var mechanics = [];

  function registerMechanic(m) { mechanics.push(m); }

  function runMechanicHook(hook, args) {
    mechanics.forEach(function(m) { if (m[hook]) { try { m[hook].apply(null, args); } catch(_) {} } });
  }

  function buildAgents() {
    var agents = [];
    var fi = 0, li = 0;
    var friendAnchors = [
      { n:-120, e:-360 }, { n:180, e:-240 }, { n:330, e:80 }, { n:-280, e:210 },
      { n:60, e:390 }, { n:-430, e:-120 }, { n:430, e:-420 }, { n:-40, e:80 },
    ];
    var localAnchors = [
      { n:-180, e:-520 }, { n:260, e:-420 }, { n:520, e:-110 }, { n:420, e:360 },
      { n:40, e:620 }, { n:-360, e:470 }, { n:-660, e:120 }, { n:-520, e:-420 },
      { n:780, e:-520 }, { n:760, e:420 }, { n:-840, e:560 }, { n:-900, e:-220 },
    ];

    for (fi = 0; fi < ${FRIEND_COUNT}; fi++) {
      var anchor = friendAnchors[fi % friendAnchors.length];
      var ring = Math.floor(fi / friendAnchors.length);
      var angle = seeded(fi * 3.1) * Math.PI * 2;
      var dist  = 18 + seeded(fi * 7.7) * (76 + ring * 22);
      var p = offsetPoint(anchor.n + Math.sin(angle) * dist, anchor.e + Math.cos(angle) * dist);
      agents.push({
        id: 'sim-friend-' + fi,
        name: FRIEND_NAMES[fi],
        isFriend: true,
        lat: p.lat,
        lng: p.lng,
        maxRadius: 980,
        speed: 0.8 + seeded(fi * 5.5) * 0.9,
        state: 'idle',
        idleUntil: Date.now() + seeded(fi * 17) * 7000,
        targetLat: null, targetLng: null,
        heading: seeded(fi * 23) * 360,
        // extensibility data bag – mechanics can add arbitrary properties
        data: {},
      });
    }

    for (li = 0; li < ${LOCAL_COUNT}; li++) {
      var localAnchor = localAnchors[li % localAnchors.length];
      var localRing = Math.floor(li / localAnchors.length);
      var angle2 = seeded(li * 2.2 + 100) * Math.PI * 2;
      var dist2  = 24 + seeded(li * 9.1 + 200) * (110 + localRing * 28);
      var lp = offsetPoint(localAnchor.n + Math.sin(angle2) * dist2, localAnchor.e + Math.cos(angle2) * dist2);
      agents.push({
        id: 'sim-local-' + li,
        name: LOCAL_NAMES[li],
        isFriend: false,
        lat: lp.lat,
        lng: lp.lng,
        maxRadius: 1500,
        speed: 0.5 + seeded(li * 3.3 + 600) * 1.1,
        state: 'idle',
        idleUntil: Date.now() + seeded(li * 19 + 700) * 9000,
        targetLat: null, targetLng: null,
        heading: seeded(li * 29 + 800) * 360,
        data: {},
      });
    }
    return agents;
  }

  var agents = buildAgents();
  var playing = true;
  var cameraInteracting = false;
  var speedMult = 1;
  var lastTick = Date.now();

  function pickTarget(agent) {
    var angle = Math.random() * Math.PI * 2;
    var step  = 40 + Math.random() * 180;
    var nLat  = agent.lat + metersToLat(Math.sin(angle) * step);
    var nLng  = agent.lng + metersToLng(Math.cos(angle) * step, agent.lat);
    if (distM(SIM_LAT, SIM_LNG, nLat, nLng) > agent.maxRadius) {
      angle = Math.atan2(SIM_LNG - agent.lng, SIM_LAT - agent.lat) + (Math.random() - 0.5) * 1.2;
      step  = 60 + Math.random() * 120;
      nLat  = agent.lat + metersToLat(Math.sin(angle) * step);
      nLng  = agent.lng + metersToLng(Math.cos(angle) * step, agent.lat);
    }
    agent.targetLat = nLat;
    agent.targetLng = nLng;
    agent.heading   = Math.atan2(nLng - agent.lng, nLat - agent.lat) * 180 / Math.PI;
    var prevState   = agent.state;
    agent.state     = 'walk';
    if (prevState !== 'walk') runMechanicHook('onAgentStateChange', [agent, 'walk', prevState]);
  }

  function tick() {
    if (!playing) return;
    updatePerformanceSample();
    var now = Date.now();
    if (cameraInteracting) {
      lastTick = now;
      updateLodForAll();
      return;
    }
    var dt  = Math.min(now - lastTick, 200) * speedMult;
    lastTick = now;
    var walkCount = 0;

    runMechanicHook('onTick', [agents, dt]);
    updateTransit(dt);

    agents.forEach(function(agent) {
      if (agent.state === 'idle') {
        if (now >= agent.idleUntil) pickTarget(agent);
      } else {
        var dLat  = agent.targetLat - agent.lat;
        var dLng  = agent.targetLng - agent.lng;
        var d     = distM(agent.lat, agent.lng, agent.targetLat, agent.targetLng);
        var stepM = agent.speed * dt / 1000;
        if (d < stepM + 0.3) {
          agent.lat = agent.targetLat;
          agent.lng = agent.targetLng;
          var prev  = agent.state;
          agent.state    = 'idle';
          agent.idleUntil = now + 2000 + Math.random() * 9000;
          runMechanicHook('onAgentArrived', [agent]);
          if (prev !== 'idle') runMechanicHook('onAgentStateChange', [agent, 'idle', prev]);
        } else {
          var ratio = stepM / d;
          agent.lat += dLat * ratio;
          agent.lng += dLng * ratio;
          walkCount++;
        }
      }
    });

    // Update marker positions + figure states
    agents.forEach(function(agent) {
      var entry = window._simMarkers && window._simMarkers[agent.id];
      if (!entry) return;
      entry.marker.setLngLat([agent.lng, agent.lat]);
      entry.agent = agent;
      if (entry.fig) {
        // speed derived from state (idle=0, walk=1.0, run=3.0)
        var spd = agent.state === 'walk' ? agent.speed : agent.state === 'run' ? 3.0 : 0;
        setFigureState(entry.fig, spd, agent.heading);
        applyFigureScale(entry.fig, agent.lat, agent.lng);
      }
    });

    document.getElementById('hud-walking').textContent = String(walkCount);
    updateLodForAll();
  }

  return {
    agents: agents,
    registerMechanic: registerMechanic,
    setPlaying: function(v) { playing = v; if (v) lastTick = Date.now(); },
    isPlaying: function() { return playing; },
    setCameraInteracting: function(v) { cameraInteracting = v; if (!v) lastTick = Date.now(); },
    setSpeed: function(v) { speedMult = v; },
    tick: tick,
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// TRANSIT + WORLD ENTITIES
// ─────────────────────────────────────────────────────────────────────────────
function buildTransitEntities() {
  var routeDefs = [
    { id:'tram-1', type:'tram', label:'1', speed:14, count:5, points:[[-1200,2100],[-680,1220],[-260,420],[0,0],[420,-520],[780,-980],[980,-1450]] },
    { id:'tram-2', type:'tram', label:'2', speed:15, count:5, points:[[1860,-1800],[1180,-1060],[420,-340],[0,0],[-520,380],[-1060,820],[-1580,1180]] },
    { id:'tram-3', type:'tram', label:'3', speed:15, count:5, points:[[230,180],[-120,-120],[-760,-760],[-1400,-1460],[-2160,-2140],[-2860,-2750]] },
    { id:'tram-4', type:'tram', label:'4', speed:13, count:4, points:[[1160,620],[620,320],[0,0],[-450,-260],[-980,-500],[-1480,-720],[-1960,-860]] },
    { id:'tram-6', type:'tram', label:'6', speed:15, count:5, points:[[1450,2300],[860,1460],[320,620],[0,0],[-460,-620],[-920,-1260],[-1400,-2020],[-1840,-2760]] },
    { id:'bus-21', type:'bus', label:'21', speed:11, count:3, points:[[1680,-1180],[1120,-620],[520,-160],[0,0],[-540,120],[-1040,420]] },
    { id:'bus-22', type:'bus', label:'22', speed:11, count:3, points:[[1200,1600],[720,920],[180,280],[0,0],[-380,-620],[-760,-1240]] },
    { id:'bus-23', type:'bus', label:'23', speed:10, count:3, points:[[2300,80],[1500,80],[760,60],[0,0],[-780,-80],[-1500,-160]] },
    { id:'bus-24', type:'bus', label:'24', speed:10, count:3, points:[[720,-2180],[520,-1320],[260,-580],[0,0],[-220,720],[-360,1420]] },
    { id:'bus-25', type:'bus', label:'25', speed:11, count:3, points:[[-1820,1320],[-980,820],[-420,360],[0,0],[680,-300],[1320,-640]] },
    { id:'bus-26', type:'bus', label:'26', speed:10, count:3, points:[[1850,1260],[980,760],[410,320],[0,0],[-560,-420],[-1080,-960]] },
    { id:'bus-32', type:'bus', label:'32', speed:11, count:3, points:[[-2200,-420],[-1240,-250],[-560,-110],[0,0],[620,240],[1320,520],[2040,820]] },
    { id:'bus-35', type:'bus', label:'35', speed:10, count:3, points:[[2460,-900],[1620,-540],[780,-260],[0,0],[-520,540],[-840,1280]] },
    { id:'bus-41', type:'bus', label:'41', speed:10, count:3, points:[[-2600,540],[-1640,360],[-820,160],[0,0],[420,-720],[840,-1540]] },
    { id:'bus-43', type:'bus', label:'43', speed:10, count:2, points:[[2400,1680],[1500,980],[660,420],[0,0],[-740,-520],[-1480,-1100]] },
  ];

  var vehicles = [];
  routeDefs.forEach(function(route) {
    var points = route.points.map(function(p) { return offsetPoint(p[0], p[1]); });
    var length = routeLengthM(points);
    for (var i = 0; i < route.count; i++) {
      var progress = (i / route.count + seeded(route.label.charCodeAt(0) + i * 17) * 0.08) % 1;
      var sampled = pointOnRoute(points, progress);
      vehicles.push({
        id:route.id + '-' + (i + 1),
        type:route.type,
        label:route.label,
        routeId:route.id,
        routePoints:points,
        routeLengthM:length,
        progress:progress,
        direction:i % 2 === 0 ? 1 : -1,
        speedMps:route.speed * (0.82 + seeded(i + length) * 0.36),
        lat:sampled.lat,
        lng:sampled.lng,
        heading:sampled.heading,
        priority:route.type === 'tram' ? 92 : 82,
      });
    }
  });

  return vehicles.slice(0, ${TRANSIT_COUNT});
}

function routeLengthM(points) {
  var length = 0;
  for (var i = 1; i < points.length; i++) {
    length += distM(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return Math.max(1, length);
}

function pointOnRoute(points, progress) {
  var routeLength = routeLengthM(points);
  var target = ((progress % 1) + 1) % 1 * routeLength;
  var travelled = 0;
  for (var i = 1; i < points.length; i++) {
    var from = points[i - 1];
    var to = points[i];
    var seg = distM(from.lat, from.lng, to.lat, to.lng);
    if (travelled + seg >= target) {
      var t = (target - travelled) / Math.max(1, seg);
      return {
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
        heading: Math.atan2(to.lng - from.lng, to.lat - from.lat) * 180 / Math.PI,
      };
    }
    travelled += seg;
  }
  var last = points[points.length - 1];
  var prev = points[points.length - 2] || last;
  return {
    lat:last.lat,
    lng:last.lng,
    heading:Math.atan2(last.lng - prev.lng, last.lat - prev.lat) * 180 / Math.PI,
  };
}

function buildWorldEntities() {
  var labels = [
    ['shop','Market','M',-120,-440], ['shop','Cafe','C',60,-260], ['event','Live','!',250,-180],
    ['shop','Kiosk','K',-360,120], ['shop','Bakery','B',180,340], ['event','Meet','+',-520,-180],
    ['shop','Book','R',430,120], ['event','Music','~',-120,560], ['shop','Food','F',620,-420],
    ['shop','Style','S',-760,420], ['event','Pulse','*',860,260], ['shop','Night','N',-980,-360],
    ['event','Open','O',340,760], ['shop','Bike','V',-280,-760],
  ];
  return labels.map(function(item, index) {
    return {
      id:item[0] + '-' + index,
      type:item[0],
      label:item[1],
      icon:item[2],
      lat:SIM_LAT + metersToLat(item[3]),
      lng:SIM_LNG + metersToLng(item[4], SIM_LAT),
      priority:item[0] === 'event' ? 74 : 58,
    };
  });
}

var TRANSIT = buildTransitEntities();
var WORLD_ENTITIES = buildWorldEntities();

function transitEl(entity) {
  var wrap = document.createElement('div');
  wrap.className = 'transit-wrap ' + entity.type;
  wrap.style.zIndex = '900';
  wrap.style.width = '54px';
  wrap.style.height = '54px';
  wrap.style.display = 'flex';
  wrap.style.alignItems = 'center';
  wrap.style.justifyContent = 'center';
  var core = document.createElement('div');
  core.className = 'transit-core';
  core.style.minWidth = '42px';
  core.style.height = '30px';
  core.style.padding = '0 7px';
  core.style.borderRadius = '8px';
  core.style.border = '2px solid rgba(255,255,255,0.98)';
  core.style.display = 'flex';
  core.style.alignItems = 'center';
  core.style.justifyContent = 'center';
  core.style.fontSize = '13px';
  core.style.fontWeight = '1000';
  core.style.color = entity.type === 'tram' ? '#02070d' : '#ffffff';
  core.style.background = entity.type === 'tram' ? '#efff3a' : '#ff2bd6';
  core.style.boxShadow = entity.type === 'tram'
    ? '0 0 18px rgba(239,255,58,0.88),0 0 30px rgba(0,240,255,0.24)'
    : '0 0 16px rgba(255,43,214,0.76),0 0 30px rgba(0,240,255,0.26)';
  core.style.transformOrigin = '50% 50%';
  core.textContent = (entity.type === 'tram' ? 'T' : 'B') + entity.label;
  wrap.appendChild(core);
  return wrap;
}

function transitScreenEl(entity) {
  var wrap = document.createElement('div');
  wrap.className = 'transit-screen ' + entity.type;
  var core = document.createElement('div');
  core.className = 'transit-screen-core';
  core.textContent = (entity.type === 'tram' ? 'T' : 'B') + entity.label;
  wrap.appendChild(core);
  return { wrap: wrap, core: core };
}

function updateTransitScreenPositions() {
  if (!window.map || !window._transitMarkers) return;
  Object.keys(window._transitMarkers).forEach(function(id) {
    var entry = window._transitMarkers[id];
    if (!entry || !entry.entity || !entry.screen) return;
    var point = map.project([entry.entity.lng, entry.entity.lat]);
    var visible = entry.screen.dataset.lod !== '0';
    entry.screen.style.opacity = visible ? '1' : '0';
    entry.screen.style.transform = visible
      ? 'translate(' + (point.x - 27).toFixed(1) + 'px,' + (point.y - 27).toFixed(1) + 'px)'
      : 'translate(-9999px,-9999px)';
    if (entry.core) entry.core.style.setProperty('--heading', entry.entity.heading.toFixed(1) + 'deg');
  });
}

function worldEntityEl(entity) {
  var wrap = document.createElement('div');
  wrap.className = 'entity-marker ' + entity.type;
  var icon = document.createElement('div');
  icon.className = 'sim-float-icon';
  icon.textContent = entity.icon;
  var label = document.createElement('div');
  label.className = 'entity-label';
  label.textContent = entity.label;
  wrap.appendChild(icon);
  wrap.appendChild(label);
  return wrap;
}

function updateTransit(dt) {
  TRANSIT.forEach(function(entity) {
    var prevLat = entity.lat;
    var prevLng = entity.lng;
    entity.progress += entity.direction * (entity.speedMps * dt / 1000) / entity.routeLengthM;
    if (entity.progress > 1) entity.progress -= 1;
    if (entity.progress < 0) entity.progress += 1;
    var sampled = pointOnRoute(entity.routePoints, entity.progress);
    entity.lat = sampled.lat;
    entity.lng = sampled.lng;
    entity.heading = entity.direction > 0
      ? sampled.heading
      : sampled.heading + 180;
    if (Math.abs(entity.lat - prevLat) < 0.0000001 && Math.abs(entity.lng - prevLng) < 0.0000001) {
      entity.heading = sampled.heading;
    }
  });
  updateTransitScreenPositions();
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP SETUP (exact copy from real map)
// ─────────────────────────────────────────────────────────────────────────────
var radarSizing = { lat: SIM_LAT, lng: SIM_LNG, radiusM: 500, enabled: true };

function distanceMetersBetween(lat1, lng1, lat2, lng2) {
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLng = (lng2 - lng1) * toRad;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2) +
    Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLng/2)*Math.sin(dLng/2);
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function proximityScaleFor(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return 1;
  var distance = distanceMetersBetween(radarSizing.lat, radarSizing.lng, lat, lng);
  if (distance <= radarSizing.radiusM)     return 1.34;
  if (distance <= radarSizing.radiusM * 2) return 1;
  return 0.72;
}

function applyFigureScale(figure, lat, lng) {
  if (!figure) return;
  figure.style.setProperty('--symbol-scale', String(proximityScaleFor(lat, lng).toFixed(2)));
}

function markerEl(size, background, border, shadow, innerHtml) {
  var el = document.createElement('div');
  el.style.cssText = [
    'width:'+size+'px','height:'+size+'px',
    'border-radius:'+(size<=16?'var(--small-marker-radius)':'var(--marker-radius)'),
    'background:'+background,'border:'+border,'box-shadow:'+shadow,
    'display:flex','align-items:center','justify-content:center'
  ].join(';');
  if (innerHtml) el.innerHTML = innerHtml;
  return el;
}

function figureEl(isMe) {
  var wrap = document.createElement('div');
  wrap.className = 'fig-wrap';
  var fig  = document.createElement('div');
  fig.className = isMe ? 'fig fig-me' : 'fig';
  fig.dataset.state = 'idle';
  var glow  = document.createElement('div'); glow.className = 'fig-glow';
  var head  = document.createElement('div'); head.className = 'fig-head';
  var body  = document.createElement('div'); body.className = 'fig-body';
  var legs  = document.createElement('div'); legs.className = 'fig-legs';
  var legL  = document.createElement('div'); legL.className = 'fig-leg';
  var legR  = document.createElement('div'); legR.className = 'fig-leg';
  legs.appendChild(legL); legs.appendChild(legR);
  fig.appendChild(glow); fig.appendChild(head); fig.appendChild(body); fig.appendChild(legs);
  wrap.appendChild(fig);
  return { wrap: wrap, fig: fig };
}

function setFigureState(figEl, speed, heading) {
  var state = (!speed || speed < 0.4) ? 'idle' : speed < 2.5 ? 'walk' : 'run';
  if (figEl.dataset.state !== state) figEl.dataset.state = state;
  if (heading != null && !isNaN(heading)) {
    // Only flip horizontally — figures stay upright, mirror left/right based on direction
    // heading < 0 means westward (left on screen), heading >= 0 means eastward (right)
    var dir = heading < 0 ? -1 : 1;
    figEl.style.setProperty('--face-dir', String(dir));
  }
}

function infoSheetHtml(name, subtitle) {
  return '<div style="min-width:160px;display:flex;align-items:center;gap:10px">'
    + '<div><div class="info-sheet-title">' + name + '</div>'
    + '<div class="info-sheet-activity">' + subtitle + '</div></div></div>';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP INIT
// ─────────────────────────────────────────────────────────────────────────────
var map = new maplibregl.Map({
  container: 'map',
  style: {
    version: 8,
    sprite: 'https://tiles.openfreemap.org/sprites/ofm_f384/ofm',
    glyphs:  'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      osm: { type:'raster', tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize:256, attribution:'© OpenStreetMap' },
      openmaptiles: { type:'vector', url:'https://tiles.openfreemap.org/planet' }
    },
    layers: [{ id:'osm-raster', type:'raster', source:'osm' }]
  },
  center: [SIM_LNG, SIM_LAT],
  zoom: 14,
  pitch: 0,
  fadeDuration: 0,
  attributionControl: false,
});
window.map = map;
setQuality('strong');
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
map.touchPitch.enable();
  map.doubleClickZoom.disable();

document.getElementById('recenter').addEventListener('click', function(e) {
  e.preventDefault(); e.stopPropagation();
  map.easeTo({ center:[SIM_LNG, SIM_LAT], zoom:Math.max(map.getZoom(),14), duration:420 });
});
map.on('click', function() {
  document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p) { p.classList.remove('visible'); });
  document.querySelectorAll('.friend-marker-wrap.popup-open').forEach(function(w) {
    w.classList.remove('popup-open'); w.style.zIndex = '2';
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CREATE MARKERS (identical visual logic to real map)
// ─────────────────────────────────────────────────────────────────────────────
map.on('load', function() {
  window._simMarkers = {};
  window._transitMarkers = {};
  window._worldMarkers = {};

  // "Me" marker
  var meFr = figureEl(true);
  meFr.fig.style.setProperty('--symbol-scale','1');
  new maplibregl.Marker({ element: meFr.wrap, anchor:'center' })
    .setLngLat([SIM_LNG, SIM_LAT])
    .setPopup(new maplibregl.Popup({ closeButton:false, offset:14 }).setHTML(infoSheetHtml('Du','Simulation')))
    .addTo(map);

  SIM.agents.forEach(function(agent, idx) {
    if (agent.isFriend) {
      // ── Friend: fig-wrap + name tag (identical to real map) ──────
      var fr = figureEl(false);
      fr.wrap.className += ' friend-marker-wrap';
      var lbl = document.createElement('div');
      lbl.className = 'friend-name-tag';
      lbl.textContent = agent.name;
      fr.wrap.insertBefore(lbl, fr.wrap.firstChild);
      fr.wrap.style.zIndex = '2';
      fr.wrap.style.animationDelay = (idx * 0.048) + 's';
      fr.wrap.classList.add('fig-entering');
      setTimeout(function(w){ w.classList.remove('fig-entering'); w.style.animationDelay=''; }.bind(null, fr.wrap), 620);
      applyFigureScale(fr.fig, agent.lat, agent.lng);
      fr.fig.dataset.state = 'idle';

      // inline popup
      var popup = document.createElement('div');
      popup.className = 'fig-popup-inner';
      var pn = document.createElement('span'); pn.className='fig-popup-name'; pn.textContent=agent.name;
      var ps = document.createElement('span'); ps.className='fig-popup-sub';  ps.textContent='Freund · Simulation';
      popup.appendChild(pn); popup.appendChild(ps);
      fr.wrap.appendChild(popup);
      popup.addEventListener('click', function(e) { e.stopPropagation(); });

      var activate = function(e) {
        if (e.cancelable) e.preventDefault(); e.stopPropagation();
        var now = Date.now();
        if (fr.wrap.__lastActivate && now - fr.wrap.__lastActivate < 320) return;
        fr.wrap.__lastActivate = now;
        var visible = popup.classList.contains('visible');
        document.querySelectorAll('.friend-marker-wrap.popup-open').forEach(function(w){ w.classList.remove('popup-open'); w.style.zIndex='2'; });
        document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p){ p.classList.remove('visible'); });
        if (!visible) { fr.wrap.classList.add('popup-open'); fr.wrap.style.zIndex='10000'; popup.classList.add('visible'); }
      };
      [lbl, fr.fig].forEach(function(t) {
        t.addEventListener('touchend', activate, { passive:false });
        t.addEventListener('click', activate);
      });

      var marker = new maplibregl.Marker({ element:fr.wrap, anchor:'center' })
        .setLngLat([agent.lng, agent.lat]).addTo(map);
      window._simMarkers[agent.id] = { marker:marker, fig:fr.fig, wrap:fr.wrap, agent:agent };

    } else {
      // ── Local: small circle (identical to real map) ───────────────
      var neonGreen = '#00ffb2';
      var el = markerEl(13, neonGreen, '1px solid rgba(234,251,255,0.9)', '0 0 10px rgba(0,255,178,0.38)');
      var delay = (idx * 0.025) + 's';
      el.style.animationDelay = delay;
      var localMarker = new maplibregl.Marker({ element:el, anchor:'center' })
        .setLngLat([agent.lng, agent.lat])
        .setPopup(new maplibregl.Popup({ closeButton:false, offset:10 }).setHTML(infoSheetHtml(agent.name, 'Local · Simulation')))
        .addTo(map);
      window._simMarkers[agent.id] = { marker:localMarker, fig:null, el:el, agent:agent };
    }
  });

  TRANSIT.forEach(function(entity) {
    var screen = transitScreenEl(entity);
    document.getElementById('transit-layer').appendChild(screen.wrap);
    window._transitMarkers[entity.id] = { wrap:screen.wrap, screen:screen.wrap, core:screen.core, entity:entity };
  });
  updateTransitScreenPositions();

  WORLD_ENTITIES.forEach(function(entity, idx) {
    var el = worldEntityEl(entity);
    el.style.animationDelay = (idx * 0.08) + 's';
    var marker = new maplibregl.Marker({ element:el, anchor:'bottom' })
      .setLngLat([entity.lng, entity.lat])
      .setPopup(new maplibregl.Popup({ closeButton:false, offset:16 }).setHTML(infoSheetHtml(entity.label, (entity.type === 'event' ? 'Event' : 'Ort') + ' · Simulation')))
      .addTo(map);
    window._worldMarkers[entity.id] = { marker:marker, wrap:el, entity:entity };
  });

  map.on('move', function() { updateTransitScreenPositions(); updateLodForAll(); });
  map.on('zoom', function() { updateTransitScreenPositions(); updateLodForAll(); });
  map.on('resize', function() { updateTransitScreenPositions(); updateLodForAll(); });
  map.on('dragstart', function() { SIM.setCameraInteracting(true); });
  map.on('movestart', function() { SIM.setCameraInteracting(true); });
  map.on('dragend', function() { SIM.setCameraInteracting(false); });
  map.on('moveend', function() { SIM.setCameraInteracting(false); updateLodForAll(); });
  updateLodForAll();

  // Start adaptive simulation tick. Rendering stays map-native; simulation work is budgeted by quality.
  var lastSimFrame = performance.now();
  function simFrame(now) {
    var profile = QUALITY[PERF.quality];
    if (now - lastSimFrame >= profile.tickMs) {
      lastSimFrame = now;
      SIM.tick();
    } else {
      updatePerformanceSample();
    }
    requestAnimationFrame(simFrame);
  }
  requestAnimationFrame(simFrame);
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTROLS
// ─────────────────────────────────────────────────────────────────────────────
function simTogglePlay() {
  var p = !SIM.isPlaying();
  SIM.setPlaying(p);
  var btn = document.getElementById('btn-play');
  btn.textContent = p ? '⏸' : '▶';
  btn.classList.toggle('on', p);
}

var SPEED_STEPS = [0.25, 0.5, 1, 2, 4, 8];
var speedIdx = 2;
function simChangeSpeed(d) {
  speedIdx = Math.max(0, Math.min(SPEED_STEPS.length - 1, speedIdx + d));
  SIM.setSpeed(SPEED_STEPS[speedIdx]);
  document.getElementById('speed-val').textContent = SPEED_STEPS[speedIdx] + '×';
}

function simSetProfile(profile) {
  setQuality(profile);
  updateLodForAll();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXAMPLE: how to register a new mechanic (burst on arrival)
// Uncomment to activate — shows how the mechanic system works:
//
// SIM.registerMechanic({
//   name: 'burst-on-arrival',
//   onAgentArrived: function(agent) {
//     var entry = window._simMarkers && window._simMarkers[agent.id];
//     if (!entry || !entry.fig) return;
//     var ring = document.createElement('div');
//     ring.className = 'burst-ring';
//     entry.fig.appendChild(ring);
//     setTimeout(function() { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 700);
//   }
// });
// ─────────────────────────────────────────────────────────────────────────────
</script>
</body>
</html>`;
}

export default function SimulationLabScreen() {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef(null);
  const html = buildSimHtml(SIM_LAT, SIM_LNG);

  return (
    <View
      style={[
        styles.container,
        { paddingTop: Platform.OS === "ios" ? insets.top : (StatusBar.currentHeight ?? 0) },
      ]}
    >
      <WebView
        key={SIM_ENGINE_VERSION}
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
        allowsInlineMediaPlayback
        mixedContentMode="always"
        cacheEnabled={false}
        onError={(e) => console.warn("SimLab error:", e.nativeEvent)}
      />
      <View pointerEvents="none" style={[styles.engineBadge, { top: (Platform.OS === "ios" ? insets.top : (StatusBar.currentHeight ?? 0)) + 10 }]}>
        <Text style={styles.engineBadgeTitle}>{SIM_ENGINE_VERSION}</Text>
        <Text style={styles.engineBadgeText}>FPS · LOD · Transit · Live World Lab</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07131f" },
  webview:   { flex: 1, backgroundColor: "#07131f" },
  engineBadge: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.light.tintBlue,
    backgroundColor: "rgba(7,19,31,0.92)",
    paddingHorizontal: 12,
    paddingVertical: 9,
    shadowColor: Colors.light.tintBlue,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
  },
  engineBadgeTitle: {
    color: Colors.light.yellow,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
  },
  engineBadgeText: {
    color: Colors.light.tintBlue,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
});
