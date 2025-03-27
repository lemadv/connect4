import { Injectable } from '@nestjs/common';
import { Player } from '../models/player.model';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PlayerService {
  private players: Map<string, Player> = new Map();

  createPlayer(nickname: string, avatar: string, socketId: string): Player {
    const player: Player = {
      id: uuidv4(),
      nickname,
      avatar,
      socketId
    };
    this.players.set(player.id, player);
    return player;
  }

  getPlayerById(id: string): Player | undefined {
    return this.players.get(id);
  }

  getPlayerBySocketId(socketId: string): Player | undefined {
    for (const player of this.players.values()) {
      if (player.socketId === socketId) {
        return player;
      }
    }
    return undefined;
  }

  updatePlayerSocket(playerId: string, socketId: string): Player | undefined {
    const player = this.getPlayerById(playerId);
    if (player) {
      player.socketId = socketId;
      this.players.set(playerId, player);
    }
    return player;
  }

  removePlayer(id: string): boolean {
    return this.players.delete(id);
  }

  assignPlayerToRoom(playerId: string, roomId: string): void {
    const player = this.getPlayerById(playerId);
    if (player) {
      player.roomId = roomId;
      this.players.set(playerId, player);
    }
  }

  getAllPlayers(): Player[] {
    return Array.from(this.players.values());
  }
}
