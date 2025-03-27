import { Injectable } from '@nestjs/common';
import { Room, RoomStatus } from '../models/room.model';
import { Player } from '../models/player.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RoomService {
  private rooms: Map<string, Room> = new Map();

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

  getRoomById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  addPlayerToRoom(roomId: string, player: Player): Room | undefined {
    const room = this.getRoomById(roomId);
    if (!room) {
      console.log(`Room ${roomId} not found`);
      return undefined;
    }

    console.log(`Attempting to add player to room ${roomId}. Room status: ${room.status}, Player count: ${room.players.length}`);

    if (room.players.length < 2 && room.status === RoomStatus.WAITING) {
      room.players.push(player);
      this.rooms.set(roomId, room);
      console.log(`Player ${player.id} (${player.nickname}) successfully added to room ${roomId}`);
      return room;
    } else {
      if (room.players.length >= 2) {
        console.log(`Cannot add player to room ${roomId}: Room is full`);
      } else if (room.status !== RoomStatus.WAITING) {
        console.log(`Cannot add player to room ${roomId}: Room status is ${room.status}, expected ${RoomStatus.WAITING}`);
      }
      return undefined;
    }
  }

  removePlayerFromRoom(roomId: string, playerId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      // Save the original status and number of players for comparison
      const originalStatus = room.status;
      const originalPlayerCount = room.players.length;

      // Remove the player
      room.players = room.players.filter(p => p.id !== playerId);

      // If no players left, delete the room
      if (room.players.length === 0) {
        this.rooms.delete(roomId);
        return undefined;
      }

      // If one player left and we were in READY, PLAYING, or FINISHED status
      // change back to WAITING so others can join
      if (room.players.length === 1 &&
          (originalStatus === RoomStatus.READY ||
           originalStatus === RoomStatus.PLAYING ||
           originalStatus === RoomStatus.FINISHED ||
           originalStatus === RoomStatus.PLAY_AGAIN_PENDING)) {
        console.log(`Room ${roomId} status changed from ${originalStatus} to ${RoomStatus.WAITING}`);
        room.status = RoomStatus.WAITING;

        // Clear game state if there was any
        if (room.gameState) {
          room.gameState = undefined;
        }

        // Clear other game-related fields
        room.currentTurn = undefined;
        room.winner = undefined;
        room.winningCells = undefined;
        room.lastMove = undefined;
        room.playAgainResponses = undefined;
        room.playAgainTimeoutEnd = undefined;
        room.playAgainInitiator = undefined;
      }

      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  startGame(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room && room.players.length === 2) {
      // Initialize game state
      room.status = RoomStatus.PLAYING;
      room.gameState = Array(6).fill(null).map(() => Array(7).fill(0));

      // Randomly select who goes first
      const randomPlayerIndex = Math.floor(Math.random() * 2);
      room.currentTurn = room.players[randomPlayerIndex].id;

      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  updateGameState(roomId: string, gameState: number[][]): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      room.gameState = gameState;
      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  switchTurn(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room && room.players.length === 2) {
      const currentPlayerIndex = room.players.findIndex(p => p.id === room.currentTurn);
      const nextPlayerIndex = (currentPlayerIndex + 1) % 2;
      room.currentTurn = room.players[nextPlayerIndex].id;
      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  endGame(roomId: string, winnerId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      room.status = RoomStatus.FINISHED;
      room.winner = winnerId || undefined;
      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  updateWinningCells(roomId: string, winningCells: {row: number, col: number}[]): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      room.winningCells = winningCells;
      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  getRoomByPlayerId(playerId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.some(p => p.id === playerId)) {
        return room;
      }
    }
    return undefined;
  }

  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  private generateRoomId(): string {
    // Generate a 6-digit random room code
    const roomId = Math.floor(100000 + Math.random() * 900000).toString();

    // Ensure unique room ID
    if (this.rooms.has(roomId)) {
      return this.generateRoomId();
    }

    return roomId;
  }

  // Start play again voting period
  initiatePlayAgain(roomId: string, initiatorId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      // Set room status to play again pending
      room.status = RoomStatus.PLAY_AGAIN_PENDING;

      // Initialize empty responses array
      room.playAgainResponses = [];

      // Set timeout end to 30 seconds from now
      room.playAgainTimeoutEnd = Date.now() + 30000; // 30 seconds

      // Track who initiated the play again request
      room.playAgainInitiator = initiatorId;

      // Automatically record the initiator as accepting
      room.playAgainResponses.push({
        playerId: initiatorId,
        accepted: true
      });

      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  // Record player's response to play again
  recordPlayAgainResponse(roomId: string, playerId: string, accepted: boolean): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room && room.status === RoomStatus.PLAY_AGAIN_PENDING) {
      // If this player already responded, update their response
      const existingResponseIndex = room.playAgainResponses.findIndex(r => r.playerId === playerId);

      if (existingResponseIndex >= 0) {
        room.playAgainResponses[existingResponseIndex].accepted = accepted;
      } else {
        // Otherwise add a new response
        room.playAgainResponses.push({
          playerId,
          accepted
        });
      }

      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  // Check if all players have accepted to play again
  allPlayersAccepted(roomId: string): boolean {
    const room = this.getRoomById(roomId);
    if (room && room.status === RoomStatus.PLAY_AGAIN_PENDING && room.playAgainResponses) {
      // If any player declined, return false
      if (room.playAgainResponses.some(r => !r.accepted)) {
        return false;
      }

      // Check if all players have responded and accepted
      return room.playAgainResponses.length === room.players.length &&
             room.playAgainResponses.every(r => r.accepted);
    }
    return false;
  }

  // Reset game for a new round
  resetGame(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      // Reset game state
      room.status = RoomStatus.PLAYING;
      room.gameState = Array(6).fill(null).map(() => Array(7).fill(0));
      room.winner = undefined;
      room.winningCells = undefined;
      room.playAgainResponses = undefined;
      room.playAgainTimeoutEnd = undefined;
      room.playAgainInitiator = undefined;
      room.lastMove = undefined;

      // Randomly select who goes first
      const randomPlayerIndex = Math.floor(Math.random() * 2);
      room.currentTurn = room.players[randomPlayerIndex].id;

      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  // Check if play again timeout has elapsed
  hasPlayAgainTimedOut(roomId: string): boolean {
    const room = this.getRoomById(roomId);
    if (room && room.status === RoomStatus.PLAY_AGAIN_PENDING && room.playAgainTimeoutEnd) {
      return Date.now() > room.playAgainTimeoutEnd;
    }
    return false;
  }

  // Set room status to READY when second player joins
  setRoomReady(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room && room.players.length === 2 && room.status === RoomStatus.WAITING) {
      room.status = RoomStatus.READY;
      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }

  // Create a new room from an existing room for play again
  createNewRoomFromExisting(originalRoomId: string): Room | undefined {
    const originalRoom = this.getRoomById(originalRoomId);
    if (!originalRoom) {
      return undefined;
    }

    // Create a new room ID
    const newRoomId = this.generateRoomId();

    // Create the new room with the same host and players
    const newRoom: Room = {
      id: newRoomId,
      players: [...originalRoom.players], // Copy players
      status: RoomStatus.READY, // Set to READY since we already have 2 players
      hostId: originalRoom.hostId, // Keep the same host
      createdAt: new Date()
    };

    // Add to rooms collection
    this.rooms.set(newRoomId, newRoom);

    // Remove the original room
    this.rooms.delete(originalRoomId);

    return newRoom;
  }

  // Set room status to WAITING when a player leaves
  setRoomWaiting(roomId: string): Room | undefined {
    const room = this.getRoomById(roomId);
    if (room) {
      console.log(`Explicitly setting room ${roomId} status from ${room.status} to ${RoomStatus.WAITING}`);
      room.status = RoomStatus.WAITING;

      // Clear game state
      room.gameState = undefined;
      room.currentTurn = undefined;
      room.winner = undefined;
      room.winningCells = undefined;
      room.lastMove = undefined;
      room.playAgainResponses = undefined;
      room.playAgainTimeoutEnd = undefined;
      room.playAgainInitiator = undefined;

      this.rooms.set(roomId, room);
      return room;
    }
    return undefined;
  }
}
