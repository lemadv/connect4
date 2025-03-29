import { Component, OnDestroy, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../services/game.service';
import { Player } from '../../models/player.model';
import { Room, RoomStatus } from '../../models/room.model';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-lobby',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lobby.component.html',
  styleUrl: './lobby.component.scss'
})
export class LobbyComponent implements OnInit, OnDestroy {
  player: Player | null = null;
  room: Room | null = null;
  joinRoomForm: FormGroup;
  error: string | null = null;
  isDarkMode = false;
  copySuccess = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private gameService: GameService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.joinRoomForm = this.fb.group({
      roomId: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(6)]]
    });

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
      });

    this.gameService.currentRoom$
      .pipe(takeUntil(this.destroy$))
      .subscribe(room => {
        this.room = room;

        // If the game has started, navigate to the game page
        if (room?.status === RoomStatus.PLAYING) {
          this.router.navigate(['/game', room.id]);
        }
      });

    this.gameService.gameError$
      .pipe(takeUntil(this.destroy$))
      .subscribe(error => {
        this.error = error;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  createRoom(): void {
    this.error = null;
    this.gameService.createRoom();
  }

  joinRoom(): void {
    if (this.joinRoomForm.valid) {
      this.error = null;
      const roomId = this.joinRoomForm.get('roomId')?.value;
      this.gameService.joinRoom(roomId);
    }
  }

  leaveRoom(): void {
    this.gameService.leaveRoom();
  }

  isHost(): boolean {
    return this.gameService.isHost();
  }

  startGame(): void {
    this.gameService.startGame();
  }

  logout(): void {
    this.gameService.clearPlayerData();
    this.router.navigate(['/']);
  }

  toggleTheme(): void {
    this.isDarkMode = !this.isDarkMode;
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('theme', this.isDarkMode ? 'dark' : 'light');
    }
    this.applyTheme();
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

  // Get an SVG avatar based on a player's nickname
  getPlayerAvatar(nickname: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.gameService.getSvgAvatar(nickname));
  }

  // Get an SVG avatar for the current player
  getCurrentPlayerAvatar(): SafeHtml {
    if (!this.player?.nickname) return this.getPlayerAvatar('');
    return this.getPlayerAvatar(this.player.nickname);
  }

  // Copy invite link to clipboard
  copyInviteLink(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const inviteLink = this.gameService.generateInviteLink();
    if (!inviteLink) return;

    navigator.clipboard.writeText(inviteLink).then(() => {
      // Show temporary success message
      this.copySuccess = true;
      setTimeout(() => {
        this.copySuccess = false;
      }, 2000);
    }).catch(err => {
      console.error('Could not copy invite link: ', err);
    });
  }
}
