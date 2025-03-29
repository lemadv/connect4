import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { GameGateway } from './gateways/game.gateway';
import { PlayerService } from './services/player.service';
import { RoomService } from './services/room.service';
import { GameService } from './services/game.service';
import { GameBoardService } from './services/game-board.service';
import { ConfigService } from './services/config.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    GameGateway,
    PlayerService,
    RoomService,
    GameService,
    GameBoardService,
    ConfigService
  ],
})
export class AppModule {}
