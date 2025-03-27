import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { GameService } from '../services/game.service';
import { map, take } from 'rxjs/operators';

export const gameGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const gameService = inject(GameService);
  const roomId = route.params['roomId'];

  return gameService.currentRoom$.pipe(
    take(1),
    map(room => {
      // Check if user is in a room and it's the correct room
      const isInRoom = !!room && room.id === roomId;

      if (!isInRoom) {
        router.navigate(['/lobby']);
        return false;
      }

      return true;
    })
  );
};
