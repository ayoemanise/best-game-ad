// entities.js — NOVA HARVEST gameplay entities.
//
// Factories for the player, bullets, enemies, particles, pickups and
// floating texts, plus updateEntities(): the single per-frame gameplay tick
// (player movement / shooting / dash, bullets, enemies, collisions,
// pickups, particles, texts). Pure gameplay logic — no drawing, no DOM.
//
// The shared state shape comes from GAME_SPEC.md. Tuning is read from
// CONFIG when present and falls back to the defaults below, so this module
// still plays correctly if config.js names a field differently.

import { CONFIG } from './config.js';
import { clamp, lerp, dist, angleTo, TAU } from './utils.js';

// ---------------------------------------------------------------------------
// Tuning (CONFIG overrides when present, same key paths)
// ---------------------------------------------------------------------------

function cfg(path, fallback) {
  let cur = CONFIG;
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object' || !(key in cur)) return fallback;
    cur = cur[key];
  }
  return cur;
}

const W = () => cfg('width', 1280);
const H = () => cfg('height', 800);

export const ENEMY_STATS = {
  drifter:    { hp: 20, speed: 95,  radius: 16, score: 50,  color: '#ff4d6d', damage: 10 },
  weaver:     { hp: 16, speed: 120, radius: 14, score: 70,  color: '#c86bff', damage: 10 },
  splitter:   { hp: 70, speed: 55,  radius: 26, score: 120, color: '#ff9f43', damage: 18 },
  spitter:    { hp: 30, speed: 80,  radius: 17, score: 100, color: '#4dd8ff', damage: 10 },
  minidrifter:{ hp: 10, speed: 170, radius: 11, score: 25,  color: '#ff7a9e', damage: 8 },
};

const PLAYER_BASE = {
  radius: 16, speed: 300, hp: 100,
  fireInterval: 0.16, bulletSpeed: 620, bulletDamage: 10, bulletRadius: 4,
  dashCooldown: 2.2, dashTime: 0.16, dashSpeed: 3.2, magnetRadius: 90,
};

const MAX_PARTICLES = 420;
const MAX_TEXTS = 30;
const COMBO_WINDOW = 3.0;   // seconds a combo stays alive without a pickup
const COMBO_STEP = 8;       // shards per +1 combo, up to x8

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

export function createPlayer(x, y) {
  return {
    x, y, vx: 0, vy: 0, angle: -Math.PI / 2,
    hp: PLAYER_BASE.hp, maxHp: PLAYER_BASE.hp,
    radius: PLAYER_BASE.radius, speed: PLAYER_BASE.speed,
    fireCd: 0, dashCd: 0, dashTime: 0, dashDirX: 0, dashDirY: -1,
    shield: 0, shieldCd: 0, invuln: 0,
    level: {
      fireRate: 0, spread: 0, damage: 0, bulletSpeed: 0, moveSpeed: 0,
      magnet: 0, maxHp: 0, dashRecharge: 0, shield: 0,
    },
  };
}

export function createBullet(x, y, vx, vy, damage, friendly, radius = 4) {
  return { x, y, vx, vy, radius, damage, friendly };
}

export function createEnemy(kind, x, y, scale = 1) {
  const base = ENEMY_STATS[kind] || ENEMY_STATS.drifter;
  const stats = { ...base, ...(cfg(`enemies.${kind}`, {})) };
  const hp = Math.round(stats.hp * scale);
  return {
    kind, x, y, vx: 0, vy: 0,
    hp, maxHp: hp, radius: stats.radius, speed: stats.speed,
    score: stats.score, t: 0, fireCd: 1.5 + Math.random() * 1.0,
    phase: Math.random() * TAU, color: stats.color, damage: stats.damage,
    small: kind === 'minidrifter',
  };
}

export function createParticle(x, y, vx, vy, life, size, color) {
  return { x, y, vx, vy, life, maxLife: life, size, color };
}

export function createPickup(kind, x, y) {
  return {
    kind, x, y, vx: 0, vy: 0,
    value: kind === 'health' ? 20 : 10,
    t: Math.random() * TAU,
  };
}

export function createFloatText(x, y, text, color) {
  return { x, y, text, life: 0.9, color };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sfx(audio, name) {
  if (audio && typeof audio.sfx === 'function') audio.sfx(name);
}

export function spawnBurst(state, x, y, color, n) {
  for (let i = 0; i < n; i++) {
    if (state.particles.length >= MAX_PARTICLES) return;
    const a = state.rng() * TAU;
    const sp = 40 + state.rng() * 260;
    state.particles.push(createParticle(
      x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      0.35 + state.rng() * 0.5, 2 + state.rng() * 3, color,
    ));
  }
}

function waveScale(n) {
  return { hp: 1 + 0.12 * (n - 1), speed: Math.min(1.4, 1 + 0.04 * (n - 1)) };
}

function addScore(state, x, y, base, label) {
  const gained = Math.round(base * state.combo);
  state.score += gained;
  if (state.texts.length < MAX_TEXTS) {
    state.texts.push(createFloatText(x, y, `+${gained}${label || ''}`, '#ffe066'));
  }
}

function damagePlayer(state, amount, audio) {
  const p = state.player;
  if (p.invuln > 0 || p.dashTime > 0 || state.mode !== 'playing') return;
  if (p.shield > 0) {
    p.shield -= 1;
    p.invuln = 0.6;
    spawnBurst(state, p.x, p.y, '#7df9ff', 14);
    sfx(audio, 'hit');
    return;
  }
  p.hp -= amount;
  p.invuln = 0.8;
  state.shake = 14;
  state.flash = 0.55;
  spawnBurst(state, p.x, p.y, '#ff4d6d', 18);
  sfx(audio, 'damage');
  if (p.hp <= 0) {
    p.hp = 0;
    state.mode = 'gameover';
    spawnBurst(state, p.x, p.y, '#5ff2ff', 60);
    spawnBurst(state, p.x, p.y, '#ff4d6d', 40);
    state.shake = 22;
    sfx(audio, 'gameover');
  }
}

function killEnemy(state, enemy, index, audio) {
  const p = state.player;
  addScore(state, enemy.x, enemy.y, enemy.score);
  state.kills += 1;
  spawnBurst(state, enemy.x, enemy.y, enemy.color, enemy.small ? 10 : 22);
  sfx(audio, 'explode');
  // Splitter births two fast mini drifters.
  if (enemy.kind === 'splitter') {
    const scale = waveScale(state.wave).hp;
    for (const off of [-16, 16]) {
      const mini = createEnemy('minidrifter', enemy.x + off, enemy.y + off, scale);
      mini.speed = ENEMY_STATS.minidrifter.speed * waveScale(state.wave).speed;
      state.enemies.push(mini);
    }
  }
  // Drops: mostly a shard, rarely a health cell.
  const roll = state.rng();
  if (roll < 0.72 || enemy.kind === 'splitter') {
    state.pickups.push(createPickup('shard', enemy.x, enemy.y));
    if (enemy.kind === 'splitter') {
      state.pickups.push(createPickup('shard', enemy.x + 18, enemy.y - 12));
      state.pickups.push(createPickup('shard', enemy.x - 18, enemy.y + 12));
    }
  } else if (roll < 0.78) {
    state.pickups.push(createPickup('health', enemy.x, enemy.y));
  }
  state.enemies.splice(index, 1);
}

// ---------------------------------------------------------------------------
// Per-frame gameplay update (only runs while mode === 'playing')
// ---------------------------------------------------------------------------

export function updateEntities(state, dt, input, audio) {
  if (state.mode !== 'playing') return;
  const p = state.player;
  const w = W(), h = H();
  const lv = p.level;

  // Derived stats from upgrade levels.
  const moveSpeed = cfg('player.speed', PLAYER_BASE.speed) * (1 + 0.10 * lv.moveSpeed);
  const fireInterval = cfg('player.fireInterval', PLAYER_BASE.fireInterval) / (1 + 0.18 * lv.fireRate);
  const bulletSpeed = cfg('player.bulletSpeed', PLAYER_BASE.bulletSpeed) * (1 + 0.20 * lv.bulletSpeed);
  const bulletDamage = cfg('player.bulletDamage', PLAYER_BASE.bulletDamage) * (1 + 0.25 * lv.damage);
  const bulletRadius = cfg('player.bulletRadius', PLAYER_BASE.bulletRadius);
  const magnetRadius = cfg('player.magnetRadius', PLAYER_BASE.magnetRadius) * (1 + 0.45 * lv.magnet);
  const dashCooldown = Math.max(0.8, cfg('player.dashCooldown', PLAYER_BASE.dashCooldown) * (1 - 0.18 * lv.dashRecharge));
  const dashTimeLen = cfg('player.dashTime', PLAYER_BASE.dashTime);
  const dashSpeed = cfg('player.dashSpeed', PLAYER_BASE.dashSpeed);

  // --- timers ---------------------------------------------------------------
  p.fireCd -= dt;
  p.dashCd -= dt;
  p.invuln -= dt;
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 1;
      state.comboChain = 0;
    }
  }
  state.shake = Math.max(0, state.shake - dt * 30);
  state.flash = Math.max(0, state.flash - dt * 1.6);

  // --- movement ---------------------------------------------------------------
  let mx = 0, my = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) my -= 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) my += 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) mx -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) mx += 1;
  const mLen = Math.hypot(mx, my);
  if (mLen > 0) { mx /= mLen; my /= mLen; }

  // Dash: Shift or right mouse, with cooldown and brief invulnerability.
  const wantDash = input.pressed('ShiftLeft') || input.pressed('ShiftRight') || input.mouse.rightDown;
  if (wantDash && p.dashCd <= 0 && p.dashTime <= 0) {
    p.dashTime = dashTimeLen;
    p.dashCd = dashCooldown;
    p.invuln = Math.max(p.invuln, dashTimeLen + 0.1);
    if (mLen > 0) { p.dashDirX = mx; p.dashDirY = my; }
    else { p.dashDirX = Math.cos(p.angle); p.dashDirY = Math.sin(p.angle); }
    spawnBurst(state, p.x, p.y, '#5ff2ff', 8);
    sfx(audio, 'dash');
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt;
    p.vx = p.dashDirX * moveSpeed * dashSpeed;
    p.vy = p.dashDirY * moveSpeed * dashSpeed;
  } else {
    const tx = mx * moveSpeed, ty = my * moveSpeed;
    p.vx = lerp(p.vx, tx, Math.min(1, dt * 14));
    p.vy = lerp(p.vy, ty, Math.min(1, dt * 14));
  }
  p.x = clamp(p.x + p.vx * dt, p.radius, w - p.radius);
  p.y = clamp(p.y + p.vy * dt, p.radius, h - p.radius);

  // --- aim + shooting -------------------------------------------------------
  p.angle = angleTo(p.x, p.y, input.mouse.x, input.mouse.y);
  const firing = input.mouse.down || input.isDown('Space');
  if (firing && p.fireCd <= 0) {
    p.fireCd = fireInterval;
    const shots = 1 + lv.spread;
    const spreadStep = 0.13;
    for (let i = 0; i < shots; i++) {
      const off = (i - (shots - 1) / 2) * spreadStep;
      const a = p.angle + off;
      const nx = p.x + Math.cos(a) * (p.radius + 6);
      const ny = p.y + Math.sin(a) * (p.radius + 6);
      state.bullets.push(createBullet(
        nx, ny, Math.cos(a) * bulletSpeed, Math.sin(a) * bulletSpeed,
        bulletDamage, true, bulletRadius,
      ));
    }
    sfx(audio, 'shoot');
  }

  // --- player bullets ---------------------------------------------------------
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -40 || b.x > w + 40 || b.y < -40 || b.y > h + 40) {
      state.bullets.splice(i, 1);
      continue;
    }
    for (let j = state.enemies.length - 1; j >= 0; j--) {
      const e = state.enemies[j];
      const rr = e.radius + b.radius;
      if (dist(b.x, b.y, e.x, e.y) < rr) {
        e.hp -= b.damage;
        // Small knockback so hits feel physical.
        e.vx += (b.vx / bulletSpeed) * 46;
        e.vy += (b.vy / bulletSpeed) * 46;
        spawnBurst(state, b.x, b.y, '#ffe066', 3);
        sfx(audio, 'hit');
        state.bullets.splice(i, 1);
        if (e.hp <= 0) killEnemy(state, e, j, audio);
        break;
      }
    }
  }

  // --- enemies ------------------------------------------------------------------
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.t += dt;
    const d = dist(e.x, e.y, p.x, p.y);
    const a = angleTo(e.x, e.y, p.x, p.y);
    let ex = 0, ey = 0;

    if (e.kind === 'drifter' || e.kind === 'minidrifter') {
      ex = Math.cos(a); ey = Math.sin(a);
    } else if (e.kind === 'weaver') {
      const weave = Math.sin(e.t * 3.2 + e.phase) * 0.85;
      ex = Math.cos(a) - Math.sin(a) * weave;
      ey = Math.sin(a) + Math.cos(a) * weave;
    } else if (e.kind === 'splitter') {
      ex = Math.cos(a); ey = Math.sin(a);
    } else if (e.kind === 'spitter') {
      // Keep a firing distance: back off when close, close in when far.
      if (d < 240) { ex = -Math.cos(a); ey = -Math.sin(a); }
      else if (d > 340) { ex = Math.cos(a); ey = Math.sin(a); }
      else { ex = -Math.sin(a) * 0.4; ey = Math.cos(a) * 0.4; }
      e.fireCd -= dt;
      if (e.fireCd <= 0 && d < 520) {
        e.fireCd = 2.0 + state.rng() * 0.7;
        const lead = 0.25;
        const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
        const fa = angleTo(e.x, e.y, tx, ty);
        const es = 210;
        state.ebullets.push(createBullet(
          e.x + Math.cos(fa) * (e.radius + 4), e.y + Math.sin(fa) * (e.radius + 4),
          Math.cos(fa) * es, Math.sin(fa) * es, 8, false, 5,
        ));
        spawnBurst(state, e.x, e.y, '#4dd8ff', 4);
        sfx(audio, 'shoot');
      }
    }

    const el = Math.hypot(ex, ey) || 1;
    e.vx = lerp(e.vx, (ex / el) * e.speed, Math.min(1, dt * 3));
    e.vy = lerp(e.vy, (ey / el) * e.speed, Math.min(1, dt * 3));
    e.x = clamp(e.x + e.vx * dt, e.radius, w - e.radius);
    e.y = clamp(e.y + e.vy * dt, e.radius, h - e.radius);

    // Contact damage (gated by the player's brief post-hit invulnerability).
    if (d < e.radius + p.radius - 2) {
      damagePlayer(state, e.damage, audio);
      // Push the enemy back a little so it does not stick to the player.
      e.x -= Math.cos(a) * 14;
      e.y -= Math.sin(a) * 14;
      if (state.mode !== 'playing') return;
    }
  }

  // Gentle separation so enemies do not stack into one blob.
  const list = state.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const rr = a.radius + b.radius;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dd = Math.hypot(dx, dy);
      if (dd > 0 && dd < rr) {
        const push = (rr - dd) / 2;
        const nx = dx / dd, ny = dy / dd;
        a.x -= nx * push * 0.5; a.y -= ny * push * 0.5;
        b.x += nx * push * 0.5; b.y += ny * push * 0.5;
      }
    }
  }

  // --- enemy bullets ----------------------------------------------------------
  for (let i = state.ebullets.length - 1; i >= 0; i--) {
    const b = state.ebullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -40 || b.x > w + 40 || b.y < -40 || b.y > h + 40) {
      state.ebullets.splice(i, 1);
      continue;
    }
    if (dist(b.x, b.y, p.x, p.y) < b.radius + p.radius - 2) {
      state.ebullets.splice(i, 1);
      damagePlayer(state, b.damage, audio);
      if (state.mode !== 'playing') return;
    }
  }

  // --- pickups ------------------------------------------------------------------
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.t += dt;
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < magnetRadius) {
      const a = angleTo(pk.x, pk.y, p.x, p.y);
      const pull = 900 * (1 - d / (magnetRadius + 1));
      pk.vx += Math.cos(a) * pull * dt * 10;
      pk.vy += Math.sin(a) * pull * dt * 10;
    } else {
      pk.vx = lerp(pk.vx, 0, Math.min(1, dt * 2));
      pk.vy = lerp(pk.vy, 0, Math.min(1, dt * 2));
    }
    pk.x = clamp(pk.x + pk.vx * dt, 8, w - 8);
    pk.y = clamp(pk.y + pk.vy * dt, 8, h - 8);
    if (d < p.radius + 12) {
      state.pickups.splice(i, 1);
      if (pk.kind === 'shard') {
        state.shards += 1;
        state.comboChain = (state.comboChain || 0) + 1;
        state.combo = 1 + Math.min(7, Math.floor(state.comboChain / COMBO_STEP));
        state.comboTimer = COMBO_WINDOW;
        addScore(state, pk.x, pk.y, pk.value);
        spawnBurst(state, pk.x, pk.y, '#ffe066', 5);
        sfx(audio, 'pickup');
      } else {
        p.hp = Math.min(p.maxHp, p.hp + pk.value);
        if (state.texts.length < MAX_TEXTS) {
          state.texts.push(createFloatText(pk.x, pk.y, `+${pk.value} HP`, '#7dff9e'));
        }
        spawnBurst(state, pk.x, pk.y, '#7dff9e', 8);
        sfx(audio, 'pickup');
      }
    }
  }

  // --- particles + floating texts ------------------------------------------------
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const pt = state.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) { state.particles.splice(i, 1); continue; }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx = lerp(pt.vx, 0, Math.min(1, dt * 2.5));
    pt.vy = lerp(pt.vy, 0, Math.min(1, dt * 2.5));
  }
  for (let i = state.texts.length - 1; i >= 0; i--) {
    const t = state.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) state.texts.splice(i, 1);
  }
}
