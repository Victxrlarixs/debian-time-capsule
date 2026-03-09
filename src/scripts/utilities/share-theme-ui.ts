// src/scripts/utilities/share-theme-ui.ts
// UI for sharing themes to GitHub Discussions

import { logger } from './logger';
import { ErrorSeverity } from '../core/error-handler';

const DISCUSSIONS_URL =
  'https://github.com/Victxrlarixs/debian-cde/discussions/categories/-dev-random';

// Declare global types
declare global {
  interface Window {
    ShareConfig?: {
      getURL: () => string;
      copy: () => Promise<boolean>;
      load: () => Promise<boolean>;
      encode: () => string;
    };
    shareThemeToDiscussions?: () => Promise<void>;
  }
}

/**
 * Show modal to share theme with community
 */
export async function shareThemeToDiscussions(): Promise<void> {
  const { errorHandler } = await import('../core/error-handler');
  
  await errorHandler.wrapAsync(async () => {
    if (!window.ShareConfig) {
      logger.error('[ShareThemeUI] ShareConfig not available');
      return;
    }

    const themeUrl = window.ShareConfig.getURL();
    const copied = await window.ShareConfig.copy();

    const html = `
      <div style="padding: 15px; max-width: 500px;">
        <p style="margin-bottom: 15px; font-size: 12px; line-height: 1.5;">
          Share your custom CDE theme with the community! Your theme URL has been copied to clipboard.
        </p>
        
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-size: 11px; font-weight: bold;">
            Theme URL:
          </label>
          <input 
            type="text" 
            value="${themeUrl}" 
            readonly 
            onclick="this.select()" 
            style="width: 100%; padding: 8px; font-family: monospace; font-size: 10px; 
                   border: 2px inset; background: white; color: black; box-sizing: border-box;"
          />
          <p style="font-size: 10px; color: #666; margin-top: 5px;">
            ${copied ? 'Copied to clipboard!' : 'Click to select and copy'}
          </p>
        </div>

        <div style="background: #f0f0f0; padding: 10px; border: 1px solid #999; margin-bottom: 15px;">
          <p style="font-size: 11px; margin: 0; line-height: 1.4;">
            <strong>Tip:</strong> Post your theme in GitHub Discussions with a screenshot 
            and description so others can try it!
          </p>
        </div>

        <div style="display: flex; gap: 10px; justify-content: center;">
          <button 
            onclick="window.open('${DISCUSSIONS_URL}', '_blank'); window.CDEModal.close();" 
            class="cde-btn cde-btn-default"
            style="padding: 8px 16px; font-size: 12px;"
          >
            <img src="/icons/apps/konqueror.png" alt="" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 5px;" />
            Share on GitHub
          </button>
        </div>
      </div>
    `;

    await (window as any).CDEModal.open('Share Your Theme', html, []);
    logger.log('[ShareThemeUI] Share modal displayed');
  }, {
    module: 'ShareThemeUI',
    action: 'shareThemeToDiscussions',
    severity: ErrorSeverity.LOW
  });
}

// Export to global scope
if (typeof window !== 'undefined') {
  (window as any).shareThemeToDiscussions = shareThemeToDiscussions;
}
