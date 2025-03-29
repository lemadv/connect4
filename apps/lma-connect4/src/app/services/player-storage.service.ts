import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ConfigService } from './config.service';
import { Player } from '../models/player.model';

/**
 * Interface for player info stored in local storage
 */
interface StoredPlayerInfo {
  nickname: string;
  avatar: string;
  id?: string;
}

/**
 * Service to handle player data persistence
 * Following the Single Responsibility Principle and Open/Closed Principle
 */
@Injectable({
  providedIn: 'root'
})
export class PlayerStorageService {
  constructor(
    private configService: ConfigService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {}

  /**
   * Save player data to localStorage
   * @param player The player data to save
   */
  savePlayer(player: Player): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const playerInfo: StoredPlayerInfo = {
      nickname: player.nickname,
      avatar: player.avatar,
      id: player.id
    };

    localStorage.setItem(
      this.configService.PLAYER_INFO_STORAGE_KEY,
      JSON.stringify(playerInfo)
    );
  }

  /**
   * Load player data from localStorage
   */
  loadPlayer(): StoredPlayerInfo | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    const playerInfoJson = localStorage.getItem(this.configService.PLAYER_INFO_STORAGE_KEY);

    if (!playerInfoJson) {
      return null;
    }

    try {
      return JSON.parse(playerInfoJson) as StoredPlayerInfo;
    } catch (err) {
      console.error('Error parsing player info from localStorage:', err);
      return null;
    }
  }

  /**
   * Clear player data from localStorage
   */
  clearPlayer(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.configService.PLAYER_INFO_STORAGE_KEY);
  }
}
