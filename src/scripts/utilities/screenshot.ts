import { CONFIG } from '../core/config';
import { CDEModal } from '../ui/modals';
import { logger } from './logger';
import { WindowManager } from '../core/windowmanager';

// ============================================================================
// Screenshot capture
// ============================================================================

// Declaration for html2canvas (assumed to be loaded globally)
declare function html2canvas(element: HTMLElement, options?: any): Promise<HTMLCanvasElement>;

const DISCUSSIONS_URL =
  'https://github.com/Victxrlarixs/debian-cde/discussions/categories/-dev-random';

/**
 * Saves a screenshot from a data URL.
 */
function saveScreenshot(dataUrl: string): void {
  const now = new Date();
  const filename = `${CONFIG.SCREENSHOT.FILENAME_PREFIX}-${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now
    .getHours()
    .toString()
    .padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')}.${now
    .getSeconds()
    .toString()
    .padStart(2, '0')}.png`;

  logger.log(`[Screenshot] Generated filename: ${filename}`);

  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
  logger.log('[Screenshot] Download triggered');
}

/**
 * Opens GitHub Discussions for sharing screenshot
 */
function shareToDiscussions(dataUrl: string): void {
  logger.log('[Screenshot] Opening GitHub Discussions for sharing');
  window.open(DISCUSSIONS_URL, '_blank');
  CDEModal.close();
}

/**
 * Captures a full-page screenshot using html2canvas.
 */
export function captureFullPageScreenshot(): void {
  logger.log('[Screenshot] Starting screenshot capture');

  const btn = document.getElementById('screenshot-btn') as HTMLElement | null;

  if (btn) {
    logger.log('[Screenshot] Setting button to loading state');
    btn.style.opacity = '0.5';
    btn.style.cursor = 'wait';
  }

  const toast = document.createElement('div');
  toast.textContent = CONFIG.SCREENSHOT.TOAST_MESSAGE;
  toast.className = 'screenshot-toast';
  document.body.appendChild(toast);
  logger.log('[Screenshot] Toast notification displayed');

  const options = {
    scale: CONFIG.SCREENSHOT.SCALE,
    backgroundColor: null,
    allowTaint: false,
    useCORS: true,
    logging: false,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    onclone: (clonedDoc: Document) => {
      logger.log('[Screenshot] Processing cloned document for capture');
      const clonedToast = clonedDoc.querySelector('.screenshot-toast');
      if (clonedToast) {
        (clonedToast as HTMLElement).style.display = 'none';
        logger.log('[Screenshot] Toast hidden in cloned document');
      }
      const clonedBtn = clonedDoc.getElementById('screenshot-btn');
      if (clonedBtn) {
        (clonedBtn as HTMLElement).style.display = 'none';
      }
      const clonedPanel = clonedDoc.getElementById('cde-panel');
      if (clonedPanel) {
        (clonedPanel as HTMLElement).style.overflow = 'visible';
        logger.log('[Screenshot] Panel overflow set to visible for complete capture');
      }
    },
  };

  logger.log(`[Screenshot] Capture options: scale=${CONFIG.SCREENSHOT.SCALE}, useCORS=true`);

  html2canvas(document.documentElement, options)
    .then(async (canvas: HTMLCanvasElement) => {
      logger.log('[Screenshot] Canvas generated successfully');

      const dataUrl = canvas.toDataURL('image/png');
      const resolution = `${canvas.width}x${canvas.height}`;
      const sizeBytes = Math.round((dataUrl.length * 3) / 4);
      const sizeStr = formatBytes(sizeBytes);

      const html = `
        <div class="screenshot-preview-container">
          <img src="${dataUrl}" class="screenshot-preview-image" />
          <div class="screenshot-info">
            Resolution: ${resolution} | Est. Size: ${sizeStr}
          </div>
        </div>
        <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
          <button 
            onclick="window.saveScreenshot('${dataUrl}'); window.CDEModal.close();" 
            class="cde-btn cde-btn-default"
            style="padding: 8px 16px; font-size: 12px;"
          >
            <img src="/icons/devices/floppy.png" alt="" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;" />
            Save
          </button>
          <button 
            onclick="window.shareToDiscussions('${dataUrl}');" 
            class="cde-btn"
            style="padding: 8px 16px; font-size: 12px;"
          >
            <img src="/icons/apps/konqueror.png" alt="" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;" />
            Post to Discussions
          </button>
        </div>
      `;

      if (document.body.contains(toast)) document.body.removeChild(toast);

      CDEModal.open('SnapShot Viewer', html, []);

      const modal = document.getElementById('cde-modal-global');
      if (modal) {
        requestAnimationFrame(() => WindowManager.centerWindow(modal));
        setTimeout(() => WindowManager.centerWindow(modal), 100);
      }

      if (btn) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        logger.log('[Screenshot] Button restored to normal state');
      }

      logger.log(`[Screenshot] Capture process finished`);
    })
    .catch((error: any) => {
      console.error('[Screenshot] Error during capture:', error);

      if (document.body.contains(toast)) {
        document.body.removeChild(toast);
        logger.log('[Screenshot] Toast removed after error');
      }

      if (btn) {
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        logger.log('[Screenshot] Button restored after error');
      }

      CDEModal.alert('Error capturing screenshot.').then(() => {
        logger.log('[Screenshot] Error alert displayed to user');
      });
    });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ============================================================================
// Global exposure
// ============================================================================

declare global {
  interface Window {
    captureFullPageScreenshot: () => void;
    saveScreenshot: (dataUrl: string) => void;
    shareToDiscussions: (dataUrl: string) => void;
  }
}

window.captureFullPageScreenshot = captureFullPageScreenshot;
window.saveScreenshot = saveScreenshot;
window.shareToDiscussions = shareToDiscussions;

logger.log('[Screenshot] Module loaded and ready');
