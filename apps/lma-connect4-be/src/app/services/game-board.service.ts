import { Injectable } from '@nestjs/common';

/**
 * Interface for a cell coordinate
 */
export interface CellCoordinate {
  row: number;
  col: number;
}

/**
 * Interface for a winning result check
 */
export interface WinResult {
  isWinningMove: boolean;
  winningCells?: CellCoordinate[];
}

/**
 * Service responsible for game board logic
 * Following Single Responsibility Principle, this service handles only game board operations
 */
@Injectable()
export class GameBoardService {
  // Game board constants
  private readonly BOARD_ROWS = 6;
  private readonly BOARD_COLS = 7;
  private readonly WINNING_COUNT = 4;

  /**
   * Create a new empty game board
   */
  createEmptyBoard(): number[][] {
    return Array(this.BOARD_ROWS).fill(null).map(() => Array(this.BOARD_COLS).fill(0));
  }

  /**
   * Find the available row in a column where a disc would land
   * @param board Current game board
   * @param column The column to check
   */
  findAvailableRow(board: number[][], column: number): number {
    // Check if the column is valid
    if (column < 0 || column >= this.BOARD_COLS) {
      return -1;
    }

    // Check if the column is full
    if (board[0][column] !== 0) {
      return -1;
    }

    // Find the first empty cell in the column (bottom-up)
    for (let r = this.BOARD_ROWS - 1; r >= 0; r--) {
      if (board[r][column] === 0) {
        return r;
      }
    }

    return -1;
  }

  /**
   * Make a move on the board
   * @param board Current game board
   * @param column Column to place the disc
   * @param playerNumber Player number (1 or 2)
   */
  makeMove(board: number[][], column: number, playerNumber: number): {
    success: boolean;
    row?: number;
    newBoard?: number[][];
  } {
    const row = this.findAvailableRow(board, column);

    if (row === -1) {
      return { success: false };
    }

    // Create a new board (immutability)
    const newBoard = board.map(row => [...row]);

    // Place the disc
    newBoard[row][column] = playerNumber;

    return {
      success: true,
      row,
      newBoard
    };
  }

  /**
   * Check if a move results in a win
   * @param board Current game board
   * @param row Row of the last move
   * @param col Column of the last move
   * @param player Player number (1 or 2)
   */
  checkWin(board: number[][], row: number, col: number, player: number): WinResult {
    // Check horizontal
    const horizontalResult = this.checkDirection(board, row, col, 0, 1, player);
    if (horizontalResult.isWinningMove) return horizontalResult;

    // Check vertical
    const verticalResult = this.checkDirection(board, row, col, 1, 0, player);
    if (verticalResult.isWinningMove) return verticalResult;

    // Check diagonal (top-left to bottom-right)
    const diagonalResult1 = this.checkDirection(board, row, col, 1, 1, player);
    if (diagonalResult1.isWinningMove) return diagonalResult1;

    // Check diagonal (top-right to bottom-left)
    const diagonalResult2 = this.checkDirection(board, row, col, 1, -1, player);
    if (diagonalResult2.isWinningMove) return diagonalResult2;

    return { isWinningMove: false };
  }

  /**
   * Helper function to check for winning sequence in a direction
   */
  private checkDirection(
    board: number[][],
    row: number,
    col: number,
    rowDir: number,
    colDir: number,
    player: number
  ): WinResult {
    const winningCells: CellCoordinate[] = [];

    // Count in the positive direction
    let count = 0;
    let r = row;
    let c = col;

    while (
      r >= 0 && r < this.BOARD_ROWS &&
      c >= 0 && c < this.BOARD_COLS &&
      board[r][c] === player &&
      count < this.WINNING_COUNT
    ) {
      winningCells.push({ row: r, col: c });
      count++;
      r += rowDir;
      c += colDir;
    }

    // Count in the negative direction (skip the starting position)
    r = row - rowDir;
    c = col - colDir;

    while (
      r >= 0 && r < this.BOARD_ROWS &&
      c >= 0 && c < this.BOARD_COLS &&
      board[r][c] === player &&
      count < this.WINNING_COUNT
    ) {
      winningCells.push({ row: r, col: c });
      count++;
      r -= rowDir;
      c -= colDir;
    }

    return {
      isWinningMove: count >= this.WINNING_COUNT,
      winningCells: count >= this.WINNING_COUNT ? winningCells : undefined
    };
  }

  /**
   * Check if the game is a draw
   * @param board Current game board
   */
  checkDraw(board: number[][]): boolean {
    // Check if the top row is full
    for (let col = 0; col < this.BOARD_COLS; col++) {
      if (board[0][col] === 0) {
        return false;
      }
    }
    return true;
  }
}
