import { Injectable } from '@nestjs/common';
import { RoomService } from './room.service';
import { Room } from '../models/room.model';
import { GameBoardService } from './game-board.service';

/**
 * Service responsible for game logic
 * Following Single Responsibility and Dependency Inversion principles
 */
@Injectable()
export class GameService {
  constructor(
    private roomService: RoomService,
    private gameBoardService: GameBoardService
  ) {}

  /**
   * Place a token in the specified column
   * @param roomId Room identifier
   * @param playerId Player making the move
   * @param column Column to place the token
   */
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

    // Make the move
    const moveResult = this.gameBoardService.makeMove(room.gameState, column, playerNumber);

    if (!moveResult.success) {
      return { success: false };
    }

    const { row, newBoard } = moveResult;

    // Update the game state
    this.roomService.updateGameState(roomId, newBoard);

    // Check for a win
    const winResult = this.gameBoardService.checkWin(newBoard, row, column, playerNumber);

    // Check for a draw
    const isDraw = this.gameBoardService.checkDraw(newBoard);

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
}
