/** Level unlocks, difficulty records, permanent Hard Gold, boss gates, and endgame unlock. */
export class ProgressionManager {
  constructor({ events = null, totalLevels = 25, bossUnlocks = {}, orcalordRequiresAllHard = true, state = null } = {}) {
    this.events = events; this.totalLevels = Math.max(1, Math.floor(totalLevels)); this.bossUnlocks = bossUnlocks;
    this.orcalordRequiresAllHard = orcalordRequiresAllHard;
    this.currentLevel = 1; this.difficulty = 'easy';
    this.unlockedLevels = [1]; this.completedLevels = {};
    this.records = { easy: {}, hard: {} }; this.goldLevels = [];
    this.unlockedBosses = []; this.defeatedBosses = []; this.orcalordUnlocked = false;
    if (state) this.deserialize(state);
  }
  #emit(name, data) { this.events?.emit?.(name, data); }
  setDifficulty(value, { reason = null } = {}) {
    if (!['level-complete', 'all-lives-lost', 'initialization'].includes(reason)) {
      throw new Error('Difficulty may change only after level completion or all-lives-lost recovery');
    }
    const difficulty = String(value).toLowerCase();
    if (!['easy', 'hard'].includes(difficulty)) throw new RangeError('Difficulty must be easy or hard');
    this.difficulty = difficulty;
    this.#emit('difficulty.changed', { difficulty });
    return difficulty;
  }
  setCurrentLevel(level) {
    const n = Math.floor(Number(level));
    if (!Number.isInteger(n) || n < 1 || n > this.totalLevels) throw new RangeError('Level is outside configured progression');
    if (!this.unlockedLevels.includes(n)) throw new Error(`Level ${n} is locked`);
    this.currentLevel = n; return n;
  }
  completeLevel({ level = this.currentLevel, difficulty = this.difficulty, score = 0, time = null, bossId = null } = {}) {
    const n = Math.floor(Number(level));
    if (!Number.isInteger(n) || n < 1 || n > this.totalLevels) throw new RangeError('Invalid completed level');
    const mode = String(difficulty).toLowerCase();
    if (!['easy', 'hard'].includes(mode)) throw new RangeError('Difficulty must be easy or hard');
    const points = Math.max(0, Math.floor(Number(score) || 0));
    const previous = this.completedLevels[n] ?? { easy: false, hard: false };
    previous[mode] = true; this.completedLevels[n] = previous;
    const record = this.records[mode][n] ?? { completions: 0, bestScore: 0, bestTime: null };
    record.completions += 1; record.bestScore = Math.max(record.bestScore, points);
    if (Number.isFinite(time) && time >= 0) record.bestTime = record.bestTime === null ? time : Math.min(record.bestTime, time);
    this.records[mode][n] = record;
    const newlyUnlocked = [];
    if (n < this.totalLevels && !this.unlockedLevels.includes(n + 1)) { this.unlockedLevels.push(n + 1); newlyUnlocked.push(n + 1); }
    if (mode === 'hard' && !this.goldLevels.includes(n)) { this.goldLevels.push(n); this.#emit('level.goldEarned', { level: n, permanent: true }); }
    const bosses = this.bossUnlocks[n] ?? this.bossUnlocks[String(n)] ?? [];
    for (const boss of (Array.isArray(bosses) ? bosses : [bosses])) if (boss && !this.unlockedBosses.includes(String(boss))) {
      this.unlockedBosses.push(String(boss)); this.#emit('boss.unlocked', { bossId: String(boss), level: n });
    }
    if (bossId && !this.defeatedBosses.includes(String(bossId))) this.defeatedBosses.push(String(bossId));
    const hardComplete = Object.values(this.completedLevels).filter(v => v.hard).length;
    if (!this.orcalordUnlocked && (this.orcalordRequiresAllHard ? hardComplete >= this.totalLevels : mode === 'hard' && n === this.totalLevels)) {
      this.orcalordUnlocked = true; this.#emit('orcalord.unlocked', { permanent: true });
    }
    const result = { level: n, difficulty: mode, score: points, newlyUnlocked, gold: this.goldLevels.includes(n), orcalordUnlocked: this.orcalordUnlocked, unlockedBosses: [...this.unlockedBosses] };
    this.#emit('level.completed', result);
    return result;
  }
  unlockAllLevels() {
    const before = new Set(this.unlockedLevels);
    this.unlockedLevels = Array.from({ length: this.totalLevels }, (_, i) => i + 1);
    const newlyUnlocked = this.unlockedLevels.filter(n => !before.has(n));
    this.#emit('levels.unlockedAll', { levels: [...this.unlockedLevels] });
    return newlyUnlocked;
  }
  unlockBoss(bossId) {
    const id = String(bossId);
    if (!id.trim()) throw new TypeError('bossId is required');
    if (!this.unlockedBosses.includes(id)) this.unlockedBosses.push(id);
    this.#emit('boss.unlocked', { bossId: id, manual: true }); return id;
  }
  defeatBoss(bossId) {
    const id = String(bossId);
    if (!this.unlockedBosses.includes(id)) throw new Error(`Boss ${id} is locked`);
    if (!this.defeatedBosses.includes(id)) this.defeatedBosses.push(id);
    this.#emit('boss.defeated', { bossId: id }); return true;
  }
  getProgressionState() { return this.serialize(); }
  serialize() {
    return { totalLevels: this.totalLevels, currentLevel: this.currentLevel, difficulty: this.difficulty,
      unlockedLevels: [...this.unlockedLevels], completedLevels: structuredCloneSafe(this.completedLevels),
      records: structuredCloneSafe(this.records), goldLevels: [...this.goldLevels],
      unlockedBosses: [...this.unlockedBosses], defeatedBosses: [...this.defeatedBosses], orcalordUnlocked: this.orcalordUnlocked };
  }
  deserialize(data = {}) {
    this.totalLevels = Math.max(1, Math.floor(Number(data.totalLevels) || this.totalLevels));
    this.currentLevel = Math.min(this.totalLevels, Math.max(1, Math.floor(Number(data.currentLevel) || 1)));
    this.difficulty = data.difficulty === 'hard' ? 'hard' : 'easy';
    this.unlockedLevels = [...new Set([1, ...(data.unlockedLevels ?? []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= this.totalLevels)])].sort((a,b)=>a-b);
    this.completedLevels = structuredCloneSafe(data.completedLevels ?? {});
    this.records = { easy: structuredCloneSafe(data.records?.easy ?? {}), hard: structuredCloneSafe(data.records?.hard ?? {}) };
    this.goldLevels = [...new Set((data.goldLevels ?? []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= this.totalLevels))].sort((a,b)=>a-b);
    this.unlockedBosses = [...new Set((data.unlockedBosses ?? []).map(String))];
    this.defeatedBosses = [...new Set((data.defeatedBosses ?? []).map(String))];
    this.orcalordUnlocked = Boolean(data.orcalordUnlocked);
    return this.getProgressionState();
  }
}
function structuredCloneSafe(value) { return JSON.parse(JSON.stringify(value)); }
