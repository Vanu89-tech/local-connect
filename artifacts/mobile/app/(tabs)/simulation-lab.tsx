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
const WORLD_ICON_COUNT = 14;
const SIM_CENTER_RADIUS_M = 500;
const SIM_ENGINE_VERSION = "Sim Engine V10";

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
  #friend-layer {
    position:fixed; inset:0; z-index:560; pointer-events:none; overflow:hidden;
  }
  #sim-me-focus {
    position:fixed; left:50%; top:50%; z-index:570; pointer-events:none;
    transform:translate(-50%,-50%);
  }
  #sim-me-focus .fig { --symbol-scale:1; }
  #sim-diagnostics {
    position:fixed; left:14px; right:14px; bottom:206px; z-index:610;
    max-height:52px; overflow:hidden; pointer-events:none;
    background:rgba(7,19,31,0.88); border:1px solid rgba(239,255,58,0.36);
    border-radius:10px; padding:7px 9px;
    color:#eafbff; font:800 8px/1.25 "Avenir Next",sans-serif;
  }
  #sim-diagnostics .bad { color:#ff5bd8; }
  #sim-diagnostics .good { color:#efff3a; }
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
  .sim-culled { opacity:0 !important; pointer-events:none !important; }
  .friend-out-of-radius { opacity:0 !important; pointer-events:none !important; }
  body.quality-weak .sim-float-icon { animation:none !important; }
  .entity-marker.closed { filter:saturate(0.35) brightness(0.72); opacity:0.62; }
  .entity-marker.busy .sim-float-icon,
  .entity-marker.happy-hour .sim-float-icon,
  .entity-marker.event-live .sim-float-icon { animation:floatIcon 1.25s ease-in-out infinite; }
  .entity-marker.happy-hour .entity-label,
  .entity-marker.event-live .entity-label { color:#efff3a; text-shadow:0 0 8px rgba(239,255,58,0.8); }
  .friend-marker-wrap.status-social .fig-head,
  .friend-marker-wrap.status-party .fig-head { background:#ff2bd6; box-shadow:0 0 8px rgba(255,43,214,0.95),0 0 18px rgba(255,43,214,0.55); }
  .friend-marker-wrap.status-food .fig-head { background:#00ffb2; box-shadow:0 0 8px rgba(0,255,178,0.95),0 0 18px rgba(0,255,178,0.55); }
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
    position:absolute; left:0; top:0; will-change:transform,opacity;
  }
  .friend-marker-wrap .fig { pointer-events:auto; }
  /* ── Game world entities ───────────────────────────────────────── */
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
    position:fixed; top:124px; left:50%; transform:translateX(-50%);
    display:flex; gap:6px; z-index:600; pointer-events:none; flex-wrap:nowrap;
    max-width:calc(100vw - 28px); overflow:hidden;
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
    position:fixed; bottom:118px; left:50%; transform:translateX(-50%);
    display:flex; align-items:center; justify-content:center; gap:7px; flex-wrap:wrap;
    width:calc(100vw - 28px); max-width:720px;
    background:rgba(7,19,31,0.9); border:1px solid rgba(0,240,255,0.28);
    border-radius:18px; padding:8px 12px; z-index:600;
    backdrop-filter:blur(12px);
  }
  .sim-btn {
    width:34px; height:34px; border-radius:50%;
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
  .sim-val.radius { min-width:42px; }
  .sim-btn.wide { width:auto; min-width:48px; border-radius:17px; padding:0 9px; font-weight:900; font-size:10px; }
  body.scenario-night #parchment-overlay,
  body.scenario-event #parchment-overlay { opacity:1; }
  body.scenario-day #parchment-overlay { opacity:0.62; }
</style>
</head>
<body>
<div id="map"></div>
<div id="friend-layer"></div>
<div id="sim-me-focus" aria-hidden="true"></div>
<div id="parchment-overlay"></div>
<div id="vignette"></div>
<div id="lod-focus" aria-hidden="true"></div>
<div id="sim-diagnostics" aria-hidden="true"></div>
<button id="recenter" aria-label="Zentrieren" type="button">⌖</button>

<!-- Simulation HUD -->
<div id="sim-hud">
  <div class="hud-chip">SIM &nbsp;👥 <span id="hud-total">${FRIEND_COUNT + LOCAL_COUNT + WORLD_ICON_COUNT}</span></div>
  <div class="hud-chip">FPS <span id="hud-fps">60</span></div>
  <div class="hud-chip">LOD <span id="hud-lod">3</span></div>
  <div class="hud-chip">R <span id="hud-radius">${SIM_CENTER_RADIUS_M}m</span></div>
  <div class="hud-chip">PHONE <span id="hud-quality">STRONG</span></div>
  <div class="hud-chip">SCN <span id="hud-scenario">DAY</span></div>
  <div class="hud-chip">TIME <span id="hud-clock">14:00</span></div>
  <div class="hud-chip">⭐ <span id="hud-friends">${FRIEND_COUNT}</span> Freunde</div>
  <div class="hud-chip">🏪 <span id="hud-places">${WORLD_ICON_COUNT}</span></div>
  <div class="hud-chip">🚶 <span id="hud-walking">0</span></div>
  <div class="hud-chip">EVT <span id="hud-events">0</span></div>
  <div class="hud-chip">MS <span id="hud-tickms">0</span></div>
  <div class="hud-chip">DBG <span id="hud-friend-debug">-</span></div>
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
  <div class="sim-sep"></div>
  <button class="sim-btn wide on" id="scenario-day" onclick="simSetScenario('day')" title="Normaler Tag">DAY</button>
  <button class="sim-btn wide" id="scenario-rush" onclick="simSetScenario('rush')" title="Feierabendverkehr">RUSH</button>
  <button class="sim-btn wide" id="scenario-night" onclick="simSetScenario('night')" title="Bars und Clubs">NITE</button>
  <button class="sim-btn wide" id="scenario-event" onclick="simSetScenario('event')" title="Grossevent">EVT</button>
  <button class="sim-btn wide" id="scenario-stress" onclick="simSetScenario('stress')" title="Stress Test">LOAD</button>
  <div class="sim-sep"></div>
  <span class="sim-label">Radius</span>
  <button class="sim-btn" onclick="simChangeRadius(-1)" title="Radius kleiner">−</button>
  <span class="sim-val radius" id="radius-val">${SIM_CENTER_RADIUS_M}m</span>
  <button class="sim-btn" onclick="simChangeRadius(1)" title="Radius groesser">+</button>
</div>

<script>
// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
var SIM_LAT = ${lat};
var SIM_LNG = ${lng};
var LAT_PER_M = 1 / 111320;

var FRIEND_NAMES = [
  'Mara','Ben','Nora','Elias','Kira','Theo','Livia','Oskar','Mila','Henri',
  'Jule','Anton','Romy','Luis','Ida','Noel','Fina','Levi','Tara','Mats',
  'Alva','Emil','Nele','Pepe','Lio','Frieda','Joris','Malou','Enno','Lene'
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
var USER_ACTIVITIES = [
  { id:'idle', label:'gerade online', status:'online', weight:20 },
  { id:'walk', label:'unterwegs', status:'moving', weight:20 },
  { id:'food', label:'essen', status:'food', weight:12 },
  { id:'social', label:'trifft Leute', status:'social', weight:14 },
  { id:'party', label:'im Nachtleben', status:'party', weight:8 },
  { id:'quiet', label:'nicht stören', status:'quiet', weight:6 },
];
var SCENARIOS = {
  day:    { label:'DAY',   timeHour:14, userSpeed:1.0,  crowd:0.42, eventRate:0.32, loadBudget:1.0 },
  rush:   { label:'RUSH',  timeHour:17, userSpeed:1.12, crowd:0.62, eventRate:0.46, loadBudget:1.12 },
  night:  { label:'NITE',  timeHour:22, userSpeed:0.92, crowd:0.78, eventRate:0.72, loadBudget:1.0 },
  event:  { label:'EVT',   timeHour:20, userSpeed:1.04, crowd:0.88, eventRate:0.9,  loadBudget:1.18 },
  stress: { label:'LOAD',  timeHour:19, userSpeed:1.18, crowd:0.95, eventRate:1.0,  loadBudget:1.7 },
};
var SIM_STATE = {
  scenario:'day',
  simMinute:14 * 60,
  tickMs:0,
  adapterMs:0,
  eventCount:0,
  lastSnapshotAt:0,
  loadFactor:1,
};

function currentScenario() { return SCENARIOS[SIM_STATE.scenario] || SCENARIOS.day; }
function weightedActivity(seedValue) {
  var total = USER_ACTIVITIES.reduce(function(sum, a) { return sum + a.weight; }, 0);
  var roll = seeded(seedValue) * total;
  for (var i = 0; i < USER_ACTIVITIES.length; i++) {
    roll -= USER_ACTIVITIES[i].weight;
    if (roll <= 0) return USER_ACTIVITIES[i];
  }
  return USER_ACTIVITIES[0];
}
function simClockLabel() {
  var minutes = Math.floor(SIM_STATE.simMinute % (24 * 60));
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

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

var SIM_RADIUS_STEPS = [50, 100, 200, 500, 1000];
var simRadiusIdx = Math.max(0, SIM_RADIUS_STEPS.indexOf(${SIM_CENTER_RADIUS_M}));
var simRadiusM = SIM_RADIUS_STEPS[simRadiusIdx];

var QUALITY = {
  weak: {
    label: 'WEAK',
    tickMs: 50,
    budget: 150,
    typeRadius: { friend: 1.0, person: 1.0, poi: 1.0 },
    typeCost:   { friend: 2,   person: 3,   poi: 2   },
    labelDistanceM: simRadiusM,
    lodRadiusM: simRadiusM,
    minZoom: 11.75,
  },
  medium: {
    label: 'MID',
    tickMs: 33,
    budget: 350,
    typeRadius: { friend: 1.0, person: 1.0, poi: 1.0 },
    typeCost:   { friend: 2,   person: 3,   poi: 2   },
    labelDistanceM: simRadiusM,
    lodRadiusM: simRadiusM,
    minZoom: 11.75,
  },
  strong: {
    label: 'STRONG',
    tickMs: 16,
    budget: 800,
    typeRadius: { friend: 1.0, person: 1.0, poi: 1.0 },
    typeCost:   { friend: 2,   person: 3,   poi: 2   },
    labelDistanceM: simRadiusM,
    lodRadiusM: simRadiusM,
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
  if (radius) radius.textContent = formatRadiusLabel(simRadiusM);
  updateLodRadiusOverlay();
  if (window.map) {
    map.setMinZoom(profile.minZoom);
    if (map.getZoom() < profile.minZoom) {
      map.easeTo({ zoom: profile.minZoom, duration: 260 });
    }
  }
}

function formatRadiusLabel(radiusM) {
  return radiusM >= 1000 ? (radiusM / 1000) + 'km' : radiusM + 'm';
}

function getSimFocusPoint() {
  if (window.map) {
    var center = map.getCenter();
    return { lat: center.lat, lng: center.lng };
  }
  return { lat: SIM_LAT, lng: SIM_LNG };
}

function syncRadiusFocus() {
  var focus = getSimFocusPoint();
  radarSizing.lat = focus.lat;
  radarSizing.lng = focus.lng;
  radarSizing.radiusM = simRadiusM;
}

function rescaleRadiusAwareMarkers() {
  if (!window._simMarkers) return;
  Object.keys(window._simMarkers).forEach(function(id) {
    var entry = window._simMarkers[id];
    if (!entry || !entry.agent) return;
    if (entry.fig) applyFigureScale(entry.fig, entry.agent.lat, entry.agent.lng);
  });
}

function setSimRadius(radiusM) {
  simRadiusM = radiusM;
  Object.keys(QUALITY).forEach(function(level) {
    QUALITY[level].labelDistanceM = radiusM;
    QUALITY[level].lodRadiusM = radiusM;
  });
  syncRadiusFocus();
  var hudRadius = document.getElementById('hud-radius');
  if (hudRadius) hudRadius.textContent = formatRadiusLabel(radiusM);
  var radiusVal = document.getElementById('radius-val');
  if (radiusVal) radiusVal.textContent = formatRadiusLabel(radiusM);
  rescaleRadiusAwareMarkers();
  updateLodRadiusOverlay();
  updateLodForAll();
}

function updatePerformanceSample() {
  var now = performance.now();
  var dt = Math.max(1, now - PERF.lastFrame);
  PERF.lastFrame = now;
  PERF.frameMs = PERF.frameMs * 0.88 + dt * 0.12;
  PERF.fps = PERF.fps * 0.88 + (1000 / dt) * 0.12;

  if (!_LOD_CAMERA_ACTIVE && now - PERF.lastQualityCheck > 1400) {
    PERF.lastQualityCheck = now;
    if ((PERF.fps < 52 || PERF.frameMs > 19) && PERF.quality === 'strong') setQuality('medium');
    else if ((PERF.fps < 50 || PERF.frameMs > 21) && PERF.quality === 'medium') setQuality('weak');
    else if (PERF.fps > 58 && PERF.frameMs < 17 && PERF.quality === 'weak') setQuality('medium');
    else if (PERF.fps > 58 && PERF.frameMs < 17 && PERF.quality === 'medium') setQuality('strong');
  }

  var fps = document.getElementById('hud-fps');
  if (fps) fps.textContent = String(Math.round(PERF.fps));
}

var _LOD_SHOW = 0.06;
var _LOD_CAMERA_ACTIVE = false;
var FRIEND_APPROACH_EPS_M = 1.5;

function lodScore(distanceM, kind, zoom) {
  var profile = QUALITY[PERF.quality];
  var typeR = (profile.typeRadius[kind] || 1.0) * profile.lodRadiusM;
  var n = distanceM / typeR;
  if (n >= 1.12) return 0;
  var t = Math.max(0, 1 - n);
  var smooth = t * t * (3 - 2 * t); // smoothstep
  var zBonus = zoom >= 15.2 ? 0.12 : zoom <= 12.2 ? -0.12 : 0;
  return Math.max(0, Math.min(1, smooth + zBonus));
}

function setLodVisibility(el, visible, score) {
  if (!el) return false;
  el.classList.remove('friend-out-of-radius');
  if (!visible) {
    if (!el.classList.contains('sim-culled')) el.classList.add('sim-culled');
    el.dataset.lod = '0';
    return false;
  }
  el.classList.remove('sim-culled');
  var displayScore = Math.max(_LOD_SHOW, score || 0);
  var scale = Math.min(1.12, 0.55 + displayScore * 0.57);
  var opacity = Math.min(1.0, 0.25 + displayScore * 0.95);
  el.style.setProperty('--lod-scale', scale.toFixed(3));
  el.style.opacity = opacity.toFixed(3);
  el.dataset.lod = '1';
  return true;
}

function positionScreenOverlay(el, lat, lng) {
  if (!el || !window.map) return null;
  var point = map.project([lng, lat]);
  el.style.transform = 'translate(' + point.x.toFixed(1) + 'px,' + point.y.toFixed(1) + 'px) translate(-50%,-50%)';
  return point;
}

function setFriendLodVisibility(entry, item, now) {
  var el = entry && (entry.wrap || entry.el);
  if (!el) return false;
  var screenPoint = positionScreenOverlay(el, entry.agent.lat, entry.agent.lng);

  if (!entry.friendLod) {
    entry.friendLod = {
      visible: false,
      lastVisibleAt: 0,
      lastDistanceM: null,
      lastDecision: 'init',
      approaching: false,
    };
  }

  var state = entry.friendLod;
  var previousDistance = typeof state.lastDistanceM === 'number' ? state.lastDistanceM : item.distanceM;
  var approaching = item.distanceM <= previousDistance - FRIEND_APPROACH_EPS_M;
  var insideEnterRadius = item.distanceM <= item.radiusM;
  var visible = insideEnterRadius;

  state.lastDistanceM = item.distanceM;
  state.approaching = approaching;
  state.lastDecision = visible ? 'inside-radius' : 'outside-radius';
  state.screenX = screenPoint ? screenPoint.x : null;
  state.screenY = screenPoint ? screenPoint.y : null;

  if (visible) {
    state.lastVisibleAt = now;
    state.visible = true;
    el.classList.remove('friend-out-of-radius');
    el.classList.remove('sim-culled');
    el.dataset.lod = '1';
    el.dataset.visible = '1';
    var displayScore = Math.max(_LOD_SHOW, item.score || 0);
    var scale = Math.min(1.12, 0.55 + displayScore * 0.57);
    el.style.setProperty('--lod-scale', scale.toFixed(3));
    el.style.opacity = '1';
    return true;
  }

  state.visible = false;
  el.classList.remove('sim-culled');
  if (!el.classList.contains('friend-out-of-radius')) el.classList.add('friend-out-of-radius');
  el.dataset.lod = '0';
  el.dataset.visible = '0';
  return false;
}

function inspectCenterElement() {
  var el = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
  if (!el) return 'none';
  var friend = el.closest && el.closest('.friend-marker-wrap');
  if (friend) return friend.dataset.name || friend.id || 'friend';
  return el.id || el.className || el.tagName;
}

function friendDiagnosticLine(item) {
  var entry = item.entry;
  var state = entry.friendLod || {};
  var el = entry.wrap || entry.el;
  var className = el ? String(el.className || '').replace(/\\s+/g, '.') : '-';
  var opacity = el ? (el.style.opacity || getComputedStyle(el).opacity) : '-';
  var verdict = state.visible ? 'good' : 'bad';
  return '<span class="' + verdict + '">' + entry.agent.name + '</span> ' +
    Math.round(item.distanceM) + '/' + Math.round(item.radiusM) + 'm ' +
    (state.visible ? 'vis' : 'hide') +
    ' lod=' + (el ? el.dataset.lod : '-') +
    ' op=' + opacity +
    ' z=' + (el ? el.style.zIndex || '-' : '-') +
    ' xy=' + (state.screenX == null ? '-' : Math.round(state.screenX) + ',' + Math.round(state.screenY)) +
    ' cls=' + className;
}

function updateFriendDebug(candidates) {
  var debug = document.getElementById('hud-friend-debug');
  var diagnostics = document.getElementById('sim-diagnostics');
  var friendCandidates = candidates
    .filter(function(item) { return item.kind === 'friend' && item.entry && item.entry.agent; })
    .sort(function(a, b) { return a.distanceM - b.distanceM; });
  if (!friendCandidates.length) {
    if (debug) debug.textContent = '-';
    if (diagnostics) diagnostics.innerHTML = 'no friends';
    return;
  }
  var item = friendCandidates[0];
  var state = item.entry.friendLod || {};
  if (debug) debug.textContent =
    item.entry.agent.name +
    ' ' + Math.round(item.distanceM) + '/' + Math.round(item.radiusM) + 'm ' +
    (state.visible ? 'vis' : 'hide') +
    (state.approaching ? ' ↓' : '') +
    ' ' + (state.lastDecision || '');
  if (diagnostics) {
    var testStatus = window._simVisibilityTestResult
      ? window._simVisibilityTestResult.ok
        ? ' tests=pass'
        : ' tests=fail(' + window._simVisibilityTestResult.failures.length + ')'
      : ' tests=pending';
    diagnostics.innerHTML =
      'center=' + inspectCenterElement() + ' radius=' + simRadiusM + 'm' + testStatus + '<br>' +
      friendCandidates.slice(0, 5).map(friendDiagnosticLine).join('<br>');
  }
}

function findFriendByName(name) {
  var needle = String(name || '').toLowerCase();
  return SIM.agents.find(function(agent) {
    return agent.isFriend && agent.name.toLowerCase() === needle;
  }) || null;
}

function simCenterOnFriend(name) {
  var friend = findFriendByName(name);
  if (!friend || !window.map) return false;
  map.jumpTo({ center:[friend.lng, friend.lat] });
  updateLodForAll();
  return true;
}
window.simCenterOnFriend = simCenterOnFriend;

function currentFriendAssertions() {
  var center = getSimFocusPoint();
  return SIM.agents
    .filter(function(agent) { return agent.isFriend; })
    .map(function(agent) {
      var entry = window._simMarkers && window._simMarkers[agent.id];
      var d = distM(center.lat, center.lng, agent.lat, agent.lng);
      var expected = d <= simRadiusM;
      var actual = !!(entry && entry._lodVisible);
      var el = entry && entry.wrap;
      return {
        id: agent.id,
        name: agent.name,
        distanceM: d,
        radiusM: simRadiusM,
        expected: expected,
        actual: actual,
        pass: expected === actual,
        lod: el ? el.dataset.lod : 'missing',
        classes: el ? String(el.className || '') : 'missing',
        opacity: el ? (el.style.opacity || getComputedStyle(el).opacity) : 'missing',
      };
    });
}
window.simFriendAssertions = currentFriendAssertions;

function simRunVisibilityTests() {
  if (!window.map || !window._simMarkers) return { ok:false, failures:['map-not-ready'] };
  var originalCenter = map.getCenter();
  var originalRadius = simRadiusM;
  var failures = [];

  SIM_RADIUS_STEPS.forEach(function(radiusM) {
    setSimRadius(radiusM);
    SIM.agents.filter(function(agent) { return agent.isFriend; }).forEach(function(agent) {
      map.jumpTo({ center:[agent.lng, agent.lat] });
      updateLodForAll();
      var centered = currentFriendAssertions().find(function(row) { return row.id === agent.id; });
      if (!centered || !centered.actual || centered.distanceM > 0.6) {
        failures.push(agent.name + ' center r' + radiusM + ' d=' + (centered ? centered.distanceM.toFixed(2) : 'missing'));
      }

      map.jumpTo({ center:[agent.lng + metersToLng(radiusM + 60, agent.lat), agent.lat] });
      updateLodForAll();
      var outside = currentFriendAssertions().find(function(row) { return row.id === agent.id; });
      if (!outside || outside.actual || outside.distanceM <= radiusM) {
        failures.push(agent.name + ' outside r' + radiusM + ' d=' + (outside ? outside.distanceM.toFixed(2) : 'missing'));
      }
    });
  });

  map.jumpTo({ center:[originalCenter.lng, originalCenter.lat] });
  setSimRadius(originalRadius);
  updateLodForAll();
  window._simVisibilityTestResult = { ok: failures.length === 0, failures: failures };
  var diagnostics = document.getElementById('sim-diagnostics');
  if (diagnostics) {
    diagnostics.innerHTML = failures.length
      ? '<span class="bad">tests failed</span><br>' + failures.slice(0, 4).join('<br>')
      : '<span class="good">visibility tests passed</span>';
  }
  return window._simVisibilityTestResult;
}
window.simRunVisibilityTests = simRunVisibilityTests;

function updateLodForAll() {
  if (!window._simMarkers || !window._worldMarkers || !window.map) return;
  syncRadiusFocus();
  rescaleRadiusAwareMarkers();
  updateLodRadiusOverlay();
  var center = getSimFocusPoint();
  var zoom = map.getZoom();
  var profile = QUALITY[PERF.quality];
  var now = Date.now();

  var candidates = [];

  function addEntry(entry, lat, lng, kind, priority) {
    var d = distM(center.lat, center.lng, lat, lng);
    var score = lodScore(d, kind, zoom);
    var radiusM = (profile.typeRadius[kind] || 1.0) * profile.lodRadiusM;
    var wasVisible = entry._lodVisible || false;
    candidates.push({
      entry: entry,
      distanceM: d,
      radiusM: radiusM,
      score: score,
      kind: kind,
      sortVal: score * (1 + (priority || 0) * 0.004) + (wasVisible ? 0.04 : 0),
      cost: profile.typeCost[kind] || 2,
      wasVisible: wasVisible,
    });
  }

  Object.keys(window._simMarkers).forEach(function(id) {
    var entry = window._simMarkers[id];
    if (!entry || !entry.agent) return;
    addEntry(entry, entry.agent.lat, entry.agent.lng,
      entry.agent.isFriend ? 'friend' : 'person',
      entry.agent.isFriend ? 78 : 34);
  });
  Object.keys(window._worldMarkers).forEach(function(id) {
    var entry = window._worldMarkers[id];
    addEntry(entry, entry.entity.lat, entry.entity.lng, 'poi', entry.entity.priority || 50);
  });

  candidates.sort(function(a, b) { return b.sortVal - a.sortVal; });

  var visible = 0;

  candidates.forEach(function(item) {
    var el = item.entry.wrap || item.entry.el;
    if (item.kind === 'friend') {
      item.entry._lodVisible = setFriendLodVisibility(item.entry, item, now);
    } else {
      var insideRadius = item.distanceM <= item.radiusM;
      item.entry._lodVisible = setLodVisibility(el, insideRadius, insideRadius ? item.score : 0);
    }
    if (item.entry._lodVisible) visible++;
  });

  updateFriendDebug(candidates);
  PERF.visibleEntities = visible;
  PERF.totalRenderable = candidates.length;
  var hudLod = document.getElementById('hud-lod');
  if (hudLod) hudLod.textContent = String(visible);
}

var pendingLodFrame = 0;
function scheduleLodUpdate() {
  if (pendingLodFrame) return;
  pendingLodFrame = requestAnimationFrame(function() {
    pendingLodFrame = 0;
    updateLodForAll();
  });
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
      { n:-80, e:-220 }, { n:95, e:-185 }, { n:210, e:-35 }, { n:155, e:170 },
      { n:-45, e:245 }, { n:-215, e:110 }, { n:-245, e:-90 }, { n:20, e:70 },
      { n:285, e:135 }, { n:-310, e:205 },
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
        id: 'sim-v8-friend-' + fi,
        entityType: 'user',
        source: 'mockUsersAdapter',
        name: FRIEND_NAMES[fi],
        isFriend: true,
        relation: 'friend',
        visibility: 'friends',
        online: true,
        activity: USER_ACTIVITIES[0],
        priority: 86,
        lat: p.lat,
        lng: p.lng,
        maxRadius: 980,
        speed: 0,
        state: 'idle',
        idleUntil: Number.POSITIVE_INFINITY,
        targetLat: null, targetLng: null,
        heading: 0,
        updatedAt: Date.now(),
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
        entityType: 'user',
        source: 'mockUsersAdapter',
        name: LOCAL_NAMES[li],
        isFriend: false,
        relation: 'public',
        visibility: 'public',
        online: seeded(li * 13.4 + 400) > 0.08,
        activity: weightedActivity(li * 8.9 + 300),
        priority: 42,
        lat: lp.lat,
        lng: lp.lng,
        maxRadius: 1500,
        speed: 0.5 + seeded(li * 3.3 + 600) * 1.1,
        state: 'idle',
        idleUntil: Date.now() + seeded(li * 19 + 700) * 9000,
        targetLat: null, targetLng: null,
        heading: seeded(li * 29 + 800) * 360,
        updatedAt: Date.now(),
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
    var scenario = currentScenario();
    var step  = 40 + Math.random() * 180;
    var nLat  = agent.lat + metersToLat(Math.sin(angle) * step);
    var nLng  = agent.lng + metersToLng(Math.cos(angle) * step, agent.lat);
    if (WORLD_ENTITIES && WORLD_ENTITIES.length && Math.random() < scenario.crowd * 0.24) {
      var place = WORLD_ENTITIES[Math.floor(Math.random() * WORLD_ENTITIES.length)];
      nLat = place.lat + metersToLat((Math.random() - 0.5) * 38);
      nLng = place.lng + metersToLng((Math.random() - 0.5) * 38, place.lat);
      agent.data.destinationId = place.id;
    } else {
      agent.data.destinationId = null;
    }
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
    if (Math.random() < 0.34) agent.activity = weightedActivity(Date.now() * 0.001 + agent.heading);
    agent.updatedAt = Date.now();
    if (prevState !== 'walk') runMechanicHook('onAgentStateChange', [agent, 'walk', prevState]);
  }

  function tick() {
    if (!playing) return;
    var tickStarted = performance.now();
    updatePerformanceSample();
    var now = Date.now();
    if (cameraInteracting) {
      lastTick = now;
      updateLodForAll();
      return;
    }
    var scenario = currentScenario();
    var rawDt = Math.min(now - lastTick, 200);
    var dt  = rawDt * speedMult;
    SIM_STATE.simMinute += (rawDt / 1000) * speedMult * 0.55;
    lastTick = now;
    var walkCount = 0;

    runMechanicHook('onTick', [agents, dt]);
    updateWorldEntities(now);
    runLiveEventEngine(now, dt);

    agents.forEach(function(agent) {
      if (agent.isFriend) return;
      if (agent.state === 'idle') {
        if (now >= agent.idleUntil) pickTarget(agent);
      } else {
        var dLat  = agent.targetLat - agent.lat;
        var dLng  = agent.targetLng - agent.lng;
        var d     = distM(agent.lat, agent.lng, agent.targetLat, agent.targetLng);
        var stepM = agent.speed * scenario.userSpeed * dt / 1000;
        if (d < stepM + 0.3) {
          agent.lat = agent.targetLat;
          agent.lng = agent.targetLng;
          var prev  = agent.state;
          agent.state    = 'idle';
          agent.idleUntil = now + 2000 + Math.random() * 9000;
          agent.updatedAt = now;
          if (Math.random() < currentScenario().eventRate * 0.18) agent.activity = weightedActivity(now * 0.003 + agent.lat);
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
      entry.agent = agent;
      if (!agent.isFriend) {
        entry.marker.setLngLat([agent.lng, agent.lat]);
        applyUserStatus(entry, agent);
      }
      if (entry.fig) {
        // speed derived from state (idle=0, walk=1.0, run=3.0)
        var spd = agent.state === 'walk' ? agent.speed : agent.state === 'run' ? 3.0 : 0;
        setFigureState(entry.fig, spd, agent.heading);
        applyFigureScale(entry.fig, agent.lat, agent.lng);
      }
    });

    document.getElementById('hud-walking').textContent = String(walkCount);
    var snapshot = collectLiveSnapshot();
    var hudTotal = document.getElementById('hud-total');
    if (hudTotal) hudTotal.textContent = String(snapshot.users.length + snapshot.places.length + snapshot.events.length);
    var hudPlaces = document.getElementById('hud-places');
    if (hudPlaces) hudPlaces.textContent = String(snapshot.places.length);
    var hudClock = document.getElementById('hud-clock');
    if (hudClock) hudClock.textContent = simClockLabel();
    var hudEvents = document.getElementById('hud-events');
    if (hudEvents) hudEvents.textContent = String(snapshot.events.length);
    var hudFriends = document.getElementById('hud-friends');
    if (hudFriends) hudFriends.textContent = String(snapshot.users.filter(function(e) { return e.payload && e.payload.isFriend; }).length);
    var tickCost = performance.now() - tickStarted;
    SIM_STATE.tickMs = SIM_STATE.tickMs * 0.82 + tickCost * 0.18;
    var hudTick = document.getElementById('hud-tickms');
    if (hudTick) hudTick.textContent = SIM_STATE.tickMs.toFixed(1);
    updateLodForAll();
  }

  return {
    agents: agents,
    registerMechanic: registerMechanic,
    setPlaying: function(v) { playing = v; if (v) lastTick = Date.now(); },
    isPlaying: function() { return playing; },
    setCameraInteracting: function(v) {
      cameraInteracting = v;
      _LOD_CAMERA_ACTIVE = v;
      document.body.classList.toggle('camera-active', v);
      if (!v) {
        lastTick = Date.now();
        PERF.lastFrame = performance.now();
        PERF.lastQualityCheck = performance.now();
      }
    },
    setSpeed: function(v) { speedMult = v; },
    tick: tick,
  };
})();

// ─────────────────────────────────────────────────────────────────────────────
// WORLD ENTITIES
// ─────────────────────────────────────────────────────────────────────────────
function buildWorldEntities() {
  var labels = [
    ['shop','Market','M',-120,-440,8,20], ['bar','Cafe','C',60,-260,7,23], ['event','Live','!',250,-180,18,24],
    ['shop','Kiosk','K',-360,120,6,22], ['shop','Bakery','B',180,340,6,18], ['event','Meet','+',-520,-180,17,23],
    ['shop','Book','R',430,120,10,19], ['club','Music','~',-120,560,21,4], ['food','Food','F',620,-420,11,23],
    ['shop','Style','S',-760,420,10,20], ['event','Pulse','*',860,260,19,2], ['club','Night','N',-980,-360,22,5],
    ['bar','Open','O',340,760,16,2], ['shop','Bike','V',-280,-760,9,19],
  ];
  return labels.map(function(item, index) {
    return {
      id:item[0] + '-' + index,
      entityType:'place',
      source:'mockPlacesAdapter',
      type:item[0],
      label:item[1],
      icon:item[2],
      lat:SIM_LAT + metersToLat(item[3]),
      lng:SIM_LNG + metersToLng(item[4], SIM_LAT),
      openHour:item[5],
      closeHour:item[6],
      state:'open',
      crowd:0,
      offer:null,
      updatedAt:Date.now(),
      priority:item[0] === 'event' || item[0] === 'club' ? 74 : 58,
    };
  });
}

var WORLD_ENTITIES = buildWorldEntities();
var LIVE_EVENTS = [];

function createSnapshotEntity(entity, type) {
  return {
    id: entity.id,
    type: type,
    source: entity.source || 'mockAdapter',
    position: { lat: entity.lat, lng: entity.lng },
    priority: entity.priority || 50,
    updatedAt: entity.updatedAt || Date.now(),
    visibility: entity.visibility || 'public',
    renderMode: entity.renderMode || 'marker',
    payload: entity,
  };
}

var SIM_ADAPTERS = {
  users: {
    name:'mockUsersAdapter',
    snapshot:function() { return SIM.agents.map(function(agent) { return createSnapshotEntity(agent, 'user'); }); },
  },
  places: {
    name:'mockPlacesAdapter',
    snapshot:function() { return WORLD_ENTITIES.map(function(entity) { return createSnapshotEntity(entity, 'place'); }); },
  },
  events: {
    name:'mockEventsAdapter',
    snapshot:function() { return LIVE_EVENTS.map(function(entity) { return createSnapshotEntity(entity, 'event'); }); },
  },
};

function collectLiveSnapshot() {
  var started = performance.now();
  var snapshot = {
    users: SIM_ADAPTERS.users.snapshot(),
    places: SIM_ADAPTERS.places.snapshot(),
    events: SIM_ADAPTERS.events.snapshot(),
  };
  SIM_STATE.adapterMs = performance.now() - started;
  SIM_STATE.lastSnapshotAt = Date.now();
  return snapshot;
}

function worldEntityEl(entity) {
  var wrap = document.createElement('div');
  wrap.className = 'entity-marker ' + entity.type + ' ' + entity.state;
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

function isPlaceOpen(entity, hour) {
  var open = entity.openHour;
  var close = entity.closeHour;
  if (open == null || close == null) return true;
  if (close < open) return hour >= open || hour < close;
  return hour >= open && hour < close;
}

function placeState(entity, hour) {
  var scenario = currentScenario();
  var open = isPlaceOpen(entity, hour);
  if (!open) return 'closed';
  if (entity.type === 'club' && (SIM_STATE.scenario === 'night' || hour >= 22 || hour < 3)) return 'event-live';
  if (entity.type === 'event' && scenario.eventRate > 0.65) return 'event-live';
  if ((entity.type === 'bar' || entity.type === 'food') && (hour === 17 || hour === 18 || SIM_STATE.scenario === 'night')) return 'happy-hour';
  if (scenario.crowd > 0.72 && seeded(entity.priority + hour) > 0.35) return 'busy';
  return 'open';
}

function updateWorldEntityVisual(entry) {
  if (!entry || !entry.wrap || !entry.entity) return;
  var entity = entry.entity;
  entry.wrap.className = 'entity-marker ' + entity.type + ' ' + entity.state;
  var label = entry.wrap.querySelector('.entity-label');
  if (label) {
    label.textContent = entity.offer ? entity.label + ' · ' + entity.offer : entity.label;
  }
}

function updateWorldEntities(now) {
  var scenario = currentScenario();
  var hour = Math.floor(SIM_STATE.simMinute / 60) % 24;
  WORLD_ENTITIES.forEach(function(entity, index) {
    var nextState = placeState(entity, hour);
    var crowdBase = scenario.crowd * (entity.type === 'club' || entity.type === 'event' ? 1.25 : 0.82);
    entity.crowd = clamp(crowdBase + seeded(index + hour * 3.7) * 0.24, 0, 1);
    entity.offer = nextState === 'happy-hour' ? 'Happy Hour' : nextState === 'event-live' ? 'Live' : null;
    if (entity.state !== nextState) {
      entity.state = nextState;
      entity.updatedAt = now;
      updateWorldEntityVisual(window._worldMarkers && window._worldMarkers[entity.id]);
    }
  });
}

function applyUserStatus(entry, agent) {
  if (!entry || !agent) return;
  var status = agent.activity && agent.activity.status ? agent.activity.status : 'online';
  var wrap = entry.wrap || entry.el;
  if (!wrap) return;
  ['status-online','status-moving','status-food','status-social','status-party','status-quiet'].forEach(function(cls) {
    wrap.classList.remove(cls);
  });
  wrap.classList.add('status-' + status);
  var popup = wrap.querySelector && wrap.querySelector('.fig-popup-sub');
  if (popup && agent.activity) popup.textContent = (agent.isFriend ? 'Freund' : 'Local') + ' · ' + agent.activity.label;
}

function pushLiveEvent(kind, label, entityId) {
  var evt = {
    id:'evt-' + Date.now() + '-' + Math.floor(Math.random() * 9999),
    entityType:'event',
    source:'mockEventsAdapter',
    kind:kind,
    label:label,
    entityId:entityId,
    lat:SIM_LAT + metersToLat((Math.random() - 0.5) * 1500),
    lng:SIM_LNG + metersToLng((Math.random() - 0.5) * 1500, SIM_LAT),
    priority:88,
    updatedAt:Date.now(),
    expiresAt:Date.now() + 42000,
  };
  LIVE_EVENTS.push(evt);
  if (LIVE_EVENTS.length > 24) LIVE_EVENTS.shift();
  SIM_STATE.eventCount++;
}

function runLiveEventEngine(now, dt) {
  LIVE_EVENTS = LIVE_EVENTS.filter(function(evt) { return evt.expiresAt > now; });
  var scenario = currentScenario();
  if (Math.random() > scenario.eventRate * dt / 72000) return;
  var roll = Math.random();
  if (roll < 0.5 && WORLD_ENTITIES.length) {
    var p = WORLD_ENTITIES[Math.floor(Math.random() * WORLD_ENTITIES.length)];
    p.state = p.type === 'bar' || p.type === 'food' ? 'happy-hour' : 'event-live';
    p.offer = p.state === 'happy-hour' ? 'Happy Hour' : 'Live';
    p.updatedAt = now;
    updateWorldEntityVisual(window._worldMarkers && window._worldMarkers[p.id]);
    pushLiveEvent('place-pulse', p.label + ' ist aktiv', p.id);
  } else {
    var locals = SIM.agents.filter(function(agent) { return !agent.isFriend; });
    if (!locals.length) return;
    var u = locals[Math.floor(Math.random() * locals.length)];
    u.online = true;
    u.activity = weightedActivity(now * 0.002 + u.lat);
    u.updatedAt = now;
    pushLiveEvent('user-status', u.name + ': ' + u.activity.label, u.id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP SETUP (exact copy from real map)
// ─────────────────────────────────────────────────────────────────────────────
var radarSizing = { lat: SIM_LAT, lng: SIM_LNG, radiusM: ${SIM_CENTER_RADIUS_M}, enabled: true };

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
var SIM_INITIAL_ZOOM = 14;
var SIM_DOUBLE_CLICK_ZOOM_DELTA = 1.25;
setQuality('strong');
map.dragRotate.disable();
map.touchZoomRotate.disableRotation();
map.touchPitch.enable();
map.doubleClickZoom.disable();

function mapPointFromPointerEvent(e) {
  var source = e && e.point
    ? e.point
    : e && e.lngLat && window.map
      ? map.project(e.lngLat)
      : null;
  if (!source) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  return { x: source.x, y: source.y };
}

function zoomInAt(point) {
  map.easeTo({
    zoom: Math.min(map.getMaxZoom(), map.getZoom() + SIM_DOUBLE_CLICK_ZOOM_DELTA),
    around: map.unproject(point),
    duration: 220,
  });
}

function resetSimZoom() {
  map.easeTo({ zoom: SIM_INITIAL_ZOOM, duration: 260 });
}

var simClickState = { count:0, timer:null, lastPoint:null };
function registerMapTap(e) {
  var target = e && e.originalEvent && e.originalEvent.target;
  if (target && target.closest && target.closest('#sim-controls, #recenter, .friend-marker-wrap, .maplibregl-popup')) return;
  var point = mapPointFromPointerEvent(e);
  simClickState.count += 1;
  simClickState.lastPoint = point;
  if (simClickState.timer) clearTimeout(simClickState.timer);
  simClickState.timer = setTimeout(function() {
    var count = simClickState.count;
    var p = simClickState.lastPoint || point;
    simClickState.count = 0;
    simClickState.timer = null;
    if (count >= 3) resetSimZoom();
    else if (count === 2) zoomInAt(p);
  }, 230);
}

document.getElementById('recenter').addEventListener('click', function(e) {
  e.preventDefault(); e.stopPropagation();
  map.easeTo({ center:[SIM_LNG, SIM_LAT], zoom:Math.max(map.getZoom(),14), duration:420 });
});
map.on('click', function() {
  document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p) { p.classList.remove('visible'); });
  document.querySelectorAll('.friend-marker-wrap.popup-open').forEach(function(w) {
    w.classList.remove('popup-open'); w.style.zIndex = '20';
  });
});
map.on('click', registerMapTap);

// ─────────────────────────────────────────────────────────────────────────────
// CREATE MARKERS (identical visual logic to real map)
// ─────────────────────────────────────────────────────────────────────────────
map.on('load', function() {
  window._simMarkers = {};
  window._worldMarkers = {};

  // Fixed "Me" overlay: the map center is the simulated user position.
  var meFr = figureEl(true);
  meFr.fig.style.setProperty('--symbol-scale','1');
  var meFocus = document.getElementById('sim-me-focus');
  if (meFocus) meFocus.appendChild(meFr.wrap);
  window._meMarker = { marker:null, fig:meFr.fig, wrap:meFr.wrap };

  var friendLayer = document.getElementById('friend-layer');

  SIM.agents.forEach(function(agent, idx) {
    if (agent.isFriend) {
      // ── Friend: screen overlay driven by map center radius ──────
      var fr = figureEl(false);
      fr.wrap.className += ' friend-marker-wrap';
      fr.wrap.id = agent.id;
      fr.wrap.dataset.id = agent.id;
      fr.wrap.dataset.name = agent.name;
      var lbl = document.createElement('div');
      lbl.className = 'friend-name-tag';
      lbl.textContent = agent.name;
      fr.wrap.insertBefore(lbl, fr.wrap.firstChild);
      fr.wrap.style.zIndex = '20';
      fr.wrap.style.animationDelay = (idx * 0.048) + 's';
      fr.wrap.classList.add('fig-entering');
      setTimeout(function(w){ w.classList.remove('fig-entering'); w.style.animationDelay=''; }.bind(null, fr.wrap), 620);
      applyFigureScale(fr.fig, agent.lat, agent.lng);
      fr.fig.dataset.state = 'idle';

      // inline popup
      var popup = document.createElement('div');
      popup.className = 'fig-popup-inner';
      var pn = document.createElement('span'); pn.className='fig-popup-name'; pn.textContent=agent.name;
      var ps = document.createElement('span'); ps.className='fig-popup-sub';  ps.textContent='Freund · ' + agent.activity.label;
      popup.appendChild(pn); popup.appendChild(ps);
      fr.wrap.appendChild(popup);
      popup.addEventListener('click', function(e) { e.stopPropagation(); });

      var activate = function(e) {
        if (e.cancelable) e.preventDefault(); e.stopPropagation();
        var now = Date.now();
        if (fr.wrap.__lastActivate && now - fr.wrap.__lastActivate < 320) return;
        fr.wrap.__lastActivate = now;
        var visible = popup.classList.contains('visible');
        document.querySelectorAll('.friend-marker-wrap.popup-open').forEach(function(w){ w.classList.remove('popup-open'); w.style.zIndex='20'; });
        document.querySelectorAll('.fig-popup-inner.visible').forEach(function(p){ p.classList.remove('visible'); });
        if (!visible) { fr.wrap.classList.add('popup-open'); fr.wrap.style.zIndex='10000'; popup.classList.add('visible'); }
      };
      [lbl, fr.fig].forEach(function(t) {
        t.addEventListener('touchend', activate, { passive:false });
        t.addEventListener('click', activate);
      });

      if (friendLayer) friendLayer.appendChild(fr.wrap);
      window._simMarkers[agent.id] = { marker:null, fig:fr.fig, wrap:fr.wrap, agent:agent };
      applyUserStatus(window._simMarkers[agent.id], agent);

    } else {
      // ── Local: small circle (identical to real map) ───────────────
      var neonGreen = '#00ffb2';
      var el = markerEl(13, neonGreen, '1px solid rgba(234,251,255,0.9)', '0 0 10px rgba(0,255,178,0.38)');
      var delay = (idx * 0.025) + 's';
      el.style.animationDelay = delay;
      var localMarker = new maplibregl.Marker({ element:el, anchor:'center' })
        .setLngLat([agent.lng, agent.lat])
        .setPopup(new maplibregl.Popup({ closeButton:false, offset:10 }).setHTML(infoSheetHtml(agent.name, 'Local · ' + agent.activity.label)))
        .addTo(map);
      window._simMarkers[agent.id] = { marker:localMarker, fig:null, el:el, agent:agent };
      applyUserStatus(window._simMarkers[agent.id], agent);
    }
  });

  WORLD_ENTITIES.forEach(function(entity, idx) {
    var el = worldEntityEl(entity);
    el.style.animationDelay = (idx * 0.08) + 's';
    var marker = new maplibregl.Marker({ element:el, anchor:'bottom' })
      .setLngLat([entity.lng, entity.lat])
      .setPopup(new maplibregl.Popup({ closeButton:false, offset:16 }).setHTML(infoSheetHtml(entity.label, (entity.type === 'event' ? 'Event' : 'Ort') + ' · ' + entity.state)))
      .addTo(map);
    window._worldMarkers[entity.id] = { marker:marker, wrap:el, entity:entity };
    updateWorldEntityVisual(window._worldMarkers[entity.id]);
  });
  simSetScenario('day');
  setSimRadius(simRadiusM);

  map.on('dragstart', function() { SIM.setCameraInteracting(true); });
  map.on('movestart', function() { SIM.setCameraInteracting(true); });
  map.on('move', scheduleLodUpdate);
  map.on('zoom', scheduleLodUpdate);
  map.on('resize', scheduleLodUpdate);
  map.on('moveend', function() { SIM.setCameraInteracting(false); updateLodForAll(); });
  updateLodForAll();
  setTimeout(function() { simRunVisibilityTests(); }, 240);

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

function simChangeRadius(d) {
  simRadiusIdx = Math.max(0, Math.min(SIM_RADIUS_STEPS.length - 1, simRadiusIdx + d));
  setSimRadius(SIM_RADIUS_STEPS[simRadiusIdx]);
}

function simSetProfile(profile) {
  setQuality(profile);
  setSimRadius(simRadiusM);
  updateLodForAll();
}

function simSetScenario(name) {
  if (!SCENARIOS[name]) return;
  SIM_STATE.scenario = name;
  var scenario = currentScenario();
  SIM_STATE.simMinute = scenario.timeHour * 60;
  SIM_STATE.loadFactor = scenario.loadBudget;
  document.body.classList.remove('scenario-day','scenario-rush','scenario-night','scenario-event','scenario-stress');
  document.body.classList.add('scenario-' + name);
  ['day','rush','night','event','stress'].forEach(function(id) {
    var btn = document.getElementById('scenario-' + id);
    if (btn) btn.classList.toggle('on', id === name);
  });
  var hudScenario = document.getElementById('hud-scenario');
  if (hudScenario) hudScenario.textContent = scenario.label;
  SIM.agents.forEach(function(agent, index) {
    if (agent.isFriend) return;
    var activitySeed = index * 18.7 + scenario.timeHour * 10;
    agent.online = name === 'stress' ? true : seeded(activitySeed) > (agent.isFriend ? 0.02 : 0.08);
    if (name === 'night' && seeded(activitySeed + 5) > 0.45) agent.activity = USER_ACTIVITIES[4];
    else if (name === 'rush' && seeded(activitySeed + 6) > 0.48) agent.activity = USER_ACTIVITIES[1];
    else if (name === 'event' && seeded(activitySeed + 7) > 0.38) agent.activity = USER_ACTIVITIES[3];
    else agent.activity = weightedActivity(activitySeed);
    agent.updatedAt = Date.now();
    applyUserStatus(window._simMarkers && window._simMarkers[agent.id], agent);
  });
  updateWorldEntities(Date.now());
  pushLiveEvent('scenario', 'Szenario ' + scenario.label + ' gestartet', name);
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
        <Text style={styles.engineBadgeText}>FPS · Radius · Live World Lab</Text>
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
