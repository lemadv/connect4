import { Component, OnDestroy, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { GameService } from '../../services/game.service';
import { Player } from '../../models/player.model';
import { Subject, takeUntil } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, OnDestroy {
  playerForm: FormGroup;
  // Use indices to reference SVG avatars instead of image filenames
  avatars: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  selectedAvatar = this.avatars[0];
  player: Player | null = null;
  isDarkMode = false;
  inviteRoomId: string | null = null;
  showInviteMessage = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private gameService: GameService,
    private sanitizer: DomSanitizer,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.playerForm = this.fb.group({
      nickname: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(15)]]
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
    // Check if this is an invite URL
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const roomId = params.get('roomId');
      if (roomId) {
        this.inviteRoomId = roomId;
        this.showInviteMessage = true;
        this.gameService.setInviteRoomId(roomId);
      }
    });

    // Check if we already have a player
    this.gameService.currentPlayer$.pipe(takeUntil(this.destroy$)).subscribe(player => {
      this.player = player;

      // If we already have a player and we're on an invite route, join the room directly
      if (player && player.id && this.inviteRoomId) {
        this.gameService.joinRoom(this.inviteRoomId);
        this.router.navigate(['/lobby']);
      }
    });
  }

  selectAvatar(avatar: number): void {
    this.selectedAvatar = avatar;
  }

  onSubmit(): void {
    if (this.playerForm.valid) {
      const nickname = this.playerForm.get('nickname')?.value;
      // Get the SVG avatar string for the selected index
      const avatarSvg = this.getAvatarSvgByIndex(this.selectedAvatar);
      this.gameService.createPlayer(nickname, avatarSvg);

      // If we came from an invite link, join that room
      if (this.inviteRoomId) {
        this.gameService.joinRoomFromInvite();
      }

      this.router.navigate(['/lobby']);
    }
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

  // Get SVG avatar by index
  getAvatarSvgByIndex(index: number): string {
    // Use the public method instead of accessing private property
    return this.gameService.getAvatarByIndex(index);
  }

  // Get sanitized SVG avatar for display
  getAvatarSvg(index: number): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(this.getAvatarSvgByIndex(index));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
