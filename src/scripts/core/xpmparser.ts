// src/scripts/core/xpmparser.ts
//
// Parses X PixMap (XPM) format used by CDE backdrops (.pm files).
// Maps CDE semantic color names to active CSS theme variables,
// so the backdrop automatically inherits the current theme palette.

import { logger } from '../utilities/logger';

/**
 * CDE semantic color → CSS variable mapping.
 * When the XPM defines `s background`, it means "use the desktop background color".
 * We map that to the active theme variable.
 */
const CDE_SEMANTIC_MAP: Record<string, string> = {
  background: '--window-color',
  selectColor: '--titlebar-color',
  foreground: '--text-color',
  topShadowColor: '--border-light',
  bottomShadowColor: '--border-dark',
  selectBackground: '--dock-color',
  activeForeground: '--titlebar-text-color',
  activeBackground: '--titlebar-color',
  troughColor: '--button-active',
  highlightColor: '--border-light',
  backgroundColor: '--window-color',
};

// Worker pool for parallel processing
let workerPool: Worker[] = [];
let workerIndex = 0;
const MAX_WORKERS = 2;

// Queue for throttling requests
let processingQueue: Array<() => void> = [];
let activeProcessing = 0;
const MAX_CONCURRENT = 3; // Max concurrent parsing operations

function getNextWorker(): Worker | null {
  if (workerPool.length === 0) {
    // Initialize worker pool
    try {
      for (let i = 0; i < MAX_WORKERS; i++) {
        const worker = new Worker(new URL('../workers/xpm-worker.ts', import.meta.url), {
          type: 'module',
        });
        workerPool.push(worker);
      }
    } catch (err) {
      logger.warn('[XPMParser] Worker not available, falling back to main thread');
      return null;
    }
  }

  const worker = workerPool[workerIndex];
  workerIndex = (workerIndex + 1) % workerPool.length;
  return worker;
}

function processQueue(): void {
  while (activeProcessing < MAX_CONCURRENT && processingQueue.length > 0) {
    const next = processingQueue.shift();
    if (next) {
      activeProcessing++;
      next();
    }
  }
}

function hexToRgba(hex: string): {r: number, g: number, b: number, a: number} {
  if (hex === 'transparent') return {r:0, g:0, b:0, a:0};
  
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
  
  return {r, g, b, a: 255};
}

/** Convert 16-bit-per-channel XPM hex (#RRRRGGGGBBBB) to CSS #RRGGBB */
function normalizeXpmColor(raw: string): string {
  if (!raw.startsWith('#')) return raw;
  const hex = raw.slice(1);
  if (hex.length === 12) {
    // Take high byte of each 16-bit channel
    const r = hex.slice(0, 2);
    const g = hex.slice(4, 6);
    const b = hex.slice(8, 10);
    return `#${r}${g}${b}`;
  }
  if (hex.length === 6) return raw;
  return raw;
}

/** Resolve a CDE color entry to an actual CSS color string */
function resolveColor(entry: string, root: CSSStyleDeclaration): string {
  // Check for 'None' (transparent)
  if (entry.toLowerCase() === 'none') return 'transparent';

  // Check for symbolic semantic color: `s semanticName`
  const semanticMatch = entry.match(/s\s+(\w+)/);
  if (semanticMatch) {
    const semanticName = semanticMatch[1];
    const cssVar = CDE_SEMANTIC_MAP[semanticName];
    if (cssVar) {
      const val = root.getPropertyValue(cssVar).trim();
      if (val) return val;
    }
  }

  // Fall back to literal color value: `c #RRRRGGGGBBBB` or `c #RRGGBB`
  const colorMatch = entry.match(/c\s+(#[0-9a-fA-F]+|[a-zA-Z]+)/);
  if (colorMatch) {
    return normalizeXpmColor(colorMatch[1]);
  }

  return '#808080'; // ultimate fallback
}

/** Parse XPM text using worker if available, with throttling and timeout */
async function parseXpmWithWorker(xpmText: string): Promise<string | null> {
  return new Promise((resolve) => {
    const task = () => {
      const worker = getNextWorker();

      if (!worker) {
        // Fallback to main thread
        parseXpmMainThread(xpmText).then((result) => {
          activeProcessing--;
          processQueue();
          resolve(result);
        });
        return;
      }

      // Get theme colors
      const root = getComputedStyle(document.documentElement);
      const themeColors: Record<string, string> = {};
      Object.values(CDE_SEMANTIC_MAP).forEach((cssVar) => {
        themeColors[cssVar] = root.getPropertyValue(cssVar).trim();
      });

      // Generate unique ID for this request
      const requestId = Math.random().toString(36).substring(7);

      const timeout = setTimeout(() => {
        worker.removeEventListener('message', handleMessage);
        activeProcessing--;
        processQueue();
        logger.warn('[XPMParser] Worker timeout, falling back to main thread');
        parseXpmMainThread(xpmText).then(resolve);
      }, 5000); // 5 second timeout

      const handleMessage = (e: MessageEvent) => {
        if (e.data.type === 'result' && e.data.requestId === requestId) {
          clearTimeout(timeout);
          worker.removeEventListener('message', handleMessage);
          activeProcessing--;
          processQueue();
          resolve(e.data.dataUrl);
        }
      };

      worker.addEventListener('message', handleMessage);
      worker.postMessage({ type: 'parse', xpmText, themeColors, requestId });
    };

    processingQueue.push(task);
    processQueue();
  });
}

/** Fallback: Parse XPM on main thread (synchronous) */
async function parseXpmMainThread(xpmText: string): Promise<string | null> {
  try {
    // Strip C-style comments
    const text = xpmText.replace(/\/\*.*?\*\//gs, '');

    // Extract all quoted strings
    const strings = Array.from(text.matchAll(/"(.*?)"/gs)).map((m) => m[1].replace(/\\n/g, ''));

    if (strings.length < 2) {
      return null;
    }

    // Parse header: "width height numColors charsPerPixel"
    const header = strings[0].trim().split(/\s+/).map(Number);
    const [width, height, numColors, cpp] = header;

    if (!width || !height || !numColors || !cpp) {
      return null;
    }

    // Get current theme CSS variables
    const root = getComputedStyle(document.documentElement);

    // Parse color table
    const colorTable: Map<string, string> = new Map();
    for (let i = 1; i <= numColors; i++) {
      const entry = strings[i];
      const symbol = entry.slice(0, cpp);
      const colorDef = entry.slice(cpp).trim();
      colorTable.set(symbol, resolveColor(colorDef, root));
    }

    // Parse pixel rows
    const pixelRows: string[] = [];
    for (let i = numColors + 1; i < strings.length && pixelRows.length < height; i++) {
      if (strings[i].length >= width * cpp) {
        pixelRows.push(strings[i]);
      }
    }

    if (pixelRows.length < height) {
      // Skip incomplete XPM files silently
      return null;
    }

    // Render to canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    
    // Pre-compile color table to RGBA for ultra-fast binary buffer insertion
    const rgbaTable = new Map<string, {r: number, g: number, b: number, a: number}>();
    colorTable.forEach((colorHex, symbol) => {
        rgbaTable.set(symbol, hexToRgba(colorHex));
    });
    const fallbackColor = {r: 128, g: 128, b: 128, a: 255};

    let offset = 0;
    for (let y = 0; y < height; y++) {
      const row = pixelRows[y];
      for (let x = 0; x < width; x++) {
        const symbol = row.slice(x * cpp, x * cpp + cpp);
        const color = rgbaTable.get(symbol) ?? fallbackColor;
        
        data[offset++] = color.r;
        data[offset++] = color.g;
        data[offset++] = color.b;
        data[offset++] = color.a;
      }
    }
    
    ctx.putImageData(imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl;
  } catch (err) {
    return null;
  }
}

/** Parse XPM text and render to a canvas, returning a pattern data URL */
export async function parseXpmToDataUrl(xpmText: string): Promise<string | null> {
  return parseXpmWithWorker(xpmText);
}

/** Fetch a .pm file and render it as a repeating background data URL */
export async function loadXpmBackdrop(path: string): Promise<string | null> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(path);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const text = await res.text();
      const result = await parseXpmToDataUrl(text);

      if (result) {
        if (attempt > 0) {
          logger.log(`[XPMParser] Success on attempt ${attempt + 1} for ${path}`);
        }
        return result;
      } else {
        throw new Error('XPM parsing returned null');
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        logger.warn(`[XPMParser] Attempt ${attempt + 1} failed for ${path}, retrying...`);
        // Wait a bit before retry
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
  }

  logger.error(`[XPMParser] All attempts failed for ${path}:`, lastError);
  return null;
}
