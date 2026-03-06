// src/scripts/core/adapters/audiomanager.adapter.ts

import { AudioManager } from '../audiomanager';
import type {
  IBasicAudio,
  ISystemSounds,
  IWindowSounds,
  IMenuSounds,
  IMusicPlayer,
  IAudioControl,
} from '../interfaces/audio-manager.interface';

/**
 * Adapter for AudioManager implementing segregated audio interfaces
 * Wraps the existing AudioManager singleton
 */
export class AudioManagerAdapter
  implements
    IBasicAudio,
    ISystemSounds,
    IWindowSounds,
    IMenuSounds,
    IMusicPlayer,
    IAudioControl
{
  // IBasicAudio
  beep(frequency?: number, duration?: number): void {
    AudioManager.beep(frequency, duration);
  }

  click(): void {
    AudioManager.click();
  }

  // ISystemSounds
  error(): void {
    AudioManager.error();
  }

  success(): void {
    AudioManager.success();
  }

  notification(): void {
    AudioManager.notification();
  }

  // IWindowSounds
  windowOpen(): void {
    AudioManager.windowOpen();
  }

  windowClose(): void {
    AudioManager.windowClose();
  }

  windowMinimize(): void {
    AudioManager.windowMinimize();
  }

  windowMaximize(): void {
    AudioManager.windowMaximize();
  }

  windowShade(): void {
    AudioManager.windowShade();
  }

  // IMenuSounds
  menuOpen(): void {
    AudioManager.menuOpen();
  }

  menuClose(): void {
    AudioManager.menuClose();
  }

  // IMusicPlayer
  async playMelody(
    notes: Array<{ freq: number; duration: number; type?: OscillatorType; delay?: number }>
  ): Promise<void> {
    await AudioManager.playMelody(notes);
  }

  playStartupChime(): void {
    AudioManager.playStartupChime();
  }

  playThemeMelody(): void {
    AudioManager.playThemeMelody();
  }

  // IAudioControl
  setVolume(volume: number): void {
    AudioManager.setVolume(volume);
  }
}
