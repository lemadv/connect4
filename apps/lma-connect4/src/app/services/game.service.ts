import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SocketService } from './socket.service';
import { GameEvents, CreateRoomPayload, JoinRoomPayload, MakeMovePayload, LeaveRoomPayload, ReconnectPayload, StartGamePayload, PlayAgainRequestPayload } from '../models/game-events.model';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';
import { Room, RoomStatus } from '../models/room.model';
import { Player } from '../models/player.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private currentPlayerSubject = new BehaviorSubject<Player | null>(null);
  private currentRoomSubject = new BehaviorSubject<Room | null>(null);
  private gameErrorSubject = new BehaviorSubject<string | null>(null);

  public currentPlayer$ = this.currentPlayerSubject.asObservable();
  public currentRoom$ = this.currentRoomSubject.asObservable();
  public gameError$ = this.gameErrorSubject.asObservable();

  constructor(
    private socketService: SocketService,
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.init();
  }

  private init(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Load player data from local storage
      this.loadPlayerData();

      // Setup socket event listeners
      this.listenForEvents();

      // Monitor socket connection status
      this.socketService.connectionStatus$.subscribe(isConnected => {
        // When connection is restored after being lost
        if (isConnected) {
          const player = this.currentPlayerSubject.value;
          const room = this.currentRoomSubject.value;

          // Clear the reconnection message regardless of player or room state
          if (this.gameErrorSubject.value === 'Connection lost. Trying to reconnect...') {
            this.gameErrorSubject.next(null);
          }

          if (player && player.id) {
            // Attempt to reconnect to any existing game
            this.reconnect();

            // If we were in a game, show that we're reconnected
            if (room) {
              this.gameErrorSubject.next('Connection restored. Rejoining game...');

              // Clear the message after a short while
              setTimeout(() => {
                if (this.gameErrorSubject.value === 'Connection restored. Rejoining game...') {
                  this.gameErrorSubject.next(null);
                }
              }, 3000);
            }
          }
        } else {
          // When connection is lost
          this.gameErrorSubject.next('Connection lost. Trying to reconnect...');
        }
      });
    }
  }

  private listenForEvents(): void {
    // Room created event
    this.socketService.on<{roomId: string, playerId: string, room: Room}>(GameEvents.ROOM_CREATED).subscribe(data => {
      this.savePlayerData(data.playerId);
      this.currentRoomSubject.next(data.room);
    });

    // Room joined event
    this.socketService.on<{roomId: string, playerId: string, room: Room}>(GameEvents.ROOM_JOINED).subscribe(data => {
      this.savePlayerData(data.playerId);
      this.currentRoomSubject.next(data.room);
    });

    // Player joined event
    this.socketService.on<{player: Player, reconnected?: boolean}>(GameEvents.PLAYER_JOINED).subscribe(data => {
      const currentRoom = this.currentRoomSubject.value;
      if (currentRoom) {
        // Create a copy of the current room
        const updatedRoom = { ...currentRoom };

        // If it's a reconnection
        if (data.reconnected) {
          // Find the player if they were already in the list (might be missing due to state inconsistency)
          const existingPlayerIndex = updatedRoom.players.findIndex(p => p.id === data.player.id);

          if (existingPlayerIndex === -1) {
            // If the player isn't in the list, add them
            console.log(`Reconnected player ${data.player.nickname} added to room`);
            updatedRoom.players = [...updatedRoom.players, data.player];
          } else {
            // If the player is already in the list, update their info
            console.log(`Reconnected player ${data.player.nickname} updated in room`);
            updatedRoom.players = [
              ...updatedRoom.players.slice(0, existingPlayerIndex),
              data.player,
              ...updatedRoom.players.slice(existingPlayerIndex + 1)
            ];
          }
        } else {
          // Regular new player joining
          console.log(`New player ${data.player.nickname} joined the room`);
          updatedRoom.players = [...updatedRoom.players, data.player];
        }

        // Update the room state with the modified player list
        this.currentRoomSubject.next(updatedRoom);
      }
    });

    // Game started event
    this.socketService.on<{room: Room, currentTurn: string}>(GameEvents.GAME_STARTED).subscribe(data => {
      this.currentRoomSubject.next(data.room);

      // Navigate to the game page if not already there
      if (!this.router.url.includes('/game/')) {
        this.router.navigate(['/game', data.room.id]);
      }
    });

    // Update game event
    this.socketService.on<{room: Room, lastMove?: { column: number, row: number, playerId: string }}>(GameEvents.UPDATE_GAME).subscribe(data => {
      this.currentRoomSubject.next(data.room);

      // Store last move info for animation
      if (data.lastMove) {
        const currentRoom = this.currentRoomSubject.value;
        if (currentRoom) {
          const updatedRoom = { ...currentRoom, lastMove: data.lastMove };
          this.currentRoomSubject.next(updatedRoom);
        }
      }
    });

    // Game over event
    this.socketService.on<{room: Room, isDraw: boolean, winnerId: string | null, winningCells?: {row: number, col: number}[]}>(GameEvents.GAME_OVER).subscribe(data => {
      console.log('Game over event received:', data);
      console.log('Winning cells:', data.winningCells);

      // Create a copy of the room with winning cells info
      const updatedRoom = {
        ...data.room,
        winningCells: data.winningCells || []
      };

      console.log('Updated room with winning cells:', updatedRoom);

      // Update the room state with winning cells info
      this.currentRoomSubject.next(updatedRoom);

      // Auto-navigate back to lobby if user doesn't interact with the play again options
      // after a reasonable timeout (30 seconds)
      setTimeout(() => {
        const currentRoom = this.currentRoomSubject.value;
        // Only auto-navigate if we're still in the same finished game
        if (currentRoom &&
            currentRoom.id === updatedRoom.id &&
            currentRoom.status === RoomStatus.FINISHED) {
          // If user hasn't made a choice to play again, return to lobby
          this.gameErrorSubject.next('Game session ended. Returning to lobby.');
          this.currentRoomSubject.next(null);
          this.router.navigate(['/lobby']);
        }
      }, 30000);
    });

    // Error event
    this.socketService.on<{message: string, critical?: boolean}>(GameEvents.ERROR).subscribe(data => {
      this.gameErrorSubject.next(data.message);

      // If it's a critical error, clear room state and go to lobby
      if (data.critical) {
        setTimeout(() => {
          this.currentRoomSubject.next(null);
          if (this.router.url.includes('/game/')) {
            this.router.navigate(['/lobby']);
          }
        }, 1500); // Delay to allow user to see the error message
      }
    });

    // Player disconnected event
    this.socketService.on<{playerId: string, nickname?: string}>(GameEvents.PLAYER_DISCONNECTED).subscribe(data => {
      const currentRoom = this.currentRoomSubject.value;
      if (currentRoom) {
        // Update the room with the disconnected player
        const updatedRoom = { ...currentRoom };
        updatedRoom.players = updatedRoom.players.filter(p => p.id !== data.playerId);
        this.currentRoomSubject.next(updatedRoom);

        // If game was in progress, show a notification
        if (currentRoom.status === RoomStatus.PLAYING || currentRoom.status === RoomStatus.READY) {
          this.gameErrorSubject.next(`Player ${data.nickname || 'opponent'} has disconnected.`);
        }

        // If I'm the only player left and we were playing, return to lobby view
        if (updatedRoom.players.length === 1 &&
            (currentRoom.status === RoomStatus.PLAYING ||
             currentRoom.status === RoomStatus.READY)) {
          // We remain in the room, but the status is set to WAITING
          // This lets the player wait for someone else to join
          if (this.router.url.includes('/game/')) {
            this.router.navigate(['/lobby']);
          }
        }
      }
    });

    // Listen for play again events
    this.listenForPlayAgainEvents();
  }

  createPlayer(nickname: string, avatar: string): void {
    const player = {
      nickname,
      avatar
    };

    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('connect4PlayerInfo', JSON.stringify(player));
    }
    this.currentPlayerSubject.next({ id: '', nickname, avatar });
  }

  async createRoom(): Promise<void> {
    const player = this.currentPlayerSubject.value;
    if (!player) return;

    const payload: CreateRoomPayload = {
      player: {
        nickname: player.nickname,
        avatar: player.avatar
      }
    };

    this.socketService.emit(GameEvents.CREATE_ROOM, payload);
  }

  async joinRoom(roomId: string): Promise<void> {
    const player = this.currentPlayerSubject.value;
    if (!player) return;

    const payload: JoinRoomPayload = {
      roomId,
      player: {
        nickname: player.nickname,
        avatar: player.avatar
      }
    };

    this.socketService.emit(GameEvents.JOIN_ROOM, payload);
  }

  makeMove(column: number): void {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !player.id || !room) return;

    const payload: MakeMovePayload = {
      roomId: room.id,
      playerId: player.id,
      column
    };

    this.socketService.emit(GameEvents.MAKE_MOVE, payload);
  }

  leaveRoom(): void {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !player.id || !room) return;

    const payload: LeaveRoomPayload = {
      roomId: room.id,
      playerId: player.id
    };

    // Create a handler for leave room success
    const handleLeaveRoomSuccess = () => {
      // Only clear the room after server confirms
      this.currentRoomSubject.next(null);

      // Ensure we're at the lobby page
      if (!this.router.url.includes('/lobby')) {
        this.router.navigate(['/lobby']);
      }
    };

    // Subscribe once to the socket server response
    this.socketService.once<{success: boolean}>(GameEvents.LEAVE_ROOM + '_RESPONSE').subscribe(response => {
      if (response.success) {
        handleLeaveRoomSuccess();
      } else {
        // Even if the server reports an error, clear the room for the client
        // to avoid stuck states
        this.gameErrorSubject.next('Error leaving room. Returning to lobby.');
        handleLeaveRoomSuccess();
      }
    });

    // Emit leave room event
    this.socketService.emit(GameEvents.LEAVE_ROOM, payload);

    // Set a timeout to clear the room in case the server doesn't respond
    // Reducing to 500ms for better user experience
    setTimeout(() => {
      handleLeaveRoomSuccess();
    }, 500);
  }

  reconnect(): void {
    const player = this.currentPlayerSubject.value;
    if (!player || !player.id) return;

    const payload: ReconnectPayload = {
      playerId: player.id
    };

    this.socketService.emit(GameEvents.RECONNECT, payload);
  }

  isMyTurn(): boolean {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !room || room.status !== RoomStatus.PLAYING) {
      return false;
    }

    return room.currentTurn === player.id;
  }

  // Check if the current player is the host of the room
  isHost(): boolean {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !room || !room.hostId) {
      return false;
    }

    return room.hostId === player.id;
  }

  // Start the game (only host can call this)
  startGame(): void {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !player.id || !room) return;

    // Only the host can start the game and only when there are 2 players
    if (room.hostId !== player.id || room.players.length !== 2) return;

    const payload: StartGamePayload = {
      roomId: room.id,
      playerId: player.id
    };

    this.socketService.emit(GameEvents.START_GAME, payload);
  }

  getPlayerNumber(): number {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !room || room.players.length < 2) {
      return 0;
    }

    return room.players[0].id === player.id ? 1 : 2;
  }

  getOpponent(): Player | null {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !room || room.players.length < 2) {
      return null;
    }

    return room.players.find(p => p.id !== player.id) || null;
  }

  resetGame(): void {
    this.currentRoomSubject.next(null);
    this.gameErrorSubject.next(null);
  }

  clearPlayerData(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('connect4Player');
      localStorage.removeItem('connect4PlayerInfo');
    }
    this.currentPlayerSubject.next(null);
    this.currentRoomSubject.next(null);
    this.gameErrorSubject.next(null);
  }

  private savePlayerData(playerId: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const playerInfo = localStorage.getItem('connect4PlayerInfo');
      if (playerInfo) {
        const { nickname, avatar } = JSON.parse(playerInfo);
        const player: Player = {
          id: playerId,
          nickname,
          avatar
        };

        localStorage.setItem('connect4Player', JSON.stringify(player));
        this.currentPlayerSubject.next(player);
      }
    }
  }

  // Add a method to select an SVG avatar based on a string
  getSvgAvatar(nickname: string): string {
    if (!nickname) return this.getDefaultAvatar();

    // Use a hash of the nickname to deterministically select an SVG avatar
    const hash = this.hashString(nickname);
    const avatarIndex = Math.abs(hash) % this.svgAvatars.length;
    return this.svgAvatars[avatarIndex];
  }

  // Get avatar by index (for avatar selection UI)
  getAvatarByIndex(index: number): string {
    if (index >= 0 && index < this.svgAvatars.length) {
      return this.svgAvatars[index];
    }
    return this.getDefaultAvatar();
  }

  // Get all available avatars
  getAllAvatars(): string[] {
    return [...this.svgAvatars];
  }

  // A collection of cool SVG avatars
  private svgAvatars: string[] = [
    // Abstract geometric shapes
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="15" fill="#FF5733"/><circle cx="70" cy="30" r="15" fill="#FFFFFF"/><circle cx="30" cy="70" r="15" fill="#FFFFFF"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#3498DB"/><path d="M30,30 L70,30 L70,70 L30,70 Z" fill="#FFFFFF"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 90,90 10,90" fill="#9B59B6"/><circle cx="50" cy="45" r="20" fill="#FFFFFF"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2ECC71"/><path d="M25,25 L75,25 L75,75 L25,75 Z" fill="#FFFFFF"/><circle cx="50" cy="50" r="15" fill="#2ECC71"/></svg>`,

    // Robot faces
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" rx="10" fill="#E74C3C"/><rect x="25" y="25" width="20" height="20" rx="5" fill="#FFFFFF"/><rect x="55" y="25" width="20" height="20" rx="5" fill="#FFFFFF"/><rect x="35" y="65" width="30" height="10" rx="5" fill="#FFFFFF"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#F1C40F"/><circle cx="35" cy="40" r="10" fill="#FFFFFF"/><circle cx="65" cy="40" r="10" fill="#FFFFFF"/><path d="M30,60 Q50,80 70,60" fill="none" stroke="#FFFFFF" stroke-width="5"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#3498DB"/><circle cx="30" cy="40" r="10" fill="#FFFFFF"/><circle cx="70" cy="40" r="10" fill="#FFFFFF"/><rect x="25" y="70" width="50" height="5" fill="#FFFFFF"/><rect x="40" y="15" width="20" height="20" fill="#E74C3C"/></svg>`,

    // Monsters and creatures
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#8E44AD"/><circle cx="35" cy="40" r="8" fill="#FFFFFF"/><circle cx="65" cy="40" r="8" fill="#FFFFFF"/><circle cx="35" cy="40" r="4" fill="#000000"/><circle cx="65" cy="40" r="4" fill="#000000"/><path d="M30,60 Q50,80 70,60" fill="none" stroke="#FFFFFF" stroke-width="4"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#16A085"/><rect x="30" y="35" width="10" height="15" rx="2" fill="#FFFFFF"/><rect x="60" y="35" width="10" height="15" rx="2" fill="#FFFFFF"/><path d="M30,65 L70,65 L70,70 L30,70 Z" fill="#FFFFFF"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#D35400"/><path d="M30,40 L40,30 L60,30 L70,40 L70,60 L60,70 L40,70 L30,60 Z" fill="#FFFFFF"/><circle cx="40" cy="45" r="5" fill="#D35400"/><circle cx="60" cy="45" r="5" fill="#D35400"/><rect x="40" y="60" width="20" height="5" fill="#D35400"/></svg>`,

    // Space and alien themes
    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#2C3E50"/><circle cx="25" cy="30" r="3" fill="#FFFFFF"/><circle cx="40" cy="20" r="2" fill="#FFFFFF"/><circle cx="60" cy="15" r="4" fill="#FFFFFF"/><circle cx="75" cy="25" r="3" fill="#FFFFFF"/><circle cx="85" cy="45" r="2" fill="#FFFFFF"/><circle cx="80" cy="70" r="3" fill="#FFFFFF"/><circle cx="60" cy="80" r="2" fill="#FFFFFF"/><circle cx="40" cy="85" r="4" fill="#FFFFFF"/><circle cx="20" cy="75" r="3" fill="#FFFFFF"/><circle cx="15" cy="55" r="2" fill="#FFFFFF"/></svg>`,

    `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="#27AE60"/><circle cx="35" cy="35" r="12" fill="#000000"/><circle cx="35" cy="35" r="8" fill="#FFFFFF"/><circle cx="65" cy="35" r="12" fill="#000000"/><circle cx="65" cy="35" r="8" fill="#FFFFFF"/><path d="M35,70 L65,70 L65,80 L35,80 Z" fill="#000000"/></svg>`
  ];

  // Get a default avatar
  getDefaultAvatar(): string {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50" fill="#95A5A6"/><circle cx="35" cy="40" r="8" fill="#FFFFFF"/><circle cx="65" cy="40" r="8" fill="#FFFFFF"/><path d="M30,60 Q50,70 70,60" fill="none" stroke="#FFFFFF" stroke-width="4"/></svg>`;
  }

  // Create a simple string hash function
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  }

  // Request to play again (create a new room with the same host)
  playAgain(): void {
    const player = this.currentPlayerSubject.value;
    const room = this.currentRoomSubject.value;

    if (!player || !player.id || !room) return;

    const payload: PlayAgainRequestPayload = {
      roomId: room.id,
      playerId: player.id
    };

    this.socketService.emit(GameEvents.PLAY_AGAIN_REQUEST, payload);
  }

  // Listener for play again events
  private listenForPlayAgainEvents(): void {
    // Listen for new room created after play again request
    this.socketService.on<{room: Room}>(GameEvents.PLAY_AGAIN_STATUS).subscribe(data => {
      if (data.room) {
        // Set the new room
        this.currentRoomSubject.next(data.room);

        // Navigate to the new room lobby
        this.router.navigate(['/lobby']);
      }
    });
  }

  private loadPlayerData(): void {
    if (isPlatformBrowser(this.platformId)) {
      const playerData = localStorage.getItem('connect4Player');
      if (playerData) {
        this.currentPlayerSubject.next(JSON.parse(playerData));
        this.reconnect();
      }
    }
  }
}
