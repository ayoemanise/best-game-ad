// ui.js — DOM presentation for NOVA HARVEST (best-game-01).
// Owns the HUD, the four screens (title / upgrade / paused / game over),
// the wave banner and the best-score display. No game logic here.
//
// DOM CONTRACT — index.html must provide these ids (all looked up lazily
// and guarded, so a missing element simply does nothing instead of
// throwing):
//   #hud, #hud-score, #hud-combo, #hud-wave, #hud-hp-fill, #hud-hp-text,
//   #hud-dash-fill, #hud-dash-text, #hud-enemies, #hud-shards, #btn-mute
//   #banner, #banner-title, #banner-sub
//   #screen-title (#title-best, #btn-start)
//   #screen-upgrade (#upgrade-cards)
//   #screen-paused (#btn-resume, #btn-restart-pause, #btn-mute-pause)
//   #screen-gameover (#final-score, #final-wave, #final-kills, #final-best,
//                      #new-best, #btn-restart)
import { formatScore } from './utils.js';

export const DOM_IDS = {
  hud: 'hud',
  score: 'hud-score',
  combo: 'hud-combo',
  wave: 'hud-wave',
  hpFill: 'hud-hp-fill',
  hpText: 'hud-hp-text',
  dashFill: 'hud-dash-fill',
  dashText: 'hud-dash-text',
  enemies: 'hud-enemies',
  shards: 'hud-shards',
  mute: 'btn-mute',
  banner: 'banner',
  bannerTitle: 'banner-title',
  bannerSub: 'banner-sub',
  screenTitle: 'screen-title',
  titleBest: 'title-best',
  start: 'btn-start',
  screenUpgrade: 'screen-upgrade',
  upgradeCards: 'upgrade-cards',
  screenPaused: 'screen-paused',
  resume: 'btn-resume',
  restartPause: 'btn-restart-pause',
  mutePause: 'btn-mute-pause',
  screenGameover: 'screen-gameover',
  finalScore: 'final-score',
  finalWave: 'final-wave',
  finalKills: 'final-kills',
  finalBest: 'final-best',
  newBest: 'new-best',
  restart: 'btn-restart',
};

const SCREENS = {
  title: DOM_IDS.screenTitle,
  upgrade: DOM_IDS.screenUpgrade,
  paused: DOM_IDS.screenPaused,
  gameover: DOM_IDS.screenGameover,
};

// Lazily cached element lookups (null-safe).
const cache = new Map();
function el(id) {
  if (!cache.has(id)) cache.set(id, document.getElementById(id));
  return cache.get(id);
}

function setText(id, value) {
  const node = el(id);
  if (node && node.textContent !== value) node.textContent = value;
}

function setShown(node, shown) {
  if (!node) return;
  node.style.display = shown ? '' : 'none';
}

// Last HUD values, so we only touch the DOM when something changed.
const last = {
  score: '', combo: '', wave: '', hp: '', dash: '', enemies: '', shards: '',
};
let dashMax = 1; // longest dash cooldown seen; used to scale the dash bar.
let lastState = null;
let bannerTimer = 0;
let buttonsBound = false;

export const UI = {
  // Refresh every HUD readout from the shared state. Cheap: only writes
  // the DOM when a value actually changed.
  updateHUD(state) {
    lastState = state;
    const p = state.player;

    const score = formatScore(state.score);
    if (score !== last.score) {
      last.score = score;
      setText(DOM_IDS.score, score);
    }

    const combo = 'x' + state.combo.toFixed(1);
    if (combo !== last.combo) {
      last.combo = combo;
      setText(DOM_IDS.combo, combo);
      const node = el(DOM_IDS.combo);
      if (node) node.classList.toggle('hot', state.combo >= 2);
    }

    const wave = String(state.wave);
    if (wave !== last.wave) {
      last.wave = wave;
      setText(DOM_IDS.wave, wave);
    }

    if (p) {
      const hpFrac = p.maxHp > 0 ? Math.max(0, p.hp / p.maxHp) : 0;
      const hpText = Math.ceil(Math.max(0, p.hp)) + '/' + p.maxHp;
      if (hpText !== last.hp) {
        last.hp = hpText;
        setText(DOM_IDS.hpText, hpText);
        const fill = el(DOM_IDS.hpFill);
        if (fill) fill.style.width = (hpFrac * 100).toFixed(1) + '%';
        if (fill) fill.classList.toggle('low', hpFrac < 0.35);
      }

      // Dash cooldown: track the longest cooldown seen as the bar's max.
      if (p.dashCd > dashMax) dashMax = p.dashCd;
      const ready = p.dashCd <= 0;
      const dashText = ready ? 'READY' : p.dashCd.toFixed(1) + 's';
      if (dashText !== last.dash) {
        last.dash = dashText;
        setText(DOM_IDS.dashText, dashText);
        const fill = el(DOM_IDS.dashFill);
        if (fill) {
          fill.style.width = ready
            ? '100%'
            : ((1 - p.dashCd / dashMax) * 100).toFixed(1) + '%';
        }
        if (fill) fill.classList.toggle('ready', ready);
      }
    }

    const enemies = String(
      state.enemies.length + (state.spawnQueue ? state.spawnQueue.length : 0),
    );
    if (enemies !== last.enemies) {
      last.enemies = enemies;
      setText(DOM_IDS.enemies, enemies);
    }

    const shards = String(state.shards);
    if (shards !== last.shards) {
      last.shards = shards;
      setText(DOM_IDS.shards, shards);
    }
  },

  // Show one screen ('title' | 'upgrade' | 'paused' | 'gameover') or
  // hide them all (null = back to gameplay). The HUD is hidden on the
  // title and game-over screens and visible everywhere else.
  // Optional `data` fills the game-over stats: { score, wave, kills,
  // best, isNewBest }. Without it, the latest HUD state is used.
  showScreen(name, data) {
    for (const key of Object.keys(SCREENS)) {
      setShown(el(SCREENS[key]), key === name);
    }
    setShown(el(DOM_IDS.hud), name !== 'title' && name !== 'gameover');

    if (name === 'gameover') {
      const s = data || lastState;
      if (s) {
        setText(DOM_IDS.finalScore, formatScore(s.score || 0));
        setText(DOM_IDS.finalWave, String(s.wave || 0));
        setText(DOM_IDS.finalKills, String(s.kills || 0));
        const best = data && data.best != null ? data.best : s.best || 0;
        setText(DOM_IDS.finalBest, formatScore(best));
        const isNewBest = !!(data && data.isNewBest);
        setShown(el(DOM_IDS.newBest), isNewBest);
      }
    }
  },

  // Build the 3 upgrade cards and open the upgrade screen. Each choice
  // is { id, name, desc, max, level? } — level defaults to 0 when the
  // caller does not attach the player's current level.
  showUpgrades(choices, onPick) {
    const box = el(DOM_IDS.upgradeCards);
    if (box) {
      box.innerHTML = '';
      for (const choice of choices) {
        const level = choice.level != null ? choice.level : 0;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'upgrade-card';
        card.dataset.upgrade = choice.id;

        const name = document.createElement('h3');
        name.textContent = choice.name;
        card.appendChild(name);

        const desc = document.createElement('p');
        desc.textContent = choice.desc;
        card.appendChild(desc);

        const lvl = document.createElement('span');
        lvl.className = 'upgrade-level';
        lvl.textContent = 'Lv ' + level + ' / ' + choice.max;
        card.appendChild(lvl);

        card.addEventListener('click', () => onPick(choice));
        box.appendChild(card);
      }
    }
    this.showScreen('upgrade');
  },

  // Wire the menu buttons once. Any handler may be omitted.
  bindButtons(handlers) {
    if (buttonsBound) return;
    buttonsBound = true;
    const h = handlers || {};
    const bind = (id, fn) => {
      const node = el(id);
      if (node && fn) node.addEventListener('click', fn);
    };
    bind(DOM_IDS.start, h.onStart);
    bind(DOM_IDS.restart, h.onRestart);
    bind(DOM_IDS.restartPause, h.onRestart);
    bind(DOM_IDS.resume, h.onResume);
    bind(DOM_IDS.mute, h.onMute);
    bind(DOM_IDS.mutePause, h.onMute);
  },

  // Big center announcement ("WAVE 2", "WAVE CLEAR!") with a subtitle.
  // Auto-hides after ~2.2s; calling it again resets the timer.
  banner(text, sub) {
    setText(DOM_IDS.bannerTitle, text);
    setText(DOM_IDS.bannerSub, sub || '');
    const node = el(DOM_IDS.banner);
    if (!node) return;
    node.style.display = '';
    node.classList.add('show');
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => {
      node.classList.remove('show');
      node.style.display = 'none';
    }, 2200);
  },

  // Best score shown on the title screen (and the game-over screen).
  setBest(score) {
    setText(DOM_IDS.titleBest, 'BEST ' + formatScore(score));
    setText(DOM_IDS.finalBest, formatScore(score));
  },
};
