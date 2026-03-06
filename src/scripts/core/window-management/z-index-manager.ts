import { CONFIG } from '../config';

/**
 * Manages z-index layers for windows and modals
 */
export class ZIndexManager {
  private highestWindowZIndex: number;
  private highestModalZIndex: number;

  constructor() {
    this.highestWindowZIndex = CONFIG.WINDOW.BASE_Z_INDEX;
    this.highestModalZIndex = 90000;
  }

  /**
   * Returns the next available highest z-index for a specific layer.
   */
  public getNextZIndex(isModal: boolean = false): number {
    if (isModal) {
      return ++this.highestModalZIndex;
    }
    return ++this.highestWindowZIndex;
  }

  /**
   * Returns the current highest z-index across all window layers.
   */
  public getTopZIndex(): number {
    return Math.max(this.highestWindowZIndex, this.highestModalZIndex);
  }
}
