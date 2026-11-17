// upgrades.js — NOVA HARVEST upgrade pool.
//
// Between waves the player picks 1 of 3 upgrades. Each upgrade is stackable
// to a cap; apply(player) raises the level and performs any immediate
// effect (healing, shield). All scaling numbers live here so the pool reads
// as one tuning table; entities.js derives the in-play values from
// player.level each frame.

export const UPGRADES = [
  {
    id: 'fireRate',
    name: 'Rapid Cycler',
    desc: '+18% fire rate. Your harvester spits shards of light faster.',
    max: 5,
    apply(player) { player.level.fireRate += 1; },
  },
  {
    id: 'spread',
    name: 'Split Shot',
    desc: '+1 projectile per shot, fanned out in a wider arc.',
    max: 4,
    apply(player) { player.level.spread += 1; },
  },
  {
    id: 'damage',
    name: 'Heavy Rounds',
    desc: '+25% bullet damage. Void creatures pop that much sooner.',
    max: 5,
    apply(player) { player.level.damage += 1; },
  },
  {
    id: 'bulletSpeed',
    name: 'Hot Rounds',
    desc: '+20% bullet speed. Shots cross the arena before enemies blink.',
    max: 4,
    apply(player) { player.level.bulletSpeed += 1; },
  },
  {
    id: 'moveSpeed',
    name: 'Ion Thrusters',
    desc: '+10% move speed. Outrun anything the void throws at you.',
    max: 5,
    apply(player) { player.level.moveSpeed += 1; },
  },
  {
    id: 'magnet',
    name: 'Tractor Coil',
    desc: '+45% shard magnet radius. Star shards fly to you from afar.',
    max: 4,
    apply(player) { player.level.magnet += 1; },
  },
  {
    id: 'maxHp',
    name: 'Reinforced Hull',
    desc: '+25 max HP and restore 25 HP right now.',
    max: 5,
    apply(player) {
      player.level.maxHp += 1;
      player.maxHp += 25;
      player.hp = Math.min(player.maxHp, player.hp + 25);
    },
  },
  {
    id: 'dashRecharge',
    name: 'Dash Capacitor',
    desc: 'Dash recharges 18% faster. Blink through danger more often.',
    max: 4,
    apply(player) { player.level.dashRecharge += 1; },
  },
  {
    id: 'shield',
    name: 'Aegis Shield',
    desc: 'Gain a shield that blocks one hit, recharged every wave.',
    max: 1,
    apply(player) {
      player.level.shield += 1;
      player.shield = 1;
    },
  },
];

// Roll 3 distinct upgrades the player has not maxed yet, using the run's
// seeded RNG so a seed replays the same offers. Returns fewer than 3 only
// when fewer than 3 upgrades remain unmaxed.
export function rollChoices(state) {
  const level = state.player.level;
  const pool = UPGRADES.filter((u) => (level[u.id] || 0) < u.max);
  // Fisher-Yates shuffle with the run RNG.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}
