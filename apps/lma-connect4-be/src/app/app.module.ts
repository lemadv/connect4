import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './gateways/game.gateway';
import { GameService } from './services/game.service';
import { RoomService } from './services/room.service';
import { PlayerService } from './services/player.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, GameGateway, GameService, RoomService, PlayerService],
})
export class AppModule {}
