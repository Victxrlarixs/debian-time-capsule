// src/scripts/features/panel.ts
import { moduleLoader } from '../shared/module-loader';

/**
 * App Manager controller stub
 */
const appManagerStub = {
  async open() {
    if (!(window as any).appManager || (window as any).appManager === appManagerStub) {
      await moduleLoader.load('appmanager');
    }
    if (window.appManager && (window.appManager as any) !== appManagerStub) {
      window.appManager.open();
    }
  },
  async close() {
    if (window.appManager && (window.appManager as any) !== appManagerStub) {
      window.appManager.close();
    }
  },
};

/**
 * Generic feature loader stub factory
 */
function createStub(moduleName: string, globalName: string, method: string = 'open') {
  return {
    [method]: async (...args: any[]) => {
      // If not yet loaded or still pointing to a stub
      if (!(window as any)[globalName] || (window as any)[globalName].isStub) {
        await moduleLoader.load(moduleName);
      }
      // Call the real method
      if ((window as any)[globalName] && !(window as any)[globalName].isStub) {
        return (window as any)[globalName][method](...args);
      }
    },
    isStub: true,
  };
}

// Initial stub exposure for all lazy modules
(window as any).appManager = appManagerStub;
(window as any).TerminalLab = createStub('terminal', 'TerminalLab');
(window as any).CalendarManager = createStub('calendar', 'CalendarManager', 'init');
(window as any).openCalendar = async () => {
  await moduleLoader.load('calendar');
  if (window.calendarManager) window.calendarManager.toggle();
};
(window as any).ManViewer = createStub('manviewer', 'ManViewer');
(window as any).Netscape = createStub('netscape', 'Netscape');
(window as any).Lynx = createStub('lynx', 'Lynx');

/**
 * Initialize panel functionality
 */
function initPanel(): void {
  // Workspace switcher
  const workspaceBtns = document.querySelectorAll('.workspace-btn');
  workspaceBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      workspaceBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
    });
  });

  // Dropdown functionality
  setupDropdown('utilitiesBtn', 'utilitiesDropdown');
  setupDropdown('styleManagerBtn', 'styleManagerDropdown');
  setupDropdown('terminalBtn', 'terminalDropdown');
  setupDropdown('browserBtn', 'browserDropdown');

  // Single delegated listener for closing all dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    const dropdownIds = [
      'utilitiesDropdown',
      'styleManagerDropdown',
      'terminalDropdown',
      'browserDropdown',
    ];
    const buttonIds = ['utilitiesBtn', 'styleManagerBtn', 'terminalBtn', 'browserBtn'];

    dropdownIds.forEach((dropdownId, index) => {
      const dropdown = document.getElementById(dropdownId);
      const button = document.getElementById(buttonIds[index]);

      if (dropdown && button) {
        if (!button.contains(e.target as Node) && !dropdown.contains(e.target as Node)) {
          dropdown.classList.remove('show');
          button.setAttribute('aria-expanded', 'false');
        }
      }
    });
  });
}

/**
 * Setup dropdown menu for a button
 */
function setupDropdown(buttonId: string, dropdownId: string): void {
  const button = document.getElementById(buttonId);
  const dropdown = document.getElementById(dropdownId);

  if (!button || !dropdown) return;

  button.addEventListener('click', (e) => {
    e.stopPropagation();

    // Close other dropdowns
    document.querySelectorAll('.dropdown-menu').forEach((menu) => {
      if (menu.id !== dropdownId) {
        menu.classList.remove('show');
      }
    });

    // Toggle current dropdown
    dropdown.classList.toggle('show');
    button.setAttribute('aria-expanded', dropdown.classList.contains('show').toString());

    // Position dropdown above the arrow button
    const rect = button.getBoundingClientRect();
    dropdown.style.left = `${rect.left}px`;
    dropdown.style.bottom = `${window.innerHeight - rect.top + 5}px`;
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPanel);
} else {
  initPanel();
}

export { initPanel, appManagerStub as appManager };
