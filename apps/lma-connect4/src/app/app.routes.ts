import { Route } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { LobbyComponent } from './pages/lobby/lobby.component';
import { GameComponent } from './pages/game/game.component';
import { playerGuard } from './guards/player.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    component: LandingComponent
  },
  {
    path: 'lobby',
    component: LobbyComponent,
    canActivate: [playerGuard]
  },
  {
    path: 'game/:roomId',
    component: GameComponent,
    canActivate: [playerGuard]
  },
  {
    path: '**',
    redirectTo: ''
  }
];
