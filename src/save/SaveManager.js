export const SAVE_VERSION = 1;
export const DEFAULT_SAVE_LIMITS = Object.freeze({ maxLives: 99, maxScore: 2_000_000_000, maxDeathCount: 2_000_000_000, maxLevels: 1000, maxGameplayBytes: 1_000_000 });
const POWER_UP_IDS = new Set(['sea-berry', 'golden-krill', 'bubble-shell']);
const isObject = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(v) && v >= min && v <= max;
const clone = value => JSON.parse(JSON.stringify(value));

/** Portable, manually transferable JSON save service. Browser APIs are used only by download/picker methods. */
export class SaveManager {
  constructor({ player = null, progression = null, lives = null, score = null, powerUps = null, checkpoints = null,
    profile = {}, getGameplayState = null, setGameplayState = null, totalLevels = null, limits = {} } = {}) {
    this.player = player; this.progression = progression; this.lives = lives; this.score = score;
    this.powerUps = powerUps; this.checkpoints = checkpoints; this.profile = profile;
    this.getGameplayState = getGameplayState; this.setGameplayState = setGameplayState;
    this.totalLevels = totalLevels ?? progression?.totalLevels ?? 25;
    this.limits = { ...DEFAULT_SAVE_LIMITS, ...limits };
  }
  getSaveVersion() { return SAVE_VERSION; }

  createSave(overrides = {}) {
    const progression = this.progression?.serialize?.() ?? this.progression?.getProgressionState?.() ?? defaultProgression(this.totalLevels);
    const lifeState = this.lives?.serialize?.() ?? { lives: 3, deathCount: 0, levelStart: { x: 80, y: 300 } };
    const scoreState = this.score?.serialize?.() ?? { score: 0, nextThreshold: 10000, awardedThresholds: [], threshold: 10000 };
    const powerState = this.powerUps?.serialize?.() ?? { active: null, protectionHits: 0 };
    const checkpoint = this.checkpoints?.serialize?.() ?? null;
    const profile = { name: this.profile?.name ?? 'Player', colour: this.profile?.colour ?? '#168AAD', characterType: this.profile?.characterType ?? this.player?.characterType ?? 'orca', badges: [...(this.profile?.badges ?? [])], ...(overrides.profile ?? {}) };
    const customGameplay = overrides.gameplayState ?? this.getGameplayState?.() ?? {};
    const gameplayState = { ...clone(customGameplay), player: customGameplay?.player ?? capturePlayer(this.player) };
    const save = {
      version: SAVE_VERSION, savedAt: new Date().toISOString(),
      player: { name: profile.name, colour: profile.colour, characterType: profile.characterType, badges: [...profile.badges] },
      difficulty: progression.difficulty ?? 'easy', cheatUnlocked: Boolean(progression.cheatUnlocked ?? this.profile?.cheatUnlocked ?? false),
      progression: {
        totalLevels: progression.totalLevels ?? this.totalLevels, currentLevel: progression.currentLevel ?? 1,
        unlockedLevels: clone(progression.unlockedLevels ?? [1]), completedLevels: clone(progression.completedLevels ?? {}),
        records: clone(progression.records ?? { easy: {}, hard: {} }), goldLevels: clone(progression.goldLevels ?? []),
        unlockedBosses: clone(progression.unlockedBosses ?? []), defeatedBosses: clone(progression.defeatedBosses ?? []),
        orcalordUnlocked: Boolean(progression.orcalordUnlocked)
      },
      score: scoreState.score, lives: lifeState.lives, deathCount: lifeState.deathCount,
      levelStart: clone(lifeState.levelStart ?? { x: 80, y: 300 }),
      activePowerUp: powerState.active ?? null, powerUpProtectionHits: powerState.protectionHits ?? 0,
      checkpoint, nextBonusLifeThreshold: scoreState.nextThreshold,
      awardedBonusLifeThresholds: clone(scoreState.awardedThresholds ?? []),
      gameplayState: clone(gameplayState)
    };
    const result = this.validateSave(save);
    if (!result.valid) throw new TypeError(`Cannot create invalid save: ${result.errors.join('; ')}`);
    return save;
  }

  validateSave(input) {
    const errors = [];
    const fail = message => errors.push(message);
    if (!isObject(input)) return { valid: false, errors: ['Save root must be a JSON object'] };
    if (input.version !== SAVE_VERSION) fail(`Unsupported save version: ${String(input.version)}`);
    if (typeof input.savedAt !== 'string' || !Number.isFinite(Date.parse(input.savedAt))) fail('savedAt must be a valid ISO date string');
    if (!isObject(input.player)) fail('player is required');
    else {
      if (typeof input.player.name !== 'string' || !input.player.name.trim() || input.player.name.length > 32) fail('player.name must be 1–32 characters');
      if (typeof input.player.colour !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(input.player.colour)) fail('player.colour must be a six-digit hex colour');
      if (input.player.characterType !== undefined && !['orca','raccoon','octopus'].includes(input.player.characterType)) fail('player.characterType is invalid');
      if (input.player.badges !== undefined && (!Array.isArray(input.player.badges) || input.player.badges.length > 15 || !input.player.badges.every(n => isInt(n,1,15)) || new Set(input.player.badges).size !== input.player.badges.length)) fail('player.badges must contain unique level numbers 1–15');
    }
    if (!['easy', 'hard'].includes(input.difficulty)) fail('difficulty must be easy or hard');
    if (typeof input.cheatUnlocked !== 'boolean') fail('cheatUnlocked must be boolean');
    const p = input.progression;
    if (!isObject(p)) fail('progression is required');
    else {
      const total = p.totalLevels;
      if (!isInt(total, 1, this.limits.maxLevels)) fail('progression.totalLevels is out of range');
      const maxLevel = isInt(total, 1, this.limits.maxLevels) ? total : this.totalLevels;
      if (!isInt(p.currentLevel, 1, maxLevel)) fail('progression.currentLevel is invalid');
      if (!Array.isArray(p.unlockedLevels) || !p.unlockedLevels.length || !p.unlockedLevels.every(n => isInt(n, 1, maxLevel)) || new Set(p.unlockedLevels).size !== p.unlockedLevels.length || !p.unlockedLevels.includes(1) || !p.unlockedLevels.includes(p.currentLevel)) fail('progression.unlockedLevels is inconsistent');
      if (!isObject(p.completedLevels)) fail('progression.completedLevels must be an object');
      else for (const [id, modes] of Object.entries(p.completedLevels)) {
        if (!/^[1-9]\d*$/.test(id) || Number(id) > maxLevel || !isObject(modes) || typeof modes.easy !== 'boolean' || typeof modes.hard !== 'boolean' || (!modes.easy && !modes.hard)) fail(`Invalid completed level entry: ${id}`);
        else if (!p.unlockedLevels?.includes(Number(id))) fail(`Completed level ${id} must be unlocked`);
      }
      if (!isObject(p.records) || !isObject(p.records.easy) || !isObject(p.records.hard)) fail('progression.records must contain easy and hard objects');
      else for (const mode of ['easy', 'hard']) for (const [id, record] of Object.entries(p.records[mode])) {
        if (!/^[1-9]\d*$/.test(id) || Number(id) > maxLevel || !isObject(record) || !isInt(record.completions, 1) || !isInt(record.bestScore, 0, this.limits.maxScore) || !(record.bestTime === null || (typeof record.bestTime === 'number' && Number.isFinite(record.bestTime) && record.bestTime >= 0))) fail(`Invalid ${mode} record for level ${id}`);
        else if (!p.completedLevels?.[id]?.[mode]) fail(`${mode} record for level ${id} has no matching completion`);
      }
      for (const field of ['goldLevels']) if (!Array.isArray(p[field]) || !p[field].every(n => isInt(n, 1, maxLevel)) || new Set(p[field]).size !== p[field].length) fail(`progression.${field} contains invalid level IDs`);
      if (Array.isArray(p.goldLevels)) for (const n of p.goldLevels) if (!p.completedLevels?.[n]?.hard) fail(`Gold level ${n} must have a Hard completion`);
      for (const field of ['unlockedBosses', 'defeatedBosses']) if (!Array.isArray(p[field]) || !p[field].every(s => typeof s === 'string' && s.trim() && s.length <= 80) || new Set(p[field]).size !== p[field].length) fail(`progression.${field} must contain unique boss IDs`);
      if (Array.isArray(p.defeatedBosses)) for (const id of p.defeatedBosses) if (!p.unlockedBosses?.includes(id)) fail(`Defeated boss ${id} must be unlocked`);
      if (typeof p.orcalordUnlocked !== 'boolean') fail('progression.orcalordUnlocked must be boolean');
      if (p.difficulty !== undefined && p.difficulty !== input.difficulty) fail('Top-level and progression difficulty must match');
    }
    if (!isInt(input.score, 0, this.limits.maxScore)) fail('score is invalid');
    if (!isInt(input.lives, 0, this.limits.maxLives)) fail('lives is invalid');
    if (!isInt(input.deathCount, 0, this.limits.maxDeathCount)) fail('deathCount is invalid');
    if (!isObject(input.levelStart) || !Number.isFinite(input.levelStart.x) || !Number.isFinite(input.levelStart.y) || Math.abs(input.levelStart.x) > 1e7 || Math.abs(input.levelStart.y) > 1e7) fail('levelStart must contain finite world coordinates');
    if (input.activePowerUp !== null && !POWER_UP_IDS.has(input.activePowerUp)) fail('activePowerUp is unknown');
    if (!isInt(input.powerUpProtectionHits, 0, 1) || (input.activePowerUp === null && input.powerUpProtectionHits !== 0) || (input.activePowerUp !== null && input.powerUpProtectionHits !== 1)) fail('Power-up and protection-hit state is inconsistent');
    if (!isInt(input.nextBonusLifeThreshold, 10000, this.limits.maxScore + 10000) || input.nextBonusLifeThreshold % 10000 !== 0 || input.nextBonusLifeThreshold <= input.score) fail('nextBonusLifeThreshold must be the next 10,000-point boundary');
    if (!Array.isArray(input.awardedBonusLifeThresholds) || !input.awardedBonusLifeThresholds.every(n => isInt(n, 10000, this.limits.maxScore) && n % 10000 === 0 && n <= input.score) || new Set(input.awardedBonusLifeThresholds).size !== input.awardedBonusLifeThresholds.length) fail('awardedBonusLifeThresholds is invalid');
    if (Array.isArray(input.awardedBonusLifeThresholds) && isInt(input.score, 0, this.limits.maxScore)) {
      const expected = Array.from({ length: Math.floor(input.score / 10000) }, (_, i) => (i + 1) * 10000);
      if (expected.length !== input.awardedBonusLifeThresholds.length || expected.some(n => !input.awardedBonusLifeThresholds.includes(n))) fail('Awarded bonus-life thresholds do not match score milestones');
      if (input.nextBonusLifeThreshold !== (Math.floor(input.score / 10000) + 1) * 10000) fail('Next bonus-life threshold does not match score');
    }
    if (input.checkpoint !== null) {
      const c = input.checkpoint;
      if (!isObject(c) || !Number.isFinite(c.x) || !Number.isFinite(c.y) || (c.id !== null && c.id !== undefined && (typeof c.id !== 'string' || c.id.length > 100)) || (c.level !== null && c.level !== undefined && !isInt(c.level, 1, p?.totalLevels ?? this.totalLevels))) fail('checkpoint is invalid');
      else if (c.level != null && p?.currentLevel !== c.level) fail('checkpoint level must match current level');
    }
    if (isObject(input.gameplayState) && input.gameplayState.world !== undefined && input.gameplayState.world !== null) {
      const world = input.gameplayState.world;
      if (!isObject(world) || !isInt(world.level, 1, this.totalLevels) || !input.progression?.unlockedLevels?.includes(world.level) ||
          typeof world.elapsed !== 'number' || !Number.isFinite(world.elapsed) || world.elapsed < 0 ||
          typeof world.cameraX !== 'number' || !Number.isFinite(world.cameraX) || world.cameraX < 0 ||
          typeof world.completed !== 'boolean' || !Array.isArray(world.collectibles) ||
          !isObject(world.encounter)) fail('gameplayState.world is invalid');
      else {
        if (world.collectibles.length > 100 || !world.collectibles.every(item =>
          isObject(item) && typeof item.id === 'string' && typeof item.collected === 'boolean')) fail('gameplayState.world.collectibles is invalid');
        const encounter = world.encounter;
        if (!Array.isArray(encounter.enemies) || !Array.isArray(encounter.projectiles) ||
            !Array.isArray(encounter.particles) || !Array.isArray(encounter.bosses) ||
            encounter.enemies.length > 250 || encounter.projectiles.length > 500 ||
            encounter.particles.length > 1000 || encounter.bosses.length > 1) fail('gameplayState.world.encounter is invalid');
      }
    }
    if (!isObject(input.gameplayState)) fail('gameplayState must be an object');
    else {
      if (input.gameplayState.player !== undefined && input.gameplayState.player !== null) {
        const ps = input.gameplayState.player;
        if (!isObject(ps)) fail('gameplayState.player must be an object or null');
        else {
          for (const key of ['x', 'y', 'vx', 'vy', 'rotation']) if (ps[key] !== undefined && (typeof ps[key] !== 'number' || !Number.isFinite(ps[key]) || Math.abs(ps[key]) > 1e7)) fail(`gameplayState.player.${key} is invalid`);
          if (ps.grounded !== undefined && typeof ps.grounded !== 'boolean') fail('gameplayState.player.grounded must be boolean');
          for (const key of ['facing', 'animationState', 'characterType']) if (ps[key] !== undefined && typeof ps[key] !== 'string') fail(`gameplayState.player.${key} must be a string`);
        }
      }
      try { const encoded = JSON.stringify(input.gameplayState); if (encoded === undefined || encoded.length > this.limits.maxGameplayBytes) fail('gameplayState is not serializable or exceeds size limit'); }
      catch { fail('gameplayState is not JSON-serializable'); }
    }
    return { valid: errors.length === 0, errors };
  }

  applySave(input) {
    const validation = this.validateSave(input);
    if (!validation.valid) return { applied: false, errors: validation.errors };
    // Validation is complete before any live state is touched.
    const previous = this.#captureRollback();
    try {
      const p = input.progression;
      this.progression?.deserialize?.({ ...clone(p), difficulty: input.difficulty, cheatUnlocked: input.cheatUnlocked });
      this.lives?.deserialize?.({ lives: input.lives, deathCount: input.deathCount, levelStart: clone(input.levelStart) });
      this.score?.deserialize?.({ score: input.score, nextThreshold: input.nextBonusLifeThreshold, awardedThresholds: input.awardedBonusLifeThresholds, threshold: 10000 });
      this.checkpoints?.deserialize?.(input.checkpoint);
      this.powerUps?.deserialize?.({ active: input.activePowerUp, protectionHits: input.powerUpProtectionHits });
      if (input.gameplayState.player && this.player) restorePlayer(this.player, input.gameplayState.player);
      if (this.profile) { this.profile.name = input.player.name; this.profile.colour = input.player.colour; this.profile.characterType = input.player.characterType ?? 'orca'; this.profile.badges = [...(input.player.badges ?? [])]; this.profile.cheatUnlocked = input.cheatUnlocked; }
      this.setGameplayState?.(clone(input.gameplayState));
      return { applied: true, version: input.version };
    } catch (error) {
      this.#restoreRollback(previous);
      return { applied: false, errors: [`Save could not be applied; previous state restored: ${error.message}`] };
    }
  }

  async loadSave(source) {
    try {
      let text;
      if (typeof source === 'string') text = source;
      else if (source && typeof source.text === 'function') text = await source.text();
      else throw new TypeError('loadSave expects JSON text or a File-like object');
      let parsed;
      try { parsed = JSON.parse(text); } catch { return { loaded: false, errors: ['Malformed JSON: unable to parse save file'] }; }
      const result = this.applySave(parsed);
      return { loaded: result.applied, ...(!result.applied ? { errors: result.errors } : { version: result.version }) };
    } catch (error) { return { loaded: false, errors: [error.message] }; }
  }

  downloadSave(save = this.createSave(), filename = 'orca-adventure-save.json') {
    const validation = this.validateSave(save);
    if (!validation.valid) throw new TypeError(`Refusing to download invalid save: ${validation.errors.join('; ')}`);
    if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof Blob === 'undefined') throw new Error('downloadSave requires a browser environment');
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    }
    // Do not revoke the object URL in the same task as click(): browsers may
    // not have consumed the download yet, which can produce an empty/no file.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { downloaded: true, filename };
  }

  async pickAndLoadSave({ accept = '.json,application/json' } = {}) {
    if (typeof document === 'undefined') throw new Error('pickAndLoadSave requires a browser environment');
    return new Promise(resolve => {
      const picker = document.createElement('input'); picker.type = 'file'; picker.accept = accept; picker.hidden = true;
      picker.addEventListener('change', async () => { const file = picker.files?.[0]; resolve(file ? await this.loadSave(file) : { loaded: false, cancelled: true }); picker.remove(); }, { once: true });
      picker.addEventListener('cancel', () => { resolve({ loaded: false, cancelled: true }); picker.remove(); }, { once: true });
      document.body.appendChild(picker); picker.click();
    });
  }

  #captureRollback() {
    return { progression: this.progression?.serialize?.(), lives: this.lives?.serialize?.(), score: this.score?.serialize?.(), powerUps: this.powerUps?.serialize?.(), checkpoints: this.checkpoints?.serialize?.(), profile: this.profile ? clone(this.profile) : null, player: capturePlayer(this.player), gameplayState: this.getGameplayState?.() ?? null };
  }
  #restoreRollback(s) {
    try { if (s.progression) this.progression?.deserialize?.(s.progression); if (s.lives) this.lives?.deserialize?.(s.lives); if (s.score) this.score?.deserialize?.(s.score); if (s.checkpoints !== undefined) this.checkpoints?.deserialize?.(s.checkpoints); if (s.powerUps) this.powerUps?.deserialize?.(s.powerUps); if (s.profile && this.profile) Object.assign(this.profile, s.profile); if (s.player && this.player) restorePlayer(this.player, s.player); if (s.gameplayState !== null) this.setGameplayState?.(s.gameplayState); } catch { /* rollback is best-effort; validation prevents ordinary invalid-state failures */ }
  }
}
function defaultProgression(totalLevels) { return { totalLevels, currentLevel: 1, difficulty: 'easy', unlockedLevels: [1], completedLevels: {}, records: { easy: {}, hard: {} }, goldLevels: [], unlockedBosses: [], defeatedBosses: [], orcalordUnlocked: false }; }

function capturePlayer(player) {
  if (!player) return null;
  const state = {};
  for (const key of ['x', 'y', 'vx', 'vy', 'grounded', 'facing', 'rotation', 'animationState', 'characterType']) {
    const value = player[key];
    if (value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value))) state[key] = value;
  }
  return state;
}
function restorePlayer(player, state) {
  if (!isObject(state)) throw new TypeError('gameplayState.player must be an object');
  for (const key of ['x', 'y', 'vx', 'vy', 'rotation']) if (state[key] !== undefined && (typeof state[key] !== 'number' || !Number.isFinite(state[key]) || Math.abs(state[key]) > 1e7)) throw new TypeError(`Invalid player ${key}`);
  for (const key of ['grounded']) if (state[key] !== undefined && typeof state[key] !== 'boolean') throw new TypeError(`Invalid player ${key}`);
  for (const key of ['facing', 'animationState']) if (state[key] !== undefined && typeof state[key] !== 'string') throw new TypeError(`Invalid player ${key}`);
  if (state.characterType !== undefined && !['orca','raccoon','octopus'].includes(state.characterType)) throw new TypeError('Invalid player characterType');
  // Never merge untrusted save objects into the live player. In particular,
  // Object.assign would honor an own "__proto__" property from parsed JSON.
  const allowedKeys = ['x', 'y', 'vx', 'vy', 'grounded', 'facing', 'rotation', 'animationState', 'characterType'];
  for (const key of allowedKeys) {
    if (Object.prototype.hasOwnProperty.call(state, key)) player[key] = state[key];
  }
  if (state.characterType && player.animation) player.animation.characterType = state.characterType;
}
