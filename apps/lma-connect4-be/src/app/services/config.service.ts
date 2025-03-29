import { Injectable } from '@nestjs/common';

/**
 * Service to provide application configuration
 * Following Single Responsibility Principle and making the codebase more maintainable
 */
@Injectable()
export class ConfigService {
  // Game board constants
  readonly BOARD_ROWS = 6;
  readonly BOARD_COLS = 7;
  readonly WINNING_COUNT = 4;

  // Room constants
  readonly MAX_PLAYERS_PER_ROOM = 2;
  readonly ROOM_CODE_LENGTH = 6;

  // Timeout values
  readonly PLAY_AGAIN_TIMEOUT_MS = 30000; // 30 seconds

  // Game state values
  readonly EMPTY_CELL = 0;
  readonly PLAYER_ONE = 1;
  readonly PLAYER_TWO = 2;
}
