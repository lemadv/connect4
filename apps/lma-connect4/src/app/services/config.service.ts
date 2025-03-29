import { Injectable } from '@angular/core';

/**
 * Service to centralize configuration values used throughout the application
 * Following the Single Responsibility Principle, this service is responsible only for configuration
 */
@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  // Game constants
  readonly BOARD_ROWS = 6;
  readonly BOARD_COLS = 7;
  readonly WINNING_COUNT = 4;

  // Storage keys
  readonly PLAYER_INFO_STORAGE_KEY = 'connect4PlayerInfo';
  readonly THEME_STORAGE_KEY = 'theme';

  // Timeouts
  readonly ERROR_DISMISS_TIMEOUT = 3000; // 3 seconds
  readonly GAME_OVER_TIMEOUT = 30000; // 30 seconds
  readonly PLAY_AGAIN_TIMEOUT = 30000; // 30 seconds
  readonly WIN_ANIMATION_DELAY = 500; // 0.5 seconds

  // Animation durations
  readonly PIECE_DROP_ANIMATION_DURATION = 1000; // 1 second

  // UI
  readonly DEFAULT_DARK_MODE = false; // Default theme is light

  constructor() { }

  /**
   * Creates an empty game board
   */
  createEmptyBoard(): number[][] {
    return Array(this.BOARD_ROWS).fill(null).map(() => Array(this.BOARD_COLS).fill(0));
  }
}
