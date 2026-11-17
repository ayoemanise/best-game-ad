# NOVA HARVEST

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/ayoemanise/best-game-ad/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/ayoemanise/best-game-ad/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A neon arena survival game — an entry for
[make.fun's "Make the best game" bounty](https://make.fun/bounty/best-game-01)
($1,000, entries close 2026-11-19 01:00 WIB).

Built with [make.fun](https://make.fun/r/v4tk2e29) — referral code `v4tk2e29`.

## The game

Pilot your harvester through the neon void. Blast void creatures, gather star
shards, and survive wave after wave. Clear a wave, pick 1 of 3 upgrades, and
push deeper.

- **Move** WASD / arrow keys · **Aim** mouse · **Fire** hold left click (or
  hold Space) · **Dash** Shift / right click · **Pause** Esc / P · **Mute** M
- **4 enemy types**: Drifters chase, Weavers sine-weave in, Splitters burst
  into two, Spitters keep their distance and shoot back
- **9 upgrades**: fire rate, spread shot, damage, bullet speed, move speed,
  magnet, hull, dash recharge, shield
- **Score + combo**: shards and kills feed a combo multiplier that decays
  over time; best score is kept between runs
- **Feel**: particles, screen shake, floating score text, hit flashes, damage
  vignette, synthesized WebAudio sound effects and an ambient pad — no audio
  or image files, everything is generated in code

## Play it

Open `game/index.html` in a desktop browser (or `node serve.ts` and visit
http://localhost:8080). No build step, no network, no install.

## Structure

- `game/index.html` — canvas, HUD and menus
- `game/style.css` — all styling
- `game/src/main.js` — boot, fixed-timestep loop, mode machine
- `game/src/config.js` — tuning
- `game/src/utils.js` — math and seeded RNG
- `game/src/input.js` — keyboard + mouse
- `game/src/audio.js` — synthesized WebAudio SFX and music
- `game/src/entities.js` — player, enemies, bullets, pickups, particles
- `game/src/waves.js` — wave composition and spawning
- `game/src/upgrades.js` — upgrade pool and choices
- `game/src/render.js` — all drawing
- `game/src/ui.js` — HUD, screens, upgrade cards
- `main.ts` — entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json`
- `screenshots/` — 4 renders of the game (title, gameplay, upgrade choice,
  game over)
