// src/scripts/shared/browser-engine.ts
import { logger } from '../utilities/logger';

/**
 * Shared logic for the transparent "2d_" engine used across the project browsers.
 * This ensures Netscape and Lynx use the same infrastructure for external sites
 * without code repetition.
 */

// We use the 2d_ engine from Archive.org as our "Invisible Motor"
// it allows us to bypass X-Frame-Options in Netscape and get a 
// cleaner HTML version for Lynx.
const ENGINE_BASE = 'https://web.archive.org/web/2d_/';

/**
 * Wraps a target URL with the 2d_ engine.
 */
export function getEngineUrl(target: string): string {
    if (!target || target.startsWith('about:') || target.startsWith('lynx://')) {
        return target;
    }

    if (target.includes('archive.org/web/2d_')) return target;

    return `${ENGINE_BASE}${target}`;
}

/**
 * Common fetch helper for Lynx-like text browsers using the project's default engine.
 */
export async function fetchExternalContent(url: string): Promise<string | null> {
    const engineUrl = getEngineUrl(url);

    // We use AllOrigins as an extra bridge because browser fetch() 
    // will hit CORS blocks even on the Archive engine.
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(engineUrl)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.text();
    } catch (e) {
        logger.error(`[BrowserEngine] Failed to fetch: ${e}`);
        return null;
    }
}
