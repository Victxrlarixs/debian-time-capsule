import { CONFIG } from '../config';
import { logger } from '../../utilities/logger';
import type { ISessionStorage } from '../interfaces/window-manager.interface';

interface DragState {
  element: HTMLElement | null;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  startLeft: number;
  startTop: number;
  lastX: number;
  lastY: number;
  isDragging: boolean;
}

/**
 * Manages window dragging with pointer events
 */
export class DragManager {
  private dragState: DragState;
  private sessionStorage: ISessionStorage;
  private onFocusWindow: (id: string) => void;
  private onNormalizePosition: (win: HTMLElement) => void;

  constructor(
    sessionStorage: ISessionStorage,
    onFocusWindow: (id: string) => void,
    onNormalizePosition: (win: HTMLElement) => void
  ) {
    this.sessionStorage = sessionStorage;
    this.onFocusWindow = onFocusWindow;
    this.onNormalizePosition = onNormalizePosition;
    this.dragState = {
      element: null,
      offsetX: 0,
      offsetY: 0,
      startX: 0,
      startY: 0,
      startLeft: 0,
      startTop: 0,
      lastX: 0,
      lastY: 0,
      isDragging: false,
    };
  }

  private isMobile(): boolean {
    return window.innerWidth < 768;
  }

  public isDragging(): boolean {
    return this.dragState.isDragging;
  }

  /**
   * Initiates dragging of a window
   */
  public startDrag(e: PointerEvent, id: string): void {
    if (this.isMobile()) {
      logger.log(`[DragManager] Drag disabled on mobile for window: ${id}`);
      return;
    }

    if (!e.isPrimary) return;

    const el = document.getElementById(id);
    if (!el) return;

    e.preventDefault();
    e.stopPropagation();

    if (window.getComputedStyle(el).transform !== 'none') {
      this.onNormalizePosition(el);
    }

    this.onFocusWindow(id);

    const rect = el.getBoundingClientRect();
    this.dragState.element = el;
    this.dragState.offsetX = e.clientX - rect.left;
    this.dragState.offsetY = e.clientY - rect.top;
    this.dragState.lastX = e.clientX;
    this.dragState.lastY = e.clientY;
    this.dragState.isDragging = true;

    el.setPointerCapture(e.pointerId);

    // X11-style move cursor
    document.documentElement.style.setProperty(
      '--cde-cursor-override',
      "url('/icons/cursors/cursor-move.svg') 12 12, move"
    );
    document.body.style.cursor = `url('/icons/cursors/cursor-move.svg') 12 12, move`;

    el.style.willChange = 'transform, left, top';

    el.addEventListener('pointermove', this.move, { passive: false });
    el.addEventListener('pointerup', this.stopDrag, { passive: false });
    el.addEventListener('pointercancel', this.stopDrag, { passive: false });

    logger.log(`[DragManager] Drag started for "${id}"`);
  }

  private move = (e: PointerEvent): void => {
    if (!this.dragState.element || !this.dragState.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const accelStr = getComputedStyle(document.documentElement).getPropertyValue(
      '--mouse-acceleration'
    );
    const acceleration = parseFloat(accelStr) || 1;

    const deltaX = e.clientX - this.dragState.lastX;
    const deltaY = e.clientY - this.dragState.lastY;

    let currentLeft = parseFloat(this.dragState.element.style.left || '0');
    let currentTop = parseFloat(this.dragState.element.style.top || '0');

    let left = currentLeft + deltaX * acceleration;
    let top = currentTop + deltaY * acceleration;

    this.dragState.lastX = e.clientX;
    this.dragState.lastY = e.clientY;

    const winWidth = this.dragState.element.offsetWidth;
    const winHeight = this.dragState.element.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const TOP_BAR_HEIGHT = CONFIG.WINDOW.TOP_BAR_HEIGHT;
    const PANEL_HEIGHT = this.isMobile() ? 65 : 85;

    const minX = 0;
    const maxX = Math.max(0, viewportWidth - winWidth);
    const minY = TOP_BAR_HEIGHT;
    const maxY = Math.max(minY, viewportHeight - winHeight - PANEL_HEIGHT);

    left = Math.max(minX, Math.min(left, maxX));
    top = Math.max(minY, Math.min(top, maxY));

    const opaque = document.documentElement.getAttribute('data-opaque-drag') !== 'false';
    if (!opaque) {
      this.dragState.element.classList.add('dragging-wireframe');
    }

    this.dragState.element.style.left = left + 'px';
    this.dragState.element.style.top = top + 'px';
  };

  private stopDrag = (e: PointerEvent): void => {
    if (!this.dragState.element || !this.dragState.isDragging) return;

    e.preventDefault();
    e.stopPropagation();

    const el = this.dragState.element;
    el.releasePointerCapture(e.pointerId);
    el.removeEventListener('pointermove', this.move);
    el.removeEventListener('pointerup', this.stopDrag);
    el.removeEventListener('pointercancel', this.stopDrag);

    el.style.willChange = 'auto';
    document.body.style.cursor = '';

    el.classList.remove('dragging-wireframe');
    this.dragState.isDragging = false;

    // Save session
    this.sessionStorage.saveWindowState(el.id, {
      left: el.style.left,
      top: el.style.top,
      maximized: el.classList.contains('maximized'),
    });

    this.dragState.element = null;
    logger.log(`[DragManager] Drag stopped`);
  };
}
