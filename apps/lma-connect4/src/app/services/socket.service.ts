import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.socket = io(environment.apiUrl);
    }
  }

  connect(): void {
    if (!this.socket?.connected) {
      this.socket?.connect();
    }
  }

  disconnect(): void {
    if (this.socket?.connected) {
      this.socket?.disconnect();
    }
  }

  emit(event: string, data: any): void {
    this.socket?.emit(event, data);
  }

  on<T>(event: string): Observable<T> {
    return new Observable<T>((observer) => {
      this.socket?.on(event, (data: T) => {
        this.ngZone.run(() => {
          observer.next(data);
        });
      });

      return () => {
        this.socket?.off(event);
      };
    });
  }

  once<T>(event: string): Observable<T> {
    return new Observable<T>((observer) => {
      this.socket?.once(event, (data: T) => {
        this.ngZone.run(() => {
          observer.next(data);
          observer.complete();
        });
      });

      return () => {
        this.socket?.off(event);
      };
    });
  }
}
