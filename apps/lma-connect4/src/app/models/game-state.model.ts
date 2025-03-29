import { Player } from './player.model';

/**
 * Represents a Connect4 game board cell coordinate
 */
export interface CellCoordinate {
  row: number;
  col: number;
}

/**
 * Represents a move made in the game
 */
export interface GameMove {
  column: number;
  row: number;
  playerId: string;
}

/**
 * Represents the game board state
 * 0 = empty cell
 * 1 = player 1
 * 2 = player 2
 */
export type GameBoard = number[][];

/**
 * Represents the result of a winning move
 */
export interface WinResult {
  isWinningMove: boolean;
  winningCells?: CellCoordinate[];
}

/**
 * Utility class with game board constants
 */
export class GameConstants {
  static readonly BOARD_ROWS = 6;
  static readonly BOARD_COLS = 7;
  static readonly WINNING_COUNT = 4;

  static createEmptyBoard(): GameBoard {
    return Array(this.BOARD_ROWS).fill(null).map(() => Array(this.BOARD_COLS).fill(0));
  }
}
