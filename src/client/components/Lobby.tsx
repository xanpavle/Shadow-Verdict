import React, { useState } from 'react';
import { GameState, Player } from '../../shared/types';
import { socket } from '../socket';
import { Crown, CheckCircle2, Circle, Copy, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface Props {
  gameState: GameState;
  currentPlayer: Player;
}

export default function Lobby({ gameState, currentPlayer }: Props) {
  const [showQR, setShowQR] = useState(false);
  const isHost = currentPlayer.isHost;
  const allReady = gameState.players.every(p => p.isReady);
  
  const playerCount = gameState.settings.fillWithBots ? gameState.settings.maxPlayers : gameState.players.length;
  const isPlayerCountValid = playerCount === gameState.settings.maxPlayers;
  
  const canStart = isHost && isPlayerCountValid && allReady;

  const handleToggleReady = () => {
    socket.emit('toggleReady', gameState.code);
  };

  const handleStart = () => {
    if (canStart) {
      socket.emit('startGame', gameState.code);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(gameState.code);
  };

  let startButtonText = 'Start Game';
  if (!isPlayerCountValid) {
    startButtonText = `Need exactly ${gameState.settings.maxPlayers} players`;
  } else if (!allReady) {
    startButtonText = 'Waiting for players to ready';
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center p-4">
      <div className="max-w-md w-full space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-zinc-500 font-medium text-sm tracking-widest uppercase">Room Code</h2>
          <div className="flex items-center justify-center gap-4">
            <h1 className="text-6xl font-mono font-black tracking-widest text-emerald-400">{gameState.code}</h1>
            <div className="flex flex-col gap-2">
              <button onClick={copyCode} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-100">
                <Copy size={20} />
              </button>
              <button onClick={() => setShowQR(!showQR)} className="p-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-400 hover:text-zinc-100">
                <QrCode size={20} />
              </button>
            </div>
          </div>
          <p className="text-zinc-500 text-sm">
            {gameState.players.length} / {gameState.settings.maxPlayers} players
          </p>
        </div>

        {showQR && (
          <div className="flex justify-center p-4 bg-white rounded-2xl">
            <QRCodeSVG value={`${window.location.origin}?code=${gameState.code}`} size={200} />
          </div>
        )}

        {/* Player List */}
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-3xl p-4 space-y-2">
          {gameState.players.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-lg text-emerald-500">
                  {p.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold flex items-center gap-2">
                    {p.displayName}
                    {p.isHost && <Crown size={14} className="text-amber-400" />}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {p.id === currentPlayer.id ? '(You)' : ''}
                  </span>
                </div>
              </div>
              <div>
                {p.isReady ? (
                  <CheckCircle2 className="text-emerald-500" />
                ) : (
                  <Circle className="text-zinc-700" />
                )}
              </div>
            </div>
          ))}
          
          {/* Empty slots */}
          {Array.from({ length: gameState.settings.maxPlayers - gameState.players.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex items-center gap-3 p-3 rounded-2xl border border-dashed border-zinc-800/50 opacity-50">
              <div className="w-10 h-10 rounded-full border border-dashed border-zinc-700" />
              <span className="text-zinc-600 font-medium">Waiting for player...</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <button
            onClick={handleToggleReady}
            className={`w-full py-4 rounded-2xl font-bold transition-colors ${
              currentPlayer.isReady 
                ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' 
                : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400'
            }`}
          >
            {currentPlayer.isReady ? 'Not Ready' : 'Ready Up'}
          </button>

          {isHost && (
            <button
              onClick={handleStart}
              disabled={!canStart}
              className="w-full py-4 rounded-2xl font-bold transition-colors bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {startButtonText}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
