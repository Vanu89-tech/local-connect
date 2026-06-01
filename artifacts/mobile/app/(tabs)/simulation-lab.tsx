import React, { useRef } from "react";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import Colors from "@/constants/colors";

// Simulation center – Munich Marienplatz (overridden at runtime by user location if desired)
const SIM_LAT = 48.1351;
const SIM_LNG = 11.5820;
const FRIEND_COUNT = 30;
const LOCAL_COUNT  = 70;

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
  #parchment-overlay {
    position:fixed; inset:0; pointer-events:none; z-index:330;
    background:
      radial-gradient(circle at 12% 16%, ${mapStyle.overlayBlue} 0%, rgba(0,240,255,0) 32%),
      radial-gradient(circle at 84% 80%, ${mapStyle.overlayPink} 0%, rgba(255,43,214,0) 36%),
      radial-gradient(circle at 52% 42%, ${mapStyle.overlayYellow} 0%, rgba(239,255,58,0) 38%);
    mix-blend-mode:screen;
  }
  #vignette { position:fixed; inset:0; pointer-events:none; z-index:360; box-shadow:inset 0 0 90px rgba(0,0,0,0.46); }
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
    transform:scale(var(--symbol-scale,1)); transform-origin:50% 100%;
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
<div id="parchment-overlay"></div>
<div id="vignette"></div>
<button id="recenter" aria-label="Zentrieren" type="button">⌖</button>

<!-- Simulation HUD -->
<div id="sim-hud">
  <div class="hud-chip">SIM &nbsp;👥 <span id="hud-total">${FRIEND_COUNT + LOCAL_COUNT}</span></div>
  <div class="hud-chip">⭐ <span id="hud-friends">${FRIEND_COUNT}</span> Freunde</div>
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

    for (fi = 0; fi < ${FRIEND_COUNT}; fi++) {
      var angle = (fi / ${FRIEND_COUNT}) * Math.PI * 2 + seeded(fi * 3.1) * 0.5;
      var dist  = 80 + seeded(fi * 7.7) * 280;
      agents.push({
        id: 'sim-friend-' + fi,
        name: FRIEND_NAMES[fi],
        isFriend: true,
        lat: SIM_LAT + metersToLat(Math.sin(angle) * dist),
        lng: SIM_LNG + metersToLng(Math.cos(angle) * dist, SIM_LAT),
        maxRadius: 380,
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
      var angle2 = seeded(li * 2.2 + 100) * Math.PI * 2;
      var dist2  = 160 + seeded(li * 9.1 + 200) * 640;
      agents.push({
        id: 'sim-local-' + li,
        name: LOCAL_NAMES[li],
        isFriend: false,
        lat: SIM_LAT + metersToLat(Math.sin(angle2) * dist2),
        lng: SIM_LNG + metersToLng(Math.cos(angle2) * dist2, SIM_LAT),
        maxRadius: 860,
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
    var now = Date.now();
    var dt  = Math.min(now - lastTick, 200) * speedMult;
    lastTick = now;
    var walkCount = 0;

    runMechanicHook('onTick', [agents, dt]);

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
      if (entry.fig) {
        // speed derived from state (idle=0, walk=1.0, run=3.0)
        var spd = agent.state === 'walk' ? agent.speed : agent.state === 'run' ? 3.0 : 0;
        setFigureState(entry.fig, spd, agent.heading);
        applyFigureScale(entry.fig, agent.lat, agent.lng);
      }
    });

    document.getElementById('hud-walking').textContent = String(walkCount);
  }

  return {
    agents: agents,
    registerMechanic: registerMechanic,
    setPlaying: function(v) { playing = v; if (v) lastTick = Date.now(); },
    isPlaying: function() { return playing; },
    setSpeed: function(v) { speedMult = v; },
    tick: tick,
  };
})();

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
    figEl.parentElement.style.transform = 'scaleX(' + dir + ')';
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
      window._simMarkers[agent.id] = { marker:marker, fig:fr.fig, wrap:fr.wrap };

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
      window._simMarkers[agent.id] = { marker:localMarker, fig:null };
    }
  });

  // Start simulation tick
  setInterval(SIM.tick, 80);
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#07131f" },
  webview:   { flex: 1, backgroundColor: "#07131f" },
});
