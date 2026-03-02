import { Server, Socket } from 'socket.io';
import { GameState, Player, GameSettings, NightAction } from '../shared/types';
import { GameManager } from './game';

const games = new Map<string, GameManager>();

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    socket.on('hostGame', (settings: GameSettings, displayName: string, callback: (res: any) => void) => {
      const code = generateRoomCode();
      const game = new GameManager(code, settings, io);
      games.set(code, game);
      
      const player = game.addPlayer(socket.id, displayName, true);
      socket.join(code);
      
      callback({ success: true, code, player });
      game.broadcastState();
    });

    socket.on('joinGame', (code: string, displayName: string, callback: (res: any) => void) => {
      code = code.toUpperCase();
      const game = games.get(code);
      if (!game) {
        return callback({ success: false, error: 'Room not found' });
      }
      if (game.getState().phase !== 'Lobby') {
        return callback({ success: false, error: 'Game already started' });
      }

      const player = game.addPlayer(socket.id, displayName, false);
      if (!player) {
         return callback({ success: false, error: 'Room full or name taken' });
      }

      socket.join(code);
      callback({ success: true, code, player });
      game.broadcastState();
    });

    socket.on('toggleReady', (code: string) => {
      const game = games.get(code);
      if (game) {
        game.toggleReady(socket.id);
        game.broadcastState();
      }
    });

    socket.on('startGame', (code: string) => {
      const game = games.get(code);
      if (game && game.isHost(socket.id)) {
        game.startGame();
      }
    });

    socket.on('chatMessage', (code: string, message: string) => {
      const game = games.get(code);
      if (game) {
        game.handleChat(socket.id, message);
      }
    });

    socket.on('vote', (code: string, targetId: string) => {
      const game = games.get(code);
      if (game) {
        game.handleVote(socket.id, targetId);
      }
    });

    socket.on('nightAction', (code: string, action: NightAction) => {
      const game = games.get(code);
      if (game) {
        game.handleNightAction(socket.id, action);
      }
    });

    socket.on('hunterKill', (code: string, targetId: string) => {
      const game = games.get(code);
      if (game) {
        game.handleHunterKill(socket.id, targetId);
      }
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      // Handle disconnect logic
      for (const [code, game] of games.entries()) {
        if (game.hasPlayer(socket.id)) {
          game.handleDisconnect(socket.id);
          if (game.isEmpty()) {
            games.delete(code);
          }
        }
      }
    });
  });
}

function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
