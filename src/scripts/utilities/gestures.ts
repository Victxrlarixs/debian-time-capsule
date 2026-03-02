// src/scripts/utilities/gestures.ts
// Shared gesture recognition logic for mobile support (long-press and double-tap)

export interface GestureCallbackConfig {
  onLongPress?: (e: PointerEvent) => void;
  onDoubleTap?: (e: PointerEvent) => void;
  onTap?: (e: PointerEvent) => void;
  thresholdPixels?: number;
  longPressDelay?: number;
  doubleTapDelay?: number;
}

export class GestureManager {
  private lastTapTime = 0;
  private longPressTimer: number | null = null;
  private startX = 0;
  private startY = 0;
  private config: Required<GestureCallbackConfig>;

  constructor(config: GestureCallbackConfig = {}) {
    this.config = {
      onLongPress: config.onLongPress || (() => {}),
      onDoubleTap: config.onDoubleTap || (() => {}),
      onTap: config.onTap || (() => {}),
      thresholdPixels: config.thresholdPixels || 10,
      longPressDelay: config.longPressDelay || 500,
      doubleTapDelay: config.doubleTapDelay || 300,
    };
  }

  /**
   * Processes a pointer down event.
   * Call this from your target element's pointerdown listener.
   */
  public handlePointerDown(e: PointerEvent): void {
    if (this.longPressTimer) window.clearTimeout(this.longPressTimer);

    this.startX = e.clientX;
    this.startY = e.clientY;

    // Setup long-press timer
    this.longPressTimer = window.setTimeout(() => {
      if (
        Math.abs(e.clientX - this.startX) < this.config.thresholdPixels &&
        Math.abs(e.clientY - this.startY) < this.config.thresholdPixels
      ) {
        this.config.onLongPress(e);
      }
      this.longPressTimer = null;
    }, this.config.longPressDelay);

    // Setup double-tap logic
    const now = Date.now();
    if (now - this.lastTapTime < this.config.doubleTapDelay) {
      if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      this.config.onDoubleTap(e);
      this.lastTapTime = 0;
      return;
    }
    this.lastTapTime = now;

    this.config.onTap(e);
  }

  /**
   * Processes a pointer move event.
   * Cancels gestures if the movement exceeds the threshold.
   */
  public handlePointerMove(e: PointerEvent): void {
    if (this.longPressTimer) {
      if (
        Math.abs(e.clientX - this.startX) > this.config.thresholdPixels ||
        Math.abs(e.clientY - this.startY) > this.config.thresholdPixels
      ) {
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
    }
  }

  /**
   * Processes a pointer up event.
   * Cleans up the long-press timer.
   */
  public handlePointerUp(): void {
    if (this.longPressTimer) {
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
}
