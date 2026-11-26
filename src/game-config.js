/** Canonical game configuration. Stable IDs are used by levels, bosses, saves and UI. */
export const GAME_CONFIG = Object.freeze({
  title: 'Orca Adventure', version: '0.1.0', stateVersion: 1,
  canvas: Object.freeze({ width: 960, height: 540, background: '#063b58' }),
  physics: Object.freeze({ gravity: 1550, worldWidth: 4800, worldHeight: 840, groundY: 480 }),
  progression: Object.freeze({ totalLevels: 15, startingLives: 3, scoreLifeThreshold: 10000, orcalordRequiresAllHard: true }),
  worlds: Object.freeze([
    Object.freeze({ id: 'coral-coast', name: 'Coral Coast', levels: [1,2,3], bossId: 'coral-warden', palette: ['#0b7189','#43c6ac'] }),
    Object.freeze({ id: 'sunken-ruins', name: 'Sunken Ruins', levels: [4,5,6], bossId: 'ruin-colossus', palette: ['#725a3a','#d6b36a'] }),
    Object.freeze({ id: 'deep-sea-trench', name: 'Deep Sea Trench', levels: [7,8,9], bossId: 'abyss-emperor', palette: ['#21134a','#7950a8'] }),
    Object.freeze({ id: 'kelp-forest', name: 'Kelp Forest', levels: [10,11,12], bossId: 'kelp-guardian', palette: ['#075b4a','#52b788'] }),
    Object.freeze({ id: 'arctic-ice-shelf', name: 'Arctic Ice Shelf', levels: [13,14,15], bossId: 'ice-leviathan', palette: ['#2b6f9c','#bde0fe'] })
  ]),
  bosses: Object.freeze(['coral-warden','ruin-colossus','abyss-emperor','kelp-guardian','ice-leviathan']),
  playerColours: Object.freeze(['classic','midnight','teal','rose','gold']),
  playableCharacters: Object.freeze([{ id:'orca', name:'Orca', description:'Balanced ocean swimmer', unlocked:true }, { id:'raccoon', name:'Raccoon', description:'Quick paws and agile movement', unlocked:true }, { id:'octopus', name:'Octopus', description:'Eight tentacles with fluid swimming animation', unlocked:true }]),
  powerUps: Object.freeze(['sea-berry','golden-krill','bubble-shell'])
});
export const BOSS_UNLOCKS = Object.freeze({ 3:['coral-warden'], 6:['ruin-colossus'], 9:['abyss-emperor'], 12:['kelp-guardian'], 15:['ice-leviathan'] });
