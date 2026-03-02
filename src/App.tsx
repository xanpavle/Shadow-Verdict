import React, { useEffect, useState } from 'react';
import { socket } from './client/socket';
import { GameState, Player, GameSettings } from './shared/types';
import MainMenu from './client/components/MainMenu';
import Lobby from './client/components/Lobby';
import GameView from './client/components/GameView';
import RoleReveal from './client/components/RoleReveal';

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on('gameState', (state: GameState) => {
      setGameState(state);
      const me = state.players.find(p => p.id === socket.id);
      if (me) setCurrentPlayer(me);
    });

    return () => {
      socket.off('gameState');
      socket.disconnect();
    };
  }, []);

  const handleHost = (settings: GameSettings, displayName: string) => {
    socket.emit('hostGame', settings, displayName, (res: any) => {
      if (!res.success) setError(res.error);
    });
  };

  const handleJoin = (code: string, displayName: string) => {
    socket.emit('joinGame', code, displayName, (res: any) => {
      if (!res.success) setError(res.error);
    });
  };

  if (!gameState) {
    return <MainMenu onHost={handleHost} onJoin={handleJoin} error={error} />;
  }

  if (gameState.phase === 'Lobby') {
    return <Lobby gameState={gameState} currentPlayer={currentPlayer!} />;
  }

  if (gameState.phase === 'RoleReveal') {
    return <RoleReveal gameState={gameState} currentPlayer={currentPlayer!} />;
  }

  return <GameView gameState={gameState} currentPlayer={currentPlayer!} />;
}
