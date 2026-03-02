// src/scripts/utilities/pwa-installer.ts
// PWA Installation Handler

let deferredInstallPrompt: any = null;
let isInstallable = false;

export function initPWAInstaller(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  // Register service worker
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(() => {
        console.log('[PWA] Service worker registered');
      })
      .catch((error) => {
        console.error('[PWA] Service worker registration failed', error);
      });
  });

  // Capture the install prompt event
  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    deferredInstallPrompt = event as any;
    isInstallable = true;

    console.log('[PWA] Install prompt available');

    // Show the install icon on desktop
    showInstallIcon();

    // Dispatch custom event for other components
    window.dispatchEvent(new CustomEvent('cde-pwa-install-available'));
  });

  // Listen for successful installation
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App installed successfully');
    deferredInstallPrompt = null;
    isInstallable = false;
    hideInstallIcon();
  });

  // Check if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[PWA] Already running as installed app');
    isInstallable = false;
  }
}

function showInstallIcon(): void {
  // Wait for desktop to be fully initialized
  setTimeout(() => {
    const desktop = document.getElementById('desktop-icons-container');
    if (!desktop) return;

    // Check if icon already exists
    if (document.getElementById('pwa-install-icon')) return;

    // Find next available position using the same logic as desktop icons
    const gridSize = 100; // CONFIG.DESKTOP_ICONS.GRID_SIZE
    const padding = 20;
    const height = desktop.offsetHeight;

    // Find first empty slot (columns first, CDE style)
    let foundX = padding;
    let foundY = padding;
    let slotFound = false;

    for (let x = padding; x < desktop.offsetWidth - gridSize && !slotFound; x += gridSize) {
      for (let y = padding; y < height - gridSize; y += gridSize) {
        if (!isSlotOccupied(x, y)) {
          foundX = x;
          foundY = y;
          slotFound = true;
          break;
        }
      }
    }

    const icon = document.createElement('div');
    icon.id = 'pwa-install-icon';
    icon.className = 'cde-desktop-icon';
    icon.dataset.system = 'true';
    icon.dataset.id = 'pwa-install-icon';
    icon.dataset.name = 'Install PWA';
    icon.dataset.type = 'system'; // Not 'file' or 'folder'
    icon.style.left = foundX + 'px';
    icon.style.top = foundY + 'px';
    icon.innerHTML = `
      <img src="/icons/actions/system-software-install.png" alt="Install PWA" draggable="false" />
      <span>Install PWA</span>
    `;

    icon.addEventListener(
      'dblclick',
      (e) => {
        e.stopPropagation();
        e.stopImmediatePropagation();
        e.preventDefault();
        installPWA();
      },
      true
    ); // Use capture phase

    desktop.appendChild(icon);
    console.log(`[PWA] Install icon positioned at ${foundX}, ${foundY}`);
  }, 500); // Wait 500ms for desktop to initialize
}

function isSlotOccupied(x: number, y: number): boolean {
  const desktop = document.getElementById('desktop-icons-container');
  if (!desktop) return false;

  const currentIcons = desktop.querySelectorAll('.cde-desktop-icon');
  for (const icon of Array.from(currentIcons)) {
    const el = icon as HTMLElement;
    const iconX = parseInt(el.style.left);
    const iconY = parseInt(el.style.top);

    // Simple coordinate match (with small tolerance)
    if (Math.abs(iconX - x) < 5 && Math.abs(iconY - y) < 5) {
      return true;
    }
  }
  return false;
}

function hideInstallIcon(): void {
  const icon = document.getElementById('pwa-install-icon');
  if (icon) {
    icon.remove();
  }
}

export async function installPWA(): Promise<void> {
  if (!deferredInstallPrompt || !isInstallable) {
    if (window.CDEModal) {
      await window.CDEModal.alert(
        'Installation not available. The app may already be installed or your browser does not support PWA installation.'
      );
    }
    return;
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;

  try {
    // Show the install prompt
    await promptEvent.prompt();

    // Wait for user choice
    const choiceResult = await promptEvent.userChoice;

    if (choiceResult.outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
      isInstallable = false;
      hideInstallIcon();
    } else {
      console.log('[PWA] User dismissed the install prompt');
      deferredInstallPrompt = promptEvent;
    }
  } catch (error) {
    console.error('[PWA] Installation prompt failed', error);
    if (window.CDEModal) {
      await window.CDEModal.alert('Installation failed. Please try again later.');
    }
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  (window as any).installCDEAsApp = installPWA;
}
