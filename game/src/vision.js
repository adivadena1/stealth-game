// Ember Vault — sight: line of sight, vision cones and detection.
// A guard sees the player only inside its cone, with a clear line between
// them, and not when the player stands in darkness (unless very close).

import {
  TILE,
  GUARD_SIGHT_RANGE,
  GUARD_CONE_HALF_ANGLE,
  GUARD_CLOSE_RANGE,
  DETECT_BASE_RATE,
  DETECT_LIT_MULTIPLIER,
  DETECT_SNEAK_MULTIPLIER,
  DETECT_CLOSE_MULTIPLIER,
} from './config.js';

/** Tiles that block sight (and movement). */
export function isOpaque(tile) {
  return tile === '#' || tile === 'C' || tile === 'B';
}

export function isWalkable(tile) {
  return tile !== '#' && tile !== 'C' && tile !== 'B';
}

/**
 * True when no opaque tile lies between two points given in pixels.
 * Steps along the segment in quarter-tile steps and tests each sample.
 */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE / 4)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return false;
    if (isOpaque(grid[ty][tx])) return false;
  }
  return true;
}

/** Normalised angle difference, wrapped to [-PI, PI]. */
export function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * The cone test for one guard and the player, in tile units.
 * Returns { seen, rate } — rate is the detection gain per second.
 */
export function guardSeesPlayer(guard, player, grid) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy) / TILE;
  if (dist > GUARD_SIGHT_RANGE) return { seen: false, rate: 0 };
  const angleToPlayer = Math.atan2(dy, dx);
  if (Math.abs(angleDifference(angleToPlayer, guard.facing)) > GUARD_CONE_HALF_ANGLE) {
    return { seen: false, rate: 0 };
  }
  if (!hasLineOfSight(grid, guard.x, guard.y, player.x, player.y)) {
    return { seen: false, rate: 0 };
  }
  const playerTile = grid[Math.floor(player.y / TILE)][Math.floor(player.x / TILE)];
  const inDark = playerTile === 'd';
  if (inDark && dist > GUARD_CLOSE_RANGE) return { seen: false, rate: 0 };
  let rate = DETECT_BASE_RATE * (1 - (dist / GUARD_SIGHT_RANGE) * 0.55);
  if (playerTile === 'L') rate *= DETECT_LIT_MULTIPLIER;
  if (player.sneaking) rate *= DETECT_SNEAK_MULTIPLIER;
  if (dist < GUARD_CLOSE_RANGE) rate *= DETECT_CLOSE_MULTIPLIER;
  return { seen: true, rate };
}

/**
 * Raycast the guard's cone against opaque tiles and return the polygon
 * points (in pixels) used to draw it, plus the far edge distance per ray.
 */
export function conePolygon(guard, grid) {
  const points = [{ x: guard.x, y: guard.y }];
  const rays = 14;
  const rangePx = GUARD_SIGHT_RANGE * TILE;
  for (let i = 0; i <= rays; i += 1) {
    const angle =
      guard.facing - GUARD_CONE_HALF_ANGLE + (2 * GUARD_CONE_HALF_ANGLE * i) / rays;
    let reach = rangePx;
    for (let d = TILE / 2; d <= rangePx; d += TILE / 4) {
      const tx = Math.floor((guard.x + Math.cos(angle) * d) / TILE);
      const ty = Math.floor((guard.y + Math.sin(angle) * d) / TILE);
      if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) {
        reach = d;
        break;
      }
      if (isOpaque(grid[ty][tx])) {
        reach = d;
        break;
      }
    }
    points.push({
      x: guard.x + Math.cos(angle) * reach,
      y: guard.y + Math.sin(angle) * reach,
    });
  }
  return points;
}
