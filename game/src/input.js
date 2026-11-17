// NOVA HARVEST — keyboard + mouse input, in canvas coordinates.
// pressed(code) is edge-triggered: true for the frame the key went down,
// cleared by endFrame() (called once per frame by main.js).
export const Input = {
  keys: new Set(),
  mouse: { x: 0, y: 0, down: false, rightDown: false },
  _pressed: new Set(),
  _click: false,
  _canvas: null,

  init(canvas) {
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (!e.repeat) {
        this._pressed.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouse.down = false;
      this.mouse.rightDown = false;
    });

    canvas.addEventListener('pointermove', (e) => {
      const p = this._toCanvas(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
    });
    canvas.addEventListener('pointerdown', (e) => {
      const p = this._toCanvas(e);
      this.mouse.x = p.x;
      this.mouse.y = p.y;
      if (e.button === 0) {
        this.mouse.down = true;
        this._click = true;
      } else if (e.button === 2) {
        this.mouse.rightDown = true;
      }
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  },

  // Map a pointer event to logical canvas coordinates (canvas is CSS-scaled).
  _toCanvas(e) {
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this._canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this._canvas.height / rect.height),
    };
  },

  isDown(code) {
    return this.keys.has(code);
  },

  pressed(code) {
    return this._pressed.has(code);
  },

  // True once after a left click on the canvas; consumed on read.
  consumeClick() {
    const c = this._click;
    this._click = false;
    return c;
  },

  // Called once per frame by the main loop; clears edge-triggered presses.
  endFrame() {
    this._pressed.clear();
  },
};
