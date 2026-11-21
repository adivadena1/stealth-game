// Ember Vault — boot.
// Builds the game, stages a screenshot scene when ?shot= is present, and
// starts the animation loop. No network, no build step: the module scripts
// below are the whole game.

import { Game } from './game.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) {
  stageShot(shot, game);
  game.renderer.draw(game);
  // Expose the staged state for the screenshot harness.
  window.__emberVault = game;
} else {
  game.start();
  window.__emberVault = game;
}
