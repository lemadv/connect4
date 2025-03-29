import { Injectable } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

/**
 * Service to handle player avatars
 * Following the Single Responsibility Principle, this service only handles avatar management
 */
@Injectable({
  providedIn: 'root'
})
export class AvatarService {
  // Collection of SVG avatars to choose from
  private readonly svgAvatars: string[] = [
    `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#64748b"/><path d="M18 18C20.7614 18 23 15.7614 23 13C23 10.2386 20.7614 8 18 8C15.2386 8 13 10.2386 13 13C13 15.7614 15.2386 18 18 18Z" fill="white"/><path d="M18 21C15.33 21 10 22.34 10 25V28H26V25C26 22.34 20.67 21 18 21Z" fill="white"/></svg>`,
    `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#ec4899"/><path d="M14.6667 13.6C14.6667 10.9444 16.0159 8 18.3333 8C20.6508 8 22 10.9444 22 13.6C22 16.2556 20.6508 18 18.3333 18C16.0159 18 14.6667 16.2556 14.6667 13.6Z" fill="white"/><path d="M19.4444 18H17.2222C13.7789 18 11 20.7789 11 24.2222V24.4444C11 26.4081 12.5919 28 14.5556 28H22.1111C24.0748 28 25.6667 26.4081 25.6667 24.4444V24.2222C25.6667 20.7789 22.8878 18 19.4444 18Z" fill="white"/></svg>`,
    `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#0891b2"/><path d="M18 8L20 18L25 8L24 21H12L11 8L16 18L18 8Z" fill="white"/><path d="M12 21L10 28H26L24 21H12Z" fill="white"/></svg>`,
    `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#9333ea"/><path d="M26 18C26 14.13 22.87 11 19 11H17C13.13 11 10 14.13 10 18C10 21.87 13.13 25 17 25H19C22.87 25 26 21.87 26 18Z" fill="white"/><circle cx="18" cy="18" r="4" fill="#9333ea"/></svg>`,
    `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#2563eb"/><path d="M18 21C20.2091 21 22 19.2091 22 17C22 14.7909 20.2091 13 18 13C15.7909 13 14 14.7909 14 17C14 19.2091 15.7909 21 18 21Z" fill="white"/><path d="M18 10L20 13H16L18 10Z" fill="white"/><path d="M18 26L16 23H20L18 26Z" fill="white"/><path d="M10 18L13 16V20L10 18Z" fill="white"/><path d="M26 18L23 20V16L26 18Z" fill="white"/></svg>`,
    `<svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="18" fill="#f97316"/><path d="M25 15C25 16.6569 23.6569 18 22 18C20.3431 18 19 16.6569 19 15C19 13.3431 20.3431 12 22 12C23.6569 12 25 13.3431 25 15Z" fill="white"/><path d="M17 21C17 22.6569 15.6569 24 14 24C12.3431 24 11 22.6569 11 21C11 19.3431 12.3431 18 14 18C15.6569 18 17 19.3431 17 21Z" fill="white"/><path d="M25 26V15H19L11 21V26H17L25 26Z" fill="white"/></svg>`
  ];

  constructor(private sanitizer: DomSanitizer) { }

  /**
   * Get all available avatars
   */
  public getAllAvatars(): string[] {
    return this.svgAvatars;
  }

  /**
   * Get an avatar by index
   * @param index The index of the avatar
   */
  public getAvatarByIndex(index: number): string {
    return this.svgAvatars[index % this.svgAvatars.length];
  }

  /**
   * Get the default avatar (first in the list)
   */
  public getDefaultAvatar(): string {
    return this.svgAvatars[0];
  }

  /**
   * Generate an avatar based on a nickname (consistent for the same nickname)
   * @param nickname The nickname to generate an avatar for
   */
  public getSvgAvatar(nickname: string): string {
    const hash = this.hashString(nickname);
    return this.svgAvatars[hash % this.svgAvatars.length];
  }

  /**
   * Convert SVG string to SafeHtml for use in templates
   * @param svg The SVG string to sanitize
   */
  public sanitizeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }

  /**
   * Hash a string to a number for consistent avatar selection
   * @param str The string to hash
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
