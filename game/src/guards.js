// Ember Vault — guard AI.
// A guard patrols a loop of waypoints and watches its cone. A glimpse
// raises suspicion; a full detection raises the alarm and the guard chases
// the player's last seen position. Lose the trail and the guard searches,
// then walks back to its patrol. Noise (a pebble landing nearby) pulls a
// patrolling guard over to investigate.

import { TILE } from './config.js';
import {
  GUARD_PATROL_SPEED,
  GUARD_CHASE_SPEED,
  GUARD_SEARCH_SPEED,
  SUSPICIOUS_HOLD,
  SEARCH_TIME,
  CHASE_GIVE_UP,
} from './config.js';
import { guardSeesPlayer, hasLineOfSight, isWalkable, angleDifference } from './vision.js';

export const GUARD_PATROL = 'patrol';
export const GUARD_SUSPICIOUS = 'suspicious';
export const GUARD_CHASE = 'chase';
export const GUARD_SEARCH = 'search';
export const GUARD_INVESTIGATE = 'investigate';
export const GUARD_RETURN = 'return';

export class Guard {
  constructor(tileX, tileY, waypoints) {
    this.x = (tileX + 0.5) * TILE;
    this.y = (tileY + 0.5) * TILE;
    this.waypoints = waypoints.map(([wx, wy]) => ({ x: (wx + 0.5) * TILE, y: (wy + 0.5) * TILE }));
    this.waypointIndex = 0;
    this.facing = 0;
    this.state = GUARD_PATROL;
    this.detection = 0; // 0..100, shared meter for this guard
    this.lastSeen = null; // {x, y} in pixels
    this.suspicionAt = null; // {x, y} of a glimpse
    this.stateTime = 0;
    this.loseSightTime = 0;
    this.searchTime = 0;
    this.patrolTimer = 0; // give up on a waypoint that cannot be reached
    this.stepPhase = Math.random() * Math.PI * 2;
    this.stepTimer = 0;
    this.pauseTimer = 0;
  }

  /** Steer toward a point; returns true when arrived. */
  moveToward(tx, ty, speed, dt, grid) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return true;
    const targetAngle = Math.atan2(dy, dx);
    let turn = angleDifference(targetAngle, this.facing);
    const maxTurn = 4.5 * dt;
    turn = Math.max(-maxTurn, Math.min(maxTurn, turn));
    this.facing += turn;
    const step = speed * TILE * dt;
    const nx = this.x + Math.cos(this.facing) * step;
    const ny = this.y + Math.sin(this.facing) * step;
    if (this.canStand(nx, this.y, grid)) this.x = nx;
    if (this.canStand(this.x, ny, grid)) this.y = ny;
    this.stepTimer += dt;
    return dist < TILE * 0.4;
  }

  canStand(px, py, grid) {
    const r = TILE * 0.28;
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

  /** A noise at (x, y) pulls a patrolling or searching guard over. Sound
   *  travels around corners, so walls do not block hearing. */
  hearNoise(x, y, radiusTiles, grid) {
    if (this.state === GUARD_CHASE) return;
    const dist = Math.hypot(x - this.x, y - this.y) / TILE;
    if (dist > radiusTiles) return;
    this.state = GUARD_INVESTIGATE;
    this.lastSeen = { x, y };
    this.stateTime = 0;
  }

  update(dt, player, grid, sound) {
    this.stateTime += dt;
    const sight = guardSeesPlayer(this, player, grid);

    if (sight.seen) {
      this.lastSeen = { x: player.x, y: player.y };
      this.loseSightTime = 0;
      if (this.state === GUARD_PATROL || this.state === GUARD_SEARCH ||
          this.state === GUARD_INVESTIGATE || this.state === GUARD_RETURN) {
        this.state = GUARD_SUSPICIOUS;
        this.suspicionAt = { x: player.x, y: player.y };
        this.stateTime = 0;
      }
      if (this.state === GUARD_SUSPICIOUS && this.stateTime > SUSPICIOUS_HOLD) {
        this.state = GUARD_CHASE;
        this.stateTime = 0;
      }
      this.detection = Math.min(100, this.detection + sight.rate * dt);
      if (this.detection >= 100 && this.state !== GUARD_CHASE) {
        this.state = GUARD_CHASE;
        this.stateTime = 0;
      }
    } else {
      this.loseSightTime += dt;
      this.detection = Math.max(0, this.detection - 26 * dt);
      if (this.state === GUARD_SUSPICIOUS) {
        this.state = GUARD_PATROL;
        this.stateTime = 0;
      }
    }

    switch (this.state) {
      case GUARD_PATROL: {
        if (this.pauseTimer > 0) {
          this.pauseTimer -= dt;
          break;
        }
        const target = this.waypoints[this.waypointIndex];
        this.patrolTimer += dt;
        if (this.moveToward(target.x, target.y, GUARD_PATROL_SPEED, dt, grid) || this.patrolTimer > 8) {
          this.waypointIndex = (this.waypointIndex + 1) % this.waypoints.length;
          this.pauseTimer = 0.7;
          this.patrolTimer = 0;
        }
        break;
      }
      case GUARD_SUSPICIOUS: {
        if (this.suspicionAt) {
          const want = Math.atan2(this.suspicionAt.y - this.y, this.suspicionAt.x - this.x);
          this.facing += Math.max(-3 * dt, Math.min(3 * dt, angleDifference(want, this.facing)));
        }
        break;
      }
      case GUARD_CHASE: {
        if (this.lastSeen) this.moveToward(this.lastSeen.x, this.lastSeen.y, GUARD_CHASE_SPEED, dt, grid);
        if (this.loseSightTime > CHASE_GIVE_UP) {
          this.state = GUARD_SEARCH;
          this.searchTime = 0;
          this.stateTime = 0;
        }
        break;
      }
      case GUARD_SEARCH: {
        this.searchTime += dt;
        if (this.lastSeen) {
          const arrived = this.moveToward(this.lastSeen.x, this.lastSeen.y, GUARD_SEARCH_SPEED, dt, grid);
          if (arrived) this.facing += dt * 1.8; // look around the spot
        }
        if (this.searchTime > SEARCH_TIME) {
          this.state = GUARD_RETURN;
          this.stateTime = 0;
        }
        break;
      }
      case GUARD_INVESTIGATE: {
        if (this.lastSeen) {
          const arrived = this.moveToward(this.lastSeen.x, this.lastSeen.y, GUARD_SEARCH_SPEED, dt, grid);
          if (arrived) {
            this.state = GUARD_SEARCH;
            this.searchTime = 0;
            this.stateTime = 0;
          }
        } else {
          this.state = GUARD_PATROL;
        }
        break;
      }
      case GUARD_RETURN: {
        const target = this.waypoints[this.waypointIndex];
        if (this.moveToward(target.x, target.y, GUARD_PATROL_SPEED, dt, grid)) {
          this.state = GUARD_PATROL;
          this.stateTime = 0;
        }
        break;
      }
      default:
        break;
    }

    // Footsteps: the player hears a nearby guard walk.
    if (sound && this.stepTimer > 0.42) {
      this.stepTimer = 0;
      const dist = Math.hypot(player.x - this.x, player.y - this.y) / TILE;
      sound.guardStep(dist);
    }
  }

  /** True when this guard is close enough to grab the player. */
  touches(player) {
    return Math.hypot(player.x - this.x, player.y - this.y) < TILE * 0.62;
  }
}
