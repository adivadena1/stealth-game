// Ember Vault — everything drawn on the canvas.
// The museum at night: dark tiled floors, lamplight pools, crates and
// bookshelves you can read at a glance, guards in red with their vision
// cones, the thief in a violet hood, and the green exit door. The HUD and
// every menu screen are drawn here too, so the screenshots show the game
// exactly as the player sees it.

import { TILE, COLS, ROWS, VIEW_W, VIEW_H, COLORS } from './config.js';
import {
  SCREEN_TITLE,
  SCREEN_BRIEFING,
  SCREEN_PLAY,
  SCREEN_CAUGHT,
  SCREEN_CLEAR,
  SCREEN_WIN,
} from './config.js';
import { conePolygon } from './vision.js';
import { Player } from './player.js';
import { GUARD_CHASE, GUARD_SUSPICIOUS, GUARD_SEARCH, GUARD_INVESTIGATE } from './guards.js';

const FONT = "'Trebuchet MS', 'Segoe UI', sans-serif";

export class Renderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  draw(game) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#0a0910';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (game.screen === SCREEN_TITLE) {
      this.drawTitle(game);
      return;
    }
    this.drawWorld(game);
    if (game.screen === SCREEN_BRIEFING) this.drawBriefing(game);
    if (game.screen === SCREEN_CAUGHT) this.drawCaught(game);
    if (game.screen === SCREEN_CLEAR) this.drawClear(game);
    if (game.screen === SCREEN_WIN) this.drawWin(game);
    if (game.screen === SCREEN_PLAY) this.drawHud(game);
  }

  // ---- the world ----------------------------------------------------------

  drawWorld(game) {
    const ctx = this.ctx;
    const grid = game.grid;
    // Floor.
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const tile = grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (tile === 'd') {
          ctx.fillStyle = COLORS.shadow;
        } else {
          ctx.fillStyle = (x + y) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
        }
        ctx.fillRect(px, py, TILE, TILE);
        if (tile === 'd') {
          ctx.fillStyle = 'rgba(120, 110, 190, 0.10)';
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        } else {
          ctx.strokeStyle = COLORS.floorTrim;
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        }
      }
    }
    // Lamplight pools on the floor.
    for (const lamp of game.lamps) {
      const glow = ctx.createRadialGradient(lamp.x, lamp.y, 6, lamp.x, lamp.y, TILE * 2.1);
      glow.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
      glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(lamp.x - TILE * 2.1, lamp.y - TILE * 2.1, TILE * 4.2, TILE * 4.2);
    }
    // Crystals, pebble caches and the exit door.
    for (const crystal of game.crystals) {
      if (crystal.taken) continue;
      const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 300 + crystal.x);
      this.drawCrystal(crystal.x, crystal.y, pulse);
    }
    for (const cache of game.pebbleCaches) {
      if (cache.taken) continue;
      ctx.fillStyle = '#b9b3c9';
      ctx.beginPath();
      ctx.arc(cache.x - 5, cache.y + 3, 3, 0, Math.PI * 2);
      ctx.arc(cache.x + 5, cache.y - 2, 3, 0, Math.PI * 2);
      ctx.arc(cache.x + 2, cache.y + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (game.exitTile) this.drawExit(game.exitTile.x * TILE, game.exitTile.y * TILE);
    // Walls, crates, bookshelves.
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const tile = grid[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (tile === '#') {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px, py, TILE, TILE);
          ctx.fillStyle = COLORS.wallTop;
          ctx.fillRect(px, py, TILE, 5);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(px, py + TILE - 4, TILE, 4);
        } else if (tile === 'C') {
          ctx.fillStyle = COLORS.crate;
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = COLORS.crateTop;
          ctx.fillRect(px + 3, py + 3, TILE - 6, 5);
          ctx.strokeStyle = '#3d2c15';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
          ctx.beginPath();
          ctx.moveTo(px + 3, py + 3);
          ctx.lineTo(px + TILE - 3, py + TILE - 3);
          ctx.moveTo(px + TILE - 3, py + 3);
          ctx.lineTo(px + 3, py + TILE - 3);
          ctx.stroke();
        } else if (tile === 'B') {
          ctx.fillStyle = COLORS.shelf;
          ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
          ctx.fillStyle = COLORS.shelfTop;
          ctx.fillRect(px + 2, py + 2, TILE - 4, 4);
          ctx.fillStyle = '#7a5a80';
          for (let i = 0; i < 3; i += 1) {
            ctx.fillRect(px + 6 + i * 8, py + 10, 5, 12);
          }
        }
      }
    }
    // Lamps themselves.
    for (const lamp of game.lamps) {
      ctx.fillStyle = '#2c2438';
      ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
      ctx.fillStyle = COLORS.lampGlow;
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Vision cones, under the guards.
    for (const guard of game.guards) {
      const alerted = guard.state === GUARD_CHASE || guard.state === GUARD_SUSPICIOUS;
      const poly = conePolygon(guard, grid);
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
      ctx.fillStyle = alerted ? COLORS.coneAlert : COLORS.coneCalm;
      ctx.fill();
      ctx.strokeStyle = alerted ? 'rgba(229,72,77,0.6)' : COLORS.coneEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Noise ring from a landed pebble.
    if (game.noiseRing) {
      const ring = game.noiseRing;
      const alpha = 1 - ring.t / 0.7;
      ctx.strokeStyle = `rgba(255, 220, 120, ${0.7 * alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius * (0.3 + 0.7 * (ring.t / 0.7)), 0, Math.PI * 2);
      ctx.stroke();
    }
    // Guards and the player.
    for (const guard of game.guards) this.drawGuard(guard);
    this.drawPlayer(game.player);
    // The pebble in flight.
    if (game.pebble) {
      const pos = Player.pebblePosition(game.pebble);
      ctx.fillStyle = '#cfc9dd';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    // Darkness vignette, so the night feels like night.
    const vignette = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  drawCrystal(x, y, pulse) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 1.25);
    ctx.fillStyle = COLORS.crystal;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 0);
    ctx.lineTo(0, 9);
    ctx.lineTo(-7, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(3, -1);
    ctx.lineTo(0, 2);
    ctx.lineTo(-3, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawExit(px, py) {
    const ctx = this.ctx;
    const glow = 0.55 + 0.25 * Math.sin(performance.now() / 400);
    ctx.fillStyle = `rgba(57, 217, 138, ${glow * 0.25})`;
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = COLORS.exit;
    ctx.fillRect(px + 4, py + 2, TILE - 8, TILE - 4);
    ctx.fillStyle = '#0b2e1d';
    ctx.font = `bold 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', px + TILE / 2, py + TILE / 2 + 1);
  }

  drawGuard(guard) {
    const ctx = this.ctx;
    const alerted = guard.state === GUARD_CHASE;
    const suspicious = guard.state === GUARD_SUSPICIOUS ||
      guard.state === GUARD_SEARCH || guard.state === GUARD_INVESTIGATE;
    // Body: a red cloak with a helmet.
    ctx.save();
    ctx.translate(guard.x, guard.y);
    const bob = Math.sin(guard.stepPhase) * 1.2;
    ctx.fillStyle = COLORS.guardBody;
    ctx.beginPath();
    ctx.moveTo(0, -11 + bob * 0.3);
    ctx.lineTo(9, 8);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = alerted ? '#ff5a5f' : COLORS.guard;
    ctx.beginPath();
    ctx.arc(0, -4 + bob * 0.3, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // Facing tick: the direction the guard looks.
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(guard.facing) * 7, -4 + Math.sin(guard.facing) * 7);
    ctx.lineTo(Math.cos(guard.facing) * 13, -4 + Math.sin(guard.facing) * 13);
    ctx.stroke();
    ctx.restore();
    // State mark above the head.
    if (alerted || suspicious) {
      ctx.font = `bold 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = alerted ? '#ff5a5f' : '#ffd166';
      ctx.fillText(alerted ? '!' : '?', guard.x, guard.y - 15);
    }
    // Personal detection meter, when partly filled.
    if (guard.detection > 1 && guard.detection < 100) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(guard.x - 13, guard.y - 26, 26, 5);
      ctx.fillStyle = guard.detection > 60 ? '#ff5a5f' : '#ffd166';
      ctx.fillRect(guard.x - 12, guard.y - 25, 24 * (guard.detection / 100), 3);
    }
  }

  drawPlayer(player) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(player.x, player.y);
    const crouch = player.sneaking ? 0.82 : 1;
    const bob = Math.sin(player.stepPhase) * (player.moving ? 1.4 : 0);
    // Violet hooded cloak.
    ctx.fillStyle = COLORS.playerCloak;
    ctx.beginPath();
    ctx.moveTo(0, -10 * crouch + bob * 0.3);
    ctx.lineTo(9, 9);
    ctx.lineTo(-9, 9);
    ctx.closePath();
    ctx.fill();
    // Hood.
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.arc(0, -3 * crouch + bob * 0.3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#241a3d';
    ctx.beginPath();
    ctx.arc(Math.cos(player.facing) * 2, -3 * crouch + Math.sin(player.facing) * 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // A faint ring while sneaking, so the player reads the quiet state.
    if (player.sneaking) {
      ctx.strokeStyle = 'rgba(232, 228, 245, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // ---- HUD and screens ----------------------------------------------------

  drawHud(game) {
    const ctx = this.ctx;
    const highest = game.guards.reduce((m, g) => Math.max(m, g.detection), 0);
    const anyChase = game.guards.some((g) => g.state === GUARD_CHASE);
    ctx.fillStyle = 'rgba(8, 7, 14, 0.82)';
    ctx.fillRect(0, 0, VIEW_W, 34);
    ctx.fillStyle = COLORS.hud;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${game.levelDef.name}  ·  Level ${game.levelIndex + 1}/3`, 12, 17);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `13px ${FONT}`;
    ctx.fillText(`◆ ${game.crystalsGot}/${game.totalCrystals}   ● ${game.player.pebbles} pebbles`, 300, 17);
    ctx.fillText(`Time ${Math.ceil(game.timeLeft)}s   Score ${game.score}`, 520, 17);
    ctx.textAlign = 'right';
    ctx.fillStyle = anyChase ? '#ff5a5f' : COLORS.hudDim;
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillText(anyChase ? '! ALARM !' : 'M: sound', VIEW_W - 12, 17);
    // Detection bar, top centre of the play area.
    if (highest > 1) {
      const w = 220;
      const x = (VIEW_W - w) / 2;
      const y = 42;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(x - 2, y - 2, w + 4, 12);
      ctx.fillStyle = highest > 60 ? '#ff5a5f' : '#ffd166';
      ctx.fillRect(x, y, w * (highest / 100), 8);
      ctx.fillStyle = '#fff';
      ctx.font = `bold 10px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('SEEN', x + w / 2, y + 4);
    }
    // Toast line.
    if (game.toast && game.toastTime > 0) {
      ctx.fillStyle = 'rgba(8, 7, 14, 0.8)';
      const w = ctx.measureText(game.toast).width + 28;
      ctx.fillRect((VIEW_W - w) / 2, VIEW_H - 52, w, 28);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = `bold 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(game.toast, VIEW_W / 2, VIEW_H - 37);
    }
    // Controls hint, bottom left.
    ctx.fillStyle = 'rgba(232, 228, 245, 0.55)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText('WASD / arrows move · Shift sneak · Click throws a pebble', 12, VIEW_H - 12);
  }

  dimOverlay(alpha = 0.72) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(6, 5, 12, ${alpha})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  panel(y, height) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(16, 13, 28, 0.92)';
    ctx.strokeStyle = '#4a4266';
    ctx.lineWidth = 2;
    const w = 640;
    const x = (VIEW_W - w) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, height, 14);
    ctx.fill();
    ctx.stroke();
  }

  drawTitle(game) {
    const ctx = this.ctx;
    // A moody backdrop: the museum floor, a few lamps and one guard cone.
    this.drawWorld(game);
    this.dimOverlay(0.62);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.crystal;
    ctx.font = `bold 64px ${FONT}`;
    ctx.fillText('EMBER VAULT', VIEW_W / 2, 170);
    ctx.fillStyle = COLORS.hud;
    ctx.font = `22px ${FONT}`;
    ctx.fillText('A quiet heist in three galleries', VIEW_W / 2, 212);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Slip past the guards. Take the ember crystals.', VIEW_W / 2, 268);
    ctx.fillText('Reach the green EXIT unseen — and leave no trace.', VIEW_W / 2, 294);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText('WASD / arrows — move      Shift — sneak      Click — throw a pebble', VIEW_W / 2, 360);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('Dark tiles hide you · Lamplight exposes you · Pebbles distract guards', VIEW_W / 2, 392);
    ctx.fillStyle = COLORS.exit;
    ctx.font = `bold 20px ${FONT}`;
    const blink = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = blink;
    ctx.fillText('—  Click or press Enter to begin  —', VIEW_W / 2, 470);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `13px ${FONT}`;
    ctx.fillText('An original game · keyboard + mouse · sound on for footsteps (M mutes)', VIEW_W / 2, 540);
  }

  drawBriefing(game) {
    const ctx = this.ctx;
    this.dimOverlay(0.66);
    this.panel(150, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.hud;
    ctx.font = `bold 30px ${FONT}`;
    ctx.fillText(`Level ${game.levelIndex + 1} — ${game.levelDef.name}`, VIEW_W / 2, 205);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `17px ${FONT}`;
    ctx.fillText(game.levelDef.subtitle, VIEW_W / 2, 242);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `16px ${FONT}`;
    ctx.fillText(`◆ ${game.totalCrystals} ember crystals   ·   ${game.guards.length} guards on patrol`, VIEW_W / 2, 292);
    ctx.fillText(`Par time ${game.levelDef.parSeconds}s   ·   Ghost bonus +${500} if never seen`, VIEW_W / 2, 322);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `15px ${FONT}`;
    ctx.fillText('Hide in the dark. Wait out a patrol. Throw a pebble to pull a guard away.', VIEW_W / 2, 362);
    ctx.fillStyle = COLORS.exit;
    ctx.font = `bold 18px ${FONT}`;
    const blink = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = blink;
    ctx.fillText('—  Click or press Enter to start  —', VIEW_W / 2, 412);
    ctx.globalAlpha = 1;
  }

  drawCaught(game) {
    const ctx = this.ctx;
    this.dimOverlay(0.68);
    this.panel(170, 260);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a5f';
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText('CAUGHT!', VIEW_W / 2, 235);
    ctx.fillStyle = COLORS.hud;
    ctx.font = `18px ${FONT}`;
    ctx.fillText('A guard grabbed you in the lamplight.', VIEW_W / 2, 280);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `16px ${FONT}`;
    ctx.fillText(`Level ${game.levelIndex + 1} · Score ${game.score} · Crystals ${game.crystalsGot}/${game.totalCrystals}`, VIEW_W / 2, 316);
    ctx.fillText('Tip: wait in the dark until the cone turns away, then move.', VIEW_W / 2, 348);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `bold 17px ${FONT}`;
    const blink = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = blink;
    ctx.fillText('—  Press R or click to try the level again  —', VIEW_W / 2, 396);
    ctx.globalAlpha = 1;
  }

  drawClear(game) {
    const ctx = this.ctx;
    this.dimOverlay(0.6);
    this.panel(150, 300);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.exit;
    ctx.font = `bold 36px ${FONT}`;
    ctx.fillText('LEVEL CLEAR', VIEW_W / 2, 205);
    ctx.fillStyle = COLORS.hud;
    ctx.font = `18px ${FONT}`;
    ctx.fillText(game.wasSeen ? 'You were seen — but you slipped away.' : 'A perfect ghost. No guard ever saw you.', VIEW_W / 2, 250);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `17px ${FONT}`;
    const bonus = game.clearBonus || { timeBonus: 0, ghost: 0 };
    ctx.fillText(`Crystals ${game.crystalsGot}/${game.totalCrystals}   ·   Time bonus +${bonus.timeBonus}`, VIEW_W / 2, 296);
    ctx.fillText(`Ghost bonus +${bonus.ghost}   ·   Score ${game.score}`, VIEW_W / 2, 326);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `15px ${FONT}`;
    ctx.fillText(game.levelIndex + 1 >= 3 ? 'That was the last gallery.' : 'The next gallery waits.', VIEW_W / 2, 366);
    ctx.fillStyle = COLORS.exit;
    ctx.font = `bold 18px ${FONT}`;
    const blink = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = blink;
    ctx.fillText(game.levelIndex + 1 >= 3 ? '—  Click to see your score  —' : '—  Click or press Enter for the next level  —', VIEW_W / 2, 412);
    ctx.globalAlpha = 1;
  }

  drawWin(game) {
    const ctx = this.ctx;
    this.dimOverlay(0.66);
    this.panel(140, 330);
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.crystal;
    ctx.font = `bold 40px ${FONT}`;
    ctx.fillText('THE VAULT IS YOURS', VIEW_W / 2, 200);
    ctx.fillStyle = COLORS.hud;
    ctx.font = `19px ${FONT}`;
    ctx.fillText('Three galleries, three clean getaways.', VIEW_W / 2, 248);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(`Final score: ${game.score}`, VIEW_W / 2, 300);
    ctx.fillStyle = COLORS.hudDim;
    ctx.font = `16px ${FONT}`;
    ctx.fillText('Ember Vault — an original stealth game.', VIEW_W / 2, 344);
    ctx.fillText('Thank you for playing. The night is quiet again.', VIEW_W / 2, 370);
    ctx.fillStyle = COLORS.exit;
    ctx.font = `bold 17px ${FONT}`;
    const blink = 0.65 + 0.35 * Math.sin(performance.now() / 350);
    ctx.globalAlpha = blink;
    ctx.fillText('—  Press R or click to play again  —', VIEW_W / 2, 428);
    ctx.globalAlpha = 1;
  }
}
