# Agent 8 — Save and Load
**Owns:** `src/save/`

Implement portable JSON Save/Load. Save version, player name/colour, difficulty, cheat status, unlocked/completed levels, Easy/Hard records, permanent Gold achievements, boss progression, score, lives, death counter, active power-up, checkpoint, next bonus-life threshold, and relevant current gameplay state.

Save generates a downloadable JSON file. Load uses a file picker.

Validate version, required fields, numbers, level IDs, power-up IDs, malformed JSON, and progression consistency. Reject invalid files safely; never crash or create impossible state. Optional local storage may supplement but must not replace manual JSON.

Expose documented APIs equivalent to `createSave`, `downloadSave`, `loadSave`, `validateSave`, `applySave`, and `getSaveVersion`.

Deliver source, docs, automated round-trip tests, malformed-file tests, and incompatible-version tests.
