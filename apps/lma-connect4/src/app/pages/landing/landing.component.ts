import { Component, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { GameService } from '../../services/game.service';
import { Player } from '../../models/player.model';
import { Subject } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnDestroy {
  playerForm: FormGroup;
  // Use indices to reference SVG avatars instead of image filenames
  avatars: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  selectedAvatar = this.avatars[0];
  player: Player | null = null;
  isDarkMode = false;
  private destroy$ = new Subject<void>();

  constructor(
    private fb: FormBuilder,
    private router: Router,
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

  selectAvatar(avatar: number): void {
    this.selectedAvatar = avatar;
  }

  onSubmit(): void {
    if (this.playerForm.valid) {
      const nickname = this.playerForm.get('nickname')?.value;
      // Get the SVG avatar string for the selected index
      const avatarSvg = this.getAvatarSvgByIndex(this.selectedAvatar);
      this.gameService.createPlayer(nickname, avatarSvg);
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
