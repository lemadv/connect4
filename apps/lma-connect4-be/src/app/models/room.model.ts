import { Player } from './player.model';

export enum RoomStatus {
  WAITING = 'waiting',
  READY = 'ready',
  PLAYING = 'playing',
  FINISHED = 'finished',
  PLAY_AGAIN_PENDING = 'play_again_pending'
}

/**
 * Interface for player play again response
 */
export interface PlayAgainResponse {
  playerId: string;
  accepted: boolean;
  timestamp: number;
}

export interface Room {
  id: string;
  players: Player[];
  status: RoomStatus;
  hostId?: string; // ID of the player who created the room (the host)
  currentTurn?: string; // player id
  gameState?: number[][]; // 0 = empty, 1 = player 1, 2 = player 2
  winner?: string; // player id
  createdAt: Date;
  lastMove?: {
    column: number;
    row: number;
    playerId: string;
  };
  winningCells?: {row: number, col: number}[]; // coordinates of winning cells
  playAgainResponses?: PlayAgainResponse[];
  playAgainTimeoutEnd?: number; // timestamp when the play again timeout will end
  playAgainInitiator?: string; // player id who initiated the play again request
}
