import { GAME_CONFIG } from '../game-config.js';
import { AUTHORED_LEVELS, WORLD_THEMES } from './level-data.js';

export function createLevel(levelNumber) {
  const number = Number(levelNumber);
  if (!Number.isInteger(number) || number < 1 || number > GAME_CONFIG.progression.totalLevels) {
    throw new RangeError('Level must be between 1 and 15');
  }
  const authored = AUTHORED_LEVELS[number - 1];
  if (!authored || authored.number !== number) throw new Error(`Missing authored layout for level ${number}`);
  const worldIndex = Math.floor((number - 1) / 3);
  const world = GAME_CONFIG.worlds[worldIndex];
  const platforms = authored.platforms.map(platform => ({ ...platform }));
  const collectibles = authored.pickups.map(([x,y,type], index) => ({
    id: `${type}-${number}-${index + 1}`, type: type === 'checkpoint' ? 'checkpoint' : type === 'life' ? 'life' : 'powerup',
    ...(type !== 'checkpoint' && type !== 'life' ? { powerUp: type } : {}), x, y
  }));
  const badgePlatform = platforms.filter(platform => platform.oneWay).at(Math.floor(platforms.filter(platform => platform.oneWay).length / 2));
  collectibles.push({ id: `badge-${number}`, type: 'badge', badgeId: number,
    x: badgePlatform.x + Math.floor(badgePlatform.w / 2) - 15, y: badgePlatform.y - 38 });
  const bossFloor = platforms.filter(platform => !platform.oneWay).at(-1);
  return {
    id: `level-${String(number).padStart(2, '0')}`, number,
    name: `${world.name} — Dive ${((number - 1) % 3) + 1}`,
    world, worldIndex: worldIndex + 1, width: GAME_CONFIG.physics.worldWidth,
    height: GAME_CONFIG.canvas.height, gravity: GAME_CONFIG.physics.gravity,
    platforms, hazards: authored.hazards.map(item => ({ ...item })),
    decorations: authored.decorations.map(item => ({ ...item })),
    enemySpawnPoints: authored.enemySpawnPoints.map(point => ({ ...point })),
    collectibles, start: { x: 80, y: GAME_CONFIG.physics.groundY - 48 },
    exit: { x: GAME_CONFIG.physics.worldWidth - 110, y: GAME_CONFIG.physics.groundY - 90, w: 70, h: 90 },
    boss: number % 3 === 0 ? { world: worldIndex + 1, id: world.bossId,
      arena: { x: bossFloor.x, y: GAME_CONFIG.physics.groundY, w: bossFloor.w, h: 210 } } : null,
    background: world.palette, theme: WORLD_THEMES[world.id]
  };
}

export const LEVELS = Object.freeze(Array.from({ length: GAME_CONFIG.progression.totalLevels }, (_, index) => createLevel(index + 1)));
