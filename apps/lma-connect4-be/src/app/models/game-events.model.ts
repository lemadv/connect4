// Event names
export enum GameEvents {
  // Client -> Server
  JOIN_ROOM = 'join_room',
  CREATE_ROOM = 'create_room',
  MAKE_MOVE = 'make_move',
  LEAVE_ROOM = 'leave_room',
  RECONNECT = 'reconnect',
  PLAY_AGAIN_REQUEST = 'play_again_request',
  PLAY_AGAIN_RESPONSE = 'play_again_response',
  START_GAME = 'start_game',

  // Server -> Client
  ROOM_JOINED = 'room_joined',
  ROOM_CREATED = 'room_created',
  PLAYER_JOINED = 'player_joined',
  GAME_STARTED = 'game_started',
  UPDATE_GAME = 'update_game',
  GAME_OVER = 'game_over',
  ERROR = 'error',
  PLAYER_DISCONNECTED = 'player_disconnected',
  PLAY_AGAIN_STATUS = 'play_again_status',
  PLAY_AGAIN_TIMEOUT = 'play_again_timeout'
}

// Payload interfaces
export interface JoinRoomPayload {
  roomId: string;
  player: {
    nickname: string;
    avatar: string;
  };
}

export interface CreateRoomPayload {
  player: {
    nickname: string;
    avatar: string;
  };
}

export interface StartGamePayload {
  roomId: string;
  playerId: string;
}

export interface MakeMovePayload {
  roomId: string;
  playerId: string;
  column: number;
}

export interface ReconnectPayload {
  playerId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
  playerId: string;
}

export interface PlayAgainRequestPayload {
  roomId: string;
  playerId: string;
}

export interface PlayAgainResponsePayload {
  roomId: string;
  playerId: string;
  accepted: boolean;
}
