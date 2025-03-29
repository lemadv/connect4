import { Injectable } from '@nestjs/common';
import { Room, RoomStatus, PlayAgainResponse } from '../models/room.model';
import { Player } from '../models/player.model';
import { ConfigService } from './config.service';
import { GameBoardService } from './game-board.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service responsible for room management
 * Following Single Responsibility Principle with improved code organization
 */
@Injectable()
export class RoomService {
  private rooms: Map<string, Room> = new Map();

  constructor(
    private configService: ConfigService,
    private gameBoardService: GameBoardService
  ) {}

  /**
   * Create a new room
   * @param player The player who creates the room
   */
  createRoom(player: Player): Room {
    const roomId = this.generateRoomId();
    const room: Room = {
      id: roomId,
      players: [player],
      status: RoomStatus.WAITING,
      hostId: player.id,
      createdAt: new Date(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Get a room by its ID
   * @param id Room ID
   */
  getRoomById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  /**
   * Add a player to a room
   * @param roomId Room ID
   * @param player Player to add
   */
  addPlayerToRoom(roomId: string, player: Player): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    if (room.players.length < this.configService.MAX_PLAYERS_PER_ROOM && room.status === RoomStatus.WAITING) {
      room.players.push(player);
      this.rooms.set(roomId, room);
      return room;
    }

    return undefined;
  }

  /**
   * Remove a player from a room
   * @param roomId Room ID
   * @param playerId Player ID to remove
   */
  removePlayerFromRoom(roomId: string, playerId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    // Save the original state for comparison
    const originalStatus = room.status;
    const originalPlayerCount = room.players.length;

    // Remove the player
    room.players = room.players.filter(p => p.id !== playerId);

    // If no players left, delete the room
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return undefined;
    }

    // If one player left and we were in an active game state,
    // change back to WAITING so others can join
    if (room.players.length === 1 && this.isActiveGameState(originalStatus)) {
      this.resetRoomToWaiting(room);
    }

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Check if a room status is an active game state
   * @param status Room status
   */
  private isActiveGameState(status: RoomStatus): boolean {
    return status === RoomStatus.READY ||
           status === RoomStatus.PLAYING ||
           status === RoomStatus.FINISHED ||
           status === RoomStatus.PLAY_AGAIN_PENDING;
  }

  /**
   * Reset a room to waiting state
   * @param room Room to reset
   */
  private resetRoomToWaiting(room: Room): void {
    room.status = RoomStatus.WAITING;

    // Clear game-related fields
    room.gameState = undefined;
    room.currentTurn = undefined;
    room.winner = undefined;
    room.winningCells = undefined;
    room.lastMove = undefined;
    room.playAgainResponses = undefined;
    room.playAgainTimeoutEnd = undefined;
    room.playAgainInitiator = undefined;
  }

  /**
   * Start a game in a room
   * @param roomId Room ID
   */
  startGame(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room || room.players.length !== this.configService.MAX_PLAYERS_PER_ROOM) {
      return undefined;
    }

    // Initialize game state
    room.status = RoomStatus.PLAYING;
    room.gameState = this.gameBoardService.createEmptyBoard();

    // Randomly select who goes first
    const randomPlayerIndex = Math.floor(Math.random() * this.configService.MAX_PLAYERS_PER_ROOM);
    room.currentTurn = room.players[randomPlayerIndex].id;

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Update the game state
   * @param roomId Room ID
   * @param gameState New game state
   */
  updateGameState(roomId: string, gameState: number[][]): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    room.gameState = gameState;
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Switch the turn to the next player
   * @param roomId Room ID
   */
  switchTurn(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room || room.players.length !== this.configService.MAX_PLAYERS_PER_ROOM) {
      return undefined;
    }

    const currentPlayerIndex = room.players.findIndex(p => p.id === room.currentTurn);
    const nextPlayerIndex = (currentPlayerIndex + 1) % this.configService.MAX_PLAYERS_PER_ROOM;
    room.currentTurn = room.players[nextPlayerIndex].id;

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * End the game
   * @param roomId Room ID
   * @param winnerId Winner player ID (empty for draw)
   */
  endGame(roomId: string, winnerId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    room.status = RoomStatus.FINISHED;
    room.winner = winnerId || undefined;
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Update the winning cells
   * @param roomId Room ID
   * @param winningCells Array of winning cell coordinates
   */
  updateWinningCells(roomId: string, winningCells: {row: number, col: number}[]): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    room.winningCells = winningCells;
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Get a room by player ID
   * @param playerId Player ID
   */
  getRoomByPlayerId(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Generate a unique room ID
   */
  private generateRoomId(): string {
    // Generate a 6-digit random room code
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();

    // Ensure unique room ID
    if (this.rooms.has(roomId)) {
      return this.generateRoomId();
    }

    return roomId;
  }

  /**
   * Start play again voting period
   * @param roomId Room ID
   * @param initiatorId Player who initiated the play again
   */
  initiatePlayAgain(roomId: string, initiatorId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    // Set room status to play again pending
    room.status = RoomStatus.PLAY_AGAIN_PENDING;

    // Initialize empty responses array
    room.playAgainResponses = [];

    // Set timeout end to configured seconds from now
    room.playAgainTimeoutEnd = Date.now() + this.configService.PLAY_AGAIN_TIMEOUT_MS;

    // Track who initiated the play again request
    room.playAgainInitiator = initiatorId;

    // Automatically record the initiator as accepting
    room.playAgainResponses.push({
      playerId: initiatorId,
      accepted: true,
      timestamp: Date.now()
    });

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Record a player's response to play again
   * @param roomId Room ID
   * @param playerId Player ID
   * @param accepted Whether the player accepted to play again
   */
  recordPlayAgainResponse(roomId: string, playerId: string, accepted: boolean): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room || room.status !== RoomStatus.PLAY_AGAIN_PENDING) {
      return undefined;
    }

    // Find if the player has already responded
    const existingResponseIndex = room.playAgainResponses?.findIndex(r => r.playerId === playerId);

    // Create a new response object
    const response: PlayAgainResponse = {
      playerId,
      accepted,
      timestamp: Date.now()
    };

    // Update or add the response
    if (existingResponseIndex !== undefined && existingResponseIndex >= 0 && room.playAgainResponses) {
      room.playAgainResponses[existingResponseIndex] = response;
    } else if (room.playAgainResponses) {
      room.playAgainResponses.push(response);
    }

    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Check if all players have accepted to play again
   * @param roomId Room ID
   */
  allPlayersAccepted(roomId: string): boolean {
    const room = this.getRoomById(roomId);
    if (!room || !room.playAgainResponses || room.status !== RoomStatus.PLAY_AGAIN_PENDING) {
      return false;
    }

    // All players must have responded and accepted
    return room.playAgainResponses.length === room.players.length &&
           room.playAgainResponses.every(r => r.accepted);
  }

  /**
   * Reset the game for a new round
   * @param roomId Room ID
   */
  resetGame(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    // Reset the game state but keep the players
    const resetRoom: Room = {
      ...room,
      status: RoomStatus.PLAYING,
      gameState: this.gameBoardService.createEmptyBoard(),
      currentTurn: room.players[Math.floor(Math.random() * this.configService.MAX_PLAYERS_PER_ROOM)].id,
      winner: undefined,
      winningCells: undefined,
      lastMove: undefined,
      playAgainResponses: undefined,
      playAgainTimeoutEnd: undefined,
      playAgainInitiator: undefined
    };

    this.rooms.set(roomId, resetRoom);
    return resetRoom;
  }

  /**
   * Check if the play again timeout has occurred
   * @param roomId Room ID
   */
  hasPlayAgainTimedOut(roomId: string): boolean {
    const room = this.getRoomById(roomId);
    if (!room || !room.playAgainTimeoutEnd || room.status !== RoomStatus.PLAY_AGAIN_PENDING) {
      return false;
    }

    return Date.now() > room.playAgainTimeoutEnd;
  }

  /**
   * Set a room to READY status
   * @param roomId Room ID
   */
  setRoomReady(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    room.status = RoomStatus.READY;
    this.rooms.set(roomId, room);
    return room;
  }

  /**
   * Create a new room based on an existing one (copying players)
   * @param originalRoomId Original room ID
   */
  createNewRoomFromExisting(originalRoomId: string): Room | undefined {
    const originalRoom = this.getRoomById(originalRoomId);
    if (!originalRoom) {
      return undefined;
    }

    const newRoomId = this.generateRoomId();
    const newRoom: Room = {
      id: newRoomId,
      players: [...originalRoom.players],
      status: RoomStatus.READY,
      hostId: originalRoom.hostId,
      createdAt: new Date()
    };

    this.rooms.set(newRoomId, newRoom);

    // Delete the original room
    this.rooms.delete(originalRoomId);

    return newRoom;
  }

  /**
   * Set a room to WAITING status
   * @param roomId Room ID
   */
  setRoomWaiting(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      return undefined;
    }

    this.resetRoomToWaiting(room);
    this.rooms.set(roomId, room);
    return room;
  }
}
