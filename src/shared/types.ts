export type Role =
  | 'Healer'
  | 'Cop'
  | 'Silencer'
  | 'Bodyguard'
  | 'Framer'
  | 'Vigilante'
  | 'Jester'
  | 'Lookout'
  | 'Roleblocker'
  | 'Consigliere'
  | 'Mafia'
  | 'Town'
  | 'Neutral'
  | 'Protector'
  | 'Arsonist'
  | 'Cult Leader'
  | 'Detective'
  | 'Traitor'
  | 'Amnesiac'
  | 'Timekeeper'
  | 'Broker'
  | 'Double'
  | 'Archivist'
  | 'Reanimator'
  | 'Pacifist'
  | 'Tinkerer'
  | 'Saboteur'
  | 'Gambler'
  | 'Occultist'
  | 'Cull'
  | 'Echo'
  | 'Mender'
  | 'Town Saboteur'
  | 'Bounty Hunter'
  | 'Caretaker'
  | 'Switchblade'
  | 'Warden'
  | 'Berserker'
  | 'Beacon'
  | 'Witch'
  | 'Grim Reaper'
  | 'Maskmaker'
  | 'Confessor'
  | 'Thief'
  | 'Oracle Apprentice'
  | 'Executioner'
  | 'Toxicologist'
  | 'Sage'
  | 'Prophet'
  | 'Hunter'
  | 'Locksmith'
  | 'Beacon of Silence'
  | 'Recluse'
  | 'Final Witness';

export type Alignment = 'Town' | 'Mafia' | 'Neutral' | 'Cult';

export interface Player {
  id: string; // Socket ID
  displayName: string;
  avatar?: string;
  isHost: boolean;
  isReady: boolean;
  role?: Role;
  alignment?: Alignment;
  isAlive: boolean;
  isSilenced: boolean;
  inbox: InboxMessage[];
  voteTarget?: string; // ID of the player they are voting for
  isBot?: boolean;
  botPersonality?: string;
  stats?: PlayerStats;
  actionLocked?: boolean; // If they confirmed their night action
  // Role-specific state
  disabledAbilities?: boolean;
  doubleEffect?: boolean;
  copiedAbility?: AbilityDef;
  wardId?: string;
  bountyTargetId?: string;
  prophetGuesses?: number;
  recluseNightsUntouched?: number;
  echoAction?: NightAction;
  executionerTargetId?: string;
  silenceImmuneNights?: number;
  abilityUses?: Record<string, number>;
  copiedRole?: Role;
  copiedAlignment?: Alignment;
  caretakerInherited?: boolean;
  grimReaperLinked?: boolean;
  hunterKilled?: boolean;
  timekeeperUsed?: boolean;
}

export interface PlayerStats {
  correctVotes: number;
  daysSurvived: number;
  suspicionReceived: number;
}

export interface InboxMessage {
  id: string;
  text: string;
  type: 'info' | 'action' | 'result' | 'prompt';
  resultCategory?: 'success' | 'no_event' | 'blocked' | 'immune' | 'invalid';
  promptData?: any;
  day?: number;
}

export type GamePhase = 'Lobby' | 'RoleReveal' | 'Day' | 'Night' | 'HunterSelection' | 'End';

export interface GameSettings {
  mode: 'Quick' | 'Casual' | 'Ranked' | 'Practice';
  maxPlayers: number;
  
  // Timing
  roleRevealDuration: number;
  allowTapToCloseEarly: boolean;
  dayDuration: number;
  nightDuration: number;
  autoSkipNight: boolean;
  
  // Voting
  anonymousVotes: boolean;
  tieBehavior: 'NoLynch' | 'Random' | 'Revote';
  
  // Death
  revealOnDeath: 'Role' | 'Alignment' | 'None';
  
  // Roles
  enableNeutrals: boolean;
  allowDuplicates: boolean;
  enabledRoles: Partial<Record<Role, number>>;
  customMode: boolean;
  
  // Bots
  fillWithBots: boolean;
  botDifficulty: 'Easy' | 'Medium' | 'Hard';
  practiceRole?: Role | 'Random';

  // Communication
  allowMafiaDayChat: boolean;
}

export interface GameState {
  code: string;
  phase: GamePhase;
  players: Player[];
  settings: GameSettings;
  timerEnd: number | null;
  dayCount: number;
  publicLogs: string[];
  winner?: Alignment | 'Jester' | 'Arsonist' | 'Executioner' | 'Occultist' | 'Bounty Hunter' | 'Witch' | 'Grim Reaper' | 'Recluse' | 'Final Witness' | 'Berserker';
  mafiaKillVotes: Record<string, string>; // playerId -> targetId
  votingComplete?: boolean;
  
  // Universal Framework State
  moderatorLog: string[];
  dousedPlayers: string[];
  cultMembers: string[];
  snapshots: string[]; // JSON stringified GameState
  linkedPlayers: [string, string] | null;
  mafiaKillLimit: number;
  lastNightActions: NightAction[];
  firstDeadPlayerId?: string;
}

export interface NightAction {
  playerId: string;
  role: Role;
  targetId?: string;
  targetId2?: string; // For abilities that require two targets (Broker, Maskmaker, Grim Reaper)
  actionType: string;
}

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  type: string;
  uses: number; // -1 for unlimited
  priority: number; // Lower is higher priority (1: block, 2: protect, 3: kill, 4: investigate, etc.)
  targetRequired: boolean;
  secondTargetRequired?: boolean;
  isMafiaSharedKill?: boolean;
  successChance?: number;
  backfireChance?: number;
}

export const ROLE_DEFINITIONS: Record<Role, { name: string, alignment: Alignment, description: string[], winCondition: string, icon: string, maxAbilitiesPerNight: number, abilities: AbilityDef[], passiveEffects?: string[] }> = {
  Healer: { 
    name: 'Healer', alignment: 'Town', description: ['Choose one player to protect each night.', 'If attacked, they survive.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Shield', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'heal', name: 'Heal', description: 'Protect a player from being killed tonight.', type: 'protect', uses: -1, priority: 2, targetRequired: true }]
  },
  Cop: { 
    name: 'Cop', alignment: 'Town', description: ['Investigate a player each night.', 'Learn if they are Town, Mafia, or Neutral.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Search', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'investigate', name: 'Investigate', description: 'Learn a player\'s alignment.', type: 'investigate', uses: -1, priority: 4, targetRequired: true }]
  },
  Silencer: { 
    name: 'Silencer', alignment: 'Mafia', description: ['Silence one player each night.', 'They cannot chat the next day.'], winCondition: 'Equal or outnumber the Town.', icon: 'MicOff', maxAbilitiesPerNight: 2,
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'silence', name: 'Silence', description: 'Silence a player for the next day.', type: 'silence', uses: -1, priority: 4, targetRequired: true }
    ]
  },
  Bodyguard: { 
    name: 'Bodyguard', alignment: 'Town', description: ['If Mafia attacks someone, you can sacrifice yourself to save them.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'UserX', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'guard', name: 'Guard', description: 'Protect a player. If they are attacked, you die instead.', type: 'protect', uses: -1, priority: 2, targetRequired: true }]
  },
  Framer: { 
    name: 'Framer', alignment: 'Mafia', description: ['Frame a player each night.', 'They appear as Mafia to the Cop.'], winCondition: 'Equal or outnumber the Town.', icon: 'PenTool', maxAbilitiesPerNight: 2,
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'frame', name: 'Frame', description: 'Frame a player to appear as Mafia.', type: 'frame', uses: -1, priority: 4, targetRequired: true }
    ]
  },
  Vigilante: { 
    name: 'Vigilante', alignment: 'Neutral', description: ['Attempt to kill a player.', '75% success, 25% chance to kill yourself.'], winCondition: 'Survive to the final two players.', icon: 'Crosshair', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'shoot', name: 'Shoot', description: 'Attempt to kill a player.', type: 'kill', uses: 3, priority: 3, targetRequired: true, successChance: 0.75, backfireChance: 0.25 }]
  },
  Jester: { 
    name: 'Jester', alignment: 'Neutral', description: ['Act suspicious.', 'Get yourself lynched by the Town.'], winCondition: 'Get lynched during the day.', icon: 'Smile', maxAbilitiesPerNight: 0,
    abilities: []
  },
  Lookout: { 
    name: 'Lookout', alignment: 'Town', description: ['Watch a player each night.', 'Learn what types of roles visited them.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Eye', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'watch', name: 'Watch', description: 'See who visits a player tonight.', type: 'watch', uses: -1, priority: 4, targetRequired: true }]
  },
  Roleblocker: { 
    name: 'Roleblocker', alignment: 'Town', description: ['Block a player each night.', 'Their night action will fail.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Ban', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'block', name: 'Block', description: 'Prevent a player from using their ability tonight.', type: 'block', uses: -1, priority: 1, targetRequired: true }]
  },
  Consigliere: { 
    name: 'Consigliere', alignment: 'Mafia', description: ['Investigate a player each night.', 'Learn their exact role.'], winCondition: 'Equal or outnumber the Town.', icon: 'Briefcase', maxAbilitiesPerNight: 2,
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'investigate_exact', name: 'Investigate', description: 'Learn a player\'s exact role.', type: 'investigate', uses: -1, priority: 4, targetRequired: true }
    ]
  },
  Mafia: { 
    name: 'Mafia', alignment: 'Mafia', description: ['Vote with other Mafia to kill a player each night.'], winCondition: 'Equal or outnumber the Town.', icon: 'Skull', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true }]
  },
  Town: { 
    name: 'Town', alignment: 'Town', description: ['Find and lynch the Mafia.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Users', maxAbilitiesPerNight: 0,
    abilities: []
  },
  Neutral: { 
    name: 'Neutral', alignment: 'Neutral', description: ['Survive.'], winCondition: 'Survive.', icon: 'User', maxAbilitiesPerNight: 0,
    abilities: []
  },
  Protector: {
    name: 'Protector', alignment: 'Town', description: ['Protect target from harmful actions.', 'If ANY action targets them, you are revealed next day.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Shield', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'protect_reveal', name: 'Protect', description: 'Protect a player. If they are targeted, your identity is revealed.', type: 'protect', uses: -1, priority: 2, targetRequired: true }]
  },
  Arsonist: {
    name: 'Arsonist', alignment: 'Neutral', description: ['Douse players in fuel.', 'Ignite to kill all doused players.'], winCondition: 'Survive to the final two players.', icon: 'Flame', maxAbilitiesPerNight: 1,
    abilities: [
      { id: 'douse', name: 'Douse', description: 'Douse a player in fuel.', type: 'douse', uses: -1, priority: 4, targetRequired: true },
      { id: 'ignite', name: 'Ignite', description: 'Kill all doused players.', type: 'ignite', uses: 1, priority: 3, targetRequired: false }
    ]
  },
  'Cult Leader': {
    name: 'Cult Leader', alignment: 'Neutral', description: ['Convert one player per night to the Cult.'], winCondition: 'If all living players are cult, Cult wins.', icon: 'Users', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'convert', name: 'Convert', description: 'Convert a player to the Cult.', type: 'convert', uses: -1, priority: 4, targetRequired: true }]
  },
  Detective: {
    name: 'Detective', alignment: 'Town', description: ['Two-time super report on a player.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Search', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'super_investigate', name: 'Super Investigate', description: 'Learn all actions involving this player.', type: 'investigate', uses: 2, priority: 5, targetRequired: true }]
  },
  Traitor: {
    name: 'Traitor', alignment: 'Town', description: ['Appears Town. If all Mafia die, you become Mafia.'], winCondition: 'Eliminate all Mafia and hostile Neutrals (initially).', icon: 'User', maxAbilitiesPerNight: 0,
    passiveEffects: ['Appears Town to investigations', 'Becomes Mafia if all Mafia die'],
    abilities: []
  },
  Amnesiac: {
    name: 'Amnesiac', alignment: 'Neutral', description: ['You have no active ability.', 'When the first player dies, you will remember who you are and take their role.'], winCondition: 'Survive.', icon: 'HelpCircle', maxAbilitiesPerNight: 0,
    abilities: []
  },
  Timekeeper: {
    name: 'Timekeeper', alignment: 'Town', description: ['One-time Rewind.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Clock', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'rewind', name: 'Rewind', description: 'Rewind the game to the start of the previous day.', type: 'rewind', uses: 1, priority: 0, targetRequired: false }]
  },
  Broker: {
    name: 'Broker', alignment: 'Neutral', description: ['Swap two players\' night results.'], winCondition: 'Survive.', icon: 'Repeat', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'swap_results', name: 'Swap Results', description: 'Swap the night action targets of two players.', type: 'swap', uses: -1, priority: 1, targetRequired: true, secondTargetRequired: true }]
  },
  Double: {
    name: 'Double', alignment: 'Neutral', description: ['Copies target\'s ability for the next night.'], winCondition: 'Survive.', icon: 'Copy', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'copy', name: 'Copy', description: 'Copy a player\'s ability for tomorrow night.', type: 'copy', uses: -1, priority: 4, targetRequired: true }]
  },
  Archivist: {
    name: 'Archivist', alignment: 'Town', description: ['Views previous night role interactions WITHOUT names.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Book', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'view_logs', name: 'View Logs', description: 'View anonymous interactions from last night.', type: 'investigate', uses: 1, priority: 5, targetRequired: false }]
  },
  Reanimator: {
    name: 'Reanimator', alignment: 'Mafia', description: ['Revives dead Mafia role ability for one night only.'], winCondition: 'Equal or outnumber the Town.', icon: 'Zap', maxAbilitiesPerNight: 2,
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'reanimate', name: 'Reanimate', description: 'Revive a dead Mafia ability for tonight.', type: 'reanimate', uses: 1, priority: 1, targetRequired: false }
    ]
  },
  Pacifist: {
    name: 'Pacifist', alignment: 'Town', description: ['Protect self + visitor from kills. Becomes Vanilla Town after.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Heart', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'pacify', name: 'Pacify', description: 'Protect yourself and anyone who visits you.', type: 'protect', uses: 1, priority: 2, targetRequired: false }]
  },
  Tinkerer: {
    name: 'Tinkerer', alignment: 'Town', description: ['Double target\'s ability output.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Wrench', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'tinker', name: 'Tinker', description: 'Double a player\'s ability effect.', type: 'buff', uses: 1, priority: 1, targetRequired: true }]
  },
  Saboteur: {
    name: 'Saboteur', alignment: 'Mafia', description: ['Permanently disable target\'s main ability.'], winCondition: 'Equal or outnumber the Town.', icon: 'XCircle', maxAbilitiesPerNight: 2,
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'sabotage', name: 'Sabotage', description: 'Permanently disable a player\'s ability.', type: 'block', uses: 1, priority: 1, targetRequired: true }
    ]
  },
  Gambler: {
    name: 'Gambler', alignment: 'Neutral', description: ['Four random actions with different success rates.'], winCondition: 'Survive to the final two players.', icon: 'Dice', maxAbilitiesPerNight: 1,
    abilities: [
      { id: 'gamble_info', name: 'Gamble: Info', description: 'High success chance.', type: 'investigate', uses: -1, priority: 4, targetRequired: true, successChance: 0.8 },
      { id: 'gamble_heal', name: 'Gamble: Heal', description: 'Medium success chance.', type: 'protect', uses: -1, priority: 2, targetRequired: true, successChance: 0.5 },
      { id: 'gamble_silence', name: 'Gamble: Silence', description: 'Low success chance.', type: 'silence', uses: -1, priority: 4, targetRequired: true, successChance: 0.3 },
      { id: 'gamble_kill', name: 'Gamble: Kill', description: 'Very low success chance.', type: 'kill', uses: -1, priority: 3, targetRequired: true, successChance: 0.1 }
    ]
  },
  Occultist: {
    name: 'Occultist', alignment: 'Neutral', description: ['Reveal roles of all living players publicly. Self dies.'], winCondition: 'If alive among final 2 after reveal.', icon: 'Eye', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'reveal_all', name: 'Reveal All', description: 'Reveal all roles publicly, but you die.', type: 'reveal', uses: 1, priority: 5, targetRequired: false }]
  },
  Cull: {
    name: 'Cull', alignment: 'Mafia', description: ['If marked player lynched, Mafia gain extra kill next night.'], winCondition: 'Equal or outnumber the Town.', icon: 'Scissors', maxAbilitiesPerNight: 2,
    passiveEffects: ['Extra kill if marked player is lynched'],
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'mark', name: 'Mark', description: 'Mark a player. If they are lynched, Mafia gets an extra kill.', type: 'mark', uses: -1, priority: 4, targetRequired: true }
    ]
  },
  Echo: {
    name: 'Echo', alignment: 'Neutral', description: ['Apply targeted action back at source next night.'], winCondition: 'Survive.', icon: 'Repeat', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'echo', name: 'Echo', description: 'Apply the action that targeted you last night back at the source.', type: 'echo', uses: 1, priority: 1, targetRequired: false }]
  },
  Mender: {
    name: 'Mender', alignment: 'Town', description: ['Restore one consumed ability use to target.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Wrench', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'mend', name: 'Mend', description: 'Restore an ability use to a player.', type: 'buff', uses: -1, priority: 1, targetRequired: true }]
  },
  'Town Saboteur': {
    name: 'Town Saboteur', alignment: 'Town', description: ['Cancels one Mafia action.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'XCircle', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'cancel_mafia', name: 'Cancel Mafia', description: 'Cancel one Mafia action tonight.', type: 'block', uses: 1, priority: 1, targetRequired: false }]
  },
  'Bounty Hunter': {
    name: 'Bounty Hunter', alignment: 'Neutral', description: ['Assigns bounty. If bounty target dies, unlock upgrade.'], winCondition: 'Survive to the final two players.', icon: 'Target', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'assign_bounty', name: 'Assign Bounty', description: 'Assign a bounty to a player.', type: 'mark', uses: 1, priority: 4, targetRequired: true }]
  },
  Caretaker: {
    name: 'Caretaker', alignment: 'Town', description: ['Select ward. If ward dies, gain ward’s main ability.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Heart', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'select_ward', name: 'Select Ward', description: 'Select a ward. If they die, you gain their ability.', type: 'mark', uses: 1, priority: 4, targetRequired: true }]
  },
  Switchblade: {
    name: 'Switchblade', alignment: 'Neutral', description: ['Target a role type. Kill current holder of that role.'], winCondition: 'Survive.', icon: 'Crosshair', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'kill_role', name: 'Kill Role', description: 'Kill the player holding a specific role.', type: 'kill', uses: 1, priority: 3, targetRequired: true }] // Target will be a role string in UI
  },
  Warden: {
    name: 'Warden', alignment: 'Town', description: ['Locks player: Cannot act, cannot be visited.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Lock', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'lockdown', name: 'Lockdown', description: 'Lock a player. They cannot act or be visited.', type: 'block', uses: -1, priority: 1, targetRequired: true }]
  },
  Berserker: {
    name: 'Berserker', alignment: 'Neutral', description: ['If last neutral: Auto win. Gains night kill.'], winCondition: 'Survive as the last Neutral.', icon: 'Zap', maxAbilitiesPerNight: 1,
    passiveEffects: ['Gains night kill if last Neutral alive'],
    abilities: [{ id: 'berserk_kill', name: 'Berserk Kill', description: 'Kill a player (only if last Neutral).', type: 'kill', uses: -1, priority: 3, targetRequired: true }]
  },
  Beacon: {
    name: 'Beacon', alignment: 'Town', description: ['Double target\'s ability effect for one night.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Sun', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'beacon_buff', name: 'Beacon', description: 'Double a player\'s ability effect.', type: 'buff', uses: 1, priority: 1, targetRequired: true }]
  },
  Witch: {
    name: 'Witch', alignment: 'Neutral', description: ['Flip or block target\'s action.'], winCondition: 'Survive to the final two players.', icon: 'Moon', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'hex', name: 'Hex', description: 'Block or alter a player\'s action.', type: 'block', uses: -1, priority: 1, targetRequired: true }]
  },
  'Grim Reaper': {
    name: 'Grim Reaper', alignment: 'Neutral', description: ['Link two players. If one dies, other dies instantly.'], winCondition: 'Survive to the final two players.', icon: 'Skull', maxAbilitiesPerNight: 2,
    abilities: [
      { id: 'bind_1', name: 'Bind 1', description: 'Select the first player to link.', type: 'mark', uses: 1, priority: 4, targetRequired: true },
      { id: 'bind_2', name: 'Bind 2', description: 'Select the second player to link.', type: 'mark', uses: 1, priority: 4, targetRequired: true }
    ]
  },
  Maskmaker: {
    name: 'Maskmaker', alignment: 'Mafia', description: ['Swap two players\' night results before resolution.'], winCondition: 'Equal or outnumber the Town.', icon: 'User', maxAbilitiesPerNight: 3,
    abilities: [
      { id: 'mafia_kill', name: 'Mafia Kill', description: 'Vote on a target for the Mafia to kill.', type: 'kill', uses: -1, priority: 3, targetRequired: true, isMafiaSharedKill: true },
      { id: 'swap_1', name: 'Swap 1', description: 'Select the first player to swap results.', type: 'swap', uses: -1, priority: 1, targetRequired: true },
      { id: 'swap_2', name: 'Swap 2', description: 'Select the second player to swap results.', type: 'swap', uses: -1, priority: 1, targetRequired: true }
    ]
  },
  Confessor: {
    name: 'Confessor', alignment: 'Town', description: ['Force private alignment reveal from target.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Book', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'confess', name: 'Confess', description: 'Force a player to reveal their alignment to you.', type: 'investigate', uses: -1, priority: 4, targetRequired: true }]
  },
  Thief: {
    name: 'Thief', alignment: 'Neutral', description: ['Steal ability copy for one night.'], winCondition: 'Survive.', icon: 'Briefcase', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'steal', name: 'Steal', description: 'Steal a copy of a player\'s ability.', type: 'copy', uses: -1, priority: 4, targetRequired: true }]
  },
  'Oracle Apprentice': {
    name: 'Oracle Apprentice', alignment: 'Town', description: ['Ask server yes/no: "Is X Mafia?"'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Eye', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'ask_oracle', name: 'Ask Oracle', description: 'Ask if a player is Mafia.', type: 'investigate', uses: 1, priority: 4, targetRequired: true }]
  },
  Executioner: {
    name: 'Executioner', alignment: 'Neutral', description: ['Win if assigned target is lynched.'], winCondition: 'Assigned target is lynched.', icon: 'Crosshair', maxAbilitiesPerNight: 0,
    abilities: []
  },
  Toxicologist: {
    name: 'Toxicologist', alignment: 'Town', description: ['Checks if target was harmed last night.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Search', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'check_harm', name: 'Check Harm', description: 'Check if a player was attacked last night.', type: 'investigate', uses: -1, priority: 4, targetRequired: true }]
  },
  Sage: {
    name: 'Sage', alignment: 'Town', description: ['Publicly reveal one role.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'BookOpen', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'public_reveal', name: 'Public Reveal', description: 'Publicly reveal a player\'s role.', type: 'reveal', uses: 1, priority: 5, targetRequired: true }]
  },
  Prophet: {
    name: 'Prophet', alignment: 'Town', description: ['Predict who dies next night. If correct twice, gain power.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Eye', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'predict_death', name: 'Predict Death', description: 'Predict who will die tonight.', type: 'mark', uses: -1, priority: 5, targetRequired: true }]
  },
  Hunter: {
    name: 'Hunter', alignment: 'Town', description: ['If lynched: Instantly kill one target.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Crosshair', maxAbilitiesPerNight: 0,
    passiveEffects: ['If lynched, can kill one player'],
    abilities: []
  },
  Locksmith: {
    name: 'Locksmith', alignment: 'Town', description: ['Publicly reveal target\'s ability.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'Lock', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'reveal_ability', name: 'Reveal Ability', description: 'Publicly reveal a player\'s ability.', type: 'reveal', uses: 1, priority: 5, targetRequired: true }]
  },
  'Beacon of Silence': {
    name: 'Beacon of Silence', alignment: 'Town', description: ['Target immune to silencing for 2 nights.'], winCondition: 'Eliminate all Mafia and hostile Neutrals.', icon: 'MicOff', maxAbilitiesPerNight: 1,
    abilities: [{ id: 'prevent_silence', name: 'Prevent Silence', description: 'Make a player immune to silencing.', type: 'protect', uses: -1, priority: 2, targetRequired: true }]
  },
  Recluse: {
    name: 'Recluse', alignment: 'Neutral', description: ['If survives 5 nights untouched -> win. If targeted -> Vanilla Town.'], winCondition: 'Survive 5 nights untouched.', icon: 'User', maxAbilitiesPerNight: 0,
    passiveEffects: ['Wins if untouched for 5 nights', 'Becomes Town if targeted'],
    abilities: []
  },
  'Final Witness': {
    name: 'Final Witness', alignment: 'Town', description: ['If last Town alive: Auto win unless killed that night.'], winCondition: 'Eliminate all Mafia and hostile Neutrals (or survive as last Town).', icon: 'Eye', maxAbilitiesPerNight: 0,
    passiveEffects: ['Auto win if last Town alive and survives the night'],
    abilities: []
  }
};
