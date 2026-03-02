import React, { useState } from 'react';
import { GameSettings, Role, ROLE_DEFINITIONS } from '../../shared/types';
import { Users, Play, Settings, BookOpen, Bot, ChevronDown, ChevronUp, Shield, Skull, User, Lock, Sun, Moon } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  onHost: (settings: GameSettings, displayName: string) => void;
  onJoin: (code: string, displayName: string) => void;
  error: string | null;
}

export default function MainMenu({ onHost, onJoin, error }: Props) {
  const [view, setView] = useState<'main' | 'host' | 'join' | 'rules' | 'settings'>('main');
  const [displayName, setDisplayName] = useState('');
  const [code, setCode] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showRoleConfig, setShowRoleConfig] = useState(false);

  // Host Settings
  const [mode, setMode] = useState<'Quick' | 'Casual' | 'Ranked' | 'Practice'>('Quick');
  const [maxPlayers, setMaxPlayers] = useState(8);
  
  // Advanced Settings
  const [roleRevealDuration, setRoleRevealDuration] = useState(15);
  const [allowTapToCloseEarly, setAllowTapToCloseEarly] = useState(false);
  const [dayDuration, setDayDuration] = useState(90);
  const [nightDuration, setNightDuration] = useState(25);
  const [autoSkipNight, setAutoSkipNight] = useState(true);
  
  const [anonymousVotes, setAnonymousVotes] = useState(false);
  const [tieBehavior, setTieBehavior] = useState<'NoLynch' | 'Random' | 'Revote'>('NoLynch');
  
  const [revealOnDeath, setRevealOnDeath] = useState<'Role' | 'Alignment' | 'None'>('Role');
  
  const [enableNeutrals, setEnableNeutrals] = useState(true);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [allowMafiaDayChat, setAllowMafiaDayChat] = useState(false);
  
  const [fillWithBots, setFillWithBots] = useState(false);
  const [botDifficulty, setBotDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [practiceRole, setPracticeRole] = useState<Role | 'Random'>('Random');
  const [customMode, setCustomMode] = useState(false);

  const [enabledRoles, setEnabledRoles] = useState<Partial<Record<Role, number>>>({
    Healer: 1, Cop: 1, Silencer: 1, Bodyguard: 1, Framer: 1, Vigilante: 1, Jester: 1, Lookout: 1, Roleblocker: 1, Consigliere: 1,
    Mafia: 1, Town: 1, Neutral: 1, Protector: 1, Arsonist: 1, 'Cult Leader': 1, Detective: 1, Traitor: 1, Amnesiac: 1, Timekeeper: 1,
    Broker: 1, Double: 1, Archivist: 1, Reanimator: 1, Pacifist: 1, Tinkerer: 1, Saboteur: 1, Gambler: 1, Occultist: 1, Cull: 1,
    Echo: 1, Mender: 1, 'Town Saboteur': 1, 'Bounty Hunter': 1, Caretaker: 1, Switchblade: 1, Warden: 1, Berserker: 1, Beacon: 1,
    Witch: 1, 'Grim Reaper': 1, Maskmaker: 1, Confessor: 1, Thief: 1, 'Oracle Apprentice': 1, Executioner: 1, Toxicologist: 1,
    Sage: 1, Prophet: 1, Hunter: 1, Locksmith: 1, 'Beacon of Silence': 1, Recluse: 1, 'Final Witness': 1
  });

  const [roleFilter, setRoleFilter] = useState<'All' | 'Town' | 'Mafia' | 'Neutral'>('All');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const codeParam = params.get('code');
    if (codeParam) {
      setCode(codeParam.toUpperCase());
      setView('join');
    }
  }, []);

  const handleHost = () => {
    if (!displayName) return;
    
    const totalRoles = Object.values(enabledRoles).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
    const townCount = Object.entries(enabledRoles).filter(([r, c]) => c && ROLE_DEFINITIONS[r as Role]?.alignment === 'Town').reduce((a: number, [_, c]: [string, number | undefined]) => a + (c || 0), 0);
    const mafiaCount = Object.entries(enabledRoles).filter(([r, c]) => c && ROLE_DEFINITIONS[r as Role]?.alignment === 'Mafia').reduce((a: number, [_, c]: [string, number | undefined]) => a + (c || 0), 0);
    const neutralCount = Object.entries(enabledRoles).filter(([r, c]) => c && ROLE_DEFINITIONS[r as Role]?.alignment === 'Neutral').reduce((a: number, [_, c]: [string, number | undefined]) => a + (c || 0), 0);
    const jesterCount = enabledRoles['Jester'] || 0;

    let validationError = null;
    
    if (!customMode) {
      let reqMafia = 0;
      let reqNeutral = 0;
      let reqJester = 0;
      
      if (maxPlayers <= 6) { reqMafia = 1; reqNeutral = 0; }
      else if (maxPlayers === 7) { reqMafia = 1; reqNeutral = 1; }
      else if (maxPlayers === 8) { reqMafia = 2; reqNeutral = 0; }
      else if (maxPlayers === 9) { reqMafia = 2; reqNeutral = 1; }
      else if (maxPlayers === 10) { reqMafia = 2; reqNeutral = 1; reqJester = 1; }
      else if (maxPlayers === 11) { reqMafia = 3; reqNeutral = 1; reqJester = 0; }
      else if (maxPlayers === 12) { reqMafia = 3; reqNeutral = 1; reqJester = 1; }
      else if (maxPlayers === 13) { reqMafia = 3; reqNeutral = 2; reqJester = 1; }
      else if (maxPlayers === 14) { reqMafia = 4; reqNeutral = 2; reqJester = 1; }
      else { reqMafia = 4; reqNeutral = 3; reqJester = 1; }

      if (mafiaCount < reqMafia) validationError = `${maxPlayers}-player games require at least ${reqMafia} Mafia role(s) to be selected.`;
      else if (neutralCount < reqNeutral) validationError = `${maxPlayers}-player games require at least ${reqNeutral} Neutral role(s) to be selected.`;
      else if (jesterCount < reqJester) validationError = `${maxPlayers}-player games must include at least ${reqJester} Jester.`;
    } else {
      // In custom mode, we don't strictly enforce max limits on the *pool* of roles,
      // because the server will randomly select from the pool to meet the player count.
      // We just need to make sure there's enough roles in the pool.
    }

    if (totalRoles < maxPlayers) {
      validationError = `You must select at least ${maxPlayers} roles (currently ${totalRoles}). If you select more, they will be randomly chosen.`;
    }

    if (validationError) {
      alert(validationError);
      return;
    }

    onHost(
      { 
        mode, maxPlayers, 
        roleRevealDuration, allowTapToCloseEarly, dayDuration, nightDuration, autoSkipNight,
        anonymousVotes, tieBehavior,
        revealOnDeath,
        enableNeutrals, allowDuplicates, enabledRoles,
        fillWithBots, botDifficulty, practiceRole, allowMafiaDayChat, customMode
      },
      displayName
    );
  };

  const handleJoin = () => {
    if (!displayName || !code) return;
    onJoin(code, displayName);
  };

  const handlePractice = () => {
    if (!displayName) {
      setDisplayName('Player');
    }
    setMode('Practice');
    setFillWithBots(true);
    setView('host');
  };

  const incrementRole = (role: Role) => {
    setEnabledRoles(prev => {
      const current = prev[role] || 0;
      if (!allowDuplicates && current >= 1) return prev;
      return { ...prev, [role]: current + 1 };
    });
  };

  const decrementRole = (role: Role) => {
    setEnabledRoles(prev => {
      const current = prev[role] || 0;
      if (current <= 0) return prev;
      return { ...prev, [role]: current - 1 };
    });
  };

  const applyPreset = (preset: 'Balanced' | 'Chaos' | 'Competitive') => {
    const newRoles: Partial<Record<Role, number>> = {};
    Object.keys(ROLE_DEFINITIONS).forEach(r => newRoles[r as Role] = 0);
    
    if (preset === 'Balanced') {
      ['Healer', 'Cop', 'Silencer', 'Bodyguard', 'Framer', 'Lookout', 'Roleblocker', 'Consigliere'].forEach(r => newRoles[r as Role] = 1);
    } else if (preset === 'Chaos') {
      ['Healer', 'Cop', 'Silencer', 'Vigilante', 'Jester', 'Lookout', 'Consigliere'].forEach(r => newRoles[r as Role] = 1);
    } else if (preset === 'Competitive') {
      ['Healer', 'Cop', 'Silencer', 'Bodyguard', 'Framer', 'Lookout', 'Roleblocker', 'Consigliere'].forEach(r => newRoles[r as Role] = 1);
    }
    setEnabledRoles(newRoles);
  };

  const renderRoleConfig = () => {
    const roles = Object.entries(ROLE_DEFINITIONS)
      .filter(([role]) => role !== 'Town' && role !== 'Mafia' && role !== 'Neutral')
      .filter(([_, def]) => roleFilter === 'All' || def.alignment === roleFilter);

    // Calculate balance
    const totalRoles = Object.values(enabledRoles).reduce((a: number, b: number | undefined) => a + (b || 0), 0);
    const townCount = Object.entries(enabledRoles).filter(([r, c]) => c && ROLE_DEFINITIONS[r as Role]?.alignment === 'Town').reduce((a: number, [_, c]: [string, number | undefined]) => a + (c || 0), 0);
    const mafiaCount = Object.entries(enabledRoles).filter(([r, c]) => c && ROLE_DEFINITIONS[r as Role]?.alignment === 'Mafia').reduce((a: number, [_, c]: [string, number | undefined]) => a + (c || 0), 0);
    const neutralCount = Object.entries(enabledRoles).filter(([r, c]) => c && ROLE_DEFINITIONS[r as Role]?.alignment === 'Neutral').reduce((a: number, [_, c]: [string, number | undefined]) => a + (c || 0), 0);
    const jesterCount = enabledRoles['Jester'] || 0;

    let reqMafia = 0;
    let reqNeutral = 0;
    let reqJester = 0;
    let maxMafia = maxPlayers;
    let maxNeutral = maxPlayers;
    let validationError = null;
    
    if (!customMode) {
      if (maxPlayers <= 6) { reqMafia = 1; reqNeutral = 0; }
      else if (maxPlayers === 7) { reqMafia = 1; reqNeutral = 1; }
      else if (maxPlayers === 8) { reqMafia = 2; reqNeutral = 0; }
      else if (maxPlayers === 9) { reqMafia = 2; reqNeutral = 1; }
      else if (maxPlayers === 10) { reqMafia = 2; reqNeutral = 1; reqJester = 1; }
      else if (maxPlayers === 11) { reqMafia = 3; reqNeutral = 1; reqJester = 0; }
      else if (maxPlayers === 12) { reqMafia = 3; reqNeutral = 1; reqJester = 1; }
      else if (maxPlayers === 13) { reqMafia = 3; reqNeutral = 2; reqJester = 1; }
      else if (maxPlayers === 14) { reqMafia = 4; reqNeutral = 2; reqJester = 1; }
      else { reqMafia = 4; reqNeutral = 3; reqJester = 1; }

      maxMafia = reqMafia;
      maxNeutral = reqNeutral;

      if (mafiaCount < reqMafia) validationError = `${maxPlayers}-player games require at least ${reqMafia} Mafia role(s) to be selected.`;
      else if (neutralCount < reqNeutral) validationError = `${maxPlayers}-player games require at least ${reqNeutral} Neutral role(s) to be selected.`;
      else if (jesterCount < reqJester) validationError = `${maxPlayers}-player games must include at least ${reqJester} Jester.`;
    } else {
      maxMafia = Math.floor(maxPlayers * 0.4);
      maxNeutral = Math.floor(maxPlayers * 0.5);
      // In custom mode, we don't strictly enforce max limits on the *pool* of roles,
      // because the server will randomly select from the pool to meet the player count.
      // We just need to make sure there's enough roles in the pool.
    }

    if (totalRoles < maxPlayers) {
      validationError = `You must select at least ${maxPlayers} roles (currently ${totalRoles}).`;
    }

    const canSave = !validationError;

    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 overflow-y-auto p-4 flex flex-col">
        <div className="max-w-3xl w-full mx-auto space-y-6">
          <div className="flex items-center justify-between sticky top-0 bg-zinc-950/90 backdrop-blur py-4 z-10 border-b border-zinc-800">
            <h2 className="text-2xl font-bold">Role Configuration</h2>
            <button 
              onClick={() => {
                if (canSave) setShowRoleConfig(false);
              }} 
              disabled={!canSave}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500 rounded-xl font-bold transition-colors"
            >
              Done
            </button>
          </div>

          <div className="flex flex-col gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-400">Custom Mode</span>
                <button 
                  onClick={() => setCustomMode(!customMode)}
                  className={clsx("w-10 h-6 rounded-full p-1 transition-colors", customMode ? "bg-emerald-500" : "bg-zinc-800")}
                >
                  <div className={clsx("w-4 h-4 rounded-full bg-white transition-transform", customMode ? "translate-x-4" : "translate-x-0")} />
                </button>
              </div>
              <div className="text-sm font-bold text-zinc-400">
                Total: <span className={totalRoles === maxPlayers ? "text-emerald-400" : "text-zinc-100"}>{totalRoles} / {maxPlayers}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm font-bold text-center">
              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <div className="text-red-400 mb-1">Mafia</div>
                <div>{mafiaCount} {reqMafia > 0 ? `/ ${reqMafia}` : ''}</div>
              </div>
              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <div className="text-zinc-400 mb-1">Neutral</div>
                <div>{neutralCount} {reqNeutral > 0 ? `/ ${reqNeutral}` : ''}</div>
              </div>
              <div className="bg-zinc-950 p-2 rounded-xl border border-zinc-800">
                <div className="text-blue-400 mb-1">Town</div>
                <div>{townCount}</div>
              </div>
            </div>

            {validationError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm font-medium">
                {validationError}
              </div>
            )}
            {customMode && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-3 rounded-xl text-sm font-medium">
                Custom Mode may create unbalanced gameplay.
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => applyPreset('Balanced')} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium">Balanced</button>
            <button onClick={() => applyPreset('Chaos')} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium">Chaos</button>
            <button onClick={() => applyPreset('Competitive')} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium">Competitive</button>
          </div>

          <div className="flex items-center justify-between bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <div className="flex gap-2">
              {(['All', 'Town', 'Mafia', 'Neutral'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setRoleFilter(f)}
                  className={clsx("px-4 py-1.5 rounded-lg text-sm font-bold transition-colors", roleFilter === f ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700")}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map(([roleStr, def]) => {
              const role = roleStr as Role;
              const count = enabledRoles[role] || 0;
              const isEnabled = count > 0;
              const alignmentColor = def.alignment === 'Town' ? 'text-blue-400 border-blue-500/30' : def.alignment === 'Mafia' ? 'text-red-400 border-red-500/30' : 'text-zinc-400 border-zinc-500/30';
              const glowClass = isEnabled ? (def.alignment === 'Town' ? 'shadow-[0_0_15px_rgba(59,130,246,0.2)] border-blue-500' : def.alignment === 'Mafia' ? 'shadow-[0_0_15px_rgba(239,68,68,0.2)] border-red-500' : 'shadow-[0_0_15px_rgba(161,161,170,0.2)] border-zinc-400') : 'border-zinc-800 opacity-60';

              return (
                <div key={role} className={clsx("relative p-4 rounded-2xl border-2 transition-all bg-zinc-900", glowClass)}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className={clsx("font-bold text-lg", isEnabled ? alignmentColor.split(' ')[0] : 'text-zinc-500')}>{def.name}</h3>
                      <span className={clsx("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border", alignmentColor)}>{def.alignment}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => decrementRole(role)}
                        disabled={count <= 0}
                        className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center font-bold"
                      >-</button>
                      <span className="w-4 text-center font-bold">{count}</span>
                      <button 
                        onClick={() => incrementRole(role)}
                        disabled={!allowDuplicates && count >= 1}
                        className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 flex items-center justify-center font-bold"
                      >+</button>
                    </div>
                  </div>
                  <p className="text-sm text-zinc-400">{def.description[0]}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-emerald-400">Shadow Verdict</h1>
          <p className="text-zinc-400 mt-2 font-medium">Party Mafia</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {view === 'main' && (
          <div className="space-y-4">
            <button
              onClick={() => setView('host')}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Users size={20} />
              Host Game
            </button>
            <button
              onClick={() => setView('join')}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Play size={20} />
              Join Game
            </button>
            <button
              onClick={handlePractice}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-bold py-4 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              <Bot size={20} />
              Practice (Bots)
            </button>
            
            <div className="flex justify-center gap-4 pt-4">
              <button onClick={() => setView('rules')} className="text-zinc-500 hover:text-zinc-300 flex flex-col items-center gap-1 text-xs font-medium">
                <BookOpen size={16} />
                Rules
              </button>
              <button onClick={() => setView('settings')} className="text-zinc-500 hover:text-zinc-300 flex flex-col items-center gap-1 text-xs font-medium">
                <Settings size={16} />
                Settings
              </button>
            </div>
          </div>
        )}

        {view === 'host' && (
          <div className="space-y-4 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 text-left max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">{mode === 'Practice' ? 'Practice Setup' : 'Host Settings'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Your name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Max Players</label>
                <input
                  type="range"
                  min="6"
                  max="12"
                  value={maxPlayers}
                  onChange={e => setMaxPlayers(parseInt(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="text-right text-xs text-zinc-500">{maxPlayers} players</div>
              </div>

              {mode === 'Practice' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Bot Difficulty</label>
                    <select
                      value={botDifficulty}
                      onChange={e => setBotDifficulty(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    >
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Your Role</label>
                    <select
                      value={practiceRole}
                      onChange={e => setPracticeRole(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
                    >
                      <option value="Random">Random</option>
                      {Object.keys(ROLE_DEFINITIONS).sort().map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between py-2 text-sm font-bold text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Advanced Settings
                {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAdvanced && (
                <div className="space-y-4 pt-2 border-t border-zinc-800/50">
                  {/* Roles Settings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Roles</h3>
                    <button 
                      onClick={() => setShowRoleConfig(true)}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 py-2 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <Shield size={16} /> Configure Roles
                    </button>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-zinc-300">Allow Mafia Day Chat</label>
                      <input type="checkbox" checked={allowMafiaDayChat} onChange={e => setAllowMafiaDayChat(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded" />
                    </div>
                  </div>

                  {/* Timing Settings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Timing</h3>
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-zinc-300">Role Reveal (s)</label>
                      <input type="number" value={roleRevealDuration} onChange={e => setRoleRevealDuration(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 w-16 text-center text-sm" />
                    </div>
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-zinc-300">Day Duration (s)</label>
                      <input type="number" value={dayDuration} onChange={e => setDayDuration(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 w-16 text-center text-sm" />
                    </div>
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-zinc-300">Night Duration (s)</label>
                      <input type="number" value={nightDuration} onChange={e => setNightDuration(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 w-16 text-center text-sm" />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-zinc-300">Auto-skip Night</label>
                      <input type="checkbox" checked={autoSkipNight} onChange={e => setAutoSkipNight(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded" />
                    </div>
                  </div>

                  {/* Voting Settings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Voting</h3>
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-zinc-300">Anonymous Votes</label>
                      <input type="checkbox" checked={anonymousVotes} onChange={e => setAnonymousVotes(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded" />
                    </div>
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-zinc-300">Tie Behavior</label>
                      <select value={tieBehavior} onChange={e => setTieBehavior(e.target.value as any)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm">
                        <option value="NoLynch">No Lynch</option>
                        <option value="Random">Random</option>
                        <option value="Revote">Revote</option>
                      </select>
                    </div>
                  </div>

                  {/* Death Settings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Death</h3>
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-zinc-300">Reveal on Death</label>
                      <select value={revealOnDeath} onChange={e => setRevealOnDeath(e.target.value as any)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm">
                        <option value="Role">Full Role</option>
                        <option value="Alignment">Alignment Only</option>
                        <option value="None">Hide Completely</option>
                      </select>
                    </div>
                  </div>

                  {/* Lobby Settings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Lobby</h3>
                    {mode !== 'Practice' && (
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-300">Fill empty slots with bots</label>
                        <input type="checkbox" checked={fillWithBots} onChange={e => setFillWithBots(e.target.checked)} className="w-5 h-5 accent-emerald-500 rounded" />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => {
                  setView('main');
                  setMode('Quick');
                }}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleHost}
                disabled={!displayName}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                {mode === 'Practice' ? 'Start Practice' : 'Create Room'}
              </button>
            </div>
          </div>
        )}

        {view === 'join' && (
          <div className="space-y-4 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 text-left">
            <h2 className="text-xl font-bold mb-4">Join Game</h2>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Room Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors font-mono uppercase tracking-widest text-lg"
                  placeholder="ABCD"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setView('main')}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-medium transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleJoin}
                disabled={!displayName || code.length !== 4}
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
              >
                Join Room
              </button>
            </div>
          </div>
        )}
        {view === 'rules' && (
          <div className="space-y-4 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 text-left max-h-[80vh] overflow-y-auto w-full max-w-2xl mx-auto">
            <h2 className="text-2xl font-black mb-6 text-emerald-400 flex items-center gap-2">
              <BookOpen size={24} /> Game Rules
            </h2>
            
            <div className="space-y-4">
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                <h3 className="font-bold text-lg text-indigo-400 mb-2 flex items-center gap-2"><Shield size={18} /> 1. Game Objective</h3>
                <p className="text-sm text-zinc-300 mb-2"><strong>Town</strong> wins by eliminating all Mafia.</p>
                <p className="text-sm text-zinc-300 mb-2"><strong>Mafia</strong> wins when Mafia count equals or exceeds Town.</p>
                <p className="text-sm text-zinc-300"><strong>Neutral</strong> roles have unique win conditions.</p>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                <h3 className="font-bold text-lg text-amber-400 mb-2 flex items-center gap-2"><Sun size={18} /> 2. Game Phases</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-bold text-sm text-amber-300">Day Phase</h4>
                    <ul className="list-disc list-inside text-sm text-zinc-300 ml-2">
                      <li>All players discuss.</li>
                      <li>Voting begins after discussion timer.</li>
                      <li>Majority vote eliminates a player.</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-indigo-300 flex items-center gap-1"><Moon size={14} /> Night Phase</h4>
                    <ul className="list-disc list-inside text-sm text-zinc-300 ml-2">
                      <li>Special roles perform abilities.</li>
                      <li>Mafia select a target.</li>
                      <li>Town roles use powers (heal, investigate, etc.).</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                <h3 className="font-bold text-lg text-emerald-400 mb-2 flex items-center gap-2"><Users size={18} /> 3. Voting Rules</h3>
                <ul className="list-disc list-inside text-sm text-zinc-300 ml-2">
                  <li>One vote per player.</li>
                  <li>Votes are visible to everyone.</li>
                  <li>Tie = No elimination (unless Tie-Breaker enabled).</li>
                </ul>
              </div>

              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800">
                <h3 className="font-bold text-lg text-red-400 mb-2 flex items-center gap-2"><Skull size={18} /> 4. Fair Play Policy</h3>
                <ul className="list-disc list-inside text-sm text-zinc-300 ml-2">
                  <li>No external communication.</li>
                  <li>No screen sharing.</li>
                  <li>No revealing role outside game mechanics.</li>
                </ul>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => setView('main')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-bold transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}

        {view === 'settings' && (
          <div className="space-y-4 bg-zinc-900/50 p-6 rounded-3xl border border-zinc-800/50 text-left max-h-[80vh] overflow-y-auto w-full max-w-md mx-auto">
            <h2 className="text-2xl font-black mb-6 text-emerald-400 flex items-center gap-2">
              <Settings size={24} /> Client Settings
            </h2>
            
            <div className="space-y-6">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Customization</h3>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-zinc-300">Theme</label>
                  <select className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-sm">
                    <option>Dark (Default)</option>
                    <option>Light</option>
                    <option>Classic Mafia</option>
                  </select>
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-zinc-300">Role Card Animation</label>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-emerald-500 rounded" />
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-zinc-300">Blood/Elimination Effects</label>
                  <input type="checkbox" defaultChecked className="w-5 h-5 accent-emerald-500 rounded" />
                </div>
                <div className="flex justify-between items-center">
                  <label className="text-sm text-zinc-300">Colorblind Mode</label>
                  <input type="checkbox" className="w-5 h-5 accent-emerald-500 rounded" />
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Audio</h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm text-zinc-300">Master Volume</label>
                    <input type="range" min="0" max="100" defaultValue="80" className="w-32 accent-emerald-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm text-zinc-300">Music Volume</label>
                    <input type="range" min="0" max="100" defaultValue="50" className="w-32 accent-emerald-500" />
                  </div>
                  <div className="flex justify-between items-center">
                    <label className="text-sm text-zinc-300">SFX Volume</label>
                    <input type="range" min="0" max="100" defaultValue="100" className="w-32 accent-emerald-500" />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-6">
              <button
                onClick={() => setView('main')}
                className="w-full bg-zinc-800 hover:bg-zinc-700 py-3 rounded-xl font-bold transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </div>
        )}
      </div>
      {showRoleConfig && renderRoleConfig()}
    </div>
  );
}
