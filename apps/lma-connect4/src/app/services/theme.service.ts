import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject, Observable } from 'rxjs';
import { ConfigService } from './config.service';

/**
 * Service to handle theme preferences
 * Following the Single Responsibility Principle, this service handles only theme management
 */
@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private isDarkModeSubject = new BehaviorSubject<boolean>(false);

  /**
   * Observable for theme changes that components can subscribe to
   */
  public isDarkMode$: Observable<boolean> = this.isDarkModeSubject.asObservable();

  constructor(
    private configService: ConfigService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.initTheme();
  }

  /**
   * Initialize theme based on localStorage or system preference
   */
  private initTheme(): void {
    if (isPlatformBrowser(this.platformId)) {
      const savedTheme = localStorage.getItem(this.configService.THEME_STORAGE_KEY);
      const isDarkMode = savedTheme === 'dark' ||
        (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);

      this.setDarkMode(isDarkMode);
    }
  }

  /**
   * Toggle between light and dark theme
   */
  public toggleTheme(): void {
    this.setDarkMode(!this.isDarkModeSubject.value);
  }

  /**
   * Set theme to light or dark
   */
  public setDarkMode(isDarkMode: boolean): void {
    if (isPlatformBrowser(this.platformId)) {
      // Update localStorage
      localStorage.setItem(
        this.configService.THEME_STORAGE_KEY,
        isDarkMode ? 'dark' : 'light'
      );

      // Update document class
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }

      // Update the subject
      this.isDarkModeSubject.next(isDarkMode);
    }
  }

  /**
   * Get current theme state
   */
  public isDarkMode(): boolean {
    return this.isDarkModeSubject.value;
  }
}
