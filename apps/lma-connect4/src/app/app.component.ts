import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { SocketService } from './services/socket.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  constructor(
    private socketService: SocketService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {
    // Connect to the WebSocket server
    if (isPlatformBrowser(this.platformId)) {
      this.socketService.connect();
    }

  }
}
