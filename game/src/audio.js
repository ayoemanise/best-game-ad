// audio.js — synthesized WebAudio sound for NOVA HARVEST (best-game-01).
// No audio files: every effect and the ambient pad are built from
// oscillators and filtered noise at run time. The AudioContext is created
// on the first user gesture (init) and resumed if the browser suspends it.

let actx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let mutedFlag = false;

// Music state.
let musicNodes = null; // { oscs, gain, timer }
let musicOn = false;

// SFX rate limits (ms) so rapid fire / hits never stack into noise.
const lastPlay = {};
const THROTTLE = { shoot: 45, hit: 40, pickup: 60, dash: 120 };

function ensureCtx() {
  if (actx) {
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  actx = new AC();
  master = actx.createGain();
  master.gain.value = mutedFlag ? 0 : 0.9;
  master.connect(actx.destination);
  sfxBus = actx.createGain();
  sfxBus.gain.value = 0.5;
  sfxBus.connect(master);
  musicBus = actx.createGain();
  musicBus.gain.value = 0.16;
  musicBus.connect(master);
  return actx;
}

// One oscillator blip with an exponential decay envelope.
function tone(opts) {
  if (!actx) return;
  const type = opts.type || 'sine';
  const dur = opts.dur || 0.15;
  const vol = opts.vol != null ? opts.vol : 0.2;
  const when = actx.currentTime + (opts.delay || 0);
  const osc = actx.createOscillator();
  const gain = actx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(opts.freq, when);
  if (opts.freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.freqEnd), when + dur);
  }
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(vol, when + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  osc.connect(gain);
  gain.connect(opts.bus || sfxBus);
  osc.start(when);
  osc.stop(when + dur + 0.05);
}

// Filtered white-noise burst (explosions, hits, dash whoosh).
function noise(opts) {
  if (!actx) return;
  const dur = opts.dur || 0.3;
  const vol = opts.vol != null ? opts.vol : 0.3;
  const when = actx.currentTime + (opts.delay || 0);
  const len = Math.max(1, Math.floor(actx.sampleRate * dur));
  const buf = actx.createBuffer(1, len, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = actx.createBufferSource();
  src.buffer = buf;
  const filter = actx.createBiquadFilter();
  filter.type = opts.filterType || 'lowpass';
  filter.frequency.setValueAtTime(opts.freq || 1200, when);
  if (opts.freqEnd) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(10, opts.freqEnd), when + dur);
  }
  const gain = actx.createGain();
  gain.gain.setValueAtTime(vol, when);
  gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(opts.bus || sfxBus);
  src.start(when);
  src.stop(when + dur + 0.05);
}

function throttled(name) {
  const now = performance.now();
  const gap = THROTTLE[name] || 0;
  if (gap > 0 && now - (lastPlay[name] || 0) < gap) return true;
  lastPlay[name] = now;
  return false;
}

// Ambient pad chords (Am – F – C – G), rotated every 8 seconds.
const PAD_CHORDS = [
  [110.0, 164.81, 220.0],
  [87.31, 130.81, 174.61],
  [130.81, 164.81, 196.0],
  [98.0, 146.83, 196.0],
];
let padStep = 0;

function startPad() {
  if (!actx || musicNodes) return;
  const oscs = [];
  const padGain = actx.createGain();
  padGain.gain.value = 0;
  padGain.gain.linearRampToValueAtTime(1, actx.currentTime + 2);
  const filter = actx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.6;
  // Slow filter swell.
  const lfo = actx.createOscillator();
  lfo.frequency.value = 0.07;
  const lfoGain = actx.createGain();
  lfoGain.gain.value = 350;
  lfo.connect(lfoGain);
  lfoGain.connect(filter.frequency);
  lfo.start();
  oscs.push(lfo);

  const chord = PAD_CHORDS[padStep % PAD_CHORDS.length];
  for (const freq of chord) {
    const osc = actx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = (Math.random() * 2 - 1) * 4;
    osc.connect(padGain);
    osc.start();
    oscs.push(osc);
  }
  padGain.connect(filter);
  filter.connect(musicBus);
  musicNodes = { oscs, gain: padGain, filter, timer: 0 };
  musicNodes.timer = window.setInterval(() => {
    if (!musicNodes || !actx) return;
    padStep += 1;
    const next = PAD_CHORDS[padStep % PAD_CHORDS.length];
    const chordOscs = musicNodes.oscs.filter((o) => o.type === 'triangle');
    for (let i = 0; i < chordOscs.length && i < next.length; i++) {
      chordOscs[i].frequency.linearRampToValueAtTime(next[i], actx.currentTime + 2.5);
    }
  }, 8000);
}

function stopPad() {
  if (!musicNodes) return;
  window.clearInterval(musicNodes.timer);
  const nodes = musicNodes;
  musicNodes = null;
  try {
    nodes.gain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.6);
    const stopAt = actx.currentTime + 0.8;
    for (const o of nodes.oscs) {
      try {
        o.stop(stopAt);
      } catch (e) {
        // Already stopped; ignore.
      }
    }
  } catch (e) {
    // Context gone; nothing to stop.
  }
}

export const AudioSys = {
  // Call from the first user gesture (Start click / keydown). Safe to
  // call repeatedly; creates the context once and resumes it if needed.
  init() {
    ensureCtx();
  },

  get muted() {
    return mutedFlag;
  },

  setMuted(b) {
    mutedFlag = !!b;
    if (master) master.gain.value = mutedFlag ? 0 : 0.9;
  },

  // Play one named effect. Unknown names and calls before init() are
  // silently ignored. Rapid effects are throttled.
  sfx(name) {
    if (!actx || mutedFlag) return;
    if (throttled(name)) return;
    switch (name) {
      case 'shoot':
        tone({ type: 'square', freq: 880, freqEnd: 420, dur: 0.07, vol: 0.1 });
        break;
      case 'hit':
        noise({ dur: 0.05, vol: 0.16, freq: 2400, freqEnd: 900 });
        tone({ type: 'triangle', freq: 220, freqEnd: 140, dur: 0.05, vol: 0.12 });
        break;
      case 'explode':
        noise({ dur: 0.4, vol: 0.35, freq: 1400, freqEnd: 90 });
        tone({ type: 'sine', freq: 170, freqEnd: 38, dur: 0.38, vol: 0.3 });
        break;
      case 'pickup':
        tone({ type: 'sine', freq: 660, dur: 0.09, vol: 0.16 });
        tone({ type: 'sine', freq: 990, dur: 0.12, vol: 0.16, delay: 0.06 });
        break;
      case 'upgrade':
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
          tone({ type: 'triangle', freq: f, dur: 0.18, vol: 0.18, delay: i * 0.09 });
        });
        break;
      case 'wave':
        tone({ type: 'sawtooth', freq: 110, dur: 0.5, vol: 0.14 });
        tone({ type: 'sawtooth', freq: 164.81, dur: 0.5, vol: 0.1 });
        tone({ type: 'sine', freq: 220, dur: 0.5, vol: 0.08 });
        break;
      case 'damage':
        tone({ type: 'sine', freq: 95, freqEnd: 48, dur: 0.25, vol: 0.32 });
        noise({ dur: 0.18, vol: 0.2, freq: 500, freqEnd: 120 });
        break;
      case 'gameover':
        [392.0, 311.13, 233.08, 196.0].forEach((f, i) => {
          tone({ type: 'triangle', freq: f, dur: 0.28, vol: 0.18, delay: i * 0.22 });
        });
        break;
      case 'dash':
        noise({ dur: 0.16, vol: 0.2, freq: 400, freqEnd: 3200, filterType: 'bandpass' });
        break;
      case 'click':
        tone({ type: 'square', freq: 1250, dur: 0.035, vol: 0.08 });
        break;
      default:
        break;
    }
  },

  // Start the quiet ambient pad loop. No-op if already playing.
  startMusic() {
    if (!ensureCtx() || musicOn) return;
    musicOn = true;
    startPad();
  },

  // Stop the pad loop. No-op if not playing.
  stopMusic() {
    musicOn = false;
    stopPad();
  },
};
