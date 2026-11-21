// Ember Vault — keyboard and mouse.
// WASD or arrows move, Shift sneaks, M mutes, and a mouse click throws a
// pebble at that spot (or presses a menu button). Clicks are queued and
// consumed once by the game, so a click never fires twice.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last consume
    this.clickQueue = [];
    this.mouse = { x: 0, y: 0 };

    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) {
        this.keys.add(event.code);
        this.pressed.add(event.code);
      }
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      this.mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    });
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
      this.clickQueue.push({ x, y });
    });
  }

  /** True once for a key pressed since the last call. */
  consumeKey(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** The oldest queued click, or null. */
  consumeClick() {
    return this.clickQueue.shift() ?? null;
  }

  /** The movement vector from the held keys, plus the sneak key. */
  moveVector() {
    let dx = 0;
    let dy = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) dx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) dx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) dy -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) dy += 1;
    return { dx, dy, sneak: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') };
  }

  /** For scripted scenes: hold a key as if the player pressed it. */
  hold(code) {
    this.keys.add(code);
  }

  release(code) {
    this.keys.delete(code);
  }

  releaseAll() {
    this.keys.clear();
  }
}
