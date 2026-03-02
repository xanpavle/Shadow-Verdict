import React, { useEffect, useState } from 'react';
import { GameState, Player, ROLE_DEFINITIONS } from '../../shared/types';
import { Shield, Search, MicOff, UserX, PenTool, Crosshair, Smile, Eye, Ban, Briefcase, Skull, Users, User } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  gameState: GameState;
  currentPlayer: Player;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Shield, Search, MicOff, UserX, PenTool, Crosshair, Smile, Eye, Ban, Briefcase, Skull, Users, User
};

export default function RoleReveal({ gameState, currentPlayer }: Props) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    const updateTimer = () => {
      if (gameState.timerEnd) {
        const remaining = Math.max(0, Math.floor((gameState.timerEnd - Date.now()) / 1000));
        setTimeLeft(remaining);
      }
    };
    const interval = setInterval(updateTimer, 1000);
    updateTimer();
    return () => clearInterval(interval);
  }, [gameState.timerEnd]);

  if (!currentPlayer.role) return null;

  const roleDef = ROLE_DEFINITIONS[currentPlayer.role];
  const Icon = ICON_MAP[roleDef.icon] || User;

  const alignmentColor = 
    roleDef.alignment === 'Town' ? 'text-blue-400' :
    roleDef.alignment === 'Mafia' ? 'text-red-500' :
    'text-zinc-400';

  const glowColor = 
    roleDef.alignment === 'Town' ? 'shadow-blue-500/20' :
    roleDef.alignment === 'Mafia' ? 'shadow-red-500/20' :
    'shadow-zinc-500/20';

  const mafiaTeammates = gameState.players.filter(p => p.alignment === 'Mafia' && p.id !== currentPlayer.id);

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center p-6 z-50 overflow-hidden">
      {/* Subtle background animation */}
      <div className={clsx("absolute inset-0 opacity-10 blur-3xl rounded-full scale-150 animate-pulse", glowColor, "bg-current")} />
      
      <div className="relative z-10 flex flex-col items-center text-center max-w-md w-full space-y-8">
        <div className="space-y-2">
          <h2 className="text-zinc-500 font-bold tracking-widest uppercase text-sm">Your Role</h2>
          <h1 className={clsx("text-6xl font-black tracking-tighter", alignmentColor)}>
            {roleDef.name}
          </h1>
        </div>

        <div className={clsx("p-8 rounded-full bg-zinc-900 border-2", alignmentColor.replace('text-', 'border-'))}>
          <Icon size={80} className={alignmentColor} />
        </div>

        <div className="space-y-4 bg-zinc-900/80 p-6 rounded-3xl border border-zinc-800 w-full backdrop-blur-sm">
          <div className="space-y-2">
            {roleDef.description.map((desc, i) => (
              <p key={i} className="text-zinc-300 font-medium">{desc}</p>
            ))}
          </div>
          
          <div className="pt-4 border-t border-zinc-800">
            <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Win Condition</h3>
            <p className={clsx("font-bold", alignmentColor)}>{roleDef.winCondition}</p>
          </div>

          {roleDef.alignment === 'Mafia' && (
            <div className="pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2 flex items-center justify-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Your Teammates
              </h3>
              {mafiaTeammates.length > 0 ? (
                <div className="flex flex-wrap justify-center gap-2">
                  {mafiaTeammates.map(t => (
                    <div key={t.id} className="flex items-center gap-2 bg-zinc-950 border border-red-500/30 px-3 py-1.5 rounded-full">
                      <User size={14} className="text-red-400" />
                      <span className="text-sm font-bold text-red-100">{t.displayName}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">You are the only Mafia member.</p>
              )}
            </div>
          )}
        </div>

        <div className="text-4xl font-mono font-black text-zinc-600">
          {timeLeft}
        </div>
      </div>
    </div>
  );
}
