import { CONFIG } from '../config';
import { logger } from '../../utilities/logger';

/**
 * Manages panel dropdown menus
 */
export class DropdownManager {
  private setupDropdown(btnId: string, menuId: string): void {
    const dropdownBtn = document.getElementById(btnId);
    const dropdownMenu = document.getElementById(menuId);

    if (!dropdownBtn || !dropdownMenu) {
      logger.warn(`[DropdownManager] Elements not found for ${btnId}/${menuId}`, {
        btn: !!dropdownBtn,
        menu: !!dropdownMenu,
      });
      return;
    }

    logger.log(`[DropdownManager] Initializing dropdown: ${menuId}`);
    let lastToggleTime = 0;

    dropdownBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const now = Date.now();
      if (now - lastToggleTime < 300) return;
      lastToggleTime = now;

      const isOpen = dropdownBtn.classList.contains('open');

      if (!isOpen) {
        dropdownBtn.classList.add('open');
        const rect = dropdownBtn.getBoundingClientRect();

        dropdownMenu.style.position = 'fixed';
        dropdownMenu.style.zIndex = String(CONFIG.DROPDOWN.Z_INDEX);
        dropdownMenu.style.display = 'block';

        const menuRect = dropdownMenu.getBoundingClientRect();
        dropdownMenu.style.bottom = window.innerHeight - rect.top + CONFIG.DROPDOWN.OFFSET + 'px';
        dropdownMenu.style.left = rect.left + rect.width / 2 - menuRect.width / 2 + 'px';

        logger.log(`[DropdownManager] Dropdown ${menuId} opened`);
      } else {
        dropdownBtn.classList.remove('open');
        dropdownMenu.style.display = 'none';
        logger.log(`[DropdownManager] Dropdown ${menuId} closed`);
      }
    });

    document.addEventListener('pointerdown', (e) => {
      const now = Date.now();
      if (now - lastToggleTime < 300) return;

      if (!dropdownBtn.contains(e.target as Node) && !dropdownMenu.contains(e.target as Node)) {
        if (dropdownBtn.classList.contains('open')) {
          dropdownBtn.classList.remove('open');
          dropdownMenu.style.display = 'none';
          logger.log(`[DropdownManager] Dropdown ${menuId} closed from outside click`);
        }
      }
    });

    dropdownMenu.style.display = 'none';
  }

  public initDropdowns(): void {
    this.setupDropdown('utilitiesBtn', 'utilitiesDropdown');
    this.setupDropdown('styleManagerBtn', 'styleManagerDropdown');
    this.setupDropdown('terminalBtn', 'terminalDropdown');
    this.setupDropdown('browserBtn', 'browserDropdown');
  }
}
