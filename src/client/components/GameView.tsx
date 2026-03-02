import React, { useState, useEffect, useRef } from 'react';
import { GameState, Player, NightAction, ROLE_DEFINITIONS } from '../../shared/types';
import { socket } from '../socket';
import { MessageSquare, Inbox, Shield, Skull, Eye, Moon, Sun, Clock, Send } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  gameState: GameState;
  currentPlayer: Player;
}

export default function GameView({ gameState, currentPlayer }: Props) {
  const [activeTab, setActiveTab] = useState<'chat' | 'inbox' | 'log' | 'mafiaChat'>('chat');
  const [chatMessage, setChatMessage] = useState('');
  const [chatLogs, setChatLogs] = useState<{ sender: string; message: string; time: string }[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [selectedTarget2, setSelectedTarget2] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    socket.on('chatMessage', (msg) => {
      setChatLogs(prev => [...prev, msg]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => {
      socket.off('chatMessage');
    };
  }, []);

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

  useEffect(() => {
    if (gameState.phase !== 'Night') {
      setSelectedTarget(null);
      setSelectedTarget2(null);
    }
  }, [gameState.phase]);

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || gameState.phase !== 'Day' || !currentPlayer.isAlive || currentPlayer.isSilenced) return;
    socket.emit('chatMessage', gameState.code, chatMessage);
    setChatMessage('');
  };

  const handleVote = (targetId: string) => {
    if (gameState.phase !== 'Day' || !currentPlayer.isAlive) return;
    if (navigator.vibrate) navigator.vibrate(50);
    socket.emit('vote', gameState.code, targetId);
  };

  const submitNightAction = (actionType: string, targetId?: string, targetId2?: string) => {
    const action: NightAction = {
      playerId: currentPlayer.id,
      role: currentPlayer.role!,
      targetId: targetId,
      targetId2: targetId2,
      actionType: actionType
    };
    socket.emit('nightAction', gameState.code, action);
  };

  const lockNightAction = () => {
    socket.emit('nightAction', gameState.code, {
      playerId: currentPlayer.id,
      role: currentPlayer.role!,
      actionType: 'lock_action'
    });
  };

  const isMafia = currentPlayer.alignment === 'Mafia';

  const renderPlayerGrid = () => {
    return (
      <div className="flex flex-col h-full">
        <div className="grid grid-cols-3 gap-4 p-4">
          {gameState.players.map(p => {
            const isMe = p.id === currentPlayer.id;
            const isDead = !p.isAlive;
            const isVotingForMe = gameState.players.filter(v => v.voteTarget === p.id).length;
            const myVote = currentPlayer.voteTarget === p.id;
            const isMafiaTeammate = isMafia && p.alignment === 'Mafia' && !isMe;

            return (
              <div
                key={p.id}
                onClick={() => {
                  if (gameState.phase === 'Day' && !gameState.votingComplete && !isDead && !isMe) handleVote(p.id);
                }}
                className={clsx(
                  "relative flex flex-col items-center p-3 rounded-2xl border-2 transition-all cursor-pointer",
                  isDead ? "opacity-40 grayscale border-zinc-800 bg-zinc-900" : "hover:border-zinc-600 border-zinc-800 bg-zinc-900",
                  myVote && !isDead ? "border-emerald-500 bg-emerald-500/10" : "",
                  isMe ? "border-zinc-700" : "",
                  isMafiaTeammate && !isDead ? "border-red-500/30" : ""
                )}
              >
                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-xl mb-2 relative">
                  {p.displayName.charAt(0).toUpperCase()}
                  {isDead && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
                      <Skull size={20} className="text-red-500" />
                    </div>
                  )}
                  {isMafiaTeammate && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-zinc-800 animate-pulse" />}
                </div>
                <span className="text-xs font-bold text-center truncate w-full">{p.displayName}</span>
                {p.role && <span className={clsx("text-[10px] uppercase font-bold tracking-wider mt-1", p.alignment === 'Town' ? 'text-blue-400' : p.alignment === 'Mafia' ? 'text-red-400' : 'text-zinc-400')}>{p.role}</span>}
                {isVotingForMe > 0 && (
                  <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                    {isVotingForMe}
                  </div>
                )}
                {gameState.phase === 'Day' && p.voteTarget && (
                  <div className="absolute -bottom-2 bg-zinc-800 text-xs px-2 py-1 rounded-full border border-zinc-700">
                    Voted
                  </div>
                )}
                {isVotingForMe >= 3 && (
                  <div className="absolute -left-2 -top-2 text-orange-500 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {gameState.phase === 'Day' && currentPlayer.isAlive && (
          <div className="px-4 pb-4 mt-auto">
            <button
              onClick={() => {
                if (!gameState.votingComplete) handleVote('skip');
              }}
              disabled={gameState.votingComplete}
              className={clsx(
                "w-full py-3 rounded-xl font-bold transition-all border-2",
                currentPlayer.voteTarget === 'skip' 
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" 
                  : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700",
                gameState.votingComplete && "opacity-50 cursor-not-allowed"
              )}
            >
              Skip Vote
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={clsx(
      "min-h-screen text-zinc-100 flex flex-col transition-colors duration-1000",
      gameState.phase === 'Day' ? "bg-zinc-900" : "bg-zinc-950"
    )}>
      {/* Top Bar */}
      <div className="flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="font-mono font-bold text-emerald-500 tracking-widest">{gameState.code}</div>
          <div className="text-xs text-zinc-500 flex items-center gap-1">
            <Clock size={12} />
            Day {gameState.dayCount}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={clsx(
            "flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold",
            gameState.phase === 'Day' ? "bg-amber-500/20 text-amber-400" : "bg-indigo-500/20 text-indigo-400"
          )}>
            {gameState.phase === 'Day' ? <Sun size={16} /> : <Moon size={16} />}
            {gameState.phase === 'Day' && gameState.votingComplete ? 'Voting Complete...' : gameState.phase}
          </div>
          <div className="font-mono text-xl font-bold w-12 text-right">
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {gameState.phase === 'End' ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6">
            <h1 className="text-6xl font-black mb-4 uppercase tracking-tighter">Game Over</h1>
            <div className={clsx(
              "text-5xl font-black px-8 py-6 rounded-3xl shadow-2xl",
              gameState.winner === 'Town' ? "bg-blue-500/20 text-blue-400 shadow-blue-500/20" :
              gameState.winner === 'Mafia' ? "bg-red-500/20 text-red-400 shadow-red-500/20" :
              "bg-purple-500/20 text-purple-400 shadow-purple-500/20"
            )}>
              {gameState.winner} WINS
            </div>
            
            <div className="w-full max-w-2xl mt-8 space-y-4">
              <h3 className="text-xl font-bold text-zinc-400">Player Roles</h3>
              <div className="grid grid-cols-2 gap-3 text-left">
                {gameState.players.map(p => (
                  <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex items-center justify-between">
                    <span className={clsx("font-bold", !p.isAlive && "line-through text-zinc-500")}>{p.displayName}</span>
                    <span className={clsx(
                      "text-sm font-bold",
                      p.alignment === 'Town' ? "text-blue-400" :
                      p.alignment === 'Mafia' ? "text-red-400" : "text-purple-400"
                    )}>{p.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {currentPlayer.isHost && (
              <div className="flex gap-4 mt-8">
                <button onClick={() => window.location.href = '/'} className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-colors">
                  Return to Menu
                </button>
              </div>
            )}
            {!currentPlayer.isHost && (
              <div className="text-zinc-500 mt-8">Waiting for host...</div>
            )}
          </div>
        ) : (
          renderPlayerGrid()
        )}
      </div>

      {/* Bottom Panel */}
      <div className="h-64 bg-zinc-900 border-t border-zinc-800 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('chat')}
            className={clsx("flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors", activeTab === 'chat' ? "text-emerald-400 border-b-2 border-emerald-400" : "text-zinc-500 hover:text-zinc-300")}
          >
            <MessageSquare size={16} /> Chat
          </button>
          
          {isMafia && (
            <button
              onClick={() => setActiveTab('mafiaChat')}
              className={clsx("flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors", activeTab === 'mafiaChat' ? "text-red-400 border-b-2 border-red-400" : "text-zinc-500 hover:text-zinc-300")}
            >
              <MessageSquare size={16} /> Mafia
            </button>
          )}

          <button
            onClick={() => setActiveTab('inbox')}
            className={clsx("flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors relative", activeTab === 'inbox' ? "text-emerald-400 border-b-2 border-emerald-400" : "text-zinc-500 hover:text-zinc-300")}
          >
            <Inbox size={16} /> Inbox
            {currentPlayer.inbox.length > 0 && (
              <span className="absolute top-2 right-4 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('log')}
            className={clsx("flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors", activeTab === 'log' ? "text-emerald-400 border-b-2 border-emerald-400" : "text-zinc-500 hover:text-zinc-300")}
          >
            <Eye size={16} /> Logs
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'chat' && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                {chatLogs.map((log, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-bold text-zinc-400">{log.sender}: </span>
                    <span className="text-zinc-200">{log.message}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  disabled={gameState.phase !== 'Day' || !currentPlayer.isAlive || currentPlayer.isSilenced}
                  placeholder={
                    !currentPlayer.isAlive ? "Dead players cannot speak" :
                    currentPlayer.isSilenced ? "You are silenced today" :
                    gameState.phase !== 'Day' ? "Chat is disabled at night" :
                    "Message..."
                  }
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={gameState.phase !== 'Day' || !currentPlayer.isAlive || currentPlayer.isSilenced || !chatMessage.trim()}
                  className="bg-emerald-500 text-zinc-950 p-2 rounded-xl disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'mafiaChat' && isMafia && (
            <div className="flex flex-col h-full">
              <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                <div className="text-sm text-red-400 italic text-center py-4">
                  Mafia Chat is private to your team.
                </div>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); }} className="flex gap-2">
                <input
                  type="text"
                  placeholder={
                    !currentPlayer.isAlive ? "Dead players cannot speak" :
                    (gameState.phase === 'Day' && !gameState.settings.allowMafiaDayChat) ? "Mafia chat disabled during Day" :
                    "Message Mafia..."
                  }
                  disabled={!currentPlayer.isAlive || (gameState.phase === 'Day' && !gameState.settings.allowMafiaDayChat)}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-500 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!currentPlayer.isAlive || (gameState.phase === 'Day' && !gameState.settings.allowMafiaDayChat)}
                  className="bg-red-500 text-zinc-950 p-2 rounded-xl disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
              </form>
            </div>
          )}

          {activeTab === 'inbox' && (
            <div className="space-y-3">
              {currentPlayer.inbox.map(msg => {
                let icon = null;
                let colorClass = 'border-zinc-800 bg-zinc-950';
                
                if (msg.type === 'result') {
                  switch (msg.resultCategory) {
                    case 'success':
                      icon = '🟢';
                      colorClass = 'border-emerald-500/30 bg-emerald-500/5';
                      break;
                    case 'no_event':
                      icon = '🔵';
                      colorClass = 'border-blue-500/30 bg-blue-500/5';
                      break;
                    case 'blocked':
                      icon = '🔴';
                      colorClass = 'border-red-500/30 bg-red-500/5';
                      break;
                    case 'immune':
                      icon = '🟡';
                      colorClass = 'border-amber-500/30 bg-amber-500/5';
                      break;
                    case 'invalid':
                      icon = '⚪';
                      colorClass = 'border-zinc-500/30 bg-zinc-500/5';
                      break;
                  }
                }

                return (
                  <div key={msg.id} className={clsx("p-4 rounded-xl border text-sm", colorClass)}>
                    {msg.day !== undefined && (
                      <div className="text-xs font-bold text-zinc-500 mb-1 uppercase tracking-wider">
                        Night {msg.day} Report
                      </div>
                    )}
                    <div className="flex items-start gap-2">
                      {icon && <span className="mt-0.5">{icon}</span>}
                      <div className="text-zinc-200 leading-relaxed font-medium">{msg.text}</div>
                    </div>
                    {msg.type === 'prompt' && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => {
                            socket.emit('nightAction', gameState.code, {
                              playerId: currentPlayer.id,
                              role: currentPlayer.role!,
                              targetId: msg.promptData?.targetId,
                              actionType: 'protect'
                            });
                            // Remove prompt from local view immediately for better UX
                            currentPlayer.inbox = currentPlayer.inbox.filter(m => m.id !== msg.id);
                          }}
                          className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-4 py-1.5 rounded-lg font-bold text-xs"
                        >
                          Yes
                        </button>
                        <button
                          onClick={() => {
                            currentPlayer.inbox = currentPlayer.inbox.filter(m => m.id !== msg.id);
                          }}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-lg font-bold text-xs"
                        >
                          No
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              {currentPlayer.inbox.length === 0 && (
                <div className="text-center text-zinc-500 text-sm mt-8">No messages</div>
              )}
            </div>
          )}

          {activeTab === 'log' && (
            <div className="space-y-2">
              {gameState.publicLogs.map((log, i) => (
                <div key={i} className="text-sm text-zinc-400">
                  {log}
                </div>
              ))}
              {gameState.publicLogs.length === 0 && (
                <div className="text-center text-zinc-500 text-sm mt-8">No events yet</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Night Action Panel */}
      {(gameState.phase === 'Night' || gameState.phase === 'HunterSelection') && currentPlayer.isAlive && (
        <div className="absolute inset-0 z-40 bg-zinc-950 flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
          {/* Left Side: Players */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col">
            <h3 className="text-xl font-bold text-indigo-400 mb-4 flex items-center gap-2">
              {gameState.phase === 'Night' ? <Moon size={20} /> : <Skull size={20} />}
              {gameState.phase === 'Night' ? (currentPlayer.role === 'Switchblade' ? 'Select Role' : 'Select Target') : 'Select Victim'}
            </h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {currentPlayer.role === 'Switchblade' ? (
                Object.keys(ROLE_DEFINITIONS).sort().map(roleName => {
                  const isSelected = selectedTarget === roleName;
                  return (
                    <button
                      key={roleName}
                      onClick={() => {
                        if (!currentPlayer.actionLocked) {
                          setSelectedTarget(roleName);
                        }
                      }}
                      disabled={currentPlayer.actionLocked}
                      className={clsx(
                        "w-full text-left px-4 py-3 rounded-xl transition-colors font-bold flex justify-between items-center",
                        isSelected ? "bg-indigo-500 text-white" : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800",
                        currentPlayer.actionLocked && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span>{roleName}</span>
                    </button>
                  );
                })
              ) : (
                gameState.players.filter(p => p.isAlive && p.id !== currentPlayer.id).map(p => {
                  const isSelected = selectedTarget === p.id;
                  const mafiaVoteCount = Object.values(gameState.mafiaKillVotes || {}).filter(id => id === p.id).length;
                  
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        if (!currentPlayer.actionLocked) {
                          setSelectedTarget(p.id);
                        }
                      }}
                      disabled={currentPlayer.actionLocked}
                      className={clsx(
                        "w-full text-left px-4 py-3 rounded-xl transition-colors font-bold flex justify-between items-center",
                        isSelected ? "bg-indigo-500 text-white" : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800",
                        currentPlayer.actionLocked && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <span>{p.displayName}</span>
                      {isMafia && mafiaVoteCount > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          {mafiaVoteCount} Vote{mafiaVoteCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Side: Abilities */}
          <div className="flex-1 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 flex flex-col">
            <div className="mb-6">
              <h2 className="text-3xl font-black text-white mb-1">{currentPlayer.role}</h2>
              <p className="text-zinc-400 text-sm">
                {gameState.phase === 'Night' ? 'Select an ability and a target, then confirm.' : 'Choose one person to take down with you!'}
              </p>
            </div>

            <div className="flex-1 space-y-4">
              {gameState.phase === 'Night' && ROLE_DEFINITIONS[currentPlayer.role!].abilities.map(ability => {
                const isAmnesiac = currentPlayer.role === 'Amnesiac';
                if (isAmnesiac) return null;

                return (
                  <div key={ability.id} className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-lg text-indigo-300">{ability.name}</h4>
                      {ability.uses !== -1 && (
                        <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded text-zinc-400">
                          {currentPlayer.abilityUses?.[ability.id] ?? ability.uses} uses left
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-400 mb-4">{ability.description}</p>
                    
                    <button
                      onClick={() => {
                        if (ability.isMafiaSharedKill) {
                          submitNightAction('mafia_kill_vote', selectedTarget || undefined);
                        } else {
                          submitNightAction(ability.id, selectedTarget || undefined);
                        }
                      }}
                      disabled={currentPlayer.actionLocked || (ability.targetRequired && !selectedTarget) || ((currentPlayer.abilityUses?.[ability.id] ?? ability.uses) === 0)}
                      className={clsx(
                        "w-full py-3 rounded-xl font-bold transition-all",
                        currentPlayer.actionLocked || ((currentPlayer.abilityUses?.[ability.id] ?? ability.uses) === 0) ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
                        (ability.targetRequired && !selectedTarget) ? "bg-zinc-800 text-zinc-500 cursor-not-allowed" :
                        ability.isMafiaSharedKill ? "bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20" :
                        "bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/20"
                      )}
                    >
                      {((currentPlayer.abilityUses?.[ability.id] ?? ability.uses) === 0) ? 'Out of Uses' : ability.isMafiaSharedKill ? 'Vote to Kill' : 'Use Ability'}
                    </button>
                  </div>
                );
              })}

              {gameState.phase === 'HunterSelection' && currentPlayer.role === 'Hunter' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4">
                  <h4 className="font-bold text-lg text-red-400 mb-2">Final Revenge</h4>
                  <p className="text-sm text-zinc-400 mb-4">Choose a target to kill instantly.</p>
                  <button
                    onClick={() => {
                      if (selectedTarget) {
                        socket.emit('hunterKill', gameState.code, selectedTarget);
                      }
                    }}
                    disabled={!selectedTarget}
                    className="w-full py-3 rounded-xl font-bold bg-red-500 hover:bg-red-400 text-white disabled:opacity-50"
                  >
                    Take Revenge
                  </button>
                </div>
              )}

              {gameState.phase === 'Night' && (ROLE_DEFINITIONS[currentPlayer.role!].abilities.length === 0 || currentPlayer.role === 'Amnesiac') && (
                <div className="text-center text-zinc-500 italic py-8">
                  You have no active ability.
                </div>
              )}
            </div>

            {gameState.phase === 'Night' && (
              <div className="mt-auto pt-6 border-t border-zinc-800">
                <button
                  onClick={lockNightAction}
                  disabled={currentPlayer.actionLocked}
                  className={clsx(
                    "w-full py-4 rounded-xl font-black text-lg transition-all uppercase tracking-wider",
                    currentPlayer.actionLocked ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/50" :
                    "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-xl shadow-emerald-500/20"
                  )}
                >
                  {currentPlayer.actionLocked ? 'Action Locked' : 'Confirm & Lock Action'}
                </button>
                <p className="text-center text-xs text-zinc-500 mt-3">
                  You cannot change your action after confirming.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Hunter Selection for Dead Hunter */}
      {gameState.phase === 'HunterSelection' && !currentPlayer.isAlive && currentPlayer.role === 'Hunter' && !currentPlayer.hunterKilled && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-8 text-center">
          <Skull size={64} className="text-red-500 mb-6 animate-bounce" />
          <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tighter">Final Revenge</h2>
          <p className="text-zinc-400 mb-8 max-w-md">You were lynched! You have 10 seconds to choose one player to take down with you.</p>
          
          <div className="w-full max-w-md space-y-2 mb-8">
            {gameState.players.filter(p => p.isAlive).map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id)}
                className={clsx(
                  "w-full py-3 rounded-xl font-bold transition-all",
                  selectedTarget === p.id ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                )}
              >
                {p.displayName}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (selectedTarget) {
                socket.emit('hunterKill', gameState.code, selectedTarget);
              }
            }}
            disabled={!selectedTarget}
            className="w-full max-w-md py-4 rounded-xl font-black text-xl bg-red-600 hover:bg-red-500 text-white shadow-2xl shadow-red-500/40 disabled:opacity-50 uppercase tracking-widest"
          >
            Kill Target
          </button>
          
          <div className="mt-6 text-red-500 font-mono text-2xl font-bold">
            {timeLeft}s
          </div>
        </div>
      )}
    </div>
  );
}
