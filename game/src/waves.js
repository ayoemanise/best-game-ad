// waves.js — NOVA HARVEST wave director.
//
// buildWave(n) composes a spawn queue for wave N, startWave(state, n) opens
// it with an announce banner, and updateWaves(state, dt, audio) drives the
// announce -> spawning -> fighting -> clear flow, then hands the run to the
// upgrade screen through state.onWaveClear() (set by main.js).
//
// Wave 1 is gentle (a handful of slow Drifters); the budget grows with N and
// the mix shifts toward Weaver, Spitter and Splitter as the waves go on.
// Spawn composition is deterministic per wave number (seeded RNG), so a
// given wave always plays the same shape.

import { CONFIG } from './config.js';
import { createRNG } from './utils.js';
import { createEnemy } from './entities.js';

// Enemy mix weights per wave. A kind with weight 0 is not spawned yet.
function mixFor(n) {
  return {
    drifter: 1.0,
    weaver: n >= 2 ? 0.45 + 0.08 * n : 0,
    spitter: n >= 3 ? 0.30 + 0.04 * n : 0,
    splitter: n >= 4 ? 0.22 : 0,
  };
}

// Total enemies in wave N (wave 1: 7, all Drifters).
function countFor(n) {
  return 4 + 3 * n;
}

// Seconds between spawns: faster as waves rise, never below 0.35s.
function intervalFor(n) {
  return Math.max(0.35, 1.0 - 0.06 * n);
}

export function buildWave(n) {
  const rng = createRNG(1000 + n * 77);
  const mix = mixFor(n);
  const kinds = Object.keys(mix).filter((k) => mix[k] > 0);
  const weights = kinds.map((k) => mix[k]);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const count = countFor(n);
  const interval = intervalFor(n);
  const queue = [];
  let t = 0.4; // first spawn shortly after the banner
  for (let i = 0; i < count; i++) {
    let r = rng() * totalWeight;
    let kind = 'drifter';
    for (let j = 0; j < kinds.length; j++) {
      r -= weights[j];
      if (r <= 0) { kind = kinds[j]; break; }
    }
    queue.push({ kind, delay: t });
    // Small jitter so spawns do not feel metronomic.
    t += interval * (0.75 + rng() * 0.5);
  }
  return queue;
}

function edgeSpawn(state) {
  const w = CONFIG.width || 1280;
  const h = CONFIG.height || 800;
  const side = Math.floor(state.rng() * 4);
  const m = 30; // spawn just outside the arena
  if (side === 0) return { x: -m, y: state.rng() * h };
  if (side === 1) return { x: w + m, y: state.rng() * h };
  if (side === 2) return { x: state.rng() * w, y: -m };
  return { x: state.rng() * w, y: h + m };
}

export function startWave(state, n, audio) {
  state.wave = n;
  state.waveState = 'announce';
  state.waveTimer = 2.2;
  state.spawnQueue = buildWave(n);
  state.spawnTimer = 0;
  state.waveClearFired = false;
  // A shield the player owns recharges at the start of every wave.
  if (state.player.level.shield > 0) state.player.shield = 1;
  const sfx = audio || state.audio;
  if (sfx && typeof sfx.sfx === 'function') sfx.sfx('wave');
}

export function updateWaves(state, dt, audio) {
  if (state.mode !== 'playing') return;

  if (state.waveState === 'announce') {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0) {
      state.waveState = 'spawning';
      state.spawnTimer = 0;
    }
    return;
  }

  if (state.waveState === 'spawning') {
    state.spawnTimer += dt;
    const hpScale = 1 + 0.12 * (state.wave - 1);
    const speedScale = Math.min(1.4, 1 + 0.04 * (state.wave - 1));
    while (state.spawnQueue.length > 0 && state.spawnQueue[0].delay <= state.spawnTimer) {
      const next = state.spawnQueue.shift();
      const pos = edgeSpawn(state);
      const enemy = createEnemy(next.kind, pos.x, pos.y, hpScale);
      enemy.speed = enemy.speed * speedScale;
      state.enemies.push(enemy);
    }
    if (state.spawnQueue.length === 0) state.waveState = 'fighting';
    return;
  }

  if (state.waveState === 'fighting') {
    if (state.enemies.length === 0) {
      state.waveState = 'clear';
      state.waveTimer = 1.0;
    }
    return;
  }

  if (state.waveState === 'clear') {
    state.waveTimer -= dt;
    if (state.waveTimer <= 0 && !state.waveClearFired) {
      state.waveClearFired = true;
      if (typeof state.onWaveClear === 'function') state.onWaveClear();
    }
  }
}
