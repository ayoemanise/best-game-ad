// render.js — pure drawing for NOVA HARVEST (best-game-01).
// No game logic lives here: every frame reads `state` and paints it.
// Glow is done with cached radial-gradient sprites (no shadowBlur in the
// hot paths) so the game holds 60fps. Background stars and nebula blobs
// are generated once from a fixed seed, so they never flicker or move.
import { TAU, createRNG } from './utils.js';

// Logical playfield size (matches CONFIG); draw() scales from w/h given.
const W0 = 1280;
const H0 = 800;

// ---------- cached background pieces (built once) ----------

const bgRng = createRNG(1337);

// Stars: normalized positions so they scale with any canvas size.
const STARS = [];
for (let i = 0; i < 170; i++) {
  STARS.push({
    x: bgRng(),
    y: bgRng(),
    r: 0.6 + bgRng() * 1.4,
    phase: bgRng() * TAU,
    tw: 0.4 + bgRng() * 1.6,
    warm: bgRng() < 0.25,
  });
}

// Nebula blobs: big soft color washes.
const NEBULAE = [];
const NEBULA_COLORS = ['#7c3aed', '#0e7490', '#be185d', '#1d4ed8', '#831843'];
for (let i = 0; i < 6; i++) {
  NEBULAE.push({
    x: bgRng(),
    y: bgRng(),
    r: 0.18 + bgRng() * 0.22,
    color: NEBULA_COLORS[i % NEBULA_COLORS.length],
    alpha: 0.05 + bgRng() * 0.05,
  });
}

// ---------- cached gradients / sprites ----------

const glowCache = new Map(); // color -> 96x96 offscreen canvas
function glowSprite(color) {
  let s = glowCache.get(color);
  if (s) return s;
  s = document.createElement('canvas');
  s.width = 96;
  s.height = 96;
  const g = s.getContext('2d');
  const grad = g.createRadialGradient(48, 48, 0, 48, 48, 48);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 96, 96);
  glowCache.set(color, s);
  return s;
}

function drawGlow(ctx, color, x, y, size, alpha) {
  ctx.globalAlpha = alpha;
  ctx.drawImage(glowSprite(color), x - size / 2, y - size / 2, size, size);
  ctx.globalAlpha = 1;
}

let bgGradKey = '';
let bgGrad = null;
function backgroundGradient(ctx, w, h) {
  const key = w + 'x' + h;
  if (bgGradKey !== key) {
    bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#070718');
    bgGrad.addColorStop(0.55, '#0d0b2e');
    bgGrad.addColorStop(1, '#140a2e');
    bgGradKey = key;
  }
  return bgGrad;
}

let vigKey = '';
let vigGrad = null;
function vignetteGradient(ctx, w, h) {
  const key = w + 'x' + h;
  if (vigKey !== key) {
    const r = Math.hypot(w, h) / 2;
    vigGrad = ctx.createRadialGradient(w / 2, h / 2, r * 0.45, w / 2, h / 2, r);
    vigGrad.addColorStop(0, 'rgba(4,4,18,0)');
    vigGrad.addColorStop(1, 'rgba(4,4,18,0.6)');
    vigKey = key;
  }
  return vigGrad;
}

// ---------- shape helpers ----------

function poly(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * TAU;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function diamond(ctx, x, y, r, rot) {
  poly(ctx, x, y, r, 4, rot);
}

// ---------- enemy drawing (one distinct silhouette per kind) ----------

function drawEnemy(ctx, e, state) {
  const r = e.radius;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (e.kind === 'drifter') {
    drawGlow(ctx, '#e879f9', e.x, e.y, r * 3.2, 0.5);
  } else if (e.kind === 'weaver') {
    drawGlow(ctx, '#22d3ee', e.x, e.y, r * 3.0, 0.45);
  } else if (e.kind === 'splitter') {
    drawGlow(ctx, '#fbbf24', e.x, e.y, r * 2.6, 0.5);
  } else if (e.kind === 'spitter') {
    drawGlow(ctx, '#a78bfa', e.x, e.y, r * 3.0, 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';

  if (e.kind === 'drifter') {
    diamond(ctx, e.x, e.y, r, e.t * 1.5);
    ctx.fillStyle = '#c026d3';
    ctx.fill();
    ctx.strokeStyle = '#f5d0fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#fdf4ff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.28, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'weaver') {
    ctx.fillStyle = '#0891b2';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Two orbiting satellite dots.
    for (let k = 0; k < 2; k++) {
      const a = e.t * 3 + k * Math.PI;
      ctx.fillStyle = '#cffafe';
      ctx.beginPath();
      ctx.arc(e.x + Math.cos(a) * r * 1.5, e.y + Math.sin(a) * r * 1.5, 2.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.3, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'splitter') {
    poly(ctx, e.x, e.y, r, 6, e.t * 0.6);
    ctx.fillStyle = '#b45309';
    ctx.fill();
    ctx.strokeStyle = '#fde68a';
    ctx.lineWidth = 2;
    ctx.stroke();
    poly(ctx, e.x, e.y, r * 0.55, 6, -e.t * 0.6);
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.fillStyle = '#fffbeb';
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 0.16, 0, TAU);
    ctx.fill();
  } else if (e.kind === 'spitter') {
    const aim = Math.atan2(state.player.y - e.y, state.player.x - e.x);
    ctx.translate(e.x, e.y);
    ctx.rotate(aim);
    ctx.beginPath();
    ctx.moveTo(r * 1.2, 0);
    ctx.lineTo(-r * 0.8, -r * 0.85);
    ctx.lineTo(-r * 0.35, 0);
    ctx.lineTo(-r * 0.8, r * 0.85);
    ctx.closePath();
    ctx.fillStyle = '#7c3aed';
    ctx.fill();
    ctx.strokeStyle = '#ddd6fe';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ede9fe';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, TAU);
    ctx.fill();
  }

  // HP bar for damaged enemies.
  if (e.hp < e.maxHp) {
    const bw = r * 2;
    const bx = e.x - bw / 2;
    const by = e.y - r - 9;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#4ade80' : '#fb7185';
    ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), 4);
  }
  ctx.restore();
}

// ---------- player ship ----------

function drawPlayer(ctx, p, state) {
  const r = p.radius;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, '#22d3ee', 0, 0, r * 4, 0.55);
  ctx.globalCompositeOperation = 'source-over';

  // Invulnerability blink while dashing.
  if (p.dashTime > 0) ctx.globalAlpha = 0.55 + 0.35 * Math.sin(state.time * 40);

  ctx.rotate(p.angle);
  // Engine flame, flickering with speed and time.
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > 40) {
    const flick = 0.7 + 0.3 * Math.sin(state.time * 42);
    const fl = (10 + Math.min(16, speed * 0.03)) * flick;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.4);
    ctx.lineTo(-r * 0.8 - fl, 0);
    ctx.lineTo(-r * 0.8, r * 0.4);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
  }
  // Sleek dart hull.
  ctx.beginPath();
  ctx.moveTo(r + 8, 0);
  ctx.lineTo(-r * 0.9, -r * 0.78);
  ctx.lineTo(-r * 0.45, 0);
  ctx.lineTo(-r * 0.9, r * 0.78);
  ctx.closePath();
  ctx.fillStyle = '#0e7490';
  ctx.fill();
  ctx.strokeStyle = '#a5f3fc';
  ctx.lineWidth = 1.8;
  ctx.stroke();
  // Cockpit.
  ctx.fillStyle = '#ecfeff';
  ctx.beginPath();
  ctx.arc(r * 0.3, 0, r * 0.22, 0, TAU);
  ctx.fill();
  ctx.restore();

  // Shield ring (drawn unrotated).
  if (p.shield > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(state.time * 5);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r + 9, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// ---------- main draw ----------

export function draw(state, ctx, w, h) {
  const t = state.time || 0;

  ctx.save();
  // Screen shake on damage / explosions.
  if (state.shake > 0.2) {
    const s = state.shake;
    ctx.translate((Math.random() * 2 - 1) * s, (Math.random() * 2 - 1) * s);
  }

  // Background.
  ctx.fillStyle = backgroundGradient(ctx, w, h);
  ctx.fillRect(-24, -24, w + 48, h + 48);

  // Nebula washes (additive, very low alpha).
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < NEBULAE.length; i++) {
    const n = NEBULAE[i];
    const size = n.r * Math.min(w, h) * 2;
    drawGlow(ctx, n.color, n.x * w, n.y * h, size, n.alpha);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Starfield with gentle twinkle.
  for (let i = 0; i < STARS.length; i++) {
    const s = STARS[i];
    const a = 0.3 + 0.6 * Math.abs(Math.sin(t * s.tw + s.phase));
    ctx.globalAlpha = a;
    ctx.fillStyle = s.warm ? '#ffe9c4' : '#e0f2fe';
    ctx.fillRect(s.x * w, s.y * h, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  // Pickups.
  for (let i = 0; i < state.pickups.length; i++) {
    const pk = state.pickups[i];
    const bob = Math.sin(t * 3 + pk.t * 2) * 2;
    if (pk.kind === 'shard') {
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#fbbf24', pk.x, pk.y + bob, 44, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      diamond(ctx, pk.x, pk.y + bob, 8, pk.t * 2);
      ctx.fillStyle = '#fbbf24';
      ctx.fill();
      ctx.strokeStyle = '#fef3c7';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#fffbeb';
      diamond(ctx, pk.x, pk.y + bob, 3.5, pk.t * 2);
      ctx.fill();
    } else {
      // Health pickup: green orb with a cross.
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, '#34d399', pk.x, pk.y + bob, 40, 0.7);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 9, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#d1fae5';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(pk.x - 1.6, pk.y + bob - 5.5, 3.2, 11);
      ctx.fillRect(pk.x - 5.5, pk.y + bob - 1.6, 11, 3.2);
    }
  }

  // Enemy bullets.
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < state.ebullets.length; i++) {
    const b = state.ebullets[i];
    drawGlow(ctx, '#e879f9', b.x, b.y, 22, 0.8);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#fdf4ff';
  for (let i = 0; i < state.ebullets.length; i++) {
    const b = state.ebullets[i];
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3, 0, TAU);
    ctx.fill();
  }

  // Enemies.
  for (let i = 0; i < state.enemies.length; i++) {
    drawEnemy(ctx, state.enemies[i], state);
  }

  // Player ship.
  const p = state.player;
  if (p && p.hp > 0) drawPlayer(ctx, p, state);

  // Friendly bullets: glowing streaks along their velocity.
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < state.bullets.length; i++) {
    const b = state.bullets[i];
    const len = Math.hypot(b.vx, b.vy) || 1;
    const nx = b.vx / len;
    const ny = b.vy / len;
    ctx.strokeStyle = 'rgba(103,232,249,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x - nx * 12, b.y - ny * 12);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    drawGlow(ctx, '#22d3ee', b.x, b.y, 14, 0.6);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Particles (additive fading dots).
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < state.particles.length; i++) {
    const pt = state.particles[i];
    const a = Math.max(0, pt.life / pt.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size * (0.5 + a * 0.5), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // Floating score texts.
  ctx.textAlign = 'center';
  ctx.font = '700 15px system-ui, -apple-system, "Segoe UI", sans-serif';
  for (let i = 0; i < state.texts.length; i++) {
    const ft = state.texts[i];
    const a = Math.max(0, Math.min(1, ft.life));
    const rise = (1 - a) * 30;
    ctx.globalAlpha = a;
    ctx.fillStyle = ft.color || '#fef3c7';
    ctx.fillText(ft.text, ft.x, ft.y - rise);
  }
  ctx.globalAlpha = 1;

  ctx.restore(); // end shake transform

  // Hit flash (white wash, decays via state.flash).
  if (state.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (state.flash * 0.22).toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);
  }

  // Damage vignette: red edges when HP is low, pulsing; stronger right
  // after a hit (state.flash).
  if (p) {
    const hpFrac = p.maxHp > 0 ? p.hp / p.maxHp : 1;
    const lowHp = hpFrac < 0.35 ? (0.35 - hpFrac) / 0.35 : 0;
    const pulse = 0.6 + 0.4 * Math.sin(t * 6);
    const dmg = Math.max(state.flash * 0.55, lowHp * 0.5 * pulse);
    if (dmg > 0.01) {
      const r = Math.hypot(w, h) / 2;
      const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.5, w / 2, h / 2, r);
      g.addColorStop(0, 'rgba(190,18,60,0)');
      g.addColorStop(1, 'rgba(190,18,60,' + Math.min(0.65, dmg).toFixed(3) + ')');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // Permanent subtle vignette for depth.
  ctx.fillStyle = vignetteGradient(ctx, w, h);
  ctx.fillRect(0, 0, w, h);
}
