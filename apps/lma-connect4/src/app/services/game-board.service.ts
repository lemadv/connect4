import { Injectable } from '@angular/core';
import { ConfigService } from './config.service';
import { CellCoordinate, GameBoard, WinResult } from '../models/game-state.model';

/**
 * Service to handle game board logic
 * Following the Single Responsibility Principle, this service only handles game board operations
 */
@Injectable({
  providedIn: 'root'
})
export class GameBoardService {
  constructor(private configService: ConfigService) { }

  /**
   * Create an empty game board
   */
  createEmptyBoard(): GameBoard {
    return this.configService.createEmptyBoard();
  }

  /**
   * Check if a move would result in a win
   * @param board The current game board
   * @param row The row of the last move
   * @param col The column of the last move
   * @param player The player number (1 or 2)
   */
  checkWin(board: GameBoard, row: number, col: number, player: number): WinResult {
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
   * Check for 4 in a row in a specific direction
   * @param board The current game board
   * @param row The row of the last move
   * @param col The column of the last move
   * @param rowDir The row direction to check
   * @param colDir The column direction to check
   * @param player The player number (1 or 2)
   */
  private checkDirection(
    board: GameBoard,
    row: number,
    col: number,
    rowDir: number,
    colDir: number,
    player: number
  ): WinResult {
    const rows = this.configService.BOARD_ROWS;
    const cols = this.configService.BOARD_COLS;
    const winningCells: CellCoordinate[] = [];

    // Count in the positive direction
    let count = 0;
    let r = row;
    let c = col;

    while (
      r >= 0 && r < rows &&
      c >= 0 && c < cols &&
      board[r][c] === player &&
      count < this.configService.WINNING_COUNT
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
      r >= 0 && r < rows &&
      c >= 0 && c < cols &&
      board[r][c] === player &&
      count < this.configService.WINNING_COUNT
    ) {
      winningCells.push({ row: r, col: c });
      count++;
      r -= rowDir;
      c -= colDir;
    }

    return {
      isWinningMove: count >= this.configService.WINNING_COUNT,
      winningCells: count >= this.configService.WINNING_COUNT ? winningCells : undefined
    };
  }

  /**
   * Check if the game is a draw (board is full)
   * @param board The current game board
   */
  checkDraw(board: GameBoard): boolean {
    // Check if the top row is full
    for (let col = 0; col < this.configService.BOARD_COLS; col++) {
      if (board[0][col] === 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Find the row where a piece would land in a given column
   * @param board The current game board
   * @param column The column to check
   */
  findAvailableRow(board: GameBoard, column: number): number {
    if (column < 0 || column >= this.configService.BOARD_COLS) {
      return -1;
    }

    // Check if the column is full
    if (board[0][column] !== 0) {
      return -1;
    }

    // Find the first empty cell in the column (bottom-up)
    for (let row = this.configService.BOARD_ROWS - 1; row >= 0; row--) {
      if (board[row][column] === 0) {
        return row;
      }
    }

    return -1;
  }

  /**
   * Check if a column is valid for placing a piece
   * @param board The current game board
   * @param column The column to check
   */
  isValidMove(board: GameBoard, column: number): boolean {
    return this.findAvailableRow(board, column) !== -1;
  }

  /**
   * Make a move on the board
   * @param board The current game board
   * @param column The column to place in
   * @param player The player number (1 or 2)
   */
  makeMove(board: GameBoard, column: number, player: number): {row: number, newBoard: GameBoard} | null {
    const row = this.findAvailableRow(board, column);

    if (row === -1) {
      return null;
    }

    // Create a copy of the board
    const newBoard = board.map(r => [...r]);

    // Place the token
    newBoard[row][column] = player;

    return { row, newBoard };
  }
}
