// Web Worker for XPM parsing

interface XPMParseMessage {
  type: 'parse';
  xpmText: string;
  themeColors: Record<string, string>;
  requestId: string;
}

interface XPMParseResult {
  type: 'result';
  dataUrl: string | null;
  requestId: string;
  error?: string;
}

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

function normalizeXpmColor(raw: string): string {
  if (!raw.startsWith('#')) return raw;
  const hex = raw.slice(1);
  if (hex.length === 12) {
    const r = hex.slice(0, 2);
    const g = hex.slice(4, 6);
    const b = hex.slice(8, 10);
    return `#${r}${g}${b}`;
  }
  if (hex.length === 6) return raw;
  return raw;
}

function resolveColor(entry: string, themeColors: Record<string, string>): string {
  if (entry.toLowerCase() === 'none') return 'transparent';

  const semanticMatch = entry.match(/s\s+(\w+)/);
  if (semanticMatch) {
    const semanticName = semanticMatch[1];
    const cssVar = CDE_SEMANTIC_MAP[semanticName];
    if (cssVar && themeColors[cssVar]) {
      return themeColors[cssVar];
    }
  }

  const colorMatch = entry.match(/c\s+(#[0-9a-fA-F]+|[a-zA-Z]+)/);
  if (colorMatch) {
    return normalizeXpmColor(colorMatch[1]);
  }

  return '#808080';
}

async function parseXpmToDataUrl(
  xpmText: string,
  themeColors: Record<string, string>
): Promise<string | null> {
  try {
    const text = xpmText.replace(/\/\*.*?\*\//gs, '');
    const strings = Array.from(text.matchAll(/"(.*?)"/gs)).map((m) => m[1].replace(/\\n/g, ''));

    if (strings.length < 2) return null;

    const header = strings[0].trim().split(/\s+/).map(Number);
    const [width, height, numColors, cpp] = header;

    if (!width || !height || !numColors || !cpp) return null;

    const colorTable: Map<string, string> = new Map();
    for (let i = 1; i <= numColors; i++) {
      const entry = strings[i];
      const symbol = entry.slice(0, cpp);
      const colorDef = entry.slice(cpp).trim();
      colorTable.set(symbol, resolveColor(colorDef, themeColors));
    }

    const pixelRows: string[] = [];
    for (let i = numColors + 1; i < strings.length && pixelRows.length < height; i++) {
      if (strings[i].length >= width * cpp) {
        pixelRows.push(strings[i]);
      }
    }

    if (pixelRows.length < height) return null;

    // Use OffscreenCanvas in worker
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    for (let y = 0; y < pixelRows.length; y++) {
      const row = pixelRows[y];
      for (let x = 0; x < width; x++) {
        const symbol = row.slice(x * cpp, x * cpp + cpp);
        const color = colorTable.get(symbol) ?? '#808080';
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const reader = new FileReader();

    return new Promise((resolve) => {
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error('[XPMWorker] Parse error:', err);
    return null;
  }
}

self.onmessage = async (e: MessageEvent<XPMParseMessage>) => {
  if (e.data.type === 'parse') {
    try {
      const dataUrl = await parseXpmToDataUrl(e.data.xpmText, e.data.themeColors);
      const result: XPMParseResult = {
        type: 'result',
        dataUrl,
        requestId: e.data.requestId,
      };
      self.postMessage(result);
    } catch (error) {
      const result: XPMParseResult = {
        type: 'result',
        dataUrl: null,
        requestId: e.data.requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      self.postMessage(result);
    }
  }
};
