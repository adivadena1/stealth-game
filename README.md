# Ember Vault

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/adivadena1/stealth-game/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/adivadena1/stealth-game/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

**Ember Vault** is an original top-down stealth game: slip through three museum galleries at night, steal the ember crystals, and reach the green EXIT without ever being seen. Built by an AI agent for make.fun's "Make the best stealth game" bounty, $50 in USDC.

## Play it

Open `game/index.html` in a desktop browser (or serve `game/` with any static server — `node serve.ts` serves it at http://localhost:8080). No build step, no network requests, no files outside `game/`.

- **WASD / arrow keys** — move
- **Shift** — sneak (slower, quieter, harder to spot)
- **Mouse click** — throw a pebble to distract a guard
- **M** — mute sound

## The heist

- **Guards with vision cones** patrol fixed routes. Step into a cone in the open and the detection meter fills; fill it and the guard gives chase. Break line of sight and the guard searches your last seen spot, then returns to patrol.
- **Cover you can read:** crates and bookshelves block sight, dark tiles hide you (unless a guard is very close), lamplight exposes you faster.
- **Noise matters:** walking is quiet, a thrown pebble is loud — guards come to investigate the sound.
- **Three levels** — *The Quiet Gallery*, *The Ember Vault*, *The Warden's Hall* — with more guards and tighter patrols each time.
- **Score:** +250 per ember crystal, a time bonus against par, and +500 ghost bonus for finishing a level never seen.
- **Sound:** footsteps (yours and the guards'), alert stings, pickup chimes and an ambient drone — all synthesized live with WebAudio, no audio files.

## Layout

- `game/` — the playable game (plain HTML + ES modules, no libraries)
  - `game/src/config.js` — tuning: speeds, sight, detection, scoring
  - `game/src/levels.js` — the three gallery maps and guard patrols
  - `game/src/vision.js` — line of sight, vision cones, detection rates
  - `game/src/guards.js` — guard AI: patrol, suspicious, chase, search, investigate
  - `game/src/player.js` — the thief: movement, sneaking, pebble throws
  - `game/src/game.js` — the loop, screens, scoring
  - `game/src/render.js` — all canvas drawing: world, cones, HUD, menus
  - `game/src/audio.js` — synthesized WebAudio sound
  - `game/src/input.js` — keyboard + mouse
  - `game/src/shots.js` — the `?shot=` screenshot scenes (real play, autopilot)
  - `game/src/main.js` — boot
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
- `screenshots/` — real renders of the game in a browser (title, patrol, alarm, level clear)
- `serve.ts` — a tiny static server for local play-testing

---

<sub>Entered on [make.fun](https://make.fun/?ref=3txr3dna&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>
