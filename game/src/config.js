// NOVA HARVEST — tuning numbers and palette.
// Every number the game runs on lives here so balancing is one file.
export const CONFIG = {
  canvas: { width: 1280, height: 800 },
  width: 1280, // top-level copies: waves.js / entities.js read CONFIG.width
  height: 800, // and CONFIG.height directly.
  step: 1 / 60,
  storageKey: 'nova-harvest-best',

  colors: {
    background: '#070a1a',
    nebula: ['#1b2a6b', '#4b1d6b', '#0e3a4d'],
    star: '#cfe8ff',
    player: '#37f6ff',
    playerGlow: '#19b8ff',
    bullet: '#aefcff',
    bulletEnemy: '#ff5d7a',
    shard: '#ffd94d',
    health: '#54ff9f',
    text: '#eaf6ff',
    danger: '#ff3b5c',
    enemies: {
      drifter: '#ff4d6d',
      weaver: '#c86bff',
      splitter: '#ff9f43',
      spitter: '#7dff5e',
    },
  },

  player: {
    radius: 16,
    speed: 340,
    accel: 2600,
    friction: 6.5,
    hp: 100,
    maxHp: 100,
    fireRate: 7, // shots per second at level 0
    bulletSpeed: 720,
    bulletDamage: 12,
    bulletRadius: 5,
    dashSpeed: 980,
    dashTime: 0.16,
    dashCooldown: 2.2,
    dashInvuln: 0.35,
    magnetRadius: 110,
    invulnAfterHit: 0.6,
  },

  bullets: { radius: 5, life: 1.1 },

  enemies: {
    drifter: {
      hp: 24, speed: 120, radius: 16, score: 100,
      color: '#ff4d6d', contact: 10,
    },
    weaver: {
      hp: 30, speed: 150, radius: 15, score: 150,
      color: '#c86bff', contact: 12,
      weaveAmp: 90, weaveFreq: 3.2,
    },
    splitter: {
      hp: 90, speed: 55, radius: 30, score: 250,
      color: '#ff9f43', contact: 16, children: 2,
    },
    spitter: {
      hp: 40, speed: 95, radius: 17, score: 200,
      color: '#7dff5e', contact: 10,
      fireRange: 520, fireInterval: 2.2, bulletSpeed: 260,
    },
  },

  waves: {
    baseBudget: 6, // enemies in wave 1
    budgetPerWave: 4, // extra enemies per wave
    spawnInterval: 0.55, // seconds between spawns
    announceTime: 1.6, // seconds the wave banner shows
    maxAlive: 26,
  },

  combo: {
    window: 4, // seconds before the combo resets
    max: 8, // maximum multiplier
    perShard: 0.05, // multiplier gained per shard
  },

  pickups: {
    shardValue: 50,
    healthValue: 25,
    healthDropChance: 0.06,
    magnetSpeed: 520,
    collectRadius: 26,
    shardLife: 14, // seconds before a shard fades
  },

  particles: { max: 420 },
  texts: { max: 24 },

  // Stack caps for the upgrade pool (mirrored by upgrades.js UPGRADES).
  upgrades: {
    fireRate: 5,
    spread: 3,
    damage: 5,
    bulletSpeed: 5,
    moveSpeed: 5,
    magnet: 5,
    maxHp: 5,
    dashRecharge: 5,
    shield: 3,
  },
};
