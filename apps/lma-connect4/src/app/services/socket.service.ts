import { Inject, Injectable, NgZone, PLATFORM_ID } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root',
})
export class SocketService {
  private socket: Socket | null = null;
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    if (isPlatformBrowser(this.platformId)) {
      this.initSocket();
    }
  }

  private initSocket(): void {
    this.socket = io(environment.apiUrl, {
      reconnection: true,       // Enable reconnection
      reconnectionAttempts: 5,  // Try to reconnect 5 times
      reconnectionDelay: 1000,  // Start with 1 second delay
      reconnectionDelayMax: 5000 // Maximum 5 seconds delay
    });

    // Setup connection listeners
    this.socket.on('connect', () => {
      this.ngZone.run(() => {
        console.log('Socket connected');
        this.connectionStatusSubject.next(true);
      });
    });

    this.socket.on('disconnect', () => {
      this.ngZone.run(() => {
        console.log('Socket disconnected');
        this.connectionStatusSubject.next(false);
      });
    });

    this.socket.on('connect_error', (error) => {
      this.ngZone.run(() => {
        console.error('Socket connection error:', error);
        this.connectionStatusSubject.next(false);
      });
    });
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

  // Check if socket is currently connected
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}
