// NOVA HARVEST — boot, fixed-timestep loop, mode machine, screenshot hooks.
import { CONFIG } from './config.js';
import { Input } from './input.js';
import { createRNG } from './utils.js';
import { AudioSys } from './audio.js';
import { createPlayer, updateEntities } from './entities.js';
import { startWave, updateWaves } from './waves.js';
import { rollChoices } from './upgrades.js';
import { draw } from './render.js';
import { UI } from './ui.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const STEP = CONFIG.step;
const BEST_KEY = CONFIG.storageKey;
const WAVE_SUBTITLES = [
  'Collect shards. Survive.',
  'They come faster now.',
  'Hold the line, harvester.',
  'The void grows hungry.',
  'No retreat. Only harvest.',
];

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY) || 0) || 0;
  } catch (_e) {
    return 0;
  }
}

function saveBest(score) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch (_e) {
    /* storage unavailable (private mode) — best score just won't persist */
  }
}

// The one shared state object every module reads and writes (see GAME_SPEC).
function createState(seed) {
  const state = {
    mode: 'title',
    time: 0,
    score: 0,
    combo: 1,
    comboTimer: 0,
    best: loadBest(),
    wave: 0,
    waveState: 'idle',
    waveTimer: 0,
    spawnQueue: [],
    spawnTimer: 0,
    player: createPlayer(CONFIG.canvas.width / 2, CONFIG.canvas.height / 2),
    bullets: [],
    enemies: [],
    ebullets: [],
    particles: [],
    pickups: [],
    texts: [],
    shards: 0,
    kills: 0,
    shake: 0,
    flash: 0,
    rng: createRNG(seed >>> 0),
    seed: seed >>> 0,
    onWaveClear: null,
  };
  return state;
}

let state = createState((Math.random() * 0xffffffff) >>> 0);
let newBest = false;
let prevWaveState = 'idle';
let prevWave = 0;

// ---- run flow ------------------------------------------------------------

function startRun(seed) {
  state = createState(seed === undefined ? (Math.random() * 0xffffffff) >>> 0 : seed);
  state.mode = 'playing';
  newBest = false;
  prevWaveState = 'idle';
  prevWave = 0;
  state.onWaveClear = openUpgradeScreen;
  UI.showScreen(null);
  UI.setBest(state.best);
  AudioSys.init();
  AudioSys.startMusic();
  startWave(state, 1, AudioSys);
}

function openUpgradeScreen() {
  if (state.mode !== 'playing') return;
  const choices = rollChoices(state);
  if (choices.length === 0) {
    // Everything maxed: roll straight into the next wave.
    startWave(state, state.wave + 1, AudioSys);
    return;
  }
  // ui.js shows each card's current level; rollChoices returns the pool
  // entries without it, so attach the player's level here.
  for (const choice of choices) {
    choice.level = state.player.level[choice.id] || 0;
  }
  state.mode = 'upgrade';
  UI.showUpgrades(choices, (choice) => {
    choice.apply(state.player);
    AudioSys.sfx('upgrade');
    UI.showScreen(null);
    state.mode = 'playing';
    startWave(state, state.wave + 1, AudioSys);
  });
  UI.showScreen('upgrade');
}

function gameOver() {
  if (state.mode === 'gameover') return;
  state.mode = 'gameover';
  AudioSys.sfx('gameover');
  AudioSys.stopMusic();
  newBest = state.score > state.best && state.score > 0;
  if (newBest) {
    state.best = state.score;
    saveBest(state.best);
  }
  // ui.js fills the game-over stats (and the NEW BEST badge) from this
  // data; shards are not in its contract, so main.js writes that one.
  document.getElementById('final-shards').textContent = String(state.shards);
  UI.setBest(state.best);
  UI.showScreen('gameover', {
    score: state.score,
    wave: state.wave,
    kills: state.kills,
    best: state.best,
    isNewBest: newBest,
  });
}

function togglePause() {
  if (state.mode === 'playing') {
    state.mode = 'paused';
    UI.showScreen('paused');
  } else if (state.mode === 'paused') {
    state.mode = 'playing';
    UI.showScreen(null);
  }
}

function toggleMute() {
  AudioSys.init();
  AudioSys.setMuted(!AudioSys.muted);
  const label = AudioSys.muted ? '🔇' : '🔊';
  const hudBtn = document.getElementById('btn-mute');
  if (hudBtn) hudBtn.textContent = label;
  const pauseBtn = document.getElementById('btn-mute-pause');
  if (pauseBtn) pauseBtn.textContent = AudioSys.muted ? '🔇 Sound Off' : '🔊 Sound On';
}

// ---- per-frame input (checked once per frame, not per fixed step) --------

function handleGlobalInput() {
  if (Input.pressed('KeyM')) toggleMute();

  if (state.mode === 'playing') {
    if (Input.pressed('Escape') || Input.pressed('KeyP')) togglePause();
  } else if (state.mode === 'paused') {
    if (Input.pressed('Escape') || Input.pressed('KeyP')) togglePause();
    else if (Input.pressed('KeyR')) startRun();
  } else if (state.mode === 'title') {
    if (Input.pressed('Enter') || Input.consumeClick()) startRun();
  } else if (state.mode === 'gameover') {
    if (Input.pressed('KeyR') || Input.pressed('Enter')) startRun();
  }
}

// ---- fixed-step update ---------------------------------------------------

// During the ?shot=play screenshot the bot keeps driving the ship in real
// time (moving, aiming, firing) so the scene stays alive for the camera.
let shotBot = false;

function update(dt) {
  if (state.mode === 'title') {
    // Let the background starfield drift behind the title screen.
    state.time += dt;
    return;
  }
  if (state.mode !== 'playing') return;

  state.time += dt;
  updateWaves(state, dt, AudioSys);
  updateEntities(state, dt, shotBot ? makeBotInput() : Input, AudioSys);

  // Wave announce banner (waves.js drives waveState; main.js announces it).
  if (state.waveState === 'announce' && (prevWaveState !== 'announce' || prevWave !== state.wave)) {
    UI.banner('WAVE ' + state.wave, WAVE_SUBTITLES[Math.min(state.wave - 1, WAVE_SUBTITLES.length - 1)]);
  }
  prevWaveState = state.waveState;
  prevWave = state.wave;

  if (state.player.hp <= 0) gameOver();
}

// ---- screenshot hooks ----------------------------------------------------
// ?shot=title|play|upgrade|gameover &seed=N
// window.__shotReady flips to true once the requested state has rendered
// for at least 2 frames. Only active when ?shot is present.

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
const shotSeed = params.get('seed') === null ? 1337 : Number(params.get('seed')) || 1337;
let shotReadyFrames = 0;
if (shot) window.__shotReady = false;
else window.__shotReady = true;

// A bot input shaped like the real Input module, for fast-forwarding.
function makeBotInput() {
  const keys = new Set();
  const p = state.player;
  const t = state.time * 0.5;
  const tx = CONFIG.canvas.width / 2 + Math.cos(t) * 260;
  const ty = CONFIG.canvas.height / 2 + Math.sin(t * 1.3) * 200;
  const dx = tx - p.x;
  const dy = ty - p.y;
  if (dx > 12) keys.add('KeyD');
  else if (dx < -12) keys.add('KeyA');
  if (dy > 12) keys.add('KeyS');
  else if (dy < -12) keys.add('KeyW');
  let target = null;
  let best = Infinity;
  for (const e of state.enemies) {
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < best) {
      best = d;
      target = e;
    }
  }
  return {
    keys,
    mouse: {
      x: target ? target.x : p.x + 100,
      y: target ? target.y : p.y,
      down: true,
      rightDown: false,
    },
    isDown: (code) => keys.has(code),
    pressed: () => false,
    consumeClick: () => false,
    endFrame: () => {},
  };
}

// One deterministic simulation step used only by the shot fast-forward.
// God-mode (full HP every step) so the shot scene is guaranteed to exist.
function stepShot(dt) {
  state.time += dt;
  state.player.hp = state.player.maxHp;
  updateWaves(state, dt, AudioSys);
  updateEntities(state, dt, makeBotInput(), AudioSys);
}

function fastForwardWave(n) {
  const savedClear = state.onWaveClear;
  state.onWaveClear = () => {};
  startWave(state, n, AudioSys);
  let guard = 0;
  while (state.waveState !== 'clear' && guard < 60 * 90) {
    stepShot(STEP);
    guard += 1;
  }
  state.onWaveClear = savedClear;
}

function fastForwardWave1() {
  fastForwardWave(1);
}

function setupShot() {
  if (!shot) return;
  if (shot === 'title') {
    UI.setBest(state.best);
    UI.showScreen('title');
    return;
  }
  if (shot === 'play') {
    startRun(shotSeed);
    // Never open the upgrade screen mid-shot: roll straight into the
    // next wave so the scene stays in combat.
    state.onWaveClear = () => startWave(state, state.wave + 1, AudioSys);
    // Play through waves 1-2, then shoot mid-wave-3 when the field is
    // at its busiest (Weavers and Spitters join from waves 2-3).
    fastForwardWave(1);
    fastForwardWave(2);
    startWave(state, 3, AudioSys);
    for (let i = 0; i < 3 * 60; i++) stepShot(STEP);
    shotBot = true;
    state.mode = 'playing';
    return;
  }
  if (shot === 'upgrade') {
    startRun(shotSeed);
    fastForwardWave1();
    state.score = 1250;
    state.shards = 18;
    state.kills = 12;
    openUpgradeScreen();
    return;
  }
  if (shot === 'gameover') {
    startRun(shotSeed);
    state.score = 4200;
    state.wave = 4;
    state.kills = 57;
    state.shards = 120;
    state.player.hp = 0;
    gameOver();
  }
}

function shotTargetReached() {
  if (shot === 'title') return state.mode === 'title';
  if (shot === 'play') return state.mode === 'playing' && state.enemies.length > 0;
  if (shot === 'upgrade') return state.mode === 'upgrade';
  if (shot === 'gameover') return state.mode === 'gameover';
  return true;
}

// ---- boot ---------------------------------------------------------------

Input.init(canvas);
UI.bindButtons({
  onStart: () => startRun(),
  onRestart: () => startRun(),
  onResume: () => togglePause(),
  onMute: () => toggleMute(),
});
document.getElementById('btn-pause').addEventListener('click', () => togglePause());

// Audio starts on the first user gesture (browser autoplay policy).
window.addEventListener('keydown', () => AudioSys.init());
window.addEventListener('pointerdown', () => AudioSys.init());

UI.setBest(state.best);
UI.showScreen('title');
setupShot();

// Shield chip in the HUD: ui.js does not own it, so main.js toggles it.
let shieldShown = false;
function updateShieldChip() {
  const has = state.player && state.player.shield > 0;
  if (has === shieldShown) return;
  shieldShown = has;
  document.getElementById('hud-shield').classList.toggle('hidden', !has);
}

// ---- main loop: fixed timestep, render every frame ------------------------

let last = performance.now();
let acc = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  handleGlobalInput();

  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    update(STEP);
    acc -= STEP;
    steps += 1;
  }
  if (steps === 5) acc = 0; // drop backlog rather than spiral

  draw(state, ctx, CONFIG.canvas.width, CONFIG.canvas.height);
  UI.updateHUD(state);
  updateShieldChip();
  Input.endFrame();

  if (shot) {
    if (shotTargetReached()) {
      shotReadyFrames += 1;
      if (shotReadyFrames >= 2) window.__shotReady = true;
    } else {
      shotReadyFrames = 0;
    }
  }
}

requestAnimationFrame(frame);
