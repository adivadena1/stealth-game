// Ember Vault — screenshot scenes behind ?shot=title|patrol|alarm|clear.
// Each scene plays the real rules forward from a fresh level: the autopilot
// issues the same key holds a player would, and it only moves where the
// game's own vision test says the player is unseen right now (waiting in
// cover when a cone sweeps past). The frame is therefore what a short real
// game looks like, and the same scene always gives the same frame.

import { TILE } from './config.js';
import { SCREEN_TITLE, SCREEN_BRIEFING, SCREEN_PLAY, SCREEN_CLEAR } from './config.js';
import { guardSeesPlayer, isWalkable } from './vision.js';

const STEP = 1 / 60;

/** Would any guard see the player if it stood at (x, y) pixels? */
function wouldBeSeen(game, x, y) {
  const probe = { x, y, sneaking: true };
  for (const guard of game.guards) {
    if (guardSeesPlayer(guard, probe, game.grid).seen) return true;
  }
  return false;
}

/**
 * Breadth-first tile path from (sx, sy) to (tx, ty) through walkable tiles,
 * as a list of [x, y] tiles not counting the start. Empty when unreachable.
 */
function findPath(game, sx, sy, tx, ty) {
  const grid = game.grid;
  const key = (x, y) => y * 100 + x;
  const prev = new Map();
  const queue = [[sx, sy]];
  prev.set(key(sx, sy), null);
  while (queue.length > 0) {
    const [x, y] = queue.shift();
    if (x === tx && y === ty) {
      const path = [];
      let at = [x, y];
      while (at) {
        path.unshift(at);
        at = prev.get(key(at[0], at[1]));
      }
      path.shift(); // the start tile itself
      return path;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (ny < 0 || ny >= grid.length || nx < 0 || nx >= grid[0].length) continue;
      if (!isWalkable(grid[ny][nx])) continue;
      if (prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), [x, y]);
      queue.push([nx, ny]);
    }
  }
  return [];
}

/**
 * One autopilot step along a BFS path toward a target tile: steer to the
 * next path tile's centre, but only when the step ahead stays unseen —
 * otherwise wait in cover for the cone to pass. Returns true when the
 * player stands on the target tile.
 */
function autopilotStep(game, path, targetTileX, targetTileY) {
  const player = game.player;
  if (path.length === 0) {
    const fresh = findPath(game, player.tileX, player.tileY, targetTileX, targetTileY);
    path.push(...fresh);
  }
  const next = path[0];
  if (!next) return true;
  const cx = (next[0] + 0.5) * TILE;
  const cy = (next[1] + 0.5) * TILE;
  const dx = cx - player.x;
  const dy = cy - player.y;
  if (Math.hypot(dx, dy) < 5) {
    path.shift();
    return player.tileX === targetTileX && player.tileY === targetTileY;
  }
  // Step toward the centre, one axis at a time (the dominant one first).
  const step = 1.8 * TILE * STEP;
  let key = null;
  let nx = player.x;
  let ny = player.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    key = dx > 0 ? 'KeyD' : 'KeyA';
    nx = player.x + Math.sign(dx) * step;
  } else {
    key = dy > 0 ? 'KeyS' : 'KeyW';
    ny = player.y + Math.sign(dy) * step;
  }
  game.input.releaseAll();
  if (!wouldBeSeen(game, nx, ny)) {
    game.input.hold(key);
    game.input.hold('ShiftLeft');
  }
  return false;
}

/** Drive the player along a list of waypoints, in real steps. When
 *  stopOnChase is set, return the moment a guard gives chase. The held
 *  keys are always released on the way out, so the player never walks on
 *  after the scene ends. */
function followWaypoints(game, waypoints, maxSeconds, stopOnChase = false) {
  const steps = Math.round(maxSeconds / STEP);
  const path = [];
  const done = () => {
    game.input.releaseAll();
  };
  for (let i = 0; i < steps; i += 1) {
    if (game.screen !== SCREEN_PLAY) return done();
    if (stopOnChase && game.guards.some((g) => g.state === 'chase')) return done();
    const target = waypoints[0];
    if (!target) return done();
    if (autopilotStep(game, path, target[0], target[1])) {
      waypoints.shift();
      path.length = 0;
    }
    game.step(STEP);
  }
  done();
}

/**
 * Stage a scene and return the screen to draw over it.
 * title: the title screen over level 1. patrol: mid-level sneaking with
 * cones sweeping. alarm: the player caught in the open, guard chasing.
 * clear: level 1 finished unseen, on the clear screen.
 */
export function stageShot(name, game) {
  game.loadLevel(0);
  if (name !== 'patrol' && name !== 'alarm' && name !== 'clear') {
    game.setScreen(SCREEN_TITLE);
    return;
  }
  game.setScreen(SCREEN_PLAY);
  if (name === 'patrol') {
    // Sneak up the left gallery, pause behind the crates at the dark tiles,
    // then edge toward the first crystal while the patrol sweeps past.
    followWaypoints(game, [[3, 7], [5, 9], [8, 9], [9, 12], [11, 12]], 40);
    return;
  }
  if (name === 'alarm') {
    // Sneak to tile (22, 13), right in front of guard 1's top patrol leg,
    // and wait there. The autopilot only moves while unseen, so it arrives
    // between patrols; as soon as a guard gives chase, stop: the frame
    // catches the red cone, the full detection meter and the guard running in.
    followWaypoints(game, [[3, 7], [5, 9], [8, 9], [11, 9], [15, 13], [19, 13], [22, 13]], 90, true);
    for (let i = 0; i < 18 / STEP; i += 1) {
      if (game.screen !== SCREEN_PLAY) return;
      if (game.guards.some((g) => g.state === 'chase')) return;
      game.step(STEP);
    }
    return;
  }
  // clear: ghost level 1 — collect two crystals, then take the gap in the
  // middle wall and walk the right hall to the exit.
  followWaypoints(game, [[3, 8], [5, 8], [8, 8], [9, 12], [11, 12], [11, 9]], 60);
  followWaypoints(game, [[15, 6], [18, 6], [18, 2], [22, 2], [25, 1], [27, 1]], 60);
  if (game.screen === SCREEN_PLAY) {
    // The autopilot waits for a safe window; give it more time if needed.
    followWaypoints(game, [[27, 1]], 30);
  }
  if (game.screen !== SCREEN_CLEAR) {
    // Fallback: the frame still shows real play, just not the clear screen.
    game.showToast('Ember Vault — Level 1', 3);
  }
}
