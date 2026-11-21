// Ember Vault — the thief.
// Moves with the keys, sneaks with Shift, and throws pebbles with the mouse
// to pull guards away. Walking makes a little noise; sneaking almost none.

import { TILE, PLAYER_WALK_SPEED, PLAYER_SNEAK_SPEED, NOISE_WALK_RADIUS, NOISE_SNEAK_RADIUS } from './config.js';
import { isWalkable } from './vision.js';

export class Player {
  constructor(tileX, tileY) {
    this.x = (tileX + 0.5) * TILE;
    this.y = (tileY + 0.5) * TILE;
    this.facing = 0; // radians; the direction the thief looks and throws
    this.sneaking = false;
    this.moving = false;
    this.pebbles = 3;
    this.crystals = 0;
    this.stepPhase = 0;
    this.stepTimer = 0;
  }

  get tileX() {
    return Math.floor(this.x / TILE);
  }

  get tileY() {
    return Math.floor(this.y / TILE);
  }

  /** The noise radius this step, in tiles, for guards to hear. */
  get noiseRadius() {
    if (!this.moving) return 0;
    return this.sneaking ? NOISE_SNEAK_RADIUS : NOISE_WALK_RADIUS;
  }

  canStand(px, py, grid) {
    const r = TILE * 0.26;
    const corners = [
      [px - r, py - r],
      [px + r, py - r],
      [px - r, py + r],
      [px + r, py + r],
    ];
    for (const [cx, cy] of corners) {
      const tx = Math.floor(cx / TILE);
      const ty = Math.floor(cy / TILE);
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return false;
      if (!isWalkable(grid[ty][tx])) return false;
    }
    return true;
  }

  /** Move from the held keys; dx/dy are -1, 0 or 1. */
  update(dt, dx, dy, sneakKey, grid, sound) {
    this.sneaking = sneakKey;
    this.moving = dx !== 0 || dy !== 0;
    if (!this.moving) return;
    const len = Math.hypot(dx, dy);
    const nx = dx / len;
    const ny = dy / len;
    this.facing = Math.atan2(ny, nx);
    const speed = (sneakKey ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED) * TILE;
    const stepX = nx * speed * dt;
    const stepY = ny * speed * dt;
    if (this.canStand(this.x + stepX, this.y, grid)) this.x += stepX;
    if (this.canStand(this.x, this.y + stepY, grid)) this.y += stepY;
    this.stepPhase += dt * (sneakKey ? 5 : 9);
    this.stepTimer += dt;
    if (sound && this.stepTimer > (sneakKey ? 0.55 : 0.38)) {
      this.stepTimer = 0;
      sound.footstep(sneakKey);
    }
  }

  /**
   * Throw a pebble at the mouse position (pixels). The pebble lands after a
   * short arc; the game resolves the noise when it lands.
   */
  throwPebble(targetX, targetY) {
    if (this.pebbles <= 0) return null;
    this.pebbles -= 1;
    this.facing = Math.atan2(targetY - this.y, targetX - this.x);
    return {
      fromX: this.x,
      fromY: this.y,
      toX: targetX,
      toY: targetY,
      t: 0,
      duration: 0.45,
      landed: false,
    };
  }

  /** Advance a thrown pebble; returns true the frame it lands. */
  static stepPebble(pebble, dt) {
    pebble.t += dt / pebble.duration;
    if (pebble.t >= 1 && !pebble.landed) {
      pebble.landed = true;
      return true;
    }
    return false;
  }

  /** The pebble's position along its arc, for drawing. */
  static pebblePosition(pebble) {
    const t = Math.min(1, pebble.t);
    const x = pebble.fromX + (pebble.toX - pebble.fromX) * t;
    const y = pebble.fromY + (pebble.toY - pebble.fromY) * t - Math.sin(t * Math.PI) * 26;
    return { x, y };
  }
}
