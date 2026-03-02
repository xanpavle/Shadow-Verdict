import { Server } from 'socket.io';
import { GameState, Player, GameSettings, NightAction, Role, Alignment, GamePhase, InboxMessage, ROLE_DEFINITIONS } from '../shared/types';

export class GameManager {
  private state: GameState;
  private io: Server;
  private nightActions: NightAction[] = [];
  private timer: NodeJS.Timeout | null = null;
  private disconnectedPlayers: Map<string, Player> = new Map();

  constructor(code: string, settings: GameSettings, io: Server) {
    this.state = {
      code,
      phase: 'Lobby',
      players: [],
      settings,
      timerEnd: null,
      dayCount: 0,
      publicLogs: [],
      mafiaKillVotes: {},
      moderatorLog: [],
      dousedPlayers: [],
      cultMembers: [],
      snapshots: [],
      linkedPlayers: null,
      mafiaKillLimit: 1,
      lastNightActions: [],
    };
    this.io = io;
  }

  private sendInboxMessage(playerId: string, text: string, type: 'info' | 'result' | 'action' | 'prompt' = 'info', category?: 'success' | 'no_event' | 'blocked' | 'immune' | 'invalid') {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.inbox.push({
        id: Math.random().toString(),
        text,
        type,
        resultCategory: category,
        day: this.state.dayCount
      });
    }
  }

  private initializeRoles() {
    const executioners = this.state.players.filter(p => p.role === 'Executioner');
    const townPlayers = this.state.players.filter(p => p.alignment === 'Town');
    
    executioners.forEach(exe => {
      if (townPlayers.length > 0) {
        const target = townPlayers[Math.floor(Math.random() * townPlayers.length)];
        exe.executionerTargetId = target.id;
        this.sendInboxMessage(exe.id, `🎯 Your target is ${target.displayName}. Get them lynched or killed to win!`, 'info');
      }
    });
  }

  public getState(): GameState {
    return this.state;
  }

  public isHost(id: string): boolean {
    const p = this.state.players.find(p => p.id === id);
    return p ? p.isHost : false;
  }

  public hasPlayer(id: string): boolean {
    return this.state.players.some(p => p.id === id);
  }

  public isEmpty(): boolean {
    return this.state.players.length === 0;
  }

  public addPlayer(id: string, displayName: string, isHost: boolean): Player | null {
    if (this.state.players.length >= this.state.settings.maxPlayers) return null;
    
    // Check for duplicate names
    let finalName = displayName;
    let count = 1;
    while (this.state.players.some(p => p.displayName === finalName)) {
      finalName = `${displayName}#${count}`;
      count++;
    }

    const player: Player = {
      id,
      displayName: finalName,
      isHost,
      isReady: false,
      isAlive: true,
      isSilenced: false,
      inbox: [],
      actionLocked: false,
    };
    this.state.players.push(player);
    return player;
  }

  public toggleReady(id: string) {
    const player = this.state.players.find(p => p.id === id);
    if (player) {
      player.isReady = !player.isReady;
    }
  }

  public handleDisconnect(id: string) {
    const playerIndex = this.state.players.findIndex(p => p.id === id);
    if (playerIndex !== -1) {
      const player = this.state.players[playerIndex];
      if (this.state.phase === 'Lobby') {
        this.state.players.splice(playerIndex, 1);
        if (player.isHost && this.state.players.length > 0) {
          this.state.players[0].isHost = true;
        }
      } else {
        // In-game disconnect
        this.disconnectedPlayers.set(id, player);
        player.isAlive = false; // Treat as dead for now, or handle reconnection
        this.addLog(`${player.displayName} disconnected.`);
        if (this.state.phase === 'Day') {
          this.checkDayEnd();
        }
      }
      this.broadcastState();
    }
  }

  public startGame() {
    if (this.state.players.length < 6 && !this.state.settings.fillWithBots) return; 
    
    if (this.state.settings.fillWithBots) {
      this.fillWithBots();
    }

    this.assignRoles();
    this.state.phase = 'RoleReveal';
    this.state.dayCount = 0;
    this.startTimer(this.state.settings.roleRevealDuration, () => {
      this.startNight();
    });
    this.broadcastState();
  }

  private fillWithBots() {
    const botNames = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel', 'India', 'Juliet'];
    const personalities = ['Aggressive', 'Defensive', 'Logical', 'Chaotic', 'Quiet'];
    let botCount = 0;
    while (this.state.players.length < this.state.settings.maxPlayers) {
      const name = botNames[botCount % botNames.length] + ' (Bot)';
      const bot: Player = {
        id: `bot_${Math.random().toString(36).substr(2, 9)}`,
        displayName: name,
        isHost: false,
        isReady: true,
        isAlive: true,
        isSilenced: false,
        inbox: [],
        isBot: true,
        botPersonality: personalities[Math.floor(Math.random() * personalities.length)],
        stats: { correctVotes: 0, daysSurvived: 0, suspicionReceived: 0 }
      };
      this.state.players.push(bot);
      botCount++;
    }
  }

  public broadcastState() {
    this.state.players.forEach(p => {
      if (!p.isBot) {
        this.io.to(p.id).emit('gameState', this.sanitizeStateForPlayer(p.id));
      }
    });
  }

  private sanitizeStateForPlayer(playerId: string): GameState {
    const player = this.state.players.find(p => p.id === playerId);
    const isEnd = this.state.phase === 'End';
    const isMafia = player?.alignment === 'Mafia';

    return {
      ...this.state,
      players: this.state.players.map(p => {
        const isMe = p.id === playerId;
        const isDead = !p.isAlive;
        const revealRole = isEnd || isMe || (isMafia && p.alignment === 'Mafia') || (isDead && this.state.settings.revealOnDeath === 'Role');
        const revealAlignment = revealRole || (isDead && this.state.settings.revealOnDeath === 'Alignment');
        
        return {
          ...p,
          role: revealRole ? p.role : undefined,
          alignment: revealAlignment ? p.alignment : undefined,
          inbox: isMe ? p.inbox : [],
          voteTarget: (this.state.settings.anonymousVotes && this.state.phase === 'Day') ? undefined : p.voteTarget,
        };
      })
    };
  }

  private assignRoles() {
    const count = this.state.players.length;
    let roles: Role[] = [];
    
    // Create a pool of all enabled roles based on their counts
    const rolePool: Role[] = [];
    Object.entries(this.state.settings.enabledRoles).forEach(([roleStr, count]) => {
      const role = roleStr as Role;
      const amount = (count as number) || 0;
      for (let i = 0; i < amount; i++) {
        rolePool.push(role);
      }
    });

    // Shuffle the pool
    rolePool.sort(() => Math.random() - 0.5);

    // If we have more roles than players, we need to select a subset
    // We should prioritize meeting the required Mafia/Neutral counts if not in custom mode
    if (!this.state.settings.customMode && rolePool.length > count) {
      let reqMafia = 0;
      let reqNeutral = 0;
      let reqJester = 0;
      
      if (count <= 6) { reqMafia = 1; reqNeutral = 0; }
      else if (count === 7) { reqMafia = 1; reqNeutral = 1; }
      else if (count === 8) { reqMafia = 2; reqNeutral = 0; }
      else if (count === 9) { reqMafia = 2; reqNeutral = 1; }
      else if (count === 10) { reqMafia = 2; reqNeutral = 1; reqJester = 1; }
      else if (count === 11) { reqMafia = 3; reqNeutral = 1; reqJester = 0; }
      else if (count === 12) { reqMafia = 3; reqNeutral = 1; reqJester = 1; }
      else if (count === 13) { reqMafia = 3; reqNeutral = 2; reqJester = 1; }
      else if (count === 14) { reqMafia = 4; reqNeutral = 2; reqJester = 1; }
      else { reqMafia = 4; reqNeutral = 3; reqJester = 1; }

      const selectedRoles: Role[] = [];
      const remainingPool = [...rolePool];

      // Helper to extract a role by alignment/name
      const extractRole = (condition: (r: Role) => boolean) => {
        const idx = remainingPool.findIndex(condition);
        if (idx !== -1) {
          selectedRoles.push(remainingPool[idx]);
          remainingPool.splice(idx, 1);
          return true;
        }
        return false;
      };

      // 1. Fulfill Jester requirement
      for (let i = 0; i < reqJester; i++) extractRole(r => r === 'Jester');
      
      // 2. Fulfill Mafia requirement
      for (let i = 0; i < reqMafia; i++) extractRole(r => ROLE_DEFINITIONS[r]?.alignment === 'Mafia');
      
      // 3. Fulfill Neutral requirement (excluding already picked Jesters)
      const currentNeutrals = selectedRoles.filter(r => ROLE_DEFINITIONS[r]?.alignment === 'Neutral').length;
      for (let i = currentNeutrals; i < reqNeutral; i++) extractRole(r => ROLE_DEFINITIONS[r]?.alignment === 'Neutral');

      // 4. Fill the rest randomly from the remaining pool, but ONLY with Town roles
      // to strictly enforce the Mafia/Neutral counts.
      const townPool = remainingPool.filter(r => ROLE_DEFINITIONS[r]?.alignment === 'Town');
      while (selectedRoles.length < count && townPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * townPool.length);
        selectedRoles.push(townPool[randomIndex]);
        townPool.splice(randomIndex, 1);
      }
      
      roles = selectedRoles;
    } else {
      // If we have fewer or equal roles, just take them (up to count)
      roles = rolePool.slice(0, count);
    }

    // Fill any remaining slots with Town
    while (roles.length < count) {
      roles.push('Town');
    }

    // Handle practice role selection
    if (this.state.settings.mode === 'Practice' && this.state.settings.practiceRole && this.state.settings.practiceRole !== 'Random') {
      const practiceRole = this.state.settings.practiceRole as Role;
      
      // Check if the role is already in the selected roles
      const roleIndex = roles.indexOf(practiceRole);
      if (roleIndex !== -1) {
        // Remove it from the pool so we can assign it specifically to the host
        roles.splice(roleIndex, 1);
      } else {
        // If it's not in the pool, we have to replace a role of the same alignment to maintain balance
        const alignment = ROLE_DEFINITIONS[practiceRole]?.alignment || 'Town';
        const replaceIndex = roles.findIndex(r => ROLE_DEFINITIONS[r]?.alignment === alignment);
        if (replaceIndex !== -1) {
          roles.splice(replaceIndex, 1);
        } else {
          // Fallback: just remove a random role
          roles.pop();
        }
      }
      
      // Final shuffle for the remaining roles
      roles.sort(() => Math.random() - 0.5);
      
      // Assign roles
      this.state.players.forEach((p) => {
        if (!p.isBot) {
          p.role = practiceRole;
        } else {
          p.role = roles.pop()!;
        }
      });
    } else {
      // Final shuffle before assignment
      roles.sort(() => Math.random() - 0.5);

      this.state.players.forEach((p, i) => {
        p.role = roles[i];
      });
    }

    this.state.players.forEach((p) => {
      p.alignment = ROLE_DEFINITIONS[p.role!]?.alignment || 'Town';
      p.stats = p.stats || { correctVotes: 0, daysSurvived: 0, suspicionReceived: 0 };
      
      // Initialize ability uses
      p.abilityUses = {};
      const roleDef = ROLE_DEFINITIONS[p.role!];
      if (roleDef && roleDef.abilities) {
        roleDef.abilities.forEach(ability => {
          if (ability.uses > 0) {
            p.abilityUses![ability.id] = ability.uses;
          }
        });
      }

      // Executioner target initialization
      if (p.role === 'Executioner') {
        const townPlayers = this.state.players.filter(tp => tp.id !== p.id && ROLE_DEFINITIONS[tp.role!]?.alignment === 'Town');
        if (townPlayers.length > 0) {
          p.executionerTargetId = townPlayers[Math.floor(Math.random() * townPlayers.length)].id;
        }
      }

      p.inbox.push({
        id: Math.random().toString(36).substring(7),
        text: `Your role is ${p.role}.`,
        type: 'info'
      });
    });
  }

  private getAlignment(role: Role): Alignment {
    return ROLE_DEFINITIONS[role]?.alignment || 'Town';
  }

  public handleChat(id: string, message: string) {
    if (this.state.phase !== 'Day') return;
    const player = this.state.players.find(p => p.id === id);
    if (!player || !player.isAlive || player.isSilenced) return;

    this.io.to(this.state.code).emit('chatMessage', {
      sender: player.displayName,
      message,
      time: new Date().toISOString()
    });
  }

  public handleVote(id: string, targetId: string) {
    if (this.state.phase !== 'Day' || this.state.votingComplete) return;
    const player = this.state.players.find(p => p.id === id);
    if (!player || !player.isAlive) return;

    if (player.voteTarget === targetId) {
      player.voteTarget = undefined; // Toggle off
    } else {
      player.voteTarget = targetId;
    }
    this.broadcastState();
    this.checkDayEnd();
  }

  public handleHunterKill(id: string, targetId: string) {
    if (this.state.phase !== 'HunterSelection') return;
    const hunter = this.state.players.find(p => p.id === id && p.role === 'Hunter' && !p.isAlive && !p.hunterKilled);
    if (hunter) {
      const target = this.state.players.find(p => p.id === targetId && p.isAlive);
      if (target) {
        target.isAlive = false;
        hunter.hunterKilled = true;
        this.addLog(`The Hunter took ${target.displayName} down with them!`);
        
        // Grim Reaper Link
        if (this.state.linkedPlayers && this.state.linkedPlayers.includes(target.id)) {
          const otherId = this.state.linkedPlayers.find(linkedId => linkedId !== target.id);
          if (otherId) {
            const otherP = this.state.players.find(player => player.id === otherId);
            if (otherP && otherP.isAlive) {
              otherP.isAlive = false;
              this.addLog(`${otherP.displayName} died due to a soul link.`);
            }
          }
        }

        this.continueAfterHunter();
      }
    }
  }

  public handleNightAction(id: string, action: NightAction) {
    if (this.state.phase !== 'Night') return;
    const player = this.state.players.find(p => p.id === id);
    if (!player || !player.isAlive || player.actionLocked) return;

    if (action.actionType === 'mafia_kill_vote') {
      if (player.alignment === 'Mafia' && action.targetId) {
        this.state.mafiaKillVotes[id] = action.targetId;
        this.broadcastState();
      }
      return;
    }

    if (action.actionType === 'lock_action') {
      player.actionLocked = true;
      this.broadcastState();
      
      // Check if all alive players (who can act) have locked
      if (this.state.settings.autoSkipNight) {
        const alivePlayers = this.state.players.filter(p => p.isAlive && !p.isBot);
        if (alivePlayers.every(p => p.actionLocked)) {
           this.resolveNight();
        }
      }
      return;
    }

    // Remove existing action for this player of the same type
    if (action.actionType !== 'mafia_kill_vote' && action.actionType !== 'lock_action') {
      const abilityId = action.actionType;
      if (player.abilityUses && player.abilityUses[abilityId] !== undefined && player.abilityUses[abilityId] <= 0) {
        return; // No uses left
      }
    }

    this.nightActions = this.nightActions.filter(a => !(a.playerId === id && a.actionType === action.actionType));
    this.nightActions.push(action);
  }

  private simulateBotNightActions() {
    const aliveBots = this.state.players.filter(p => p.isAlive && p.isBot);
    const alivePlayers = this.state.players.filter(p => p.isAlive);
    
    aliveBots.forEach(bot => {
      // Simple random target for bots
      const possibleTargets = alivePlayers.filter(p => p.id !== bot.id);
      if (possibleTargets.length > 0) {
        const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
        this.nightActions.push({
          playerId: bot.id,
          role: bot.role!,
          targetId: target.id,
          actionType: bot.role === 'Vigilante' || ['Mafia', 'Silencer', 'Consigliere', 'Framer'].includes(bot.role!) ? 'kill' : 'ability'
        });
      }
    });
  }

  private startTimer(seconds: number, callback: () => void) {
    if (this.timer) clearTimeout(this.timer);
    this.state.timerEnd = Date.now() + seconds * 1000;
    this.timer = setTimeout(callback, seconds * 1000);
  }

  private resolveNight() {
    const kills = new Set<string>();
    const protects = new Set<string>();
    const blocks = new Set<string>();
    const frames = new Set<string>();
    const protectedTargets = new Map<string, string[]>(); // targetId -> array of protector IDs
    const nightLog: string[] = []; // For Archivist
    const results: Record<string, { text: string, category: 'success' | 'no_event' | 'blocked' | 'immune' | 'invalid' }[]> = {};

    // Reset action locks
    this.state.players.forEach(p => p.actionLocked = false);

    // Helper to add results
    const addResult = (playerId: string, text: string, category: 'success' | 'no_event' | 'blocked' | 'immune' | 'invalid') => {
      if (!results[playerId]) results[playerId] = [];
      results[playerId].push({ text, category });
    };

    const consumeAbilityUse = (playerId: string, abilityId: string) => {
      const player = this.state.players.find(p => p.id === playerId);
      if (player && player.abilityUses && player.abilityUses[abilityId] !== undefined) {
        if (player.abilityUses[abilityId] > 0) {
          player.abilityUses[abilityId]--;
        }
      }
    };

    const isBlocked = (playerId: string) => {
      if (blocks.has(playerId)) {
        this.sendInboxMessage(playerId, `🔴 You were prevented from performing your night action.`, 'result', 'blocked');
        return true;
      }
      return false;
    };

    // --- PRIORITY 0: TIMEKEEPER REWIND ---
    const timekeeperAction = this.nightActions.find(a => a.role === 'Timekeeper' && a.actionType === 'rewind');
    if (timekeeperAction && !isBlocked(timekeeperAction.playerId)) {
      if (this.state.snapshots.length > 0) {
        consumeAbilityUse(timekeeperAction.playerId, timekeeperAction.actionType);
        // Restore snapshot from the start of the PREVIOUS day
        const snapshot = JSON.parse(this.state.snapshots[this.state.snapshots.length - 1]);
        this.state = snapshot;
        this.addLog(`Time has been rewound. All events from the previous night and day have been undone.`);
        this.broadcastState();
        return;
      }
    }

    // --- PRIORITY 1: BLOCKS & MODIFIERS ---
    this.nightActions.filter(a => {
      const p = this.state.players.find(player => player.id === a.playerId);
      return ['Roleblocker', 'Witch', 'Saboteur', 'Town Saboteur', 'Warden', 'Reanimator'].includes(a.role) || p?.copiedAbility?.type === 'block';
    }).forEach(a => {
      if (isBlocked(a.playerId)) return;
      const p = this.state.players.find(player => player.id === a.playerId);

      if (p?.copiedAbility?.type === 'block' && a.actionType === p.copiedAbility.id) {
        if (a.targetId) {
          blocks.add(a.targetId);
          addResult(a.playerId, `🟢 Your copied block was successful.`, 'success');
        }
        p.copiedAbility = undefined;
        return;
      }

      if (a.role === 'Reanimator' && a.actionType === 'reanimate') {
        consumeAbilityUse(a.playerId, a.actionType);
        const deadMafia = this.state.players.filter(p => !p.isAlive && p.alignment === 'Mafia' && p.role !== 'Mafia');
        if (deadMafia.length > 0) {
          const randomDead = deadMafia[Math.floor(Math.random() * deadMafia.length)];
          const self = this.state.players.find(p => p.id === a.playerId);
          if (self && randomDead.role) {
            const roleDef = ROLE_DEFINITIONS[randomDead.role];
            if (roleDef && roleDef.abilities.length > 0) {
              self.copiedAbility = { ...roleDef.abilities[0], uses: 1 };
              addResult(a.playerId, `🟢 You reanimated the spirit of a ${randomDead.role}. You have gained their ${roleDef.abilities[0].name} for one night.`, 'success');
            }
          }
        } else {
          addResult(a.playerId, `🔵 No dead Mafia spirits to reanimate.`, 'no_event');
        }
        return;
      }
      if (a.targetId) {
        consumeAbilityUse(a.playerId, a.actionType);
        blocks.add(a.targetId);
        if (a.role === 'Warden') {
          protects.add(a.targetId); 
        }
        if (a.role === 'Saboteur') {
          const target = this.state.players.find(p => p.id === a.targetId);
          if (target) {
            target.disabledAbilities = true;
            addResult(target.id, `🔴 Your tools have been destroyed.`, 'blocked');
          }
        }
        addResult(a.playerId, `🟢 You successfully blocked your target.`, 'success');
      }
    });

    // Tinkerer / Beacon
    this.nightActions.filter(a => ['Tinkerer', 'Beacon'].includes(a.role)).forEach(a => {
      if (isBlocked(a.playerId)) return;
      if (a.targetId) {
        consumeAbilityUse(a.playerId, a.actionType);
        const target = this.state.players.find(p => p.id === a.targetId);
        if (target) target.doubleEffect = true;
        this.sendInboxMessage(a.playerId, `🟢 You doubled your target's effect.`, 'result', 'success');
      }
    });

    // --- PRIORITY 2: PROTECTIONS ---
    this.nightActions.filter(a => {
      const p = this.state.players.find(player => player.id === a.playerId);
      return ['Healer', 'Bodyguard', 'Protector', 'Pacifist', 'Beacon of Silence'].includes(a.role) || p?.copiedAbility?.type === 'protect';
    }).forEach(a => {
      if (isBlocked(a.playerId)) return;
      const p = this.state.players.find(player => player.id === a.playerId);

      if (p?.copiedAbility?.type === 'protect' && a.actionType === p.copiedAbility.id) {
        if (a.targetId) {
          protects.add(a.targetId);
          if (!protectedTargets.has(a.targetId)) protectedTargets.set(a.targetId, []);
          protectedTargets.get(a.targetId)!.push(a.playerId);
          this.sendInboxMessage(a.playerId, `🟢 Your copied protection was successful.`, 'result', 'success');
        }
        p.copiedAbility = undefined;
        return;
      }

      if (a.targetId) {
        consumeAbilityUse(a.playerId, a.actionType);
        protects.add(a.targetId);
        if (!protectedTargets.has(a.targetId)) protectedTargets.set(a.targetId, []);
        protectedTargets.get(a.targetId)!.push(a.playerId);
        
        if (a.role === 'Pacifist') {
          protects.add(a.playerId); // Protect self
          const self = this.state.players.find(p => p.id === a.playerId);
          if (self) self.role = 'Town'; // Becomes Vanilla Town
        }
        if (a.role === 'Beacon of Silence') {
          const target = this.state.players.find(p => p.id === a.targetId);
          if (target) target.silenceImmuneNights = 2;
        }
      }
    });

    // --- PRIORITY 3: KILLS ---
    // Mafia Kill (Shared Vote)
    const mafiaVotes: Record<string, number> = {};
    const votingMafia: string[] = [];
    Object.entries(this.state.mafiaKillVotes).forEach(([voterId, targetId]) => {
      if (!isBlocked(voterId)) {
        mafiaVotes[targetId] = (mafiaVotes[targetId] || 0) + 1;
        votingMafia.push(voterId);
      }
    });

    let maxVotes = 0;
    let mafiaTargetId: string | null = null;
    let tie = false;

    for (const [targetId, count] of Object.entries(mafiaVotes)) {
      if (count > maxVotes) {
        maxVotes = count;
        mafiaTargetId = targetId;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    }

    if (tie) {
      const tiedTargets = Object.keys(mafiaVotes).filter(id => mafiaVotes[id] === maxVotes);
      if (tiedTargets.length > 0) {
        mafiaTargetId = tiedTargets[Math.floor(Math.random() * tiedTargets.length)];
      }
    }

    const notifyMafia = (msg: string, category: 'success' | 'no_event' | 'blocked' | 'immune' | 'invalid') => {
      this.state.players.filter(p => p.alignment === 'Mafia').forEach(m => {
        this.sendInboxMessage(m.id, msg, 'result', category);
      });
    };

    if (mafiaTargetId) {
      nightLog.push(`Mafia targeted ${mafiaTargetId}`);
      if (!protects.has(mafiaTargetId)) {
        kills.add(mafiaTargetId);
        notifyMafia(`🟢 Your target was eliminated.`, 'success');
      } else {
        notifyMafia(`🔴 Your attack failed. The target was protected.`, 'blocked');
        protectedTargets.get(mafiaTargetId)?.forEach(protectorId => {
          this.sendInboxMessage(protectorId, `🟢 Your target was attacked — but you successfully saved them.`, 'result', 'success');
        });
      }
    } else if (votingMafia.length > 0) {
      notifyMafia(`🔵 No kill was made due to a tie or lack of consensus.`, 'no_event');
    }

    // Other Kills (Vigilante, Berserker, Switchblade, Arsonist Ignite)
    this.nightActions.filter(a => {
      const p = this.state.players.find(player => player.id === a.playerId);
      return ['Vigilante', 'Berserker', 'Switchblade', 'Arsonist'].includes(a.role) || p?.copiedAbility?.type === 'kill';
    }).forEach(a => {
      if (isBlocked(a.playerId)) return;
      const p = this.state.players.find(player => player.id === a.playerId);

      if (p?.copiedAbility?.type === 'kill' && a.actionType === p.copiedAbility.id) {
        if (a.targetId) {
          if (!protects.has(a.targetId)) {
            kills.add(a.targetId);
            addResult(a.playerId, `🟢 Your copied ability successfully eliminated your target.`, 'success');
          } else {
            addResult(a.playerId, `🔴 Your attack failed. The target was protected.`, 'blocked');
          }
        }
        p.copiedAbility = undefined;
        return;
      }
      
      if (a.role === 'Arsonist' && a.actionType === 'ignite') {
        consumeAbilityUse(a.playerId, a.actionType);
        this.state.dousedPlayers.forEach(id => {
          if (!protects.has(id)) kills.add(id);
        });
        addResult(a.playerId, `🟢 You ignited all marked targets.`, 'success');
        nightLog.push(`Arsonist ignited`);
        return;
      }

      if (a.role === 'Switchblade' && a.actionType === 'kill_role') {
         consumeAbilityUse(a.playerId, a.actionType);
         const targetRole = a.targetId as Role;
         const targets = this.state.players.filter(p => p.isAlive && p.role === targetRole);
         
         if (targets.length > 0) {
           targets.forEach(target => {
             if (!protects.has(target.id)) {
               kills.add(target.id);
               addResult(a.playerId, `🟢 You successfully eliminated a ${targetRole}.`, 'success');
             } else {
               addResult(a.playerId, `🔴 Your attack failed. The target was protected.`, 'blocked');
             }
           });
         } else {
           addResult(a.playerId, `🔵 No one with the role ${targetRole} was found.`, 'no_event');
         }
         return;
      }

      // Arsonist douse should NOT kill
      if (a.role === 'Arsonist' && a.actionType === 'douse') return;

      if (a.targetId) {
        consumeAbilityUse(a.playerId, a.actionType);
        nightLog.push(`${a.role} targeted ${a.targetId}`);
        
        if (a.role === 'Berserker') {
          const aliveNeutrals = this.state.players.filter(p => p.isAlive && p.alignment === 'Neutral');
          if (aliveNeutrals.length > 1) {
            addResult(a.playerId, `🔴 You can only kill if you are the last Neutral alive.`, 'blocked');
            return;
          }
        }

        let success = true;
        if (a.role === 'Vigilante' && Math.random() >= 0.75) {
          success = false;
          kills.add(a.playerId); // Backfire
          addResult(a.playerId, `🔴 Your weapon backfired!`, 'blocked');
        }

        if (success) {
          if (!protects.has(a.targetId)) {
            kills.add(a.targetId);
            addResult(a.playerId, `🟢 You successfully eliminated your target.`, 'success');
          } else {
            addResult(a.playerId, `🔴 Your attack failed. The target was protected.`, 'blocked');
            protectedTargets.get(a.targetId)?.forEach(protectorId => {
              addResult(protectorId, `🟢 Your target was attacked — but you successfully saved them.`, 'success');
            });
          }
        }
      }
    });

    // --- PRIORITY 4: INVESTIGATE & MARK ---
    this.nightActions.filter(a => {
      const p = this.state.players.find(player => player.id === a.playerId);
      return ['Cop', 'Consigliere', 'Lookout', 'Silencer', 'Framer', 'Arsonist', 'Cult Leader', 'Double', 'Thief', 'Confessor', 'Oracle Apprentice', 'Toxicologist', 'Sage', 'Prophet', 'Locksmith', 'Bounty Hunter', 'Caretaker', 'Grim Reaper', 'Gambler', 'Echo', 'Mender', 'Cull'].includes(a.role) || p?.copiedAbility?.type === 'investigate' || p?.copiedAbility?.type === 'mark';
    }).forEach(a => {
      if (isBlocked(a.playerId)) return;
      if (!a.targetId) return;

      const p = this.state.players.find(player => player.id === a.playerId);
      if (p?.copiedAbility && (p.copiedAbility.type === 'investigate' || p.copiedAbility.type === 'mark') && a.actionType === p.copiedAbility.id) {
        const target = this.state.players.find(p => p.id === a.targetId);
        if (target) {
          if (p.copiedAbility.type === 'investigate') {
            this.sendInboxMessage(a.playerId, `🟢 Copied Investigation: ${target.displayName} is a ${target.role}.`, 'result', 'success');
          } else {
            p.bountyTargetId = a.targetId;
            this.sendInboxMessage(a.playerId, `🟢 Copied Mark: You marked ${target.displayName}.`, 'result', 'success');
          }
        }
        p.copiedAbility = undefined;
        return;
      }

      consumeAbilityUse(a.playerId, a.actionType);

      const target = this.state.players.find(p => p.id === a.targetId);
      if (!target) return;

      nightLog.push(`${a.role} targeted ${a.targetId}`);

      switch (a.role) {
        case 'Cop':
          const isMafia = frames.has(target.id) || target.alignment === 'Mafia';
          const alignmentStr = isMafia ? 'Mafia' : target.alignment === 'Neutral' ? 'Neutral' : 'Town';
          addResult(a.playerId, `🟢 Your investigation confirms that ${target.displayName} is aligned with ${alignmentStr}.`, 'success');
          break;
        case 'Consigliere':
          addResult(a.playerId, `🟢 Your investigation confirms that ${target.displayName} is a ${target.role}.`, 'success');
          break;
        case 'Lookout':
          const visitors = this.nightActions.filter(na => na.targetId === a.targetId && na.playerId !== a.playerId).map(na => {
            const p = this.state.players.find(p => p.id === na.playerId);
            return p ? p.displayName : 'Someone';
          });
          Object.entries(this.state.mafiaKillVotes).forEach(([voterId, targetId]) => {
            if (targetId === a.targetId && voterId !== a.playerId) {
              const p = this.state.players.find(p => p.id === voterId);
              if (p && !visitors.includes(p.displayName)) visitors.push(p.displayName);
            }
          });
          if (visitors.length > 0) addResult(a.playerId, `🟢 You saw ${visitors.join(', ')} visit your target.`, 'success');
          else addResult(a.playerId, `🔵 No one visited your target.`, 'no_event');
          break;
        case 'Silencer':
          if (target.silenceImmuneNights && target.silenceImmuneNights > 0) {
            addResult(a.playerId, `🔴 Your target is immune to silencing.`, 'immune');
          } else {
            target.isSilenced = true;
            addResult(a.playerId, `🟢 You successfully silenced ${target.displayName}.`, 'success');
            addResult(target.id, `🔴 You have been silenced and cannot speak today.`, 'blocked');
          }
          break;
        case 'Framer':
          frames.add(a.targetId);
          addResult(a.playerId, `🟢 You successfully framed your target.`, 'success');
          break;
        case 'Arsonist':
          if (a.actionType === 'douse') {
            if (!this.state.dousedPlayers.includes(a.targetId)) this.state.dousedPlayers.push(a.targetId);
            addResult(a.playerId, `🟢 Your target has been soaked in fuel.`, 'success');
          }
          break;
        case 'Cult Leader':
          target.alignment = 'Cult';
          if (!this.state.cultMembers.includes(a.targetId)) this.state.cultMembers.push(a.targetId);
          addResult(a.playerId, `🟢 Your ritual succeeded.`, 'success');
          break;
        case 'Bounty Hunter':
          const self = this.state.players.find(p => p.id === a.playerId);
          if (self) self.bountyTargetId = a.targetId;
          addResult(a.playerId, `🟢 You assigned a bounty to ${target.displayName}.`, 'success');
          break;
        case 'Grim Reaper':
          const grActions = this.nightActions.filter(act => act.playerId === a.playerId);
          const bind1 = grActions.find(act => act.actionType === 'bind_1');
          const bind2 = grActions.find(act => act.actionType === 'bind_2');
          
          if (bind1 && bind2 && bind1.targetId && bind2.targetId) {
            // Only process once per night (when we hit the first of the two actions)
            if (a.actionType === 'bind_1') {
              this.state.linkedPlayers = [bind1.targetId, bind2.targetId];
              const p1 = this.state.players.find(p => p.id === bind1.targetId);
              const p2 = this.state.players.find(p => p.id === bind2.targetId);
              if (p1 && p2) {
                addResult(a.playerId, `🟢 Targets ${p1.displayName} and ${p2.displayName} are bound.`, 'success');
              }
            }
          } else if (a.actionType === 'bind_1' || a.actionType === 'bind_2') {
             addResult(a.playerId, `🔴 You must use both Bind 1 and Bind 2 to link souls.`, 'blocked');
          }
          break;
        case 'Toxicologist':
          if (kills.has(a.targetId)) addResult(a.playerId, `🟢 Your target was harmed last night.`, 'success');
          else addResult(a.playerId, `🔵 Your target was not harmed last night.`, 'no_event');
          break;
        case 'Oracle Apprentice':
          addResult(a.playerId, `🟢 Is ${target.displayName} Mafia? ${target.alignment === 'Mafia' ? 'Yes' : 'No'}.`, 'success');
          break;
        case 'Confessor':
          addResult(a.playerId, `🟢 ${target.displayName} confessed to being aligned with ${target.alignment}.`, 'success');
          break;
        case 'Gambler':
          const gamblerAbility = ROLE_DEFINITIONS['Gambler'].abilities.find(ab => ab.id === a.actionType);
          if (gamblerAbility && gamblerAbility.successChance && Math.random() > gamblerAbility.successChance) {
            addResult(a.playerId, `🔴 Your gamble failed.`, 'blocked');
          } else {
            if (a.actionType === 'gamble_info') {
              addResult(a.playerId, `🟢 Your gamble succeeded! ${target.displayName} is a ${target.role}.`, 'success');
            } else if (a.actionType === 'gamble_heal') {
              protects.add(a.targetId);
              addResult(a.playerId, `🟢 Your gamble succeeded! You protected ${target.displayName}.`, 'success');
            } else if (a.actionType === 'gamble_silence') {
              target.isSilenced = true;
              addResult(a.playerId, `🟢 Your gamble succeeded! You silenced ${target.displayName}.`, 'success');
            } else if (a.actionType === 'gamble_kill') {
              if (!protects.has(a.targetId)) {
                kills.add(a.targetId);
                addResult(a.playerId, `🟢 Your gamble succeeded! You eliminated ${target.displayName}.`, 'success');
              } else {
                addResult(a.playerId, `🔴 Your gamble succeeded, but the target was protected.`, 'blocked');
              }
            }
          }
          break;
        case 'Echo':
          const actionsTargetingEcho = this.state.lastNightActions?.filter(la => la.targetId === a.playerId) || [];
          if (actionsTargetingEcho.length > 0) {
            const lastAction = actionsTargetingEcho[0];
            addResult(a.playerId, `🟢 You echoed ${lastAction.role}'s action back at them.`, 'success');
            if (['kill', 'block', 'silence'].includes(lastAction.actionType)) {
              if (lastAction.actionType === 'kill' && !protects.has(lastAction.playerId)) kills.add(lastAction.playerId);
              else if (lastAction.actionType === 'block') blocks.add(lastAction.playerId);
              else if (lastAction.actionType === 'silence') {
                const source = this.state.players.find(p => p.id === lastAction.playerId);
                if (source) source.isSilenced = true;
              }
            }
          } else {
            addResult(a.playerId, `🔵 No one targeted you last night.`, 'no_event');
          }
          break;
        case 'Mender':
          if (target.abilityUses) {
            const limitedAbilities = Object.keys(target.abilityUses);
            if (limitedAbilities.length > 0) {
              const randomAbilityId = limitedAbilities[Math.floor(Math.random() * limitedAbilities.length)];
              target.abilityUses[randomAbilityId]++;
              addResult(a.playerId, `🟢 You restored an ability use to ${target.displayName}.`, 'success');
              addResult(target.id, `🟢 One of your abilities has been restored by a Mender.`, 'success');
            } else {
              addResult(a.playerId, `🔵 ${target.displayName} has no limited abilities to restore.`, 'no_event');
            }
          }
          break;
        case 'Double':
          const doubleRoleDef = ROLE_DEFINITIONS[target.role!];
          if (doubleRoleDef && doubleRoleDef.abilities.length > 0) {
            const mainAbility = doubleRoleDef.abilities[0];
            const self = this.state.players.find(p => p.id === a.playerId);
            if (self) {
              self.copiedAbility = { ...mainAbility, uses: 1 };
              addResult(a.playerId, `🟢 You copied ${target.displayName}'s ${mainAbility.name} ability for tomorrow night.`, 'success');
            }
          }
          break;
        case 'Thief':
          const targetRoleDef = ROLE_DEFINITIONS[target.role!];
          if (targetRoleDef && targetRoleDef.abilities.length > 0) {
            const mainAbility = targetRoleDef.abilities[0];
            const self = this.state.players.find(p => p.id === a.playerId);
            if (self) {
              self.copiedAbility = { ...mainAbility, uses: 1 };
              addResult(a.playerId, `🟢 You stole a copy of ${target.displayName}'s ${mainAbility.name} ability.`, 'success');
            }
          }
          break;
        case 'Caretaker':
          const caretaker = this.state.players.find(p => p.id === a.playerId);
          if (caretaker) {
            caretaker.wardId = a.targetId;
            addResult(a.playerId, `🟢 You selected ${target.displayName} as your ward.`, 'success');
          }
          break;
        case 'Cull':
          const cull = this.state.players.find(p => p.id === a.playerId);
          if (cull) {
            cull.bountyTargetId = a.targetId;
            addResult(a.playerId, `🟢 You marked ${target.displayName}.`, 'success');
          }
          break;
        case 'Prophet':
          const prophet = this.state.players.find(p => p.id === a.playerId);
          if (prophet) {
            prophet.bountyTargetId = a.targetId; 
            addResult(a.playerId, `🟢 You predicted that ${target.displayName} will die tonight.`, 'success');
          }
          break;
      }
    });

    // --- PRIORITY 5: SUPER INVESTIGATE & REVEAL ---
    this.nightActions.filter(a => ['Detective', 'Archivist', 'Amnesiac', 'Occultist', 'Sage', 'Locksmith'].includes(a.role)).forEach(a => {
      if (isBlocked(a.playerId)) return;
      
      if (a.role === 'Archivist') {
        addResult(a.playerId, `🟢 Moderator Log:\n${this.state.moderatorLog.join('\n')}`, 'success');
      } else if (a.role === 'Occultist') {
        this.state.players.filter(p => p.isAlive).forEach(p => {
          this.addLog(`${p.displayName}'s role is ${p.role}.`);
        });
        kills.add(a.playerId); 
      } else if (a.role === 'Sage' && a.targetId) {
        const target = this.state.players.find(p => p.id === a.targetId);
        if (target) this.addLog(`Sage reveals: ${target.displayName} is a ${target.role}.`);
      } else if (a.role === 'Locksmith' && a.targetId) {
        const target = this.state.players.find(p => p.id === a.targetId);
        if (target) this.addLog(`Locksmith reveals: ${target.displayName}'s ability is ${target.role}.`); 
      } else if (a.role === 'Detective' && a.targetId) {
        consumeAbilityUse(a.playerId, a.actionType);
        const target = this.state.players.find(p => p.id === a.targetId);
        if (target) {
          const relevantActions = this.nightActions.filter(na => na.playerId === a.targetId || na.targetId === a.targetId);
          const report = relevantActions.map(na => {
            const actor = this.state.players.find(p => p.id === na.playerId);
            return `${actor?.displayName || 'Someone'} used ${na.actionType} ${na.targetId === a.targetId ? 'on them' : 'on someone'}.`;
          }).join('\n');
          addResult(a.playerId, `🟢 Super Report for ${target.displayName}:\n${report || 'No actions detected.'}`, 'success');
        }
      }
    });

    // --- BROKER & MASKMAKER SWAP ---
    this.nightActions.filter(a => ['Broker', 'Maskmaker'].includes(a.role)).forEach(a => {
      if (isBlocked(a.playerId)) return;
      
      if (a.role === 'Broker') {
        if (a.targetId && a.targetId2) {
          const temp = results[a.targetId];
          results[a.targetId] = results[a.targetId2];
          results[a.targetId2] = temp;
          addResult(a.playerId, `🟢 You swapped the results of your targets.`, 'success');
        }
      } else if (a.role === 'Maskmaker') {
        const mmActions = this.nightActions.filter(act => act.playerId === a.playerId);
        const swap1 = mmActions.find(act => act.actionType === 'swap_1');
        const swap2 = mmActions.find(act => act.actionType === 'swap_2');
        
        if (swap1 && swap2 && swap1.targetId && swap2.targetId) {
          // Only process once per night
          if (a.actionType === 'swap_1') {
            const temp = results[swap1.targetId];
            results[swap1.targetId] = results[swap2.targetId];
            results[swap2.targetId] = temp;
            addResult(a.playerId, `🟢 You swapped the results of your targets.`, 'success');
          }
        } else if (a.actionType === 'swap_1' || a.actionType === 'swap_2') {
          if (a.actionType === 'swap_1') {
            addResult(a.playerId, `🔴 You must use both Swap 1 and Swap 2 to switch results.`, 'blocked');
          }
        }
      }
    });

    // --- POST-RESOLUTION: SEND RESULTS ---
    Object.entries(results).forEach(([playerId, msgs]) => {
      if (msgs) msgs.forEach(m => this.sendInboxMessage(playerId, m.text, 'result', m.category));
    });

    // Send "no event" to protectors who weren't triggered
    protectedTargets.forEach((protectorIds, targetId) => {
      if (!kills.has(targetId) && mafiaTargetId !== targetId) { // Not attacked
        protectorIds.forEach(pid => {
          this.sendInboxMessage(pid, `🔵 Your target was not attacked.`, 'result', 'no_event');
        });
      }
    });

    // Apply kills
    const deadThisNight: string[] = [];
    kills.forEach(id => {
      const p = this.state.players.find(p => p.id === id);
      if (p) {
        p.isAlive = false;
        if (!this.state.firstDeadPlayerId) this.state.firstDeadPlayerId = p.id;
        deadThisNight.push(id);
        this.addLog(`${p.displayName} died last night. ${this.state.settings.revealOnDeath !== 'None' ? `They were: ${this.state.settings.revealOnDeath === 'Role' ? p.role : p.alignment}` : ''}`);
        
        // Grim Reaper Link
        if (this.state.linkedPlayers && this.state.linkedPlayers.includes(id)) {
          const otherId = this.state.linkedPlayers.find(linkedId => linkedId !== id);
          if (otherId) {
            const otherP = this.state.players.find(p => p.id === otherId);
            if (otherP && otherP.isAlive) {
              otherP.isAlive = false;
              deadThisNight.push(otherId!);
              this.addLog(`${otherP.displayName} died due to a soul link. ${this.state.settings.revealOnDeath !== 'None' ? `They were: ${this.state.settings.revealOnDeath === 'Role' ? otherP.role : otherP.alignment}` : ''}`);
            }
          }
        }

        // Executioner Target Killed Check (Becomes Jester)
        const executioner = this.state.players.find(player => player.role === 'Executioner');
        if (executioner && executioner.executionerTargetId === p.id) {
          executioner.role = 'Jester';
          executioner.alignment = 'Neutral';
          this.sendInboxMessage(executioner.id, `🔴 Your target has died at night. You have become a Jester.`, 'result', 'no_event');
        }
      }
    });

    // Bounty Hunter Upgrade
    this.state.players.filter(p => p.isAlive && p.role === 'Bounty Hunter').forEach(bh => {
      if (bh.bountyTargetId && deadThisNight.includes(bh.bountyTargetId)) {
        bh.copiedAbility = { id: 'bounty_kill', name: 'Bounty Kill', description: 'Kill a player.', type: 'kill', uses: 1, priority: 3, targetRequired: true };
        this.sendInboxMessage(bh.id, `🟢 Your bounty target has died. You have unlocked a Bounty Kill!`, 'result', 'success');
      }
    });

    // Caretaker Inheritance
    this.state.players.filter(p => p.isAlive && p.role === 'Caretaker').forEach(caretaker => {
      if (caretaker.wardId && deadThisNight.includes(caretaker.wardId)) {
        const ward = this.state.players.find(p => p.id === caretaker.wardId);
        if (ward && ward.role) {
          const wardRoleDef = ROLE_DEFINITIONS[ward.role];
          if (wardRoleDef && wardRoleDef.abilities.length > 0) {
            caretaker.copiedAbility = { ...wardRoleDef.abilities[0], uses: -1 };
            caretaker.caretakerInherited = true;
            this.sendInboxMessage(caretaker.id, `🟢 Your ward ${ward.displayName} has died. You have inherited their ${wardRoleDef.abilities[0].name} ability.`, 'result', 'success');
          }
        }
      }
    });

    // Prophet Prediction Check
    this.state.players.filter(p => p.isAlive && p.role === 'Prophet').forEach(prophet => {
      if (prophet.bountyTargetId && deadThisNight.includes(prophet.bountyTargetId)) {
        prophet.prophetGuesses = (prophet.prophetGuesses || 0) + 1;
        this.sendInboxMessage(prophet.id, `🟢 Your prediction was correct! Progress: ${prophet.prophetGuesses}/2`, 'result', 'success');
        if (prophet.prophetGuesses >= 2) {
          prophet.copiedAbility = { id: 'prophet_kill', name: 'Divine Judgment', description: 'Kill a player.', type: 'kill', uses: 1, priority: 3, targetRequired: true };
          this.sendInboxMessage(prophet.id, `🔥 You have gained the power of Divine Judgment!`, 'result', 'success');
        }
      } else if (prophet.bountyTargetId) {
        this.sendInboxMessage(prophet.id, `🔴 Your prediction was incorrect.`, 'result', 'no_event');
      }
      prophet.bountyTargetId = undefined;
    });

    // Recluse Untouched Check
    this.state.players.filter(p => p.isAlive && p.role === 'Recluse').forEach(recluse => {
      const wasVisited = this.nightActions.some(na => na.targetId === recluse.id);
      if (wasVisited) {
        recluse.role = 'Town';
        recluse.alignment = 'Town';
        recluse.recluseNightsUntouched = 0;
        this.sendInboxMessage(recluse.id, `🔴 You were visited! You have lost your seclusion and are now a Vanilla Town.`, 'result', 'blocked');
      } else {
        recluse.recluseNightsUntouched = (recluse.recluseNightsUntouched || 0) + 1;
      }
    });

    // Update Moderator Log
    this.state.moderatorLog = nightLog;

    // Take Snapshot for Timekeeper
    this.state.snapshots.push(JSON.stringify(this.state));

    // Update lastNightActions for Echo
    this.state.lastNightActions = [...this.nightActions];

    // Reset for next night
    this.nightActions = [];
    this.state.mafiaKillVotes = {};
    
    // Decrement silence immune nights
    this.state.players.forEach(p => {
      if (p.silenceImmuneNights && p.silenceImmuneNights > 0) p.silenceImmuneNights--;
    });

    if (this.checkWinCondition()) return;

    this.state.phase = 'Day';
    this.state.votingComplete = false;
    this.startTimer(this.state.settings.dayDuration, () => this.resolveDay());
    this.simulateBotDayActions();
    this.broadcastState();
  }

  private simulateBotDayActions() {
    const aliveBots = this.state.players.filter(p => p.isAlive && p.isBot);
    const alivePlayers = this.state.players.filter(p => p.isAlive);

    // Bots vote randomly halfway through the day
    aliveBots.forEach(bot => {
      setTimeout(() => {
        if (this.state.phase === 'Day' && bot.isAlive) {
          const possibleTargets = [...alivePlayers.filter(p => p.id !== bot.id).map(p => p.id), 'skip'];
          if (possibleTargets.length > 0) {
            const target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)];
            this.handleVote(bot.id, target);
          }
        }
      }, (this.state.settings.dayDuration * 1000) * (0.3 + Math.random() * 0.5));
    });
  }

  private checkDayEnd() {
    if (this.state.phase !== 'Day' || this.state.votingComplete) return;
    const alivePlayers = this.state.players.filter(p => p.isAlive);
    const votesSubmitted = alivePlayers.filter(p => p.voteTarget !== undefined).length;
    
    if (votesSubmitted === alivePlayers.length) {
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer = null;
      }
      this.state.votingComplete = true;
      this.broadcastState();
      
      // Delay resolution slightly to show "Voting Complete"
      setTimeout(() => {
        this.resolveDay();
      }, 2000);
    }
  }

  private resolveDay() {
    if (this.state.phase !== 'Day') return;
    
    // Tally votes
    const votes: Record<string, number> = {};
    const alivePlayers = this.state.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(p => {
      const target = p.voteTarget || 'skip'; // Non-voters count as skip
      votes[target] = (votes[target] || 0) + 1;
    });

    let maxVotes = 0;
    let lynchedId: string | null = null;
    let tie = false;

    for (const [id, count] of Object.entries(votes)) {
      if (count > maxVotes) {
        maxVotes = count;
        lynchedId = id;
        tie = false;
      } else if (count === maxVotes) {
        tie = true;
      }
    }

    if (lynchedId && lynchedId !== 'skip' && !tie) {
      const p = this.state.players.find(p => p.id === lynchedId);
      if (p) {
        p.isAlive = false;
        if (!this.state.firstDeadPlayerId) this.state.firstDeadPlayerId = p.id;
        this.addLog(`${p.displayName} was lynched. ${this.state.settings.revealOnDeath ? `They were: ${p.role}` : ''}`);
        
        // Grim Reaper Link
        if (this.state.linkedPlayers && this.state.linkedPlayers.includes(p.id)) {
          const otherId = this.state.linkedPlayers.find(linkedId => linkedId !== p.id);
          if (otherId) {
            const otherP = this.state.players.find(player => player.id === otherId);
            if (otherP && otherP.isAlive) {
              otherP.isAlive = false;
              this.addLog(`${otherP.displayName} died due to a soul link. ${this.state.settings.revealOnDeath ? `They were: ${otherP.role}` : ''}`);
              
              // Executioner Check for linked death (Becomes Jester)
              const executioner = this.state.players.find(player => player.role === 'Executioner');
              if (executioner && executioner.executionerTargetId === otherP.id) {
                executioner.role = 'Jester';
                executioner.alignment = 'Neutral';
                this.sendInboxMessage(executioner.id, `🔴 Your target has died due to a soul link. You have become a Jester.`, 'result', 'no_event');
              }
            }
          }
        }
        
        if (p.role === 'Jester') {
          this.state.winner = 'Jester';
          this.state.phase = 'End';
          this.broadcastState();
          return;
        }

        // Executioner Win Check
        const executioner = this.state.players.find(player => player.role === 'Executioner');
        if (executioner && executioner.executionerTargetId === p.id) {
          this.state.winner = 'Executioner';
          this.state.phase = 'End';
          this.broadcastState();
          return;
        }

        // Cull Passive
        const cull = this.state.players.find(player => player.role === 'Cull');
        if (cull && p.id === cull.bountyTargetId) { // Reusing bountyTargetId for marked target
          this.state.mafiaKillLimit++;
        }

        // Hunter Passive
        if (p.role === 'Hunter') {
          this.state.phase = 'HunterSelection';
          this.addLog(`The Hunter has 10 seconds to take someone down!`);
          this.broadcastState();
          this.startTimer(10, () => {
            if (this.state.phase === 'HunterSelection') {
              // Time's up, random kill if not chosen
              const aliveOthers = this.state.players.filter(p => p.isAlive && p.id !== lynchedId);
              if (aliveOthers.length > 0) {
                const target = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                target.isAlive = false;
                this.addLog(`The Hunter took ${target.displayName} down with them!`);
                
                // Grim Reaper Link
                if (this.state.linkedPlayers && this.state.linkedPlayers.includes(target.id)) {
                  const otherId = this.state.linkedPlayers.find(linkedId => linkedId !== target.id);
                  if (otherId) {
                    const otherP = this.state.players.find(player => player.id === otherId);
                    if (otherP && otherP.isAlive) {
                      otherP.isAlive = false;
                      this.addLog(`${otherP.displayName} died due to a soul link.`);
                    }
                  }
                }
              }
              this.continueAfterHunter();
            }
          });
          return;
        }
      }
    } else {
      this.addLog(`The town could not decide on a lynch.`);
    }

    // Traitor Passive Check
    const aliveMafia = this.state.players.filter(p => p.isAlive && p.alignment === 'Mafia').length;
    if (aliveMafia === 0) {
      this.state.players.filter(p => p.isAlive && p.role === 'Traitor').forEach(traitor => {
        traitor.alignment = 'Mafia';
        traitor.inbox.push({
          id: Math.random().toString(),
          text: `You have embraced your true allegiance. You are now Mafia.`,
          type: 'info',
          day: this.state.dayCount
        });
      });
    }

    // Reset votes
    this.state.players.forEach(p => p.voteTarget = undefined);

    if (this.checkWinCondition()) return;

    this.startNight();
  }

  public continueAfterHunter() {
    // Traitor Passive Check
    const aliveMafia = this.state.players.filter(p => p.isAlive && p.alignment === 'Mafia').length;
    if (aliveMafia === 0) {
      this.state.players.filter(p => p.isAlive && p.role === 'Traitor').forEach(traitor => {
        traitor.alignment = 'Mafia';
        traitor.inbox.push({
          id: Math.random().toString(),
          text: `You have embraced your true allegiance. You are now Mafia.`,
          type: 'info',
          day: this.state.dayCount
        });
      });
    }

    // Reset votes
    this.state.players.forEach(p => p.voteTarget = undefined);

    if (this.checkWinCondition()) return;

    this.startNight();
  }

  private startNight() {
    this.state.phase = 'Night';
    this.state.dayCount++;

    // Amnesiac Transformation
    if (this.state.firstDeadPlayerId) {
      const firstDead = this.state.players.find(p => p.id === this.state.firstDeadPlayerId);
      if (firstDead) {
        this.state.players.filter(p => p.isAlive && p.role === 'Amnesiac').forEach(amnesiac => {
          amnesiac.role = firstDead.role;
          amnesiac.alignment = firstDead.alignment;
          amnesiac.abilityUses = {};
          if (firstDead.role && ROLE_DEFINITIONS[firstDead.role]) {
            ROLE_DEFINITIONS[firstDead.role].abilities.forEach(ability => {
              if (ability.uses !== -1) {
                amnesiac.abilityUses![ability.id] = ability.uses;
              }
            });
          }
          amnesiac.inbox.push({
            id: Math.random().toString(),
            text: `You have remembered your past life. You are now ${firstDead.role}.`,
            type: 'info',
            day: this.state.dayCount
          });
        });
      }
    }

    this.simulateBotNightActions();
    this.startTimer(this.state.settings.nightDuration, () => this.resolveNight());
    this.broadcastState();
  }

  private checkWinCondition(): boolean {
    const alive = this.state.players.filter(p => p.isAlive);
    const mafiaCount = alive.filter(p => p.alignment === 'Mafia').length;
    const townCount = alive.filter(p => p.alignment === 'Town').length;
    const neutralCount = alive.filter(p => p.alignment === 'Neutral').length;
    const cultCount = alive.filter(p => p.alignment === 'Cult').length;
    const totalAlive = alive.length;

    if (totalAlive === 0) {
      this.state.winner = 'Town';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    // Cult Win
    if (cultCount === totalAlive) {
      this.state.winner = 'Cult';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    // Final 2 Neutral Wins
    if (totalAlive <= 2) {
      const remainingRoles = alive.map(p => p.role);
      const neutralWinners = ['Arsonist', 'Gambler', 'Occultist', 'Bounty Hunter', 'Witch', 'Grim Reaper'];
      for (const role of neutralWinners) {
        if (remainingRoles.includes(role as Role)) {
          this.state.winner = role as any;
          this.state.phase = 'End';
          this.broadcastState();
          return true;
        }
      }
    }

    // Berserker Win
    if (totalAlive === 2 && alive.some(p => p.role === 'Berserker')) {
      this.state.winner = 'Berserker';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    // Final Witness Win
    if (townCount === 1 && alive.some(p => p.role === 'Final Witness')) {
      this.state.winner = 'Final Witness';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    // Recluse Win
    if (alive.some(p => p.role === 'Recluse' && p.recluseNightsUntouched && p.recluseNightsUntouched >= 5)) {
      this.state.winner = 'Recluse';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    if (mafiaCount === 0 && neutralCount === 0 && cultCount === 0) {
      this.state.winner = 'Town';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    if (mafiaCount >= townCount + neutralCount + cultCount) {
      this.state.winner = 'Mafia';
      this.state.phase = 'End';
      this.broadcastState();
      return true;
    }

    return false;
  }

  private addLog(msg: string) {
    this.state.publicLogs.push(`[Day ${this.state.dayCount}] ${msg}`);
  }
}
