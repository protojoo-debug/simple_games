export class InputManager {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  mouseDown = false;
  aimDown = false;
  lookX = 0;
  lookY = 0;
  locked = false;

  constructor(private readonly target: HTMLElement) {
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.target.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  consume(code: string): boolean {
    const has = this.pressed.has(code);
    this.pressed.delete(code);
    return has;
  }

  endFrame(): void {
    this.lookX = 0;
    this.lookY = 0;
    this.pressed.clear();
  }

  requestLock(): void {
    const request = this.target.requestPointerLock();
    if (request instanceof Promise) {
      void request.catch(() => {
        // Embedded preview surfaces may reject pointer lock; desktop browsers accept it after a user click.
      });
    }
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!this.keys.has(event.code)) this.pressed.add(event.code);
    this.keys.add(event.code);
    if (['Space', 'Tab'].includes(event.code)) event.preventDefault();
  };
  private onKeyUp = (event: KeyboardEvent): void => void this.keys.delete(event.code);
  private onMouseMove = (event: MouseEvent): void => {
    if (!this.locked) return;
    this.lookX += event.movementX;
    this.lookY += event.movementY;
  };
  private onMouseDown = (event: MouseEvent): void => {
    if (!this.locked) return;
    if (event.button === 0) this.mouseDown = true;
    if (event.button === 2) this.aimDown = true;
  };
  private onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.mouseDown = false;
    if (event.button === 2) this.aimDown = false;
  };
  private onLockChange = (): void => {
    this.locked = document.pointerLockElement === this.target;
    if (!this.locked) {
      this.mouseDown = false;
      this.aimDown = false;
    }
  };
}
