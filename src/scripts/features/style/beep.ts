// src/scripts/features/style/beep.ts

import { logger } from '../../utilities/logger';
import { CONFIG } from '../../core/config';
import { StyleModuleBase } from '../../shared/style-module-base';
import { settingsManager } from '../../core/settingsmanager';

/**
 * System beep and sound settings.
 */
export interface BeepSettings {
  volume: number;
  frequency: number;
  duration: number;
}

/**
 * Module to manage system beep settings and volume.
 */
export class BeepModule extends StyleModuleBase<BeepSettings> {
  constructor() {
    super({
      name: 'BeepModule',
      settingsKey: 'beep',
      panelId: 'styleManagerBeep',
      defaultSettings: {
        volume: CONFIG.AUDIO.BEEP_GAIN,
        frequency: CONFIG.AUDIO.BEEP_FREQUENCY,
        duration: CONFIG.AUDIO.BEEP_DURATION,
      },
    });
  }

  /**
   * Initializes the beep module and applies saved settings.
   * Always ensures volume starts at 90% (0.9) if not previously configured.
   */
  public load(): void {
    const saved = this.config.settingsKey
      ? settingsManager.getSection(this.config.settingsKey)
      : {};
    if (saved && Object.keys(saved).length > 0) {
      Object.assign(this.settings, saved);
    } else {
      this.settings.volume = 0.9;
      this.save();
    }
    this.apply();
    logger.log(`[${this.config.name}] Loaded:`, this.settings);
  }

  /**
   * Applies the current beep settings to the AudioManager.
   */
  public apply(): void {
    if (window.AudioManager) {
      window.AudioManager.setVolume(this.settings.volume);
    }
    logger.log('[BeepModule] Applied settings to AudioManager');
  }

  /**
   * Syncs the UI in StyleManagerBeep.astro.
   */
  protected syncUIImpl(panel: HTMLElement): void {
    this.syncSlider(panel, 'volume', this.settings.volume * 100);
    this.syncSlider(panel, 'frequency', this.settings.frequency);
    this.syncSlider(panel, 'duration', this.settings.duration * 1000);
  }

  /**
   * Test the current beep settings.
   */
  public testBeep(): void {
    if (window.AudioManager) {
      window.AudioManager.beep(this.settings.frequency, this.settings.duration);
      logger.log('[BeepModule] Test beep played');
    }
  }
}
