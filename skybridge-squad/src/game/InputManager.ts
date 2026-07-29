import { clamp } from "../utils/math";

export class InputManager {
  public horizontal = 0;
  private pointerTarget = 0;
  private dragging = false;
  private mouseTracking = false;
  private specialQueued = false;
  private pointerMoved = false;

  public constructor(
    private readonly element: HTMLElement,
    private readonly halfWidth: number,
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    element.addEventListener("pointerdown", this.onPointerDown);
    element.addEventListener("pointermove", this.onPointerMove);
    element.addEventListener("pointerup", this.onPointerUp);
    element.addEventListener("pointercancel", this.onPointerUp);
    element.addEventListener("contextmenu", this.preventDefault);
  }

  private readonly keys = new Set<string>();

  public update(currentX: number): number {
    const keyboard =
      (this.keys.has("ArrowRight") || this.keys.has("KeyD") ? 1 : 0) -
      (this.keys.has("ArrowLeft") || this.keys.has("KeyA") ? 1 : 0);
    this.horizontal = keyboard;
    if (keyboard !== 0) return keyboard;
    if (!this.dragging && !this.mouseTracking) return 0;
    const delta = this.pointerTarget - currentX;
    return clamp(delta * 1.8, -1, 1);
  }

  public consumeSpecial(): boolean {
    const queued = this.specialQueued;
    this.specialQueued = false;
    return queued;
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.removeEventListener("contextmenu", this.preventDefault);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === "Space") {
      event.preventDefault();
      this.specialQueued = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly pointerToWorld = (clientX: number): number => {
    const rect = this.element.getBoundingClientRect();
    const normalized = ((clientX - rect.left) / rect.width) * 2 - 1;
    // 카메라가 +Z 방향을 바라보므로 화면의 오른쪽은 월드의 -X 방향이다.
    return clamp(-normalized * this.halfWidth, -this.halfWidth, this.halfWidth);
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.dragging = true;
    this.mouseTracking = event.pointerType === "mouse";
    this.pointerMoved = false;
    this.pointerTarget = this.pointerToWorld(event.clientX);
    this.element.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === "mouse") this.mouseTracking = true;
    if (!this.dragging && !this.mouseTracking) return;
    const nextTarget = this.pointerToWorld(event.clientX);
    if (this.dragging && Math.abs(this.pointerTarget - nextTarget) > 0.08) {
      this.pointerMoved = true;
    }
    this.pointerTarget = nextTarget;
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (this.dragging && !this.pointerMoved) this.specialQueued = true;
    this.dragging = false;
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
  };

  private readonly preventDefault = (event: Event): void => event.preventDefault();
}
