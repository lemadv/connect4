import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { GameService } from '../services/game.service';
import { map, take } from 'rxjs/operators';

export const playerGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const gameService = inject(GameService);

  return gameService.currentPlayer$.pipe(
    take(1),
    map(player => {
      const isLoggedIn = !!player;
      if (!isLoggedIn) {
        router.navigate(['/']);
        return false;
      }
      return true;
    })
  );
};
