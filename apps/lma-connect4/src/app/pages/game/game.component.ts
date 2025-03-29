import { Component, OnDestroy, OnInit, HostListener, Inject, PLATFORM_ID, SecurityContext } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { GameService } from '../../services/game.service';
import { Player } from '../../models/player.model';
import { Room, RoomStatus } from '../../models/room.model';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss'
})
export class GameComponent implements OnInit, OnDestroy {
  player: Player | null = null;
  room: Room | null = null;
  opponent: Player | null = null;
  playerNumber = 0;
  isMyTurn = false;
  gameOver = false;
  isDraw = false;
  winner: Player | null = null;
  showWinAnimation = false;
  boardColumns = Array(7).fill(0).map((_, i) => i);
  lastMoveColumn: number | null = null;
  lastMoveRow: number | null = null;
  winningCells: {row: number, col: number}[] = [];
  isDarkMode = false;

  private destroy$ = new Subject<void>();

  // Animation delay timer
  private winAnimationTimer: any;

  constructor(
    private router: Router,
    private gameService: GameService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    // Set dark mode based on localStorage or system preference
    if (isPlatformBrowser(this.platformId)) {
      this.isDarkMode = localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    // Apply the initial theme
    this.applyTheme();
  }

  ngOnInit(): void {
    this.gameService.currentPlayer$
      .pipe(takeUntil(this.destroy$))
      .subscribe(player => {
        this.player = player;
        this.updateGameState();
      });

    this.gameService.currentRoom$
      .pipe(takeUntil(this.destroy$))
      .subscribe(room => {
        // If room is null, navigate back to lobby
        if (!room) {
          this.router.navigate(['/lobby']);
          return;
        }

        // Update the room reference
        this.room = room;

        if (room) {
          // Check for game status changes
          if (room.status === RoomStatus.PLAYING) {
            // Reset visual state when starting a new game
            this.gameOver = false;
            this.isDraw = false;
            this.winner = null;
            this.showWinAnimation = false;
            this.lastMoveColumn = null;
            this.lastMoveRow = null;
            this.winningCells = [];
          } else {
            // Check for game over
            this.gameOver = room.status === RoomStatus.FINISHED;
            this.isDraw = this.gameOver && !room.winner;
          }

          // If we're not in PLAYING or FINISHED status, go back to lobby
          if (room.status !== RoomStatus.PLAYING &&
              room.status !== RoomStatus.FINISHED) {
            this.router.navigate(['/lobby']);
            return;
          }

          // Update the last move information for disc animation
          if (room.lastMove) {
            this.lastMoveColumn = room.lastMove.column;
            this.lastMoveRow = room.lastMove.row;
          }

          // Update the winning cells if available
          if (room.winningCells && room.winningCells.length > 0) {
            this.winningCells = [...room.winningCells];
          }

          if (this.gameOver && room.winner) {
            this.winner = room.players.find(p => p.id === room.winner) || null;

            // Show win animation after a delay
            if (!this.showWinAnimation) {
              this.winAnimationTimer = setTimeout(() => {
                this.showWinAnimation = true;
              }, 500);
            }
          }
        }

        this.updateGameState();
      });

    // Listen for errors that might affect game state
    this.gameService.gameError$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        // For specific errors that require returning to lobby
        if (error && (
            error.includes('disconnected') ||
            error.includes('connection lost') ||
            error.includes('error')
          )) {
          // Show the error but don't navigate, let the room update handle navigation
          console.log('Game error:', error);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.winAnimationTimer) {
      clearTimeout(this.winAnimationTimer);
    }
  }

  // Listen for window resize to make the board responsive
  @HostListener('window:resize')
  onResize() {
    // The board size is handled with CSS
  }

  makeMove(column: number): void {
    if (!this.isMyTurn || this.gameOver || !this.room?.gameState) return;

    // Check if column is full
    if (this.room.gameState[0][column] !== 0) return;

    this.gameService.makeMove(column);
  }

  getCellValue(row: number, col: number): number {
    if (!this.room?.gameState) return 0;
    return this.room.gameState[row][col];
  }

  getCellClass(row: number, col: number): string {
    const value = this.getCellValue(row, col);

    let classes = 'cell';

    if (value === 1) {
      classes += ' player-one';
    } else if (value === 2) {
      classes += ' player-two';
    }

    // Highlight the last move
    if (row === this.lastMoveRow && col === this.lastMoveColumn) {
      classes += ' last-move';
    }

    // Highlight winning cells
    if (this.gameOver && !this.isDraw && value > 0) {
      // First check if this is a winning cell using the component's winningCells array
      const isWinningCell =
        (this.winningCells.length > 0 &&
         this.winningCells.some(cell => cell.row === row && cell.col === col)) ||
        (this.room && this.room.winningCells && this.room.winningCells.length > 0 &&
         this.room.winningCells.some(cell => cell.row === row && cell.col === col));

      if (isWinningCell) {
        classes += ' winning-cell';
      }
    }

    return classes;
  }

  isWinningCell(row: number, col: number): boolean {
    if (!this.room?.winningCells || this.room.winningCells.length === 0) return false;

    // Check if the cell is in the winning cells array
    return this.room.winningCells.some(cell => cell.row === row && cell.col === col);
  }

  getColumnClass(col: number): string {
    if (!this.room?.gameState || this.gameOver) return '';

    let classes = 'column';

    // Highlight hoverable columns during player's turn
    if (this.isMyTurn && this.room.gameState[0][col] === 0) {
      classes += ' hoverable';
    }

    return classes;
  }

  backToLobby(): void {
    this.gameService.resetGame();
    this.router.navigate(['/lobby']);
  }

  playAgain(): void {
    this.gameService.playAgain();
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
    this.applyTheme();
  }

  private updateGameState(): void {
    if (!this.player || !this.room) return;

    // Get opponent
    this.opponent = this.gameService.getOpponent();

    // Get player number (1 or 2)
    this.playerNumber = this.gameService.getPlayerNumber();

    // Check if it's the player's turn
    this.isMyTurn = this.gameService.isMyTurn();
  }

  private applyTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      if (this.isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }

  // Get an SVG avatar for the current player
  getPlayerAvatar(): SafeHtml {
    if (!this.player?.nickname) return this.sanitizeSvg(this.gameService.getSvgAvatar(''));
    return this.sanitizeSvg(this.gameService.getSvgAvatar(this.player.nickname));
  }

  // Get an SVG avatar for the opponent
  getOpponentAvatar(): SafeHtml {
    if (!this.opponent?.nickname) return this.sanitizeSvg(this.gameService.getSvgAvatar(''));
    return this.sanitizeSvg(this.gameService.getSvgAvatar(this.opponent.nickname));
  }

  // Sanitize SVG content for safe rendering
  private sanitizeSvg(svgContent: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svgContent);
  }

  // Method to return to lobby manually
  returnToLobby(): void {
    this.gameService.leaveRoom();
  }
}
