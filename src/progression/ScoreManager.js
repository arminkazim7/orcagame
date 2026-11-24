/** Score milestones award exactly one extra life per crossed 10,000-point boundary. */
export class ScoreManager {
  constructor({ lives = null, events = null, state = null, threshold = 10000 } = {}) {
    this.lives = lives; this.events = events; this.threshold = threshold;
    this.score = 0; this.nextThreshold = threshold; this.awardedThresholds = [];
    if (state) this.deserialize(state);
  }
  #emit(name, data) { this.events?.emit?.(name, data); }
  addScore(points) {
    const amount = Number(points);
    if (!Number.isFinite(amount) || amount < 0) throw new RangeError('Score must be a finite non-negative number');
    const before = this.score; this.score += Math.floor(amount);
    const awards = [];
    while (this.score >= this.nextThreshold) {
      const milestone = this.nextThreshold;
      if (!this.awardedThresholds.includes(milestone)) {
        this.awardedThresholds.push(milestone);
        this.lives?.grantLife?.(1, 'score-milestone');
        awards.push(milestone);
        this.#emit('life.scoreMilestone', { threshold: milestone, lives: this.lives?.getLives?.() ?? null });
      }
      this.nextThreshold += this.threshold;
    }
    const result = { score: this.score, added: this.score - before, awards, nextThreshold: this.nextThreshold, progressToNext: this.score % this.threshold };
    this.#emit('score.changed', result);
    return result;
  }
  getScore() { return this.score; }
  getMilestoneProgress() { return { score: this.score, nextThreshold: this.nextThreshold, remaining: Math.max(0, this.nextThreshold - this.score), progress: this.score % this.threshold, threshold: this.threshold }; }
  serialize() { return { score: this.score, nextThreshold: this.nextThreshold, awardedThresholds: [...this.awardedThresholds], threshold: this.threshold }; }
  deserialize(data = {}) {
    this.score = Math.max(0, Math.floor(Number(data.score) || 0));
    this.awardedThresholds = [...new Set((data.awardedThresholds ?? []).map(Number).filter(n => Number.isInteger(n) && n > 0))].sort((a,b)=>a-b);
    this.nextThreshold = Math.max(this.threshold, Math.floor(Number(data.nextThreshold) || (Math.floor(this.score / this.threshold) + 1) * this.threshold));
    while (this.nextThreshold <= this.score) this.nextThreshold += this.threshold;
    return this.serialize();
  }
}
