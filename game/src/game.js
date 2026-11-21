// Ember Vault — the game itself.
// Parses a level into a grid and entities, runs the loop, and owns the
// state machine: title, briefing, playing, caught, level clear, victory.
// Score: crystals, time left against par, and a ghost bonus for finishing
// a level without ever being spotted.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H } from './config.js';
import { LEVELS } from './levels.js';
import { Guard, GUARD_CHASE } from './guards.js';
import { Player } from './player.js';
import { isWalkable } from './vision.js';
import { SoundEngine } from './audio.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import {
  PEBBLE_START_COUNT,
  PEBBLE_MAX_COUNT,
  CRYSTAL_POINTS,
  GHOST_BONUS,
  TIME_BONUS_PER_SECOND,
  NOISE_PEBBLE_RADIUS,
  ALARM_AT,
  SCREEN_TITLE,
  SCREEN_BRIEFING,
  SCREEN_PLAY,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_WIN,
} from './config.js';

export { SCREEN_TITLE, SCREEN_BRIEFING, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_WIN };

const STEP = 1 / 60;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.sound = new SoundEngine();
    this.input = new Input(canvas);
    this.renderer = new Renderer(this.ctx);
    this.screen = SCREEN_TITLE;
    this.levelIndex = 0;
    this.score = 0;
    this.totalCrystals = 0;
    this.crystalsGot = 0;
    this.timeLeft = 0;
    this.elapsed = 0;
    this.spotted = false; // any guard reached full detection this level
    this.wasSeen = false; // any guard saw the player at all this level
    this.toast = null;
    this.toastTime = 0;
    this.screenTime = 0;
    this.pebble = null;
    this.pebbleLandedAt = null;
    this.noiseRing = null; // {x, y, radius, t} drawn when a noise sounds
    this.grid = [];
    this.guards = [];
    this.player = null;
    this.exitTile = null;
    this.crystals = []; // {x, y, taken}
    this.pebbleCaches = []; // {x, y, taken}
    this.lamps = []; // {x, y} tile centres, in pixels
    this.accumulator = 0;
    this.lastTime = 0;
    this.running = false;
    this.onStateChange = null; // hook for the screenshot scenes
    this.loadLevel(0);
  }

  loadLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    this.grid = def.rows.map((row) => row.split(''));
    this.guards = [];
    this.crystals = [];
    this.pebbleCaches = [];
    this.lamps = [];
    this.totalCrystals = 0;
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const tile = this.grid[y][x];
        const px = (x + 0.5) * TILE;
        const py = (y + 0.5) * TILE;
        if (tile === 'P') {
          this.player = new Player(x, y);
          this.player.pebbles = PEBBLE_START_COUNT;
          this.grid[y][x] = '.';
        } else if (tile === 'X') {
          this.exitTile = { x, y };
        } else if (tile === '*') {
          this.crystals.push({ x: px, y: py, taken: false });
          this.totalCrystals += 1;
          this.grid[y][x] = '.';
        } else if (tile === 'o') {
          this.pebbleCaches.push({ x: px, y: py, taken: false });
          this.grid[y][x] = '.';
        } else if (tile === 'L') {
          this.lamps.push({ x: px, y: py });
        } else if (tile >= '1' && tile <= '4') {
          this.guards.push(new Guard(x, y, def.patrols[tile]));
          this.grid[y][x] = '.';
        }
      }
    }
    this.crystalsGot = 0;
    this.timeLeft = def.parSeconds;
    this.elapsed = 0;
    this.spotted = false;
    this.wasSeen = false;
    this.pebble = null;
    this.noiseRing = null;
  }

  get levelDef() {
    return LEVELS[this.levelIndex];
  }

  showToast(text, seconds = 2.4) {
    this.toast = text;
    this.toastTime = seconds;
  }

  setScreen(screen) {
    this.screen = screen;
    this.screenTime = 0;
    if (this.onStateChange) this.onStateChange(screen);
  }

  startGame() {
    this.score = 0;
    this.loadLevel(0);
    this.setScreen(SCREEN_BRIEFING);
  }

  startLevel() {
    this.setScreen(SCREEN_PLAY);
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.setScreen(SCREEN_WIN);
      this.sound.victory();
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.setScreen(SCREEN_BRIEFING);
  }

  retryLevel() {
    this.loadLevel(this.levelIndex);
    this.setScreen(SCREEN_PLAY);
  }

  /** One fixed step of play. Returns false when nothing changed. */
  step(dt) {
    if (this.screen !== SCREEN_PLAY) return false;
    this.elapsed += dt;
    this.timeLeft = Math.max(0, this.levelDef.parSeconds - this.elapsed);

    const { dx, dy, sneak } = this.input.moveVector();
    this.player.update(dt, dx, dy, sneak, this.grid, this.sound);

    // The player's own footsteps can be heard by nearby guards.
    const noise = this.player.noiseRadius;
    if (noise > 0) {
      for (const guard of this.guards) {
        const dist = Math.hypot(guard.x - this.player.x, guard.y - this.player.y) / TILE;
        if (dist < noise) guard.hearNoise(this.player.x, this.player.y, noise, this.grid);
      }
    }

    for (const guard of this.guards) {
      const before = guard.state;
      guard.update(dt, this.player, this.grid, this.sound);
      if (guard.detection >= ALARM_AT && !this.spotted) {
        this.spotted = true;
        this.sound.alertSting();
        this.showToast('SPOTTED! Break line of sight!', 2.2);
      }
      if (guard.state === GUARD_CHASE && before !== GUARD_CHASE) {
        this.sound.spotted();
      }
      if (guard.detection > 0) this.wasSeen = true;
      if (guard.touches(this.player)) {
        this.caught();
        return false;
      }
    }

    // Thrown pebble: arc, then a loud noise where it lands.
    if (this.pebble) {
      if (Player.stepPebble(this.pebble, dt)) {
        const { toX, toY } = this.pebble;
        this.pebbleLandedAt = { x: toX, y: toY };
        this.noiseRing = { x: toX, y: toY, radius: NOISE_PEBBLE_RADIUS * TILE, t: 0 };
        this.sound.pebbleLand();
        for (const guard of this.guards) {
          guard.hearNoise(toX, toY, NOISE_PEBBLE_RADIUS, this.grid);
        }
        this.pebble = null;
      }
    }
    if (this.noiseRing) {
      this.noiseRing.t += dt;
      if (this.noiseRing.t > 0.7) this.noiseRing = null;
    }

    // Pickups: crystals and pebble caches, by walking over them.
    for (const crystal of this.crystals) {
      if (!crystal.taken && Math.hypot(crystal.x - this.player.x, crystal.y - this.player.y) < TILE * 0.6) {
        crystal.taken = true;
        this.crystalsGot += 1;
        this.player.crystals += 1;
        this.score += CRYSTAL_POINTS;
        this.sound.pickup();
        this.showToast(`Ember crystal ${this.crystalsGot}/${this.totalCrystals}  (+${CRYSTAL_POINTS})`);
      }
    }
    for (const cache of this.pebbleCaches) {
      if (!cache.taken && Math.hypot(cache.x - this.player.x, cache.y - this.player.y) < TILE * 0.6) {
        cache.taken = true;
        this.player.pebbles = Math.min(PEBBLE_MAX_COUNT, this.player.pebbles + 2);
        this.sound.pickup();
        this.showToast('Pebbles restocked (+2)');
      }
    }

    // Exit: step onto the green door to finish the level.
    if (this.exitTile &&
        this.player.tileX === this.exitTile.x && this.player.tileY === this.exitTile.y) {
      this.levelClear();
    }
    return true;
  }

  levelClear() {
    const timeBonus = Math.round(this.timeLeft) * TIME_BONUS_PER_SECOND;
    const ghost = !this.wasSeen ? GHOST_BONUS : 0;
    this.score += timeBonus + ghost;
    this.sound.levelClear();
    this.clearBonus = { timeBonus, ghost };
    this.setScreen(SCREEN_CLEAR);
  }

  caught() {
    this.sound.caughtSting();
    this.setScreen(SCREEN_CAUGHT);
  }

  /** Clicks and keys that act on menus, plus the pebble throw in play. */
  handleAction() {
    this.sound.ensure();
    this.sound.startAmbient();
    const click = this.input.consumeClick();
    if (this.input.consumeKey('KeyM')) {
      const muted = this.sound.toggleMute();
      this.showToast(muted ? 'Sound muted (M)' : 'Sound on (M)');
    }
    if (this.screen === SCREEN_TITLE) {
      if (click || this.input.consumeKey('Enter') || this.input.consumeKey('Space')) this.startGame();
      return;
    }
    if (this.screen === SCREEN_BRIEFING) {
      if (click || this.input.consumeKey('Enter') || this.input.consumeKey('Space')) this.startLevel();
      return;
    }
    if (this.screen === SCREEN_CAUGHT) {
      if (click || this.input.consumeKey('KeyR') || this.input.consumeKey('Enter')) this.retryLevel();
      return;
    }
    if (this.screen === SCREEN_CLEAR) {
      if (click || this.input.consumeKey('Enter') || this.input.consumeKey('Space')) this.nextLevel();
      return;
    }
    if (this.screen === SCREEN_WIN) {
      if (click || this.input.consumeKey('Enter') || this.input.consumeKey('KeyR')) {
        this.startGame();
      }
      return;
    }
    // In play: a mouse click throws a pebble at that spot.
    if (this.screen === SCREEN_PLAY && click) {
      const pebble = this.player.throwPebble(click.x, click.y);
      if (pebble) {
        this.pebble = pebble;
        this.sound.pebbleThrow();
      } else {
        this.showToast('Out of pebbles — find a cache', 1.6);
      }
    }
  }

  frame(now) {
    if (!this.running) return;
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.25) dt = 0.25;
    this.screenTime += dt;
    if (this.toastTime > 0) this.toastTime -= dt;
    this.handleAction();
    this.accumulator += dt;
    let guard = 0;
    while (this.accumulator >= STEP && guard < 5) {
      this.step(STEP);
      this.accumulator -= STEP;
      guard += 1;
    }
    this.renderer.draw(this);
    requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    this.running = true;
    requestAnimationFrame((t) => this.frame(t));
  }

  /** For the screenshot scenes: run the real loop headlessly. */
  runSteps(seconds) {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i += 1) this.step(STEP);
  }
}
