/* ------------------------------------------------------------------
       System clock (24h format) - Optimized version
    ------------------------------------------------------------------ */

import { logger } from './logger';

let clockInterval: number | null = null;
let lastTimeString: string = '';

// Global format settings
let use24h = true;
let showSeconds = false;

/**
 * Updates the clock element with the current time.
 */
function updateClock(): void {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;

  const now = new Date();

  const timeString = now.toLocaleTimeString('en-US', {
    hour12: !use24h,
    hour: '2-digit',
    minute: '2-digit',
    second: showSeconds ? '2-digit' : undefined,
  });

  if (timeString !== lastTimeString) {
    clockEl.textContent = timeString;
    lastTimeString = timeString;
  }
}

/**
 * Updates the clock display format.
 */
function updateClockFormat(config: { is24h?: boolean; showSeconds?: boolean }): void {
  if (config.is24h !== undefined) use24h = config.is24h;
  if (config.showSeconds !== undefined) showSeconds = config.showSeconds;
  lastTimeString = ''; // Reset flag to force update
  updateClock();
}

// Global exposure
if (typeof window !== 'undefined') {
  (window as any).updateClockFormat = updateClockFormat;
}

/**
 * Initializes the system clock with performance optimizations.
 *
 * @remarks
 * Sets up the clock by performing an initial update and then
 * establishing an interval to update the clock every second.
 * Includes cleanup function to properly dispose when not needed.
 * Only updates DOM when the time actually changes.
 *
 * @example
 * ```typescript
 * initClock(); // Starts the clock updates
 * ```
 */
function initClock(): void {
  logger.log('[Clock] initClock: initializing system clock');

  if (clockInterval !== null) {
    clearInterval(clockInterval);
    logger.log('[Clock] initClock: cleared previous interval');
  }

  // Initial update
  updateClock();

  if (typeof requestAnimationFrame === 'function') {
    let lastUpdate = Date.now();

    function tick() {
      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        updateClock();
        lastUpdate = now;
      }
      clockInterval = requestAnimationFrame(tick) as any;
    }

    clockInterval = requestAnimationFrame(tick) as any;
  } else {
    // Fallback to setInterval for older browsers
    clockInterval = setInterval(() => {
      updateClock();
    }, 1000) as any;
  }

  // Add cleanup function to window for proper disposal
  (window as any).cleanupClock = () => {
    if (clockInterval !== null) {
      if (typeof clockInterval === 'number') {
        cancelAnimationFrame(clockInterval);
      } else {
        clearInterval(clockInterval);
      }
      clockInterval = null;
      logger.log('[Clock] cleanupClock: clock interval cleared');
    }
  };

  logger.log('[Clock] initClock: clock fully initialized with performance optimizations');
}

/**
 * Cleans up clock resources.
 * Call this when the application is shutting down or clock is no longer needed.
 */
function cleanupClock(): void {
  if (clockInterval !== null) {
    if (typeof clockInterval === 'number') {
      cancelAnimationFrame(clockInterval);
    } else {
      clearInterval(clockInterval);
    }
    clockInterval = null;
    logger.log('[Clock] cleanupClock: clock resources cleaned up');
  }
}

// Export functions
export { updateClock, initClock, cleanupClock };
