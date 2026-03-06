// src/scripts/core/interfaces/audio-manager.interface.ts

/**
 * Interface for basic audio operations
 * Use this when components only need simple sounds
 */
export interface IBasicAudio {
  /**
   * Play a beep sound
   * @param frequency - Frequency in Hz (optional)
   * @param duration - Duration in seconds (optional)
   */
  beep(frequency?: number, duration?: number): void;

  /**
   * Play a click sound
   */
  click(): void;
}

/**
 * Interface for system sound effects
 * Use this when components need system feedback sounds
 */
export interface ISystemSounds {
  /**
   * Play an error sound
   */
  error(): void;

  /**
   * Play a success sound
   */
  success(): void;

  /**
   * Play a notification sound
   */
  notification(): void;
}

/**
 * Interface for window-related sounds
 * Use this when components need window event sounds
 */
export interface IWindowSounds {
  /**
   * Play window open sound
   */
  windowOpen(): void;

  /**
   * Play window close sound
   */
  windowClose(): void;

  /**
   * Play window minimize sound
   */
  windowMinimize(): void;

  /**
   * Play window maximize sound
   */
  windowMaximize(): void;

  /**
   * Play window shade sound
   */
  windowShade(): void;
}

/**
 * Interface for menu sounds
 * Use this when components need menu interaction sounds
 */
export interface IMenuSounds {
  /**
   * Play menu open sound
   */
  menuOpen(): void;

  /**
   * Play menu close sound
   */
  menuClose(): void;
}

/**
 * Interface for music playback
 * Use this when components need to play melodies
 */
export interface IMusicPlayer {
  /**
   * Play a melody sequence
   * @param notes - Array of notes with frequency, duration, type, and delay
   */
  playMelody(
    notes: Array<{ freq: number; duration: number; type?: OscillatorType; delay?: number }>
  ): Promise<void>;

  /**
   * Play the startup chime
   */
  playStartupChime(): void;

  /**
   * Play the theme melody
   */
  playThemeMelody(): void;
}

/**
 * Interface for audio volume control
 * Use this when components need to control volume
 */
export interface IAudioControl {
  /**
   * Set the master volume
   * @param volume - Volume level (0.0 to 1.0)
   */
  setVolume(volume: number): void;
}
