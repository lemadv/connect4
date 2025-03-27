import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PlayerService } from '../services/player.service';
import { RoomService } from '../services/room.service';
import { GameService } from '../services/game.service';
import {
  GameEvents,
  JoinRoomPayload,
  CreateRoomPayload,
  MakeMovePayload,
  ReconnectPayload,
  LeaveRoomPayload,
  PlayAgainRequestPayload,
  PlayAgainResponsePayload,
  StartGamePayload
} from '../models/game-events.model';
import { Logger } from '@nestjs/common';
import { RoomStatus } from '../models/room.model';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server: Server;

  // Initialize map to store timeout handles
  private playAgainTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private playerService: PlayerService,
    private roomService: RoomService,
    private gameService: GameService,
  ) {}

  // Handle new client connections
  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  // Handle client disconnections
  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Find player by socket ID
    const player = this.playerService.getPlayerBySocketId(client.id);

    if (player && player.roomId) {
      // Find the room
      const room = this.roomService.getRoomById(player.roomId);

      if (room) {
        // Notify other players in the room
        client.to(room.id).emit(GameEvents.PLAYER_DISCONNECTED, {
          playerId: player.id,
          nickname: player.nickname
        });
      }
    }
  }

  // Create a new room
  @SubscribeMessage(GameEvents.CREATE_ROOM)
  handleCreateRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: CreateRoomPayload,
  ) {
    try {
      // Create a player
      const player = this.playerService.createPlayer(
        payload.player.nickname,
        payload.player.avatar,
        client.id
      );

      // Create a room
      const room = this.roomService.createRoom(player);

      // Assign player to room
      this.playerService.assignPlayerToRoom(player.id, room.id);

      // Join the socket room
      client.join(room.id);

      // Emit room created event
      client.emit(GameEvents.ROOM_CREATED, {
        roomId: room.id,
        playerId: player.id,
        room: room
      });

      return { success: true, roomId: room.id, playerId: player.id };
    } catch (error) {
      this.logger.error('Error creating room:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to create room' });
      return { success: false, error: 'Failed to create room' };
    }
  }

  // Join an existing room
  @SubscribeMessage(GameEvents.JOIN_ROOM)
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinRoomPayload,
  ) {
    try {
      // Check if the room exists
      const room = this.roomService.getRoomById(payload.roomId);

      if (!room) {
        client.emit(GameEvents.ERROR, { message: 'Room not found' });
        return { success: false, error: 'Room not found' };
      }

      // Check if the room is full
      if (room.players.length >= 2) {
        client.emit(GameEvents.ERROR, { message: 'Room is full' });
        return { success: false, error: 'Room is full' };
      }

      // Create a player
      const player = this.playerService.createPlayer(
        payload.player.nickname,
        payload.player.avatar,
        client.id
      );

      // Add player to room
      const updatedRoom = this.roomService.addPlayerToRoom(payload.roomId, player);

      if (!updatedRoom) {
        client.emit(GameEvents.ERROR, { message: 'Failed to join room' });
        return { success: false, error: 'Failed to join room' };
      }

      // Assign player to room
      this.playerService.assignPlayerToRoom(player.id, payload.roomId);

      // Join the socket room
      client.join(payload.roomId);

      // Notify the room owner
      client.to(payload.roomId).emit(GameEvents.PLAYER_JOINED, {
        player: {
          id: player.id,
          nickname: player.nickname,
          avatar: player.avatar
        }
      });

      // Emit room joined event
      client.emit(GameEvents.ROOM_JOINED, {
        roomId: payload.roomId,
        playerId: player.id,
        room: updatedRoom
      });

      // If there are now 2 players, set the room to READY instead of starting the game
      if (updatedRoom.players.length === 2) {
        // Set room to READY
        const readyRoom = this.roomService.setRoomReady(payload.roomId);

        if (readyRoom) {
          // Notify both players that the room is ready
          this.server.to(payload.roomId).emit(GameEvents.UPDATE_GAME, {
            room: readyRoom
          });
        }
      }

      return { success: true, roomId: payload.roomId, playerId: player.id };
    } catch (error) {
      this.logger.error('Error joining room:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to join room' });
      return { success: false, error: 'Failed to join room' };
    }
  }

  // Handle a player's move
  @SubscribeMessage(GameEvents.MAKE_MOVE)
  handleMakeMove(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: MakeMovePayload,
  ) {
    try {
      const { roomId, playerId, column } = payload;

      // Make the move
      const result = this.gameService.makeMove(roomId, playerId, column);

      if (!result.success) {
        client.emit(GameEvents.ERROR, { message: 'Invalid move' });
        return { success: false, error: 'Invalid move' };
      }

      // Broadcast the updated game state
      this.server.to(roomId).emit(GameEvents.UPDATE_GAME, {
        room: result.room,
        lastMove: {
          column,
          row: result.row,
          playerId
        }
      });

      // If the game is over, notify the players
      if (result.isWinningMove || result.isDraw) {
        console.log('Game over! Winning cells:', result.winningCells);
        this.server.to(roomId).emit(GameEvents.GAME_OVER, {
          room: result.room,
          isDraw: result.isDraw,
          winnerId: result.isWinningMove ? playerId : null,
          winningCells: result.winningCells || []
        });
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error making move:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to make move' });
      return { success: false, error: 'Failed to make move' };
    }
  }

  // Handle player reconnection
  @SubscribeMessage(GameEvents.RECONNECT)
  handleReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ReconnectPayload,
  ) {
    try {
      const { playerId } = payload;

      // Update player's socket ID
      const player = this.playerService.updatePlayerSocket(playerId, client.id);

      if (!player) {
        client.emit(GameEvents.ERROR, { message: 'Player not found' });
        return { success: false, error: 'Player not found' };
      }

      // If player was in a room, reconnect them
      if (player.roomId) {
        const room = this.roomService.getRoomById(player.roomId);

        if (room) {
          // Join the socket room
          client.join(player.roomId);

          // Send the current game state
          client.emit(GameEvents.UPDATE_GAME, {
            room: room
          });

          return { success: true, room };
        }
      }

      return { success: true, player };
    } catch (error) {
      this.logger.error('Error reconnecting:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to reconnect' });
      return { success: false, error: 'Failed to reconnect' };
    }
  }

  // Handle player leaving a room
  @SubscribeMessage(GameEvents.LEAVE_ROOM)
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LeaveRoomPayload,
  ) {
    try {
      const { roomId, playerId } = payload;

      // Remove player from room
      this.roomService.removePlayerFromRoom(roomId, playerId);

      // Leave the socket room
      client.leave(roomId);

      // Notify other players
      client.to(roomId).emit(GameEvents.PLAYER_DISCONNECTED, {
        playerId
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Error leaving room:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to leave room' });
      return { success: false, error: 'Failed to leave room' };
    }
  }

  // Handle play again request
  @SubscribeMessage(GameEvents.PLAY_AGAIN_REQUEST)
  handlePlayAgainRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlayAgainRequestPayload,
  ) {
    try {
      const { roomId, playerId } = payload;

      // Check if room exists and is in FINISHED state
      const room = this.roomService.getRoomById(roomId);
      if (!room || room.status !== RoomStatus.FINISHED) {
        client.emit(GameEvents.ERROR, { message: 'Room not found or not in finished state' });
        return { success: false, error: 'Room not found or not in finished state' };
      }

      // Create a new room with the same players and host
      const newRoom = this.roomService.createNewRoomFromExisting(roomId);

      if (!newRoom) {
        client.emit(GameEvents.ERROR, { message: 'Failed to create new room' });
        return { success: false, error: 'Failed to create new room' };
      }

      // Make all players leave the old socket room
      room.players.forEach(player => {
        const playerSocket = this.server.sockets.sockets.get(player.socketId);
        if (playerSocket) {
          playerSocket.leave(roomId);

          // Join the new room
          playerSocket.join(newRoom.id);

          // Update the player's room assignment
          this.playerService.assignPlayerToRoom(player.id, newRoom.id);

          // Notify each player about the new room
          playerSocket.emit(GameEvents.PLAY_AGAIN_STATUS, {
            room: newRoom,
            message: 'Players moved to a new room'
          });
        }
      });

      return { success: true, roomId: newRoom.id };
    } catch (error) {
      this.logger.error('Error handling play again request:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to process play again request' });
      return { success: false, error: 'Failed to process play again request' };
    }
  }

  // Handle play again response
  @SubscribeMessage(GameEvents.PLAY_AGAIN_RESPONSE)
  handlePlayAgainResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: PlayAgainResponsePayload,
  ) {
    try {
      const { roomId, playerId, accepted } = payload;

      // Record the player's response
      const room = this.roomService.recordPlayAgainResponse(roomId, playerId, accepted);

      if (!room) {
        client.emit(GameEvents.ERROR, { message: 'Room not found or not in play again state' });
        return { success: false, error: 'Room not found or not in play again state' };
      }

      // Notify all players about the updated status
      this.server.to(roomId).emit(GameEvents.PLAY_AGAIN_STATUS, {
        room,
        respondent: playerId,
        accepted,
        timeRemaining: Math.max(0, Math.floor((room.playAgainTimeoutEnd - Date.now()) / 1000))
      });

      // If a player declined, cancel play again
      if (!accepted) {
        // Clear the timeout
        if (this.playAgainTimeouts.has(roomId)) {
          clearTimeout(this.playAgainTimeouts.get(roomId));
          this.playAgainTimeouts.delete(roomId);
        }

        // Notify all players that play again was declined
        this.server.to(roomId).emit(GameEvents.PLAY_AGAIN_TIMEOUT, {
          message: 'A player declined to play again',
          room
        });
      }
      // If all players accepted, start a new game
      else if (this.roomService.allPlayersAccepted(roomId)) {
        // Clear the timeout
        if (this.playAgainTimeouts.has(roomId)) {
          clearTimeout(this.playAgainTimeouts.get(roomId));
          this.playAgainTimeouts.delete(roomId);
        }

        // Reset the game for a new round
        const newGame = this.roomService.resetGame(roomId);

        if (newGame) {
          // Notify all players that the game has started
          this.server.to(roomId).emit(GameEvents.GAME_STARTED, {
            room: newGame,
            currentTurn: newGame.currentTurn
          });
        }
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error handling play again response:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to process play again response' });
      return { success: false, error: 'Failed to process play again response' };
    }
  }

  // Handle start game request (from host)
  @SubscribeMessage(GameEvents.START_GAME)
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: StartGamePayload,
  ) {
    try {
      const { roomId, playerId } = payload;

      // Check if room exists
      const room = this.roomService.getRoomById(roomId);

      if (!room) {
        client.emit(GameEvents.ERROR, { message: 'Room not found' });
        return { success: false, error: 'Room not found' };
      }

      // Check if player is the host
      if (room.hostId !== playerId) {
        client.emit(GameEvents.ERROR, { message: 'Only the host can start the game' });
        return { success: false, error: 'Only the host can start the game' };
      }

      // Check if room has 2 players and is in READY status
      if (room.players.length !== 2 || room.status !== RoomStatus.READY) {
        client.emit(GameEvents.ERROR, { message: 'Cannot start game - room not ready or missing players' });
        return { success: false, error: 'Cannot start game - room not ready or missing players' };
      }

      // Start the game
      const gameRoom = this.roomService.startGame(roomId);

      if (gameRoom) {
        // Notify both players that the game has started
        this.server.to(roomId).emit(GameEvents.GAME_STARTED, {
          room: gameRoom,
          currentTurn: gameRoom.currentTurn
        });

        return { success: true };
      } else {
        client.emit(GameEvents.ERROR, { message: 'Failed to start game' });
        return { success: false, error: 'Failed to start game' };
      }
    } catch (error) {
      this.logger.error('Error starting game:', error);
      client.emit(GameEvents.ERROR, { message: 'Failed to start game' });
      return { success: false, error: 'Failed to start game' };
    }
  }
}
