import { Injectable } from '@nestjs/common';
import { RoomService } from './room.service';
import { Room } from '../models/room.model';

@Injectable()
export class GameService {
  constructor(private roomService: RoomService) {}

  // Place a token in the specified column
  makeMove(roomId: string, playerId: string, column: number): {
    success: boolean;
    room?: Room;
    isWinningMove?: boolean;
    isDraw?: boolean;
    row?: number;
    winningCells?: {row: number, col: number}[];
  } {
    const room = this.roomService.getRoomById(roomId);

    // Check if the room exists and it's the player's turn
    if (!room || room.currentTurn !== playerId || !room.gameState) {
      return { success: false };
    }

    // Check if the column is valid (0-6)
    if (column < 0 || column > 6) {
      return { success: false };
    }

    // Find which player number they are (1 or 2)
    const playerNumber = room.players[0].id === playerId ? 1 : 2;

    // Find the first empty cell in the column (bottom-up)
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (room.gameState[r][column] === 0) {
        row = r;
        break;
      }
    }

    // Column is full
    if (row === -1) {
      return { success: false };
    }

    // Place the token
    room.gameState[row][column] = playerNumber;

    // Update the game state
    this.roomService.updateGameState(roomId, room.gameState);

    // Check for a win
    const winResult = this.checkWin(room.gameState, row, column, playerNumber);
    console.log('Win result:', winResult);

    // Check for a draw
    const isDraw = this.checkDraw(room.gameState);

    if (winResult.isWinningMove) {
      // Save winning cells to the room
      this.roomService.updateWinningCells(roomId, winResult.winningCells || []);

      // End the game with the winner
      this.roomService.endGame(roomId, playerId);

      // Return with winning info
      const updatedRoom = this.roomService.getRoomById(roomId);
      return {
        success: true,
        room: updatedRoom,
        isWinningMove: true,
        isDraw: false,
        row,
        winningCells: winResult.winningCells
      };
    } else if (isDraw) {
      // End the game with no winner
      this.roomService.endGame(roomId, '');

      // Return with draw info
      return {
        success: true,
        room: this.roomService.getRoomById(roomId),
        isWinningMove: false,
        isDraw: true,
        row
      };
    } else {
      // Switch turns
      this.roomService.switchTurn(roomId);

      // Return normal move info
      return {
        success: true,
        room: this.roomService.getRoomById(roomId),
        isWinningMove: false,
        isDraw: false,
        row
      };
    }
  }

  // Check if a move results in a win
  private checkWin(board: number[][], row: number, col: number, player: number): {
    isWinningMove: boolean;
    winningCells?: {row: number, col: number}[]
  } {
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

  // Helper function to check for 4 in a row in a direction
  private checkDirection(
    board: number[][],
    row: number,
    col: number,
    rowDir: number,
    colDir: number,
    player: number
  ): {
    isWinningMove: boolean;
    winningCells?: {row: number, col: number}[]
  } {
    const rows = 6;
    const cols = 7;
    const winningCells: {row: number, col: number}[] = [];

    // Count in the positive direction
    let count = 0;
    let r = row;
    let c = col;

    while (
      r >= 0 && r < rows &&
      c >= 0 && c < cols &&
      board[r][c] === player &&
      count < 4
    ) {
      winningCells.push({row: r, col: c});
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
      count < 4
    ) {
      winningCells.push({row: r, col: c});
      count++;
      r -= rowDir;
      c -= colDir;
    }

    return {
      isWinningMove: count >= 4,
      winningCells: count >= 4 ? winningCells : undefined
    };
  }

  // Check if the game is a draw
  private checkDraw(board: number[][]): boolean {
    // Check if the top row is full
    for (let col = 0; col < 7; col++) {
      if (board[0][col] === 0) {
        return false;
      }
    }
    return true;
  }
}
