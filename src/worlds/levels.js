import { GAME_CONFIG } from '../game-config.js';

const ROUTES = [
  [[520,390,180],[900,330,170],[1320,390,190],[1780,310,180],[2260,370,180],[2740,300,190],[3260,380,180],[3740,310,190],[4220,370,180]],
  [[420,350,150],[760,420,170],[1120,310,170],[1510,390,160],[1900,290,180],[2320,410,170],[2720,320,180],[3150,390,170],[3570,280,180],[4020,380,180]],
  [[600,410,200],[1020,300,150],[1450,370,200],[1900,260,150],[2350,390,200],[2800,300,150],[3250,410,200],[3700,280,170],[4140,370,200]]
];

export function createLevel(levelNumber) {
  const number = Number(levelNumber);
  if (!Number.isInteger(number) || number < 1 || number > GAME_CONFIG.progression.totalLevels) {
    throw new RangeError('Level must be between 1 and 15');
  }
  const worldIndex = Math.floor((number - 1) / 3);
  const world = GAME_CONFIG.worlds[worldIndex];
  const route = ROUTES[(number - 1) % ROUTES.length];
  const platforms = [
    { id: 'seafloor', x: 0, y: GAME_CONFIG.physics.groundY, w: GAME_CONFIG.physics.worldWidth, h: 80, oneWay: false },
    ...route.map(([x, y, w], index) => ({
      id: `level-${number}-platform-${index + 1}`,
      x: Math.min(GAME_CONFIG.physics.worldWidth - w - 80, x + ((number - 1) % 3) * 28),
      y: Math.max(380, Math.min(430, y + ((number + index) % 2) * 18)),
      w, h: 18, oneWay: true
    }))
  ];
  const badgePlatform = platforms[1 + (number % (platforms.length - 1))];
  const badge = { id: `badge-${number}`, type: 'badge', badgeId: number, x: badgePlatform.x + Math.floor(badgePlatform.w / 2) - 15, y: badgePlatform.y - 38 };
  const collectibles = [
    badge,
    { id: `berry-${number}`, type: 'powerup', powerUp: 'sea-berry', x: 650 + (number % 3) * 35, y: 365 },
    { id: `krill-${number}`, type: 'powerup', powerUp: 'golden-krill', x: 2140, y: 365 },
    { id: `bubble-${number}`, type: 'powerup', powerUp: 'bubble-shell', x: 3540, y: 365 },
    { id: `life-${number}`, type: 'life', x: 4380, y: 420 },
    { id: `checkpoint-${number}`, type: 'checkpoint', x: 2450, y: 430 }
  ];
  return {
    id: `level-${String(number).padStart(2, '0')}`,
    number,
    name: `${world.name} — Dive ${((number - 1) % 3) + 1}`,
    world,
    worldIndex: worldIndex + 1,
    width: GAME_CONFIG.physics.worldWidth,
    height: GAME_CONFIG.canvas.height,
    gravity: GAME_CONFIG.physics.gravity,
    platforms,
    collectibles,
    start: { x: 80, y: GAME_CONFIG.physics.groundY - 48 },
    exit: { x: GAME_CONFIG.physics.worldWidth - 110, y: GAME_CONFIG.physics.groundY - 90, w: 70, h: 90 },
    boss: number % 3 === 0
      ? { world: worldIndex + 1, id: world.bossId, arena: { x: 3650, y: GAME_CONFIG.physics.groundY, w: 1050, h: 210 } }
      : null,
    background: world.palette
  };
}

export const LEVELS = Object.freeze(Array.from(
  { length: GAME_CONFIG.progression.totalLevels },
  (_, index) => createLevel(index + 1)
));
