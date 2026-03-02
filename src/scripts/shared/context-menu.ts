// src/scripts/shared/context-menu.ts
// Shared context menu utilities for File Manager and Desktop

import { CONFIG } from '../core/config';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  header?: boolean;
  disabled?: boolean;
  action: () => Promise<void> | void;
}

/**
 * Creates and renders a context menu at the specified position
 * @param items - Array of menu items to display
 * @param x - X coordinate for menu position
 * @param y - Y coordinate for menu position
 * @returns The created menu element
 */
export function createContextMenu(items: ContextMenuItem[], x: number, y: number): HTMLElement {
  const menu = document.createElement('div');
  menu.className = 'fm-contextmenu';
  menu.style.position = 'fixed';
  menu.style.zIndex = String(CONFIG.DROPDOWN.Z_INDEX);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  items.forEach((item) => {
    const div = document.createElement('div');

    if (item.header) {
      div.className = 'fm-context-header';
      div.textContent = item.label;
    } else {
      div.className = 'fm-context-item' + (item.disabled ? ' disabled' : '');

      if (item.icon) {
        const img = document.createElement('img');
        img.src = item.icon;
        img.style.width = '16px';
        img.style.height = '16px';
        img.style.marginRight = '8px';
        img.style.imageRendering = 'pixelated';
        div.appendChild(img);
      }

      const span = document.createElement('span');
      span.textContent = item.label;
      div.appendChild(span);

      if (!item.disabled) {
        div.addEventListener('click', async () => {
          await item.action();
          menu.remove();
        });
      }
    }

    menu.appendChild(div);
  });

  document.body.appendChild(menu);

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = window.innerWidth - rect.width - 5 + 'px';
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = window.innerHeight - rect.height - 5 + 'px';
  }

  return menu;
}
